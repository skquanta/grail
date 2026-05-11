// SPDX-License-Identifier: LicenseRef-Grail-Proprietary
// Copyright (c) 2026 Shashwot Bhattarai. All Rights Reserved.

import { Module } from "@nestjs/common";
import { ActionsController } from "./actions.controller";
import { ChargeController } from "./charge/charge.controller";
import { ChargeService } from "./charge/charge.service";
import { MidlayerClient } from "./midlayer.client";

@Module({
  controllers: [ActionsController, ChargeController],
  providers: [ChargeService, MidlayerClient],
})
export class AppModule {}
