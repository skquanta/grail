// SPDX-License-Identifier: LicenseRef-Grail-Proprietary
// Copyright (c) 2026 Shashwot Bhattarai. All Rights Reserved.

import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const cpoWallet = process.env.SEED_TENANT_CPO_WALLET;
  if (!cpoWallet) {
    throw new Error(
      "SEED_TENANT_CPO_WALLET env var required. Run `npm run setup:solana` first.",
    );
  }
  const tenant = await prisma.tenant.upsert({
    where: { tenantId: "demo-cpo" },
    update: { cpoWallet, ratePerKwh: 0.15, feePercent: 0.75 },
    create: {
      tenantId: "demo-cpo",
      name: "Demo CPO",
      masterIdTag: "GRAIL_DEMO_CPO",
      cpoWallet,
      ratePerKwh: 0.15,
      feePercent: 0.75,
    },
  });
  console.log("Seeded tenant:", tenant);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
