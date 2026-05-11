// SPDX-License-Identifier: LicenseRef-Grail-Proprietary
// Copyright (c) 2026 Shashwot Bhattarai. All Rights Reserved.

import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { SolanaService } from "../solana/solana.service";

const round6 = (n: number): number =>
  Math.max(0, Math.round(n * 1_000_000) / 1_000_000);

@Injectable()
export class SettlementService {
  private readonly logger = new Logger(SettlementService.name);

  constructor(
    private readonly db: PrismaService,
    private readonly solana: SolanaService,
  ) {}

  async settle(sessionId: string, energyDeliveredWh: number): Promise<void> {
    const session = await this.db.session.findUnique({
      where: { id: sessionId },
      include: { tenant: true },
    });
    if (!session) throw new Error(`Session ${sessionId} not found`);
    if (session.status === "SETTLED") {
      this.logger.warn(`Session ${sessionId} already SETTLED — skipping`);
      return;
    }

    const energyKwh = energyDeliveredWh / 1000;
    const finalCost = round6(
      Math.max(0, energyKwh * session.tenant.ratePerKwh),
    );
    const grailFee = round6((finalCost * session.tenant.feePercent) / 100);
    const cpoPayout = round6(finalCost - grailFee);
    const refund = round6(session.usdcLocked - finalCost);

    this.logger.log(
      `Settle ${sessionId}: kWh=${energyKwh.toFixed(4)} cost=${finalCost} fee=${grailFee} cpo=${cpoPayout} refund=${refund}`,
    );

    let settlementSig: string | null = null;
    let refundSig: string | null = null;

    try {
      if (cpoPayout > 0.000001) {
        settlementSig = await this.solana.transferUsdc({
          to: session.tenant.cpoWallet,
          amountUsdc: cpoPayout,
        });
      }
      if (refund > 0.001) {
        refundSig = await this.solana.transferUsdc({
          to: session.userPublicKey,
          amountUsdc: refund,
        });
      }
      await this.db.session.update({
        where: { id: sessionId },
        data: {
          energyDeliveredKwh: energyKwh,
          finalCostUsdc: finalCost,
          grailFeeUsdc: grailFee,
          refundUsdc: refund > 0 ? refund : 0,
          settlementSignature: settlementSig,
          refundSignature: refundSig,
          status: "SETTLED",
          settledAt: new Date(),
          endedAt: session.endedAt ?? new Date(),
        },
      });
      this.logger.log(
        `Session ${sessionId} SETTLED — payout=${settlementSig} refund=${refundSig}`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Settlement failed for ${sessionId}: ${msg}`);
      await this.db.session.update({
        where: { id: sessionId },
        data: { status: "FAILED", failureReason: `Settlement error: ${msg}` },
      });
      throw err;
    }
  }
}
