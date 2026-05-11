// SPDX-License-Identifier: LicenseRef-Grail-Proprietary
// Copyright (c) 2026 Shashwot Bhattarai. All Rights Reserved.

import { Controller, Get } from "@nestjs/common";

@Controller()
export class HealthController {
  @Get("health")
  ok() {
    return { status: "ok", service: "grail-midlayer", ts: new Date().toISOString() };
  }
}
