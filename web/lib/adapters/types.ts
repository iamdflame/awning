import type { OfferKind, Palette } from "../db/schema";

export type DnsRecord = { type: "A" | "CNAME"; name: string; content: string };

export type DomainCheck = {
  domain: string;
  /** Only true when the registrar positively said the name can be registered via API. */
  available: boolean;
  /** First-year registration price in USD, e.g. "11.08". */
  priceUsd: string;
  /** Same price in integer cents, total for the minimum registration term. */
  cents: number;
  premium: boolean;
  /** Registry did not answer; neither available nor taken. */
  unresolved?: boolean;
  /** Already registered in our registrar account. */
  inAccount?: boolean;
};

export interface Registrar {
  readonly name: string;
  readonly mock: boolean;
  check(domains: string[], signal?: AbortSignal): Promise<DomainCheck[]>;
  /** Registers at exactly `cents`; must refuse if the registrar's current price differs. */
  register(domain: string, cents: number, idempotencyKey: string, signal?: AbortSignal): Promise<{ orderId: string; cents: number }>;
  setDns(domain: string, records: DnsRecord[], idempotencyKey: string, signal?: AbortSignal): Promise<{ ids: string[] }>;
}

export interface Hosting {
  readonly name: string;
  readonly mock: boolean;
  /** Attach apex + www to the project. Returns the names added (for undo). */
  addDomain(domain: string, signal?: AbortSignal): Promise<{ names: string[] }>;
  removeDomains(names: string[], signal?: AbortSignal): Promise<void>;
}

export type BuyNumberInput = {
  country: string;
  candidates: string[];
  friendlyName: string;
  voiceUrl: string;
  smsUrl?: string;
};

export interface Telephony {
  readonly name: string;
  readonly mock: boolean;
  /** Read-only search for purchasable local numbers (E.164). */
  search(country: string, signal?: AbortSignal): Promise<string[]>;
  buy(input: BuyNumberInput, signal?: AbortSignal): Promise<{ sid: string; number: string }>;
  release(sid: string, signal?: AbortSignal): Promise<void>;
}

export type ReceptionistSpec = { businessName: string; agentName: string; systemPrompt: string; firstMessage: string };

export interface Receptionist {
  readonly name: string;
  readonly mock: boolean;
  create(spec: ReceptionistSpec, signal?: AbortSignal): Promise<{ agentId: string }>;
  /** Connect a purchased Twilio number to the agent (the provider takes over the voice webhook). */
  attachNumber(input: { agentId: string; number: string; label: string }, signal?: AbortSignal): Promise<{ phoneId: string }>;
  remove(input: { agentId?: string; phoneId?: string }, signal?: AbortSignal): Promise<void>;
}

export type DraftInput = { sentence: string; ownerName?: string; country?: string };

export type DraftOffer = { title: string; description: string; priceUsd: number; kind: OfferKind };

export type BusinessDraft = {
  name: string;
  tagline: string;
  description: string;
  category: string;
  city: string | null;
  palette: Palette;
  offers: DraftOffer[];
};

export interface Drafter {
  readonly name: string;
  readonly mock: boolean;
  draft(input: DraftInput, signal?: AbortSignal): Promise<BusinessDraft>;
}

export type OrderNotice = {
  businessName: string;
  ownerPhone: string | null;
  fromNumber: string | null;
  title: string;
  qty: number;
  totalUsd: string;
  buyerContact: string | null;
  buyerNote: string | null;
  tx: string | null;
};

export interface Notifier {
  readonly name: string;
  readonly mock: boolean;
  orderPaid(notice: OrderNotice): Promise<{ delivered: boolean; channel: string }>;
}

export interface Refunder {
  readonly name: string;
  readonly mock: boolean;
  /** Sends USDC from the treasury back to `to`. Resolves only once the transfer is mined. */
  refund(input: { to: string; amountAtomic: bigint; reason: string }): Promise<{ tx: string }>;
}

export type Adapters = {
  registrar: Registrar;
  hosting: Hosting;
  telephony: Telephony;
  receptionist: Receptionist;
  drafter: Drafter;
  notifier: Notifier;
  refunder: Refunder;
};
