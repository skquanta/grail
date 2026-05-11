// SPDX-License-Identifier: LicenseRef-Grail-Proprietary
// Copyright (c) 2026 Shashwot Bhattarai. All Rights Reserved.

import { Module } from "@nestjs/common";
import { PrismaModule } from "./prisma/prisma.module";
import { SolanaModule } from "./solana/solana.module";
import { OcppModule } from "./ocpp/ocpp.module";
import { SessionModule } from "./session/session.module";
import { SettlementModule } from "./settlement/settlement.module";
import { WebhookModule } from "./webhook/webhook.module";
import { HealthController } from "./health.controller";

@Module({
  imports: [
    PrismaModule,
    SolanaModule,
    OcppModule,
    SettlementModule,
    SessionModule,
    WebhookModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
