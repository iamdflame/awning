import { env } from "../env";
import { log } from "../log";
import { stableIndex } from "../ids";
import { ProviderError, excerpt, http, obj } from "./http";
import type { BuyNumberInput, Telephony } from "./types";

const TWILIO = "https://api.twilio.com/2010-04-01";

/**
 * Twilio REST: AvailablePhoneNumbers (read-only search, done at plan time) and
 * IncomingPhoneNumbers (purchase / release). The voice webhook points at our
 * TwiML fallback; when ElevenLabs is configured it takes the number over.
 */
export class TwilioTelephony implements Telephony {
  readonly name = "twilio";
  readonly mock = false;
  constructor(
    private readonly sid: string,
    private readonly token: string,
  ) {}

  private headers(form = false) {
    const auth = Buffer.from(`${this.sid}:${this.token}`).toString("base64");
    return { authorization: `Basic ${auth}`, ...(form ? { "content-type": "application/x-www-form-urlencoded" } : {}) };
  }

  async search(country: string, signal?: AbortSignal): Promise<string[]> {
    const q = new URLSearchParams({ VoiceEnabled: "true", PageSize: "5" });
    const res = await http(`${TWILIO}/Accounts/${this.sid}/AvailablePhoneNumbers/${encodeURIComponent(country)}/Local.json?${q}`, {
      headers: this.headers(),
      signal,
      timeoutMs: 6000,
    });
    if (!res.ok) throw new ProviderError("twilio", `search ${country} failed (${res.status}): ${excerpt(res.text)}`, res.status);
    const list = obj(res.json).available_phone_numbers;
    return Array.isArray(list) ? list.map((n) => String(obj(n).phone_number)).filter((n) => n.startsWith("+")) : [];
  }

  async buy(input: BuyNumberInput, signal?: AbortSignal) {
    let candidates = input.candidates;
    if (!candidates.length) candidates = await this.search(input.country, signal);
    if (!candidates.length && input.country !== "US") candidates = await this.search("US", signal);
    let lastErr = "no numbers available";
    for (const number of candidates.slice(0, 3)) {
      const form = new URLSearchParams({ PhoneNumber: number, FriendlyName: input.friendlyName.slice(0, 64), VoiceUrl: input.voiceUrl, VoiceMethod: "POST" });
      if (input.smsUrl) form.set("SmsUrl", input.smsUrl);
      const res = await http(`${TWILIO}/Accounts/${this.sid}/IncomingPhoneNumbers.json`, {
        method: "POST",
        headers: this.headers(true),
        body: form.toString(),
        signal,
        timeoutMs: 8000,
      });
      if (res.ok) {
        const b = obj(res.json);
        return { sid: String(b.sid), number: String(b.phone_number) };
      }
      lastErr = `(${res.status}) ${excerpt(res.text)}`;
      // 400 = number was taken since the search; try the next candidate.
      if (res.status !== 400) break;
    }
    throw new ProviderError("twilio", `buy number failed: ${lastErr}`);
  }

  async release(sid: string, signal?: AbortSignal) {
    const res = await http(`${TWILIO}/Accounts/${this.sid}/IncomingPhoneNumbers/${encodeURIComponent(sid)}.json`, {
      method: "DELETE",
      headers: this.headers(),
      signal,
      timeoutMs: 8000,
    });
    if (!res.ok && res.status !== 404) throw new ProviderError("twilio", `release ${sid} failed (${res.status})`, res.status);
  }

  async sendSms(to: string, from: string, body: string): Promise<void> {
    const form = new URLSearchParams({ To: to, From: from, Body: body.slice(0, 1500) });
    const res = await http(`${TWILIO}/Accounts/${this.sid}/Messages.json`, {
      method: "POST",
      headers: this.headers(true),
      body: form.toString(),
      timeoutMs: 6000,
    });
    if (!res.ok) throw new ProviderError("twilio", `sms failed (${res.status}): ${excerpt(res.text)}`, res.status);
  }
}

/** Mock numbers use the reserved fictional 555-01xx range. */
export class MockTelephony implements Telephony {
  readonly name = "mock-telephony";
  readonly mock = true;
  readonly owned = new Map<string, string>();
  async search(country: string): Promise<string[]> {
    const start = stableIndex(country, 90);
    return [0, 1, 2].map((i) => `+1202555${String(100 + ((start + i) % 100)).padStart(4, "0")}`);
  }
  async buy(input: BuyNumberInput) {
    const owned = new Set(this.owned.values());
    const number =
      input.candidates.find((c) => !owned.has(c)) ?? `+1202555${String(100 + stableIndex(input.friendlyName, 100)).padStart(4, "0")}`;
    const sid = `PNmock${stableIndex(number + input.friendlyName, 1e9)}`;
    this.owned.set(sid, number);
    log.info("MOCK telephony bought number", { number });
    return { sid, number };
  }
  async release(sid: string) {
    this.owned.delete(sid);
  }
}

export function makeTelephony(): Telephony {
  const sid = env.twilioSid();
  const token = env.twilioToken();
  if (sid && token) return new TwilioTelephony(sid, token);
  return new MockTelephony();
}
