"use client";

import { useState } from "react";

const REASONS = [
  { id: "phishing", label: "Phishing: asks for passwords, codes, card numbers or wallet keys" },
  { id: "impersonation", label: "Pretends to be another company, a person or a government office" },
  { id: "scam", label: "Scam: took payment and did not deliver, or misleading offers" },
  { id: "prohibited", label: "Sells something prohibited (weapons, drugs, adult, gambling…)" },
  { id: "other", label: "Something else" },
] as const;

type State = { kind: "idle" } | { kind: "sending" } | { kind: "done"; message: string } | { kind: "error"; message: string };

export function ReportForm({ slug, name }: { slug: string; name: string | null }) {
  const [state, setState] = useState<State>({ kind: "idle" });

  async function submit(form: FormData) {
    setState({ kind: "sending" });
    const body = {
      slug: String(form.get("slug") ?? "").trim(),
      reason: String(form.get("reason") ?? "other"),
      details: String(form.get("details") ?? "").trim() || undefined,
      contact: String(form.get("contact") ?? "").trim() || undefined,
    };
    try {
      const res = await fetch("/v1/reports", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const data = (await res.json().catch(() => ({}))) as { message?: string };
      if (res.ok) setState({ kind: "done", message: data.message ?? "Thanks, we received your report." });
      else setState({ kind: "error", message: data.message ?? `Could not send the report (${res.status}).` });
    } catch {
      setState({ kind: "error", message: "Could not reach Awning. Check your connection and try again." });
    }
  }

  if (state.kind === "done") {
    return (
      <p role="status" className="report-done">
        {state.message}
      </p>
    );
  }

  return (
    <form action={submit} className="report-form">
      <label>
        Business
        <input name="slug" defaultValue={slug} required maxLength={80} placeholder="the name in its web address, e.g. ridge-roast" />
        {name ? <span className="muted small">{name}</span> : null}
      </label>
      <fieldset>
        <legend>What is wrong?</legend>
        {REASONS.map((r, i) => (
          <label key={r.id} className="radio">
            <input type="radio" name="reason" value={r.id} defaultChecked={i === 0} /> {r.label}
          </label>
        ))}
      </fieldset>
      <label>
        Details <span className="muted small">(optional)</span>
        <textarea name="details" maxLength={1000} rows={4} placeholder="What happened, links, the number that called you…" />
      </label>
      <label>
        Your email or phone <span className="muted small">(optional, only if you want a reply)</span>
        <input name="contact" maxLength={200} autoComplete="email" />
      </label>
      <button type="submit" disabled={state.kind === "sending"}>
        {state.kind === "sending" ? "Sending…" : "Send report"}
      </button>
      {state.kind === "error" ? (
        <p role="alert" className="report-error">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
