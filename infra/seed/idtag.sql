-- SPDX-License-Identifier: LicenseRef-Grail-Proprietary
-- Copyright (c) 2026 Shashwot Bhattarai. All Rights Reserved.

-- Insert master idTag for the Solana bridge in CitrineOS.
-- This is the single OCPP 1.6 idTag that the midlayer presents on RemoteStartTransaction.
-- Run against the CitrineOS Postgres on EC2.
-- NOTE: OCPP 1.6 idTag is CiString20Type — MAX 20 CHARS. `GRAIL_DEMO_CPO` is 14.

INSERT INTO "Authorizations" ("idToken", "idTokenType", "status", "tenantId", "createdAt", "updatedAt")
VALUES ('GRAIL_DEMO_CPO', 'ISO14443', 'Accepted', 1, NOW(), NOW())
ON CONFLICT ("tenantId", "idToken", "idTokenType") DO UPDATE SET "status" = 'Accepted', "updatedAt" = NOW();

-- Verify
SELECT "idToken", "idTokenType", "status", "tenantId"
FROM "Authorizations"
WHERE "idToken" = 'GRAIL_DEMO_CPO';
