# Awning Privacy Policy

**Last updated: 2026-10-17**

This policy explains what personal data Awning ("we") collects when you open a business, buy from one, call one, or visit an Awning site, what we do with it, who else receives it, and how long we keep it.

## 1. What we collect

**When you plan or open a business (owners)**

- The sentence you or your agent wrote to describe the business.
- Your receiving wallet address (required).
- Your name, email address, phone number and country, if you or your agent provide them.
- The business we draft and you open: name, tagline, description, category, city, colours, offers and prices.
- For Pro businesses: the domain, phone number and identifiers of the services set up for you.
- Payment records for the opening: the paying wallet, amount and blockchain transaction.

**When you buy (buyers)**

- Your paying wallet address, the amount, and the blockchain transaction.
- What you bought and how many.
- A note and contact details, only if you or your agent include them.

**When you call a business (callers)**

- Our telephony provider receives your phone number and the call.
- When the business uses the AI receptionist, our voice provider processes the call audio to understand and answer you, and may record the call and keep a transcript.
- When the automated greeting answers instead, it does not listen to or record what you say. We store only that a call happened and the last four digits of the calling number.

**When you report a business**

- The business, your reason, the details you write and, if you give it, your contact.
- A daily identifier computed with a one-way function from your network (the first three parts of an IPv4 address, or the first three groups of an IPv6 address), used to limit reports per person. We do not store the IP address itself.

**When you visit a site**

- Standard request data processed by our hosting provider (such as IP address, browser and pages requested). Awning sites do not use advertising trackers.

## 2. How we use it

| Purpose | Data |
|---|---|
| Draft and open your business | your sentence, name, country |
| Pay sales to you | your wallet address |
| Send you order notifications by SMS | your phone number, the order details, the buyer's note and contact |
| Let buyers find and buy from your business | the business details you publish |
| Record and fulfil orders, and show them to the owner | order details, buyer note and contact |
| Answer calls for a business | call audio, and the business's details and offers |
| Prevent double charges, fraud and abuse | payment records, request data, reports |
| Keep Awning running and fix problems | server logs |

We do not sell personal data, and we do not use it for advertising.

## 3. What is public

The following is public on purpose, because a business has to be findable to sell:

- business name, description, category, city, offers and prices, storefront address and phone number;
- the owner's receiving wallet address (it is also in every payment request);
- openings and sales on `awning.sh/live`: business name, amount and blockchain transaction.

Blockchain transactions on Base are public and permanent. Anyone can see the paying and receiving wallets and the amount. We cannot remove them.

Draft businesses are visible to anyone who has their preview link, marked as previews and excluded from search engines.

## 4. Who else receives data

| Recipient | What | Why |
|---|---|---|
| The business owner | buyer's note, contact details, wallet and order | to fulfil the order |
| PayBox (MoonPay) | the requests your agent makes through the Awning plugin, and the payments you approve | it runs the plugin and your wallet |
| Anthropic, or the Vercel AI Gateway and the model provider it routes to | your sentence, name and country | to draft the business |
| The Vercel AI Gateway and its image model provider | a description of a generic scene for the business's category and its colours; no personal data | to generate illustrative storefront photos |
| Porkbun | the domain and its DNS records | to check, register and point the domain; domains are registered in Awning's account |
| Vercel | the domain; site request data | hosting |
| Twilio | phone numbers, calls, owner SMS content | phone lines and notifications |
| ElevenLabs | the business details in the receptionist's instructions; call audio and transcripts | AI receptionist |
| The x402 payment facilitator (PayAI by default) | the signed payment authorization | to verify and settle payments |
| Our database provider (Neon) | everything stored by Awning | storage |
| Authorities | what the law requires | legal obligations |

Each provider handles data under its own privacy terms. Your agent's host (for example Claude or ChatGPT) sees everything your agent sends to and receives from Awning, including your owner token, under that host's own policy.

## 5. Call recordings and transcripts

- Awning itself does not record calls.
- When a business's AI receptionist answers, ElevenLabs processes the audio and may keep recordings and transcripts according to its retention settings. Awning does not yet set a custom retention period for them, and owners cannot yet view them through Awning.
- We plan to announce at the start of each call that it is answered by an AI and may be recorded, and to set and publish a retention period. Until then, if you do not want to talk to an AI receptionist, hang up and contact the business another way.

## 6. How long we keep data

- We keep business, offer, order and payment records for as long as the business exists, so owners can see their sales and so payments are never processed twice.
- Plans that were never opened are kept with their draft. Awning does not yet delete them automatically.
- Server logs are kept by our hosting provider under its retention settings.
- Blockchain data is permanent and outside our control.

We are working on automatic deletion of unopened drafts and old logs, and will update this policy when it is in place.

## 7. Your choices and rights

- You choose what optional details (name, email, phone, buyer note, contact) you give us.
- You can ask us for a copy of your data, to correct it, or to delete it. Deleting a business removes its storefront and listing; we may keep payment records we need to prevent fraud or meet legal obligations. Blockchain data cannot be deleted.
- Depending on where you live, you may have further rights, including to object to processing or to complain to a data protection authority.

To make a request, contact us (section 10). We may need to confirm that you control the business, for example with its owner token or a signature from its wallet.

## 8. Security

Payment authorizations are checked before any work and settled only once. Owner tokens are derived, not stored. Secrets are kept in server configuration and never logged. Details are in our [threat model](../THREAT_MODEL.md). No system is perfectly secure; report problems as described in our [security policy](../../SECURITY.md).

## 9. Children

Awning is not for people under 18. We do not knowingly collect data from children.

## 10. Contact

Privacy questions and requests: email abuse@awning.sh with "Privacy" in the subject.

## 11. Changes

We will update the date at the top when this policy changes and give notice on `awning.sh` for material changes.
