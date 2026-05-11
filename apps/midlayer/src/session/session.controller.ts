// SPDX-License-Identifier: LicenseRef-Grail-Proprietary
// Copyright (c) 2026 Shashwot Bhattarai. All Rights Reserved.

import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { SessionService } from "./session.service";
import { CryptoStartDto } from "./session.dto";

@Controller("internal/v1")
export class SessionController {
  constructor(private readonly sessions: SessionService) {}

  @Post("crypto-start")
  cryptoStart(@Body() dto: CryptoStartDto) {
    return this.sessions.cryptoStart(dto);
  }

  @Get("session/:id")
  async getSession(@Param("id") id: string) {
    const s = await this.sessions.getSession(id);
    if (!s) return { error: "not_found" };
    return s;
  }
}
