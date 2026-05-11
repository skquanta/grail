-- SPDX-License-Identifier: LicenseRef-Grail-Proprietary
-- Copyright (c) 2026 Shashwot Bhattarai. All Rights Reserved.

-- Insert a webhook Subscription so CitrineOS dispatches inbound OCPP 1.6 messages to our midlayer.
-- The midlayer parses body.message (OCPP-J array) and acts on StartTransaction / StopTransaction.
--
-- BEFORE RUNNING: replace :STATION_ID with the actual IOC charger's stationId in CitrineOS.
-- The midlayer URL assumes midlayer is co-located on the same EC2 host as CitrineOS (localhost:3001).
--
-- We subscribe to both onMessage (inbound requests from charger) AND sentMessage (outbound responses)
-- so we can capture the CSMS-assigned transactionId from the StartTransactionResponse.
--
-- After insert, CitrineOS's WebhookDispatcher caches subscriptions and refreshes every 3 minutes.
-- To take effect immediately, restart CitrineOS container.

INSERT INTO "Subscriptions" ("stationId", "tenantId", "onConnect", "onClose", "onMessage", "sentMessage", "messageRegexFilter", "url", "createdAt", "updatedAt")
VALUES (
  :'STATION_ID',
  1,
  false,
  false,
  true,
  true,
  '"StartTransaction"|"StopTransaction"',
  'http://host.docker.internal:3001/webhooks/citrineos',
  NOW(),
  NOW()
);

-- If CitrineOS is NOT in a Docker container (or the host.docker.internal alias isn't set), use:
--   'http://localhost:3001/webhooks/citrineos'
-- If midlayer is on a different host, use its FQDN or private IP.

-- Verify
SELECT "stationId", "tenantId", "onMessage", "sentMessage", "messageRegexFilter", "url"
FROM "Subscriptions"
WHERE "stationId" = :'STATION_ID';
