// SPDX-License-Identifier: LicenseRef-Grail-Proprietary
// Copyright (c) 2026 Shashwot Bhattarai. All Rights Reserved.

import { Injectable, Logger } from "@nestjs/common";
import axios from "axios";

@Injectable()
export class MidlayerClient {
  private readonly logger = new Logger(MidlayerClient.name);
  private readonly baseURL: string;

  constructor() {
    this.baseURL = process.env.MIDLAYER_URL ?? "http://localhost:3001";
  }

  async getSession(sessionId: string): Promise<Record<string, unknown>> {
    const { data } = await axios.get(
      `${this.baseURL}/internal/v1/session/${sessionId}`,
      { timeout: 5_000 },
    );
    return data;
  }

  async stopSession(sessionId: string): Promise<{ success: boolean; sessionId: string }> {
    const { data } = await axios.post(
      `${this.baseURL}/internal/v1/session/${sessionId}/stop`,
      {},
      { timeout: 10_000 },
    );
    this.logger.log(`midlayer stop → ${JSON.stringify(data)}`);
    return data;
  }

  async cryptoStart(payload: {
    signature: string;
    userPublicKey: string;
    tenantId: string;
    stationId: string;
    connectorId: number;
    usdcAmount: number;
  }): Promise<{ sessionId: string; status: string }> {
    const { data } = await axios.post(
      `${this.baseURL}/internal/v1/crypto-start`,
      payload,
      { timeout: 30_000 },
    );
    this.logger.log(`midlayer crypto-start → ${JSON.stringify(data)}`);
    return data;
  }
}
