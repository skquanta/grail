// SPDX-License-Identifier: LicenseRef-Grail-Proprietary
// Copyright (c) 2026 Shashwot Bhattarai. All Rights Reserved.

import { Module } from "@nestjs/common";
import { OcppClient } from "./ocpp.client";

@Module({
  providers: [OcppClient],
  exports: [OcppClient],
})
export class OcppModule {}
