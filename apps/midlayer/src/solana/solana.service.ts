// SPDX-License-Identifier: LicenseRef-Grail-Proprietary
// Copyright (c) 2026 Shashwot Bhattarai. All Rights Reserved.

import { Injectable, Logger } from "@nestjs/common";
import {
  Connection,
  Keypair,
  ParsedTransactionWithMeta,
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import {
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferCheckedInstruction,
  getAssociatedTokenAddress,
} from "@solana/spl-token";
import bs58 from "bs58";

export interface VerifyParams {
  signature: string;
  expectedMint: string;
  expectedEscrowPubkey: string; // owner pubkey of the escrow ATA destination
  expectedAmountUsdc: number;
  expectedSender: string;
  requireFinalized?: boolean;
}

export interface VerifyResult {
  valid: boolean;
  reason?: string;
  sender?: string;
  amountUsdc?: number;
}

@Injectable()
export class SolanaService {
  private readonly logger = new Logger(SolanaService.name);
  private readonly connection: Connection;
  private readonly escrowKeypair: Keypair;
  private readonly mint: PublicKey;

  constructor() {
    this.connection = new Connection(
      process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com",
      "confirmed",
    );
    const secret = process.env.GRAIL_ESCROW_PRIVATE_KEY;
    if (!secret) {
      throw new Error("GRAIL_ESCROW_PRIVATE_KEY env required");
    }
    this.escrowKeypair = Keypair.fromSecretKey(bs58.decode(secret));
    this.mint = new PublicKey(
      process.env.USDC_MINT ?? "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
    );
    this.logger.log(
      `Solana escrow ${this.escrowKeypair.publicKey.toBase58()} on ${this.connection.rpcEndpoint}`,
    );
  }

  get escrowPubkey(): PublicKey {
    return this.escrowKeypair.publicKey;
  }

  async verifyTransaction(params: VerifyParams): Promise<VerifyResult> {
    const commitment = params.requireFinalized ? "finalized" : "confirmed";
    let tx: ParsedTransactionWithMeta | null = null;

    // Poll up to ~30s — devnet is often slow to finalize.
    for (let i = 0; i < 15; i++) {
      tx = await this.connection.getParsedTransaction(params.signature, {
        commitment,
        maxSupportedTransactionVersion: 0,
      });
      if (tx) break;
      await new Promise((r) => setTimeout(r, 2000));
    }

    if (!tx) return { valid: false, reason: "Transaction not found after polling" };
    if (tx.meta?.err) {
      return { valid: false, reason: `Tx failed: ${JSON.stringify(tx.meta.err)}` };
    }

    const escrowOwner = new PublicKey(params.expectedEscrowPubkey);
    const escrowAta = (
      await getAssociatedTokenAddress(this.mint, escrowOwner)
    ).toBase58();
    const expectedAtomic = BigInt(Math.round(params.expectedAmountUsdc * 1_000_000));

    const instructions = [
      ...tx.transaction.message.instructions,
      ...(tx.meta?.innerInstructions ?? []).flatMap((g) => g.instructions),
    ];
    let actualSender: string | undefined;
    let amountAtomic = 0n;

    for (const ix of instructions) {
      if (!("parsed" in ix)) continue;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const parsed: any = (ix as any).parsed;
      const t = parsed?.type;
      if (t !== "transferChecked" && t !== "transfer") continue;
      const info = parsed.info;
      if (info?.mint && info.mint !== params.expectedMint) continue;
      if (info?.destination !== escrowAta) continue;

      const amt =
        t === "transferChecked"
          ? BigInt(info.tokenAmount.amount)
          : BigInt(info.amount);
      amountAtomic += amt;
      actualSender = info.authority ?? info.owner ?? info.source ?? actualSender;
    }

    if (amountAtomic < expectedAtomic) {
      return {
        valid: false,
        reason: `Amount short: got ${amountAtomic} need ${expectedAtomic} (atomic units)`,
      };
    }
    if (!actualSender) {
      return { valid: false, reason: "No transfer authority found in tx" };
    }
    if (actualSender !== params.expectedSender) {
      return {
        valid: false,
        reason: `Sender mismatch: tx=${actualSender} expected=${params.expectedSender}`,
      };
    }

    return {
      valid: true,
      sender: actualSender,
      amountUsdc: Number(amountAtomic) / 1_000_000,
    };
  }

  async transferUsdc(params: {
    to: string;
    amountUsdc: number;
  }): Promise<string> {
    const recipient = new PublicKey(params.to);
    const fromAta = await getAssociatedTokenAddress(
      this.mint,
      this.escrowKeypair.publicKey,
    );
    const toAta = await getAssociatedTokenAddress(this.mint, recipient);
    const amount = BigInt(Math.round(params.amountUsdc * 1_000_000));

    const ixs = [
      createAssociatedTokenAccountIdempotentInstruction(
        this.escrowKeypair.publicKey,
        toAta,
        recipient,
        this.mint,
      ),
      createTransferCheckedInstruction(
        fromAta,
        this.mint,
        toAta,
        this.escrowKeypair.publicKey,
        amount,
        6,
      ),
    ];

    const { blockhash } = await this.connection.getLatestBlockhash("confirmed");
    const message = new TransactionMessage({
      payerKey: this.escrowKeypair.publicKey,
      recentBlockhash: blockhash,
      instructions: ixs,
    }).compileToV0Message();

    const tx = new VersionedTransaction(message);
    tx.sign([this.escrowKeypair]);
    const sig = await this.connection.sendTransaction(tx, { skipPreflight: false });
    await this.connection.confirmTransaction(sig, "confirmed");
    this.logger.log(`Transferred ${params.amountUsdc} USDC → ${params.to} (${sig})`);
    return sig;
  }
}
