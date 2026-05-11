// SPDX-License-Identifier: LicenseRef-Grail-Proprietary
// Copyright (c) 2026 Shashwot Bhattarai. All Rights Reserved.

import { Body, Controller, Logger, Post } from "@nestjs/common";
import { SessionService } from "../session/session.service";

interface CitrineWebhookBody {
  stationId: string;
  event: string;
  origin: string;
  message: string; // JSON-stringified OCPP-J array
  info: {
    correlationId: string;
    action: string;
    timestamp: string;
    protocol: string;
  };
}

@Controller("webhooks")
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(private readonly sessions: SessionService) {}

  @Post("citrineos")
  async handle(@Body() body: CitrineWebhookBody): Promise<{ ok: boolean }> {
    if (!body?.message) {
      this.logger.warn(`Webhook with no body.message: ${JSON.stringify(body)}`);
      return { ok: false };
    }

    let rpc: unknown[];
    try {
      rpc = JSON.parse(body.message);
    } catch {
      this.logger.error(`Bad webhook body.message: ${body.message}`);
      return { ok: false };
    }

    // OCPP-J:
    //   Call:        [2, msgId, action, payload]
    //   CallResult:  [3, msgId, payload]
    //   CallError:   [4, msgId, errorCode, errorDescription, errorDetails]
    const msgType = rpc[0] as number;
    const action = body.info.action;

    try {
      if (msgType === 2 && action === "StartTransaction") {
        await this.sessions.onStartTransaction(
          body.stationId,
          rpc[3] as {
            connectorId: number;
            idTag: string;
            meterStart: number;
            timestamp?: string;
          },
        );
      } else if (msgType === 3 && action === "StartTransaction") {
        const payload = rpc[2] as { transactionId?: number };
        if (typeof payload?.transactionId === "number") {
          await this.sessions.onStartTransactionResponse(
            body.stationId,
            payload.transactionId,
          );
        }
      } else if (msgType === 2 && action === "StopTransaction") {
        await this.sessions.onStopTransaction(
          body.stationId,
          rpc[3] as {
            transactionId: number;
            meterStop: number;
            timestamp?: string;
            reason?: string;
          },
        );
      } else {
        this.logger.debug(
          `Ignoring msgType=${msgType} action=${action} station=${body.stationId}`,
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Webhook handler error: ${msg}`);
    }
    return { ok: true };
  }
}
