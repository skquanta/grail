// SPDX-License-Identifier: LicenseRef-Grail-Proprietary
// Copyright (c) 2026 Shashwot Bhattarai. All Rights Reserved.

import {
  Body,
  Controller,
  Get,
  Logger,
  Param,
  Post,
  Query,
} from "@nestjs/common";
import { ChargeService } from "./charge.service";
import { MidlayerClient } from "../midlayer.client";

const DEFAULT_ICON =
  "https://upload.wikimedia.org/wikipedia/commons/thumb/8/82/Solana_logo.png/240px-Solana_logo.png";

@Controller("v1/charge")
export class ChargeController {
  private readonly logger = new Logger(ChargeController.name);

  constructor(
    private readonly charge: ChargeService,
    private readonly midlayer: MidlayerClient,
  ) {}

  @Get(":tenantId/:stationId/:connectorId")
  getMetadata(
    @Param("tenantId") tenantId: string,
    @Param("stationId") stationId: string,
    @Param("connectorId") connectorId: string,
  ) {
    const base = process.env.BLINK_BASE_URL ?? "";
    const href = (amt: number): string =>
      `${base}/v1/charge/${tenantId}/${stationId}/${connectorId}?amount=${amt}`;
    return {
      type: "action",
      title: `Grail — ${tenantId} / Station ${stationId}`,
      icon: process.env.BLINK_ICON_URL ?? DEFAULT_ICON,
      description: `OCPP 1.6 AC charger · 0.15 USDC/kWh · Connector ${connectorId}. Tap an amount to lock USDC and start charging — unused USDC is refunded automatically.`,
      label: "Start Charging",
      links: {
        actions: [
          { label: "5 USDC", href: href(5) },
          { label: "10 USDC", href: href(10) },
          { label: "20 USDC", href: href(20) },
        ],
      },
    };
  }

  @Post(":tenantId/:stationId/:connectorId")
  async startCharge(
    @Param("tenantId") tenantId: string,
    @Param("stationId") stationId: string,
    @Param("connectorId") connectorId: string,
    @Query("amount") amount: string,
    @Body() body: { account?: string },
  ) {
    const amt = Number(amount);
    if (!body?.account) {
      return { message: "Missing 'account' in request body" };
    }
    if (!Number.isFinite(amt) || amt <= 0) {
      return { message: `Invalid amount: ${amount}` };
    }
    const memo = `b2g:1.0|t=${tenantId}|s=${stationId}|c=${connectorId}|a=${amt}`;
    this.logger.log(
      `POST charge: tenant=${tenantId} station=${stationId} conn=${connectorId} amt=${amt} user=${body.account.slice(0, 8)}…`,
    );
    const txBase64 = await this.charge.buildChargeTx(body.account, amt, memo);
    const base = process.env.BLINK_BASE_URL ?? "";
    const nextHref = `${base}/v1/charge/confirm?tenantId=${tenantId}&stationId=${stationId}&connectorId=${connectorId}&amount=${amt}`;
    return {
      transaction: txBase64,
      message: `Locking ${amt} USDC at ${tenantId} / Station ${stationId}`,
      links: {
        next: { type: "post", href: nextHref },
      },
    };
  }

  @Post("confirm")
  async confirm(
    @Query("tenantId") tenantId: string,
    @Query("stationId") stationId: string,
    @Query("connectorId") connectorId: string,
    @Query("amount") amount: string,
    @Body() body: { account?: string; signature?: string },
  ) {
    const icon = process.env.BLINK_ICON_URL ?? DEFAULT_ICON;
    if (!body?.account || !body?.signature) {
      return {
        type: "completed",
        title: "Confirmation failed",
        icon,
        description: "Wallet did not provide account+signature on the chained action.",
      };
    }
    try {
      const result = await this.midlayer.cryptoStart({
        signature: body.signature,
        userPublicKey: body.account,
        tenantId,
        stationId,
        connectorId: Number(connectorId),
        usdcAmount: Number(amount),
      });
      return {
        type: "completed",
        title: "Charging started",
        icon,
        description: `Session ${result.sessionId} — the charger is now dispensing energy. You'll be refunded any unused USDC when the session ends.`,
      };
    } catch (err) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ae = err as any;
      const msg = ae?.response?.data?.message ?? ae?.message ?? "Unknown error";
      this.logger.error(`confirm failed: ${msg}`);
      return {
        type: "completed",
        title: "Charge failed",
        icon,
        description: String(msg),
      };
    }
  }
}
