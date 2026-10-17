import { createHmac, timingSafeEqual } from "node:crypto";
import { apiUrl } from "@/lib/api";
import { env } from "@/lib/env";
import { log } from "@/lib/log";
import { getBusinessBySlug, offersFor } from "@/lib/services/businesses";
import { emitEvent } from "@/lib/services/events";
import { atomicToUsdString } from "@/lib/money";

export const dynamic = "force-dynamic";

function xml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** https://www.twilio.com/docs/usage/webhooks/webhooks-security */
function validTwilioSignature(url: string, params: URLSearchParams, signature: string | null, token: string): boolean {
  if (!signature) return false;
  const data = url + [...params.keys()].sort().map((k) => k + (params.get(k) ?? "")).join("");
  const expected = createHmac("sha1", token).update(data).digest("base64");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

function twiml(body: string): Response {
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><Response>${body}</Response>`, { headers: { "content-type": "text/xml; charset=utf-8" } });
}

/**
 * Twilio voice webhook: the receptionist used when no ElevenLabs agent is
 * attached to the number. Reads the business's own facts and offers.
 */
export async function POST(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const raw = await req.text();
  const params = new URLSearchParams(raw);
  const token = env.twilioToken();
  if (token && !validTwilioSignature(apiUrl(`/v1/voice/${slug}`), params, req.headers.get("x-twilio-signature"), token)) {
    log.warn("rejected voice webhook with bad Twilio signature", { slug });
    return new Response("forbidden", { status: 403 });
  }
  const b = await getBusinessBySlug(slug);
  if (!b || b.status !== "live") return twiml(`<Say>Sorry, this number is not in service yet. Goodbye.</Say><Hangup/>`);
  const offers = (await offersFor(b.id)).slice(0, 4);
  const agent = b.receptionistName ?? "the receptionist";
  const menu = offers.map((o) => `${o.title}, ${atomicToUsdString(o.priceAtomic).replace(/\.00$/, "")} dollars`).join(". ");
  const site = (b.domain && b.package === "pro" ? b.domain : `${b.slug}.${env.rootDomain()}`).replace(/\./g, " dot ");
  await emitEvent({ type: "call", slug: b.slug, name: b.name, data: { via: "twiml", from: params.get("From")?.slice(-4) ?? null } }).catch(() => undefined);
  return twiml(
    [
      `<Say voice="Polly.Joanna">Thanks for calling ${xml(b.name)}, this is ${xml(agent)}.</Say>`,
      `<Pause length="1"/>`,
      `<Say voice="Polly.Joanna">${xml(b.tagline)} Here is what we offer. ${xml(menu)}.</Say>`,
      `<Say voice="Polly.Joanna">You can order on our website, ${xml(site)}, or ask any AI agent with PayBox to buy from ${xml(b.name)} on Awning. Thanks for calling, goodbye.</Say>`,
    ].join(""),
  );
}
