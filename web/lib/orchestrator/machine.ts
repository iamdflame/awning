import type { StepRecord } from "../db/schema";
import { errorMessage, log } from "../log";

/**
 * A tiny saga runner: steps run in order with timing and a shared deadline;
 * when one fails, the completed steps are undone in reverse order.
 * Steps never move customer money (settlement happens after the saga).
 */

export type Step<S> = {
  name: string;
  /** Skip this step (recorded as "skipped"). */
  when?: (state: S) => boolean;
  run: (state: S, signal: AbortSignal) => Promise<void>;
  /** Undo for compensation. Omit for irreversible steps (they are ordered last). */
  undo?: (state: S, signal: AbortSignal) => Promise<void>;
  /** Max time for this step; capped by the remaining deadline. */
  timeoutMs?: number;
  /** Retries for transient failures. */
  retries?: number;
};

export type SagaResult =
  | {
      ok: true;
      steps: StepRecord[];
      /** Undo every completed step (used when settlement or the final commit fails). */
      undo: () => Promise<StepRecord[]>;
    }
  | { ok: false; steps: StepRecord[]; failedStep: string; reason: string };

async function withSignal<T>(ms: number, fn: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const ctl = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      const err = new Error(`timed out after ${ms}ms`);
      ctl.abort(err);
      reject(err);
    }, ms);
  });
  try {
    return await Promise.race([fn(ctl.signal), timeout]);
  } finally {
    clearTimeout(timer);
  }
}

export async function runSaga<S>(steps: Step<S>[], state: S, opts: { deadlineMs: number; label: string }): Promise<SagaResult> {
  const started = Date.now();
  const records: StepRecord[] = [];
  const done: Step<S>[] = [];
  for (const step of steps) {
    if (step.when && !step.when(state)) {
      records.push({ name: step.name, status: "skipped", ms: 0 });
      continue;
    }
    const remaining = opts.deadlineMs - (Date.now() - started);
    const t0 = performance.now();
    let error: unknown = null;
    if (remaining <= 250) {
      error = new Error("deadline reached before step started");
    } else {
      const budget = Math.min(step.timeoutMs ?? 10000, remaining);
      for (let attempt = 0; attempt <= (step.retries ?? 0); attempt++) {
        try {
          await withSignal(budget, (signal) => step.run(state, signal));
          error = null;
          break;
        } catch (err) {
          error = err;
          if (Date.now() - started > opts.deadlineMs - 500) break;
        }
      }
    }
    const ms = Math.round(performance.now() - t0);
    if (error) {
      const reason = errorMessage(error);
      records.push({ name: step.name, status: "failed", ms, detail: reason.slice(0, 300) });
      log.warn(`${opts.label}: step ${step.name} failed; compensating`, { reason });
      await compensate(done, state, records);
      return { ok: false, steps: records, failedStep: step.name, reason };
    }
    records.push({ name: step.name, status: "ok", ms });
    done.push(step);
  }
  return {
    ok: true,
    steps: records,
    undo: async () => {
      await compensate(done, state, records);
      return records;
    },
  };
}

/** Undo completed steps in reverse order; records each outcome on the step's row. */
export async function compensate<S>(done: Step<S>[], state: S, records: StepRecord[]) {
  for (const step of [...done].reverse()) {
    if (!step.undo) continue;
    const rec = records.find((r) => r.name === step.name && r.status === "ok");
    try {
      await withSignal(8000, (signal) => step.undo!(state, signal));
      if (rec) rec.status = "compensated";
    } catch (err) {
      if (rec) {
        rec.status = "compensation_failed";
        rec.detail = errorMessage(err).slice(0, 300);
      }
      log.error(`compensation of ${step.name} failed`, { error: errorMessage(err) });
    }
  }
}
