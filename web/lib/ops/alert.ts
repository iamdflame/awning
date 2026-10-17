import { TwilioTelephony } from "../adapters/telephony";
import { env } from "../env";
import { errorMessage, log } from "../log";

/**
 * Pages a person for anything that needs a human: a refund that could not be
 * sent, an order settled but not recorded, provider resources left behind, a
 * business held after reports. Always logged; also posted to
 * AWNING_OPS_WEBHOOK_URL (Slack- or Discord-compatible JSON) and texted to
 * AWNING_OPERATOR_PHONE when Twilio is configured. Never throws.
 */
export type OperatorAlert = { subject: string; data: Record<string, unknown>; channels: string[] };

const g = globalThis as unknown as { __awningAlerts?: OperatorAlert[] };
/** Recent alerts in this process (tests and the health check read it). */
export const recentAlerts: OperatorAlert[] = (g.__awningAlerts ??= []);

function render(subject: string, data: Record<string, unknown>): string {
  const body = JSON.stringify(data, (_k, v) => (typeof v === "bigint" ? v.toString() : v));
  return `[Awning] ${subject}\n${body.length > 1500 ? `${body.slice(0, 1500)}…` : body}`;
}

export async function alertOperator(subject: string, data: Record<string, unknown> = {}): Promise<OperatorAlert> {
  log.error(`OPERATOR: ${subject}`, data);
  const channels = ["log"];
  const text = render(subject, data);
  const tasks: Promise<void>[] = [];

  const hook = process.env.AWNING_OPS_WEBHOOK_URL;
  if (hook && /^https:\/\//.test(hook)) {
    tasks.push(
      fetch(hook, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text, content: text.slice(0, 1900) }),
        signal: AbortSignal.timeout(4000),
        redirect: "error",
      }).then(
        (r) => {
          if (r.ok) channels.push("webhook");
          else log.warn("ops webhook rejected the alert", { status: r.status });
        },
        (err) => log.warn("ops webhook failed", { error: errorMessage(err) }),
      ),
    );
  }

  const phone = process.env.AWNING_OPERATOR_PHONE;
  const sid = env.twilioSid();
  const token = env.twilioToken();
  const from = env.twilioFrom();
  if (phone && sid && token && from) {
    tasks.push(
      new TwilioTelephony(sid, token)
        .sendSms(phone, from, `[Awning] ${subject}`.slice(0, 300))
        .then(
          () => void channels.push("sms"),
          (err) => log.warn("ops SMS failed", { error: errorMessage(err) }),
        ),
    );
  }

  await Promise.all(tasks);
  const alert = { subject, data, channels };
  recentAlerts.unshift(alert);
  recentAlerts.length = Math.min(recentAlerts.length, 50);
  return alert;
}
