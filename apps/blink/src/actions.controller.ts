// SPDX-License-Identifier: LicenseRef-Grail-Proprietary
// Copyright (c) 2026 Shashwot Bhattarai. All Rights Reserved.

import { Controller, Get } from "@nestjs/common";

@Controller()
export class ActionsController {
  @Get("actions.json")
  manifest() {
    return {
      rules: [{ pathPattern: "/v1/charge/**", apiPath: "/v1/charge/**" }],
    };
  }

  @Get("health")
  health() {
    return { status: "ok", service: "grail-blink", ts: new Date().toISOString() };
  }
}
