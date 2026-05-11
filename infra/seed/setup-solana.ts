// SPDX-License-Identifier: LicenseRef-Grail-Proprietary
// Copyright (c) 2026 Shashwot Bhattarai. All Rights Reserved.

/**
 * One-shot Solana setup for hackathon devnet demo.
 *
 *  - Generates/loads escrow + CPO keypairs in ./keypairs/  (gitignored)
 *  - Airdrops devnet SOL to both (for tx fees on settlement/refund)
 *  - Prints the .env values to drop into apps/midlayer/.env and apps/blink/.env
 *
 * Run from repo root:  npm run setup:solana
 */
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
} from "@solana/web3.js";
import { getAssociatedTokenAddress } from "@solana/spl-token";
import * as fs from "node:fs";
import * as path from "node:path";
import bs58 from "bs58";

const DEVNET = process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
const USDC_MINT = new PublicKey(
  process.env.USDC_MINT ?? "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
);
const KEYPAIR_DIR = path.join(__dirname, "..", "..", "keypairs");

function ensureKeypair(filename: string): Keypair {
  const filepath = path.join(KEYPAIR_DIR, filename);
  if (fs.existsSync(filepath)) {
    const bytes = JSON.parse(fs.readFileSync(filepath, "utf8")) as number[];
    return Keypair.fromSecretKey(Uint8Array.from(bytes));
  }
  const kp = Keypair.generate();
  fs.mkdirSync(KEYPAIR_DIR, { recursive: true });
  fs.writeFileSync(filepath, JSON.stringify(Array.from(kp.secretKey)));
  fs.chmodSync(filepath, 0o600);
  return kp;
}

async function airdropIfNeeded(
  connection: Connection,
  pubkey: PublicKey,
  targetSol: number,
): Promise<number> {
  const before = (await connection.getBalance(pubkey)) / LAMPORTS_PER_SOL;
  if (before >= targetSol) return before;
  const needLamports = Math.ceil((targetSol - before) * LAMPORTS_PER_SOL);
  try {
    const sig = await connection.requestAirdrop(pubkey, needLamports);
    await connection.confirmTransaction(sig, "confirmed");
  } catch (err) {
    console.warn(`Airdrop to ${pubkey.toBase58()} failed (rate-limited?). Try: https://faucet.solana.com`);
    console.warn(err);
  }
  return (await connection.getBalance(pubkey)) / LAMPORTS_PER_SOL;
}

async function main(): Promise<void> {
  const connection = new Connection(DEVNET, "confirmed");

  const escrow = ensureKeypair("escrow.json");
  const cpo = ensureKeypair("cpo.json");

  console.log(`Solana RPC:    ${DEVNET}`);
  console.log(`USDC mint:     ${USDC_MINT.toBase58()}`);
  console.log(`Escrow pubkey: ${escrow.publicKey.toBase58()}`);
  console.log(`CPO pubkey:    ${cpo.publicKey.toBase58()}`);
  console.log("");
  console.log("Requesting devnet SOL airdrops...");

  const escrowBal = await airdropIfNeeded(connection, escrow.publicKey, 1.5);
  console.log(`  escrow SOL:  ${escrowBal.toFixed(4)}`);
  const cpoBal = await airdropIfNeeded(connection, cpo.publicKey, 0.2);
  console.log(`  cpo SOL:     ${cpoBal.toFixed(4)}`);

  const escrowAta = await getAssociatedTokenAddress(USDC_MINT, escrow.publicKey);
  const cpoAta = await getAssociatedTokenAddress(USDC_MINT, cpo.publicKey);
  console.log("");
  console.log(`Escrow USDC ATA: ${escrowAta.toBase58()}`);
  console.log(`CPO    USDC ATA: ${cpoAta.toBase58()}`);

  console.log("");
  console.log("================================================");
  console.log("Drop these into apps/midlayer/.env");
  console.log("================================================");
  console.log(`GRAIL_ESCROW_WALLET=${escrow.publicKey.toBase58()}`);
  console.log(`GRAIL_ESCROW_PRIVATE_KEY=${bs58.encode(escrow.secretKey)}`);
  console.log(`SEED_TENANT_CPO_WALLET=${cpo.publicKey.toBase58()}`);
  console.log("================================================");
  console.log("Drop GRAIL_ESCROW_WALLET into apps/blink/.env too");
  console.log("================================================");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
