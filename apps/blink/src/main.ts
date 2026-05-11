// SPDX-License-Identifier: LicenseRef-Grail-Proprietary
// Copyright (c) 2026 Shashwot Bhattarai. All Rights Reserved.

import "reflect-metadata";
import "dotenv/config";
import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import {
  FastifyAdapter,
  NestFastifyApplication,
} from "@nestjs/platform-fastify";
import type { FastifyInstance } from "fastify";
import { AppModule } from "./app.module";

const SOLANA_BLOCKCHAIN_ID_DEVNET =
  "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: false, bodyLimit: 1024 * 1024 }),
  );

  // Solana Actions: CORS must be permissive AND specific headers must be reflected
  app.enableCors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "Content-Encoding",
      "Accept-Encoding",
    ],
    exposedHeaders: ["X-Action-Version", "X-Blockchain-Ids", "Content-Encoding"],
    maxAge: 86400,
  });

  // Solana Actions headers on every response.
  const fastify = app.getHttpAdapter().getInstance() as FastifyInstance;
  fastify.addHook("onSend", (_req, reply, payload, done) => {
    reply.header("X-Action-Version", "2.4");
    reply.header("X-Blockchain-Ids", SOLANA_BLOCKCHAIN_ID_DEVNET);
    done(null, payload);
  });

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port, "0.0.0.0");
  Logger.log(`Grail Blink listening on :${port}`, "Bootstrap");
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
