// SPDX-License-Identifier: LicenseRef-Grail-Proprietary
// Copyright (c) 2026 Shashwot Bhattarai. All Rights Reserved.

import { Injectable, Logger } from "@nestjs/common";
import {
  Connection,
  PublicKey,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import {
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferCheckedInstruction,
  getAssociatedTokenAddress,
} from "@solana/spl-token";

const MEMO_PROGRAM_ID = new PublicKey(
  "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr",
);

@Injectable()
export class ChargeService {
  private readonly logger = new Logger(ChargeService.name);
  private readonly connection: Connection;
  private readonly mint: PublicKey;
  private readonly escrow: PublicKey;

  constructor() {
    this.connection = new Connection(
      process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com",
      "confirmed",
    );
    this.mint = new PublicKey(
      process.env.USDC_MINT ?? "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
    );
    if (!process.env.GRAIL_ESCROW_WALLET) {
      throw new Error("GRAIL_ESCROW_WALLET env required");
    }
    this.escrow = new PublicKey(process.env.GRAIL_ESCROW_WALLET);
    this.logger.log(
      `Blink tx builder: mint=${this.mint.toBase58()} escrow=${this.escrow.toBase58()}`,
    );
  }

  async buildChargeTx(
    userPubkey: string,
    amountUsdc: number,
    memo: string,
  ): Promise<string> {
    const user = new PublicKey(userPubkey);
    const userAta = await getAssociatedTokenAddress(this.mint, user);
    const escrowAta = await getAssociatedTokenAddress(this.mint, this.escrow);
    const amountAtomic = BigInt(Math.round(amountUsdc * 1_000_000));

    const ixs: TransactionInstruction[] = [
      // Ensure the escrow ATA exists (idempotent — first user pays the rent ~0.002 SOL)
      createAssociatedTokenAccountIdempotentInstruction(
        user,
        escrowAta,
        this.escrow,
        this.mint,
      ),
      createTransferCheckedInstruction(
        userAta,
        this.mint,
        escrowAta,
        user,
        amountAtomic,
        6,
      ),
      new TransactionInstruction({
        keys: [],
        programId: MEMO_PROGRAM_ID,
        data: Buffer.from(memo, "utf8"),
      }),
    ];

    const { blockhash } = await this.connection.getLatestBlockhash("confirmed");
    const message = new TransactionMessage({
      payerKey: user,
      recentBlockhash: blockhash,
      instructions: ixs,
    }).compileToV0Message();

    const tx = new VersionedTransaction(message);
    return Buffer.from(tx.serialize()).toString("base64");
  }
}
