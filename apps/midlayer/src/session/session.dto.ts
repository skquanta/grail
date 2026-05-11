// SPDX-License-Identifier: LicenseRef-Grail-Proprietary
// Copyright (c) 2026 Shashwot Bhattarai. All Rights Reserved.

export interface CryptoStartDto {
  signature: string;
  userPublicKey: string;
  tenantId: string;
  stationId: string;
  connectorId: number;
  usdcAmount: number;
}
