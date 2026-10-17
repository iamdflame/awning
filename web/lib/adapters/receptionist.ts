import { env } from "../env";
import { log } from "../log";
import { stableIndex } from "../ids";
import { ProviderError, excerpt, http, obj } from "./http";
import type { Receptionist, ReceptionistSpec } from "./types";

const ELEVEN = "https://api.elevenlabs.io";

/**
 * ElevenLabs Conversational AI: one agent per business, prompt built from the
 * business facts and offers at plan time. The Twilio number is imported into
 * ElevenLabs with `agent_id`, which repoints the number's voice webhook.
 */
export class ElevenLabsReceptionist implements Receptionist {
  readonly name = "elevenlabs";
  readonly mock = false;
  constructor(
    private readonly apiKey: string,
    private readonly twilioSid: string | undefined,
    private readonly twilioToken: string | undefined,
    private readonly voiceId: string | undefined,
  ) {}

  private headers() {
    return { "xi-api-key": this.apiKey, "content-type": "application/json" };
  }

  async create(spec: ReceptionistSpec, signal?: AbortSignal) {
    const body = {
      name: `${spec.businessName} receptionist`.slice(0, 100),
      tags: ["awning"],
      conversation_config: {
        agent: {
          first_message: spec.firstMessage,
          language: "en",
          prompt: { prompt: spec.systemPrompt },
        },
        ...(this.voiceId ? { tts: { voice_id: this.voiceId } } : {}),
      },
    };
    const res = await http(`${ELEVEN}/v1/convai/agents/create`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(body),
      signal,
      timeoutMs: 10000,
    });
    const agentId = obj(res.json).agent_id;
    if (!res.ok || typeof agentId !== "string") throw new ProviderError("elevenlabs", `create agent failed (${res.status}): ${excerpt(res.text)}`, res.status);
    return { agentId };
  }

  async attachNumber(input: { agentId: string; number: string; label: string }, signal?: AbortSignal) {
    if (!this.twilioSid || !this.twilioToken) throw new ProviderError("elevenlabs", "Twilio credentials required to import a number");
    const res = await http(`${ELEVEN}/v1/convai/phone-numbers`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({
        phone_number: input.number,
        label: input.label.slice(0, 100),
        provider: "twilio",
        sid: this.twilioSid,
        token: this.twilioToken,
        agent_id: input.agentId,
      }),
      signal,
      timeoutMs: 10000,
    });
    const phoneId = obj(res.json).phone_number_id;
    if (!res.ok || typeof phoneId !== "string") throw new ProviderError("elevenlabs", `import number failed (${res.status}): ${excerpt(res.text)}`, res.status);
    return { phoneId };
  }

  async remove(input: { agentId?: string; phoneId?: string }, signal?: AbortSignal) {
    if (input.phoneId) {
      const r = await http(`${ELEVEN}/v1/convai/phone-numbers/${encodeURIComponent(input.phoneId)}`, { method: "DELETE", headers: this.headers(), signal, timeoutMs: 8000 });
      if (!r.ok && r.status !== 404) throw new ProviderError("elevenlabs", `delete number failed (${r.status})`, r.status);
    }
    if (input.agentId) {
      const r = await http(`${ELEVEN}/v1/convai/agents/${encodeURIComponent(input.agentId)}`, { method: "DELETE", headers: this.headers(), signal, timeoutMs: 8000 });
      if (!r.ok && r.status !== 404) throw new ProviderError("elevenlabs", `delete agent failed (${r.status})`, r.status);
    }
  }
}

/** Without ElevenLabs the Twilio number answers with our TwiML receptionist (/v1/voice/:slug). */
export class MockReceptionist implements Receptionist {
  readonly name = "mock-receptionist";
  readonly mock = true;
  readonly agents = new Set<string>();
  async create(spec: ReceptionistSpec) {
    const agentId = `agent_mock_${stableIndex(spec.businessName + spec.systemPrompt, 1e9)}`;
    this.agents.add(agentId);
    log.info("MOCK receptionist created", { business: spec.businessName });
    return { agentId };
  }
  async attachNumber(input: { agentId: string; number: string }) {
    return { phoneId: `phone_mock_${stableIndex(input.agentId + input.number, 1e9)}` };
  }
  async remove(input: { agentId?: string }) {
    if (input.agentId) this.agents.delete(input.agentId);
  }
}

export function makeReceptionist(): Receptionist {
  const key = env.elevenLabsKey();
  if (key) return new ElevenLabsReceptionist(key, env.twilioSid(), env.twilioToken(), env.elevenLabsVoiceId());
  return new MockReceptionist();
}
