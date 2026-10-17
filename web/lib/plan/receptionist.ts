import type { DraftOffer } from "../adapters/types";
import { stableIndex } from "../ids";

const NAMES = ["Ama", "Maya", "Leo", "Sam", "Nia", "Theo", "Zara", "Kofi", "Iris", "Jude", "Ada", "Remi"];

export function receptionistName(businessName: string): string {
  return NAMES[stableIndex(`receptionist:${businessName}`, NAMES.length)]!;
}

/** System prompt for the phone agent, built only from the business's own facts and offers. */
export function receptionistPrompt(b: {
  name: string;
  agentName: string;
  city: string | null;
  category: string;
  description: string;
  url: string;
  offers: DraftOffer[];
}): { systemPrompt: string; firstMessage: string } {
  const menu = b.offers.map((o) => `- ${o.title}: $${o.priceUsd.toFixed(2)} (${o.kind}). ${o.description}`).join("\n");
  const systemPrompt = [
    `You are ${b.agentName}, the phone receptionist for ${b.name}${b.city ? ` in ${b.city}` : ""} (${b.category}).`,
    "",
    `About the business: ${b.description}`,
    "",
    "What the business sells (prices in US dollars):",
    menu,
    "",
    `How to buy: on the website ${b.url}, or by asking any AI agent connected to PayBox to buy from "${b.name}" on Awning. Payments are in USDC and go straight to the owner.`,
    "",
    "How to behave:",
    "- This is a phone call: be warm, brief and clear. One or two sentences at a time.",
    "- Only state facts written above. If you are asked something you do not know (opening hours, address, stock, custom requests), say the owner will follow up, and offer to take a message.",
    "- To take a message, collect the caller's name, a phone number or email, and what they need, then read it back.",
    "- Never ask for or accept card numbers, bank details, passwords or wallet keys over the phone.",
    "- If the caller wants to buy, tell them the item and price, and that they can pay on the website or through their AI agent.",
  ].join("\n");
  const firstMessage = `Thanks for calling ${b.name}, this is ${b.agentName}. How can I help you today?`;
  return { systemPrompt, firstMessage };
}
