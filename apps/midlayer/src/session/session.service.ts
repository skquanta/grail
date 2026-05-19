// SPDX-License-Identifier: LicenseRef-Grail-Proprietary
// Copyright (c) 2026 Shashwot Bhattarai. All Rights Reserved.

import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { SolanaService } from "../solana/solana.service";
import { OcppClient } from "../ocpp/ocpp.client";
import { SettlementService } from "../settlement/settlement.service";
import { CryptoStartDto } from "./session.dto";

@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);

  constructor(
    private readonly db: PrismaService,
    private readonly solana: SolanaService,
    private readonly ocpp: OcppClient,
    private readonly settlement: SettlementService,
  ) {}

  async cryptoStart(dto: CryptoStartDto) {
    // Idempotency by signature
    const existing = await this.db.session.findUnique({
      where: { solanaSignature: dto.signature },
    });
    if (existing) {
      this.logger.log(
        `Idempotent: session ${existing.id} already exists for sig=${dto.signature.slice(0, 8)}…`,
      );
      return { success: true, sessionId: existing.id, status: existing.status };
    }

    // Verify on-chain
    const verify = await this.solana.verifyTransaction({
      signature: dto.signature,
      expectedMint:
        process.env.USDC_MINT ?? "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
      expectedEscrowPubkey: this.solana.escrowPubkey.toBase58(),
      expectedAmountUsdc: dto.usdcAmount,
      expectedSender: dto.userPublicKey,
      requireFinalized: false,
    });
    if (!verify.valid) {
      this.logger.warn(`Verify failed: ${verify.reason}`);
      throw new BadRequestException(`Solana verification failed: ${verify.reason}`);
    }

    // Tenant lookup
    const tenant = await this.db.tenant.findUnique({
      where: { tenantId: dto.tenantId },
    });
    if (!tenant) throw new BadRequestException(`Unknown tenant ${dto.tenantId}`);

    // Create session in PAYMENT_CONFIRMED
    const session = await this.db.session.create({
      data: {
        solanaSignature: dto.signature,
        userPublicKey: dto.userPublicKey,
        tenantId: dto.tenantId,
        stationId: dto.stationId,
        connectorId: dto.connectorId,
        usdcLocked: dto.usdcAmount,
        status: "PAYMENT_CONFIRMED",
      },
    });

    // Fire RemoteStart to CitrineOS
    try {
      await this.ocpp.remoteStartTransaction({
        stationId: dto.stationId,
        connectorId: dto.connectorId,
        idTag: tenant.masterIdTag,
      });
      await this.db.session.update({
        where: { id: session.id },
        data: { status: "OCPP_STARTING" },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await this.db.session.update({
        where: { id: session.id },
        data: { status: "FAILED", failureReason: `OCPP RemoteStart error: ${msg}` },
      });
      throw new BadRequestException(`Failed to start OCPP session: ${msg}`);
    }

    return { success: true, sessionId: session.id, status: "OCPP_STARTING" };
  }

  async getSession(id: string) {
    return this.db.session.findUnique({ where: { id } });
  }

  async stopSession(session: { id: string; stationId: string; ocppTransactionId: string | null; status: string }) {
    if (!["OCPP_STARTING", "CHARGING", "ENDING"].includes(session.status)) {
      throw new BadRequestException(`Session ${session.id} is in status ${session.status} — cannot stop`);
    }

    let txId = session.ocppTransactionId ? Number(session.ocppTransactionId) : null;

    // Webhook may have been missing (e.g. Subscription wiped on restart) — look up from CitrineOS
    if (txId == null) {
      txId = await this.ocpp.getActiveTransactionId(session.stationId);
      if (txId != null) {
        await this.db.session.update({
          where: { id: session.id },
          data: { ocppTransactionId: String(txId), status: "CHARGING" },
        });
        this.logger.log(`Recovered txId=${txId} from CitrineOS for session ${session.id}`);
      }
    }

    if (txId == null) {
      throw new BadRequestException(`No active OCPP transaction found for station ${session.stationId}`);
    }

    await this.ocpp.remoteStopTransaction({ stationId: session.stationId, transactionId: txId });
    this.logger.log(`RemoteStop sent for session ${session.id} txId=${txId}`);
    return { success: true, sessionId: session.id };
  }

  // Webhook handler entrypoints — see WebhookController.
  async onMeterValues(stationId: string, connectorId: number, energyWh: number): Promise<void> {
    const session = await this.db.session.findFirst({
      where: { stationId, connectorId, status: "CHARGING" },
      orderBy: { startedAt: "desc" },
    });
    if (!session) return;
    await this.db.session.update({
      where: { id: session.id },
      data: { liveEnergyWh: energyWh },
    });
  }

  async onStartTransaction(
    stationId: string,
    payload: { connectorId: number; idTag: string; meterStart: number; timestamp?: string },
  ): Promise<void> {
    const session = await this.db.session.findFirst({
      where: {
        stationId,
        connectorId: payload.connectorId,
        status: "OCPP_STARTING",
      },
      orderBy: { grantedAt: "desc" },
    });
    if (!session) {
      this.logger.warn(
        `No pending session for ${stationId}/${payload.connectorId} — ignoring StartTransaction`,
      );
      return;
    }
    await this.db.session.update({
      where: { id: session.id },
      data: {
        meterStartWh: payload.meterStart,
        status: "CHARGING",
        startedAt: payload.timestamp ? new Date(payload.timestamp) : new Date(),
      },
    });
    this.logger.log(
      `Session ${session.id} → CHARGING (meterStart=${payload.meterStart} Wh)`,
    );
  }

  async onStartTransactionResponse(
    stationId: string,
    transactionId: number,
  ): Promise<void> {
    // Bind CSMS-assigned transactionId to the most recent CHARGING session for the station
    const session = await this.db.session.findFirst({
      where: { stationId, status: "CHARGING", ocppTransactionId: null },
      orderBy: { startedAt: "desc" },
    });
    if (!session) {
      this.logger.warn(
        `No CHARGING session for ${stationId} — cannot bind transactionId ${transactionId}`,
      );
      return;
    }
    await this.db.session.update({
      where: { id: session.id },
      data: { ocppTransactionId: String(transactionId) },
    });
    this.logger.log(`Session ${session.id} bound to OCPP tx ${transactionId}`);
  }

  async onStopTransaction(
    stationId: string,
    payload: { transactionId: number; meterStop: number; timestamp?: string; reason?: string },
  ): Promise<void> {
    // Primary lookup: by ocppTransactionId
    let session = await this.db.session.findUnique({
      where: { ocppTransactionId: String(payload.transactionId) },
    });
    // Fallback: most-recent CHARGING for this station
    if (!session) {
      session = await this.db.session.findFirst({
        where: { stationId, status: "CHARGING" },
        orderBy: { startedAt: "desc" },
      });
      if (!session) {
        this.logger.warn(
          `No session for StopTransaction txId=${payload.transactionId} station=${stationId}`,
        );
        return;
      }
      await this.db.session.update({
        where: { id: session.id },
        data: { ocppTransactionId: String(payload.transactionId) },
      });
    }
    const energyWh = Math.max(0, payload.meterStop - (session.meterStartWh ?? 0));
    await this.db.session.update({
      where: { id: session.id },
      data: {
        status: "ENDING",
        endedAt: payload.timestamp ? new Date(payload.timestamp) : new Date(),
      },
    });
    this.logger.log(
      `Session ${session.id} → ENDING (energy=${energyWh} Wh) — invoking settlement`,
    );
    await this.settlement.settle(session.id, energyWh);
  }
}
