/** Minimal structured logger. Never pass secrets in `data`. */
type Level = "info" | "warn" | "error";

function emit(level: Level, msg: string, data?: Record<string, unknown>) {
  if (process.env.AWNING_QUIET === "1" && level === "info") return;
  const line = data ? `${msg} ${safeJson(data)}` : msg;
  if (level === "error") console.error(`[awning] ${line}`);
  else if (level === "warn") console.warn(`[awning] ${line}`);
  else console.log(`[awning] ${line}`);
}

function safeJson(v: unknown): string {
  try {
    return JSON.stringify(v, (_k, val) => (typeof val === "bigint" ? val.toString() : val));
  } catch {
    return String(v);
  }
}

export const log = {
  info: (msg: string, data?: Record<string, unknown>) => emit("info", msg, data),
  warn: (msg: string, data?: Record<string, unknown>) => emit("warn", msg, data),
  error: (msg: string, data?: Record<string, unknown>) => emit("error", msg, data),
};

const announced = new Set<string>();
/** Logs once per process that an adapter runs in MOCK mode. */
export function announceMock(adapter: string, why: string) {
  if (announced.has(adapter)) return;
  announced.add(adapter);
  emit("warn", `MOCK ${adapter}: ${why}`);
}

export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}
