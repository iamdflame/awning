import { env } from "../env";
import { log } from "../log";
import { TwilioTelephony } from "./telephony";
import type { Notifier, OrderNotice } from "./types";

function message(n: OrderNotice): string {
  const parts = [`${n.businessName}: new order — ${n.qty} × ${n.title}, ${n.totalUsd} USDC paid to your wallet.`];
  if (n.buyerContact) parts.push(`Contact: ${n.buyerContact}.`);
  if (n.buyerNote) parts.push(`Note: ${n.buyerNote.slice(0, 200)}`);
  if (n.tx) parts.push(`Tx: https://basescan.org/tx/${n.tx}`);
  return parts.join(" ");
}

/** SMS to the owner via Twilio, from the business's own number or TWILIO_FROM_NUMBER. */
export class TwilioSmsNotifier implements Notifier {
  readonly name = "twilio-sms";
  readonly mock = false;
  constructor(private readonly twilio: TwilioTelephony) {}
  async orderPaid(n: OrderNotice) {
    const from = n.fromNumber ?? env.twilioFrom();
    if (!n.ownerPhone || !from) return { delivered: false, channel: "none" };
    await this.twilio.sendSms(n.ownerPhone, from, message(n));
    return { delivered: true, channel: "sms" };
  }
}

export class LogNotifier implements Notifier {
  readonly name = "log-notifier";
  readonly mock = true;
  readonly sent: OrderNotice[] = [];
  async orderPaid(n: OrderNotice) {
    this.sent.push(n);
    log.info("MOCK notify owner", { text: message(n) });
    return { delivered: false, channel: "log" };
  }
}

export function makeNotifier(): Notifier {
  const sid = env.twilioSid();
  const token = env.twilioToken();
  if (sid && token) return new TwilioSmsNotifier(new TwilioTelephony(sid, token));
  return new LogNotifier();
}
