// SPDX-License-Identifier: LicenseRef-Grail-Proprietary
// Copyright (c) 2026 Shashwot Bhattarai. All Rights Reserved.

import { Module } from "@nestjs/common";
import { WebhookController } from "./webhook.controller";
import { SessionModule } from "../session/session.module";

@Module({
  imports: [SessionModule],
  controllers: [WebhookController],
})
export class WebhookModule {}
