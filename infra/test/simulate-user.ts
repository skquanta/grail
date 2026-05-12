// SPDX-License-Identifier: LicenseRef-Grail-Proprietary
// Copyright (c) 2026 Shashwot Bhattarai. All Rights Reserved.

/**
 * Simulates a Phantom wallet user end-to-end without touching a wallet UI.
 *
 *  1. Loads or generates a demo-user keypair in ./keypairs/demo-user.json
 *  2. Checks SOL + USDC balances; tells you where to fund if low
 *  3. Builds the SAME versioned tx the Blink would build (USDC transferChecked → escrow + memo)
 *  4. Signs locally and submits to devnet
 *  5. Waits for confirmation
 *  6. POSTs the signature to the midlayer's /internal/v1/crypto-start
 *  7. Prints the response so you can see the midlayer's RemoteStart attempt
 *
 * Usage:
 *   npm run test:simulate-user                 # uses defaults (TENANT=demo-cpo STATION=IOC_TEST CONN=1 AMOUNT=1)
 *   AMOUNT_USDC=2 npm run test:simulate-user   # override amount
 *   STATION_ID=REAL_STATION_ID npm run test:simulate-user
 */

import {
  Connection,
  Keypair,
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
import * as fs from "node:fs";
import * as path from "node:path";

const DEVNET = process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
const USDC_MINT = new PublicKey(
  process.env.USDC_MINT ?? "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
);
const ESCROW_PUBKEY = new PublicKey(
  process.env.GRAIL_ESCROW_WALLET ?? "E6aLwCgZ7GM8J9fPNfSmh8ykpExRD317Ek3zmKsNMB5z",
);
const MIDLAYER_URL = process.env.MIDLAYER_URL ?? "http://15.206.5.208:3001";
const TENANT_ID = process.env.TENANT_ID ?? "demo-cpo";
const STATION_ID = process.env.STATION_ID ?? "IOC_TEST";
const CONNECTOR_ID = Number(process.env.CONNECTOR_ID ?? 1);
const AMOUNT_USDC = Number(process.env.AMOUNT_USDC ?? 1);
const MEMO_PROGRAM_ID = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");

const KEYPAIR_DIR = path.join(__dirname, "..", "..", "keypairs");
const KEYPAIR_PATH = path.join(KEYPAIR_DIR, "demo-user.json");

function loadOrGenerateKeypair(): Keypair {
  if (fs.existsSync(KEYPAIR_PATH)) {
    const bytes = JSON.parse(fs.readFileSync(KEYPAIR_PATH, "utf8")) as number[];
    return Keypair.fromSecretKey(Uint8Array.from(bytes));
  }
  const kp = Keypair.generate();
  fs.mkdirSync(KEYPAIR_DIR, { recursive: true });
  fs.writeFileSync(KEYPAIR_PATH, JSON.stringify(Array.from(kp.secretKey)));
  fs.chmodSync(KEYPAIR_PATH, 0o600);
  return kp;
}

async function getBalances(
  connection: Connection,
  pubkey: PublicKey,
  ata: PublicKey,
): Promise<{ sol: number; usdc: number }> {
  const sol = (await connection.getBalance(pubkey)) / 1e9;
  let usdc = 0;
  try {
    const b = await connection.getTokenAccountBalance(ata);
    usdc = Number(b.value.uiAmount ?? 0);
  } catch {
    /* ATA may not exist yet */
  }
  return { sol, usdc };
}

async function main(): Promise<void> {
  const connection = new Connection(DEVNET, "confirmed");
  const user = loadOrGenerateKeypair();
  const userAta = await getAssociatedTokenAddress(USDC_MINT, user.publicKey);
  const escrowAta = await getAssociatedTokenAddress(USDC_MINT, ESCROW_PUBKEY);

  console.log(`Demo user wallet: ${user.publicKey.toBase58()}`);
  console.log(`User USDC ATA:    ${userAta.toBase58()}`);
  console.log(`Escrow:           ${ESCROW_PUBKEY.toBase58()}`);
  console.log(`Escrow USDC ATA:  ${escrowAta.toBase58()}`);
  console.log("");

  const { sol, usdc } = await getBalances(connection, user.publicKey, userAta);
  console.log(`Balances: ${sol.toFixed(4)} SOL · ${usdc.toFixed(4)} USDC`);

  if (sol < 0.01) {
    console.error("");
    console.error("⚠  Fund SOL first:");
    console.error(`   1. Open https://faucet.solana.com`);
    console.error(`   2. Paste:  ${user.publicKey.toBase58()}`);
    console.error(`   3. Network: Devnet · Amount: 1 SOL`);
    console.error(`   4. Re-run this script.`);
    process.exit(1);
  }
  if (usdc < AMOUNT_USDC) {
    console.error("");
    console.error("⚠  Fund devnet USDC first:");
    console.error(`   1. Open https://spl-token-faucet.com/?token-name=USDC-Dev`);
    console.error(`   2. Paste pubkey:  ${user.publicKey.toBase58()}`);
    console.error(`   3. Request 100 USDC`);
    console.error(`   4. Re-run this script.`);
    process.exit(1);
  }

  // Build the same tx Blink would build
  const amountAtomic = BigInt(Math.round(AMOUNT_USDC * 1_000_000));
  const memo = `b2g:1.0|t=${TENANT_ID}|s=${STATION_ID}|c=${CONNECTOR_ID}|a=${AMOUNT_USDC}`;
  const ixs: TransactionInstruction[] = [
    createAssociatedTokenAccountIdempotentInstruction(
      user.publicKey,
      escrowAta,
      ESCROW_PUBKEY,
      USDC_MINT,
    ),
    createTransferCheckedInstruction(
      userAta,
      USDC_MINT,
      escrowAta,
      user.publicKey,
      amountAtomic,
      6,
    ),
    new TransactionInstruction({
      keys: [],
      programId: MEMO_PROGRAM_ID,
      data: Buffer.from(memo, "utf8"),
    }),
  ];

  const { blockhash } = await connection.getLatestBlockhash("confirmed");
  const msg = new TransactionMessage({
    payerKey: user.publicKey,
    recentBlockhash: blockhash,
    instructions: ixs,
  }).compileToV0Message();
  const tx = new VersionedTransaction(msg);
  tx.sign([user]);

  console.log("");
  console.log(`Submitting tx (locking ${AMOUNT_USDC} USDC from user → escrow)...`);
  const signature = await connection.sendTransaction(tx, { skipPreflight: false });
  console.log(`  signature: ${signature}`);
  console.log(`  explorer:  https://explorer.solana.com/tx/${signature}?cluster=devnet`);
  await connection.confirmTransaction(signature, "confirmed");
  console.log("  confirmed ✓");

  // POST to midlayer — same shape Blink's /confirm forwards
  console.log("");
  console.log(`POST ${MIDLAYER_URL}/internal/v1/crypto-start`);
  const body = {
    signature,
    userPublicKey: user.publicKey.toBase58(),
    tenantId: TENANT_ID,
    stationId: STATION_ID,
    connectorId: CONNECTOR_ID,
    usdcAmount: AMOUNT_USDC,
  };
  const res = await fetch(`${MIDLAYER_URL}/internal/v1/crypto-start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  console.log(`Status: ${res.status}`);
  console.log(`Response: ${text}`);
  console.log("");
  console.log("Watch midlayer logs for the OCPP RemoteStart attempt:");
  console.log("  ssh -i citrine-new.pem ubuntu@15.206.5.208 'sudo docker logs --tail 30 grail-midlayer'");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
