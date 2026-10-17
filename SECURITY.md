# Security policy

## Reporting a vulnerability

Report vulnerabilities privately by email to **abuse@awning.sh**, with "Security" in the subject.

Do not disclose a security problem publicly before we have fixed it.

Please include:

- what is affected (plugin, API endpoint, x402 endpoint, storefront host, phone line);
- steps to reproduce, with request and response excerpts;
- the impact you expect (for example, a payment settled twice, a charge without provisioning, another owner's data, a leaked secret);
- whether real funds, domains or phone numbers were involved.

Do not include anyone else's personal data, owner tokens or private keys in the report. If you obtained a secret by accident, tell us so we can rotate it, and do not use it.

We will acknowledge the report, keep you updated while we fix it, and credit you if you want.

## PayBox platform issues

Problems in PayBox itself (the plugin sandbox, brokered credentials, wallets, approvals, signing or x402 payment handling inside PayBox) belong to MoonPay. Report them privately to MoonPay through its official security disclosure channel, not here. If you are unsure which side a problem is on, report it to us privately and we will route it.

## Supported versions

| Component | Supported |
|---|---|
| `plugin/` | the latest version on `main` and the latest version published in PayBox (server version `1.0.0`) |
| `web/` | the latest version on `main` and the production deployment |

Older plugin versions that users still have installed in PayBox are fixed by publishing a new version; PayBox users must accept the update.

## Scope

In scope:

- the plugin in `plugin/`;
- the web app in `web/`: the `/v1/*` API, the `/x402/*` payment endpoints, the opening orchestrator, the voice webhook and storefront hosting;
- the deployments at `awning.sh`, `api.awning.sh` and `*.awning.sh`, and custom domains attached by Awning.

Out of scope:

- third-party services Awning uses (Porkbun, Vercel, Twilio, ElevenLabs, Anthropic, the x402 facilitator, Base and the USDC contract); report to them directly;
- PayBox (see above);
- content of individual businesses (report the business instead);
- volumetric denial of service, spam to our inboxes, social engineering of maintainers or providers, and physical attacks;
- findings that require a compromised device or a malicious browser extension.

## Testing rules

- Use your own wallets, your own businesses and small amounts. Prefer a local server with `AWNING_FACILITATOR_URL=mock` (see `web/README.md`), where no money moves.
- Do not access, change or delete other people's businesses, orders or data.
- Do not place calls or send messages to numbers you do not own.
- Do not register domains or buy numbers in bulk.
- Stop and report as soon as you can show impact.

We will not pursue good-faith research that follows these rules.

Known design risks and open gaps are documented in [docs/THREAT_MODEL.md](docs/THREAT_MODEL.md).
