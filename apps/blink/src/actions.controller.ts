// SPDX-License-Identifier: LicenseRef-Grail-Proprietary
// Copyright (c) 2026 Shashwot Bhattarai. All Rights Reserved.

import { Controller, Get } from "@nestjs/common";

@Controller()
export class ActionsController {

  // Phantom checks /actions.json first, then /.well-known/solana-actions.json
  @Get("actions.json")
  manifest() {
    return {
      rules: [
        { pathPattern: "/v1/charge/**", apiPath: "/v1/charge/**" },
      ],
    };
  }

  // Some wallets/validators check the well-known path too
  @Get(".well-known/solana-actions.json")
  wellKnownManifest() {
    return this.manifest();
  }

  @Get("health")
  health() {
    return { status: "ok", service: "grail-blink", ts: new Date().toISOString() };
  }
}