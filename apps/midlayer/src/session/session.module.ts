// SPDX-License-Identifier: LicenseRef-Grail-Proprietary
// Copyright (c) 2026 Shashwot Bhattarai. All Rights Reserved.

import { Module } from "@nestjs/common";
import { SessionService } from "./session.service";
import { SessionController } from "./session.controller";
import { OcppModule } from "../ocpp/ocpp.module";
import { SolanaModule } from "../solana/solana.module";
import { SettlementModule } from "../settlement/settlement.module";

@Module({
  imports: [OcppModule, SolanaModule, SettlementModule],
  providers: [SessionService],
  controllers: [SessionController],
  exports: [SessionService],
})
export class SessionModule {}
