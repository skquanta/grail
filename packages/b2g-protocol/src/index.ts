// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 Shashwot Bhattarai. 

// Grail B2G Protocol — Open-source Session Grant schema and shared constants.

export interface B2GSessionGrant {
  version: "1.0";
  station_id: string;
  connector_id: number;
  tenant_id: string;
  usdc_locked: number;
  rate_per_kwh: number;
  currency: "USDC";
  user_public_key: string;
  solana_signature: string;
  verification_tier: "standard" | "gold" | "platinum";
  granted_at: number;
  expires_at: number;
}

export const USDC_MINT_DEVNET = "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU";
export const USDC_MINT_MAINNET = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
export const USDC_DECIMALS = 6;
export const MEMO_PROGRAM_ID = "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr";

export type SessionStatus =
  | "PAYMENT_PENDING"
  | "PAYMENT_CONFIRMED"
  | "OCPP_STARTING"
  | "CHARGING"
  | "ENDING"
  | "SETTLED"
  | "FAILED"
  | "EXPIRED";
