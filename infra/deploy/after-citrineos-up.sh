#!/usr/bin/env bash
# SPDX-License-Identifier: LicenseRef-Grail-Proprietary
# Copyright (c) 2026 Shashwot Bhattarai. All Rights Reserved.
#
# Once the IOC charger has reconnected and registered with CitrineOS, run this on EC2
# to seed the webhook Subscription and run the OCPP smoke test.
#
# Usage:
#   STATION_ID=IOC_CHARGER_X bash ~/grail/infra/deploy/after-citrineos-up.sh
#
# Idempotent — safe to re-run.

set -euo pipefail

REPO=${REPO:-$HOME/grail}
PSQL_CITRINE="psql postgresql://citrine:citrine@localhost:5432/citrine -v ON_ERROR_STOP=1"

cd "$REPO"

echo "==> 1. Confirm CitrineOS healthy"
curl -sf http://localhost:8080/health > /dev/null || { echo "    !! 8080 not responding"; exit 1; }
echo "    OK"

echo "==> 2. Confirm Grail compose stack healthy"
sudo docker ps --format "{{.Names}} {{.Status}}" | grep -E "grail-(midlayer|blink|cloudflared)" || true
curl -sf http://localhost:3001/health > /dev/null && echo "    midlayer OK" || echo "    !! midlayer not responding"
curl -sf http://localhost:3000/health > /dev/null && echo "    blink OK"    || echo "    !! blink not responding"

echo "==> 3. Find connected stations in CitrineOS"
STATIONS=$($PSQL_CITRINE -At -c 'SELECT id FROM "ChargingStations" ORDER BY "createdAt" DESC LIMIT 10;' 2>/dev/null || echo "")
if [[ -z "$STATIONS" ]]; then
  echo "    !! No stations registered yet. Power-cycle the IOC charger so it sends BootNotification."
  echo "       Watch logs: sudo docker logs -f server-citrine-1"
  exit 1
fi
echo "    Stations:"
echo "$STATIONS" | sed 's/^/      /'

STATION_ID="${STATION_ID:-$(echo "$STATIONS" | head -1)}"
echo "    Using STATION_ID=$STATION_ID"

echo "==> 4. Master idTag already seeded? (re-asserting)"
$PSQL_CITRINE -f "$REPO/infra/seed/idtag.sql" | tail -3

echo "==> 5. Insert/update webhook Subscription pointing at midlayer (host.docker.internal:3001)"
$PSQL_CITRINE <<EOF
DELETE FROM "Subscriptions" WHERE "stationId" = '$STATION_ID' AND "url" LIKE '%/webhooks/citrineos';
INSERT INTO "Subscriptions" ("stationId", "tenantId", "onConnect", "onClose", "onMessage", "sentMessage", "messageRegexFilter", "url", "createdAt", "updatedAt")
VALUES ('$STATION_ID', 1, false, false, true, true, '"StartTransaction"|"StopTransaction"', 'http://host.docker.internal:3001/webhooks/citrineos', NOW(), NOW());
SELECT "stationId", "onMessage", "sentMessage", "url" FROM "Subscriptions" WHERE "stationId" = '$STATION_ID';
EOF

echo "==> 6. Restart citrine container to pick up the new Subscription (cache refreshes every 3min otherwise)"
sudo docker restart server-citrine-1
echo "    Waiting for citrine to come healthy..."
for i in $(seq 1 30); do
  S=$(sudo docker inspect --format '{{.State.Health.Status}}' server-citrine-1 2>/dev/null)
  if [[ "$S" == "healthy" ]]; then echo "    citrine healthy ✓"; break; fi
  sleep 3
done

echo "==> 7. OCPP smoke test: send RemoteStartTransaction"
echo "       station=$STATION_ID idTag=GRAIL_DEMO_CPO"
RESULT=$(curl -sS -X POST "http://localhost:8080/ocpp/1.6/evdriver/remoteStartTransaction?identifier=$STATION_ID&tenantId=1" \
  -H "Content-Type: application/json" \
  -d '{"connectorId":1,"idTag":"GRAIL_DEMO_CPO"}')
echo "    Result: $RESULT"

if echo "$RESULT" | grep -q '"success":true'; then
  echo "    ✓ RemoteStart accepted. Charger should now physically begin a session."
  echo
  echo "    Watch the rest of the flow:"
  echo "       sudo docker logs -f grail-midlayer    # webhook + (later) settle"
  echo "       sudo docker logs -f server-citrine-1  # StartTransaction / StopTransaction inbound"
else
  echo "    !! RemoteStart did not succeed. Check that the charger is online:"
  echo "       psql postgresql://citrine:citrine@localhost:5432/citrine -c 'SELECT id, \"isOnline\" FROM \"ChargingStations\";'"
fi

echo
echo "==> 8. Stop the test session (when ready):"
echo "       Find the OCPP transactionId:"
echo "       psql postgresql://citrine:citrine@localhost:5432/citrine -c 'SELECT id, \"stationId\", \"meterStart\" FROM \"Transactions\" ORDER BY \"createdAt\" DESC LIMIT 1;'"
echo "       Then:"
echo "       curl -X POST 'http://localhost:8080/ocpp/1.6/evdriver/remoteStopTransaction?identifier=$STATION_ID&tenantId=1' \\"
echo "         -H 'Content-Type: application/json' -d '{\"transactionId\":<ID>}'"
echo
echo "==> Phone test (Phantom on devnet):"
echo "       Public Blink URL:  $(grep ^BLINK_BASE_URL $REPO/apps/blink/.env | cut -d= -f2-)"
echo "       Action URL:        $(grep ^BLINK_BASE_URL $REPO/apps/blink/.env | cut -d= -f2-)/v1/charge/demo-cpo/$STATION_ID/1"
echo "       QR encodes:        solana-action:$(grep ^BLINK_BASE_URL $REPO/apps/blink/.env | cut -d= -f2-)/v1/charge/demo-cpo/$STATION_ID/1"
