// SPDX-License-Identifier: LicenseRef-Grail-Proprietary
// Copyright (c) 2026 Shashwot Bhattarai. All Rights Reserved.

import { Module } from "@nestjs/common";
import { SettlementService } from "./settlement.service";
import { SolanaModule } from "../solana/solana.module";

@Module({
  imports: [SolanaModule],
  providers: [SettlementService],
  exports: [SettlementService],
})
export class SettlementModule {}
