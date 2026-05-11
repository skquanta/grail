<!-- SPDX-License-Identifier: LicenseRef-Grail-Proprietary -->
<!-- Copyright (c) 2026 Shashwot Bhattarai. All Rights Reserved. -->

# Grail — Blink-to-Grid (B2G) Protocol

A decentralized EV charging settlement rail. Bridges **Solana Actions (Blinks)** with **OCPP 1.6 (CitrineOS)**. A driver scans a QR, pays USDC via Phantom, and a real charger starts — no app, no registration, no roaming fees.

## Layout

```
grail/
├── apps/
│   ├── blink/          NestJS + Fastify — Solana Actions gateway (HTTPS, port 3000)
│   └── midlayer/       NestJS + Prisma — Orchestrator (private, port 3001)
├── packages/
│   └── b2g-protocol/   Open Session Grant schema (Apache 2.0)
├── infra/
│   ├── Dockerfile.*    Container builds for midlayer and blink
│   ├── docker-compose.yml   Grail services for EC2 (alongside CitrineOS)
│   ├── seed/                Master idTag + Subscription seed SQL
│   └── deploy/              EC2 bootstrap + runbook scripts
└── citrineos-core/     *not* committed — clone from github.com/skquanta/citrineos-core
```

## Setup

```bash
# 1. Install deps
npm install

# 2. Generate Solana escrow keypair + airdrop devnet SOL
npm run setup:solana
# Paste the printed values into apps/midlayer/.env and apps/blink/.env

# 3. (Locally) Run Blink for `dial.to` validation
cd apps/blink && npm run dev
```

For production / live demo: see `infra/deploy/EC2_DEPLOY.md`.

## License

Apps and infrastructure are proprietary — see [LICENSE](./LICENSE) and [NOTICE](./NOTICE).
The B2G protocol schema (`packages/b2g-protocol`) is Apache 2.0.
