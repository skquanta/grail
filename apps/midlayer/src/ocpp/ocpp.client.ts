// SPDX-License-Identifier: LicenseRef-Grail-Proprietary
// Copyright (c) 2026 Shashwot Bhattarai. All Rights Reserved.

import { Injectable, Logger } from "@nestjs/common";
import axios, { AxiosInstance } from "axios";

@Injectable()
export class OcppClient {
  private readonly logger = new Logger(OcppClient.name);
  private readonly http: AxiosInstance;
  private readonly tenantId: number;

  constructor() {
    const baseURL = process.env.CITRINEOS_URL ?? "http://localhost:8080";
    this.tenantId = Number(process.env.CITRINEOS_TENANT_ID ?? 1);
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (process.env.CITRINEOS_API_TOKEN) {
      headers["Authorization"] = `Bearer ${process.env.CITRINEOS_API_TOKEN}`;
    }
    this.http = axios.create({ baseURL, timeout: 10_000, headers });
    this.logger.log(`CitrineOS REST: ${baseURL} (tenantId=${this.tenantId})`);
  }

  async remoteStartTransaction(params: {
    stationId: string;
    connectorId: number;
    idTag: string;
  }): Promise<unknown> {
    const url = "/ocpp/1.6/evdriver/remoteStartTransaction";
    this.logger.log(
      `POST ${url}?identifier=${params.stationId}&tenantId=${this.tenantId} body=${JSON.stringify({ connectorId: params.connectorId, idTag: params.idTag })}`,
    );
    try {
      const { data } = await this.http.post(
        url,
        { connectorId: params.connectorId, idTag: params.idTag },
        { params: { identifier: params.stationId, tenantId: this.tenantId } },
      );
      this.logger.log(`remoteStartTransaction response: ${JSON.stringify(data)}`);
      return data;
    } catch (err) {
      if (axios.isAxiosError(err)) {
        this.logger.error(
          `remoteStartTransaction failed: ${err.response?.status} ${JSON.stringify(err.response?.data)}`,
        );
      }
      throw err;
    }
  }

  async remoteStopTransaction(params: {
    stationId: string;
    transactionId: number;
  }): Promise<unknown> {
    const url = "/ocpp/1.6/evdriver/remoteStopTransaction";
    const { data } = await this.http.post(
      url,
      { transactionId: params.transactionId },
      { params: { identifier: params.stationId, tenantId: this.tenantId } },
    );
    this.logger.log(`remoteStopTransaction response: ${JSON.stringify(data)}`);
    return data;
  }
}
