// SPDX-License-Identifier: LicenseRef-Grail-Proprietary
// Copyright (c) 2026 Shashwot Bhattarai. All Rights Reserved.

import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Req,
} from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { ChargeService } from "./charge.service";

interface InitiateBody {
  account: string; // base58 wallet pubkey sent by Phantom
}

@Controller("v1/charge")
export class ChargeController {
  constructor(private readonly chargeService: ChargeService) {}

  // ── GET: return the Blink action card ────────────────────────────────────
  @Get(":cpo/:stationId/:connectorId")
  getAction(
    @Param("cpo") cpo: string,
    @Param("stationId") stationId: string,
    @Param("connectorId") connectorId: string,
    @Req() req: FastifyRequest,
  ) {
    // Fastify exposes hostname separately — reconstruct the absolute base URL.
    // Behind Cloudflare Tunnel the forwarded proto is always https.
    const proto = (req.headers["x-forwarded-proto"] as string) ?? req.protocol ?? "https";
    const host  = (req.headers["x-forwarded-host"]  as string) ?? req.hostname;
    const base  = `${proto}://${host}`;
    const path  = `/v1/charge/${cpo}/${stationId}/${connectorId}`;

    return {
      type:        "action",
      title:       `Grail — ${cpo} / Station ${stationId}`,
      icon:        "https://upload.wikimedia.org/wikipedia/commons/thumb/8/82/Solana_logo.png/240px-Solana_logo.png",
      description: `OCPP 1.6 AC charger · 0.15 USDC/kWh · Connector ${connectorId}. Tap an amount to lock USDC — unused USDC is refunded automatically.`,
      label:       "Start Charging",
      links: {
        actions: [
          { label: "5 USDC",  href: `${base}${path}?amount=5`  },
          { label: "10 USDC", href: `${base}${path}?amount=10` },
          { label: "20 USDC", href: `${base}${path}?amount=20` },
        ],
      },
    };
  }

  // ── POST: Phantom POSTs { account } here when the user taps a button ─────
  @Post(":cpo/:stationId/:connectorId")
  @HttpCode(200)
  async initiateCharge(
    @Param("cpo") cpo: string,
    @Param("stationId") stationId: string,
    @Param("connectorId") connectorId: string,
    @Query("amount") amount: string,
    @Body() body: InitiateBody,
  ) {
    const { account } = body;

    // Build + serialize the Solana transaction (USDC lock to escrow, etc.)
    const { transaction, message } = await this.chargeService.buildTransaction({
      cpo,
      stationId,
      connectorId,
      amountUsdc: Number(amount),
      payerPubkey: account,
    });

    // Phantom expects { transaction: "<base64>", message?: string }
    return { transaction, message };
  }
}