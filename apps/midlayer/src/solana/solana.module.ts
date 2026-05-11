// SPDX-License-Identifier: LicenseRef-Grail-Proprietary
// Copyright (c) 2026 Shashwot Bhattarai. All Rights Reserved.

import { Module } from "@nestjs/common";
import { SolanaService } from "./solana.service";

@Module({
  providers: [SolanaService],
  exports: [SolanaService],
})
export class SolanaModule {}
