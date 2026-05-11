#!/usr/bin/env bash
# SPDX-License-Identifier: LicenseRef-Grail-Proprietary
# Copyright (c) 2026 Shashwot Bhattarai. All Rights Reserved.
# Run once on the EC2 host after rsyncing the repo to ~/grail.
# Idempotent — safe to re-run.
set -euo pipefail

REPO_ROOT="${REPO_ROOT:-$HOME/grail}"
cd "$REPO_ROOT"

echo "==> 1. Sanity: existing CitrineOS reachable on :8080"
if ! curl -sf http://localhost:8080/health > /dev/null 2>&1; then
  echo "    !! CitrineOS health check failed. Continuing — but RemoteStart probes will fail."
fi

echo "==> 2. Install Node 20 via NVM if needed"
if ! command -v node > /dev/null 2>&1 || [[ "$(node -v)" != v20.* ]]; then
  if ! command -v nvm > /dev/null 2>&1; then
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
    # shellcheck disable=SC1091
    source "$HOME/.nvm/nvm.sh"
  fi
  nvm install 20
  nvm use 20
fi
node -v
npm -v

echo "==> 3. npm install (root workspaces — hoists everything)"
npm install --no-audit --no-fund

echo "==> 4. Generate Prisma client"
(cd apps/midlayer && npx prisma generate)

echo "==> 5. Verify .env files are populated"
for f in apps/midlayer/.env apps/blink/.env; do
  if [[ ! -f "$f" ]]; then
    echo "    !! $f missing — copy from .env.example and fill in" >&2
    exit 1
  fi
  grep -q '^GRAIL_ESCROW_WALLET=.\+' "$f" 2>/dev/null || echo "    !! $f missing GRAIL_ESCROW_WALLET — fix before starting"
done

echo "==> Done. Next steps (manual):"
echo "    a) seed CitrineOS DB:    psql ... -f infra/seed/idtag.sql"
echo "       and:                  psql ... -v STATION_ID=<IOC_STATION_ID> -f infra/seed/subscription.sql"
echo "    b) restart CitrineOS so it picks up the subscription:"
echo "       docker restart <citrineos-container-name>"
echo "    c) create grail DB + run prisma migrate:"
echo "       psql ... -c 'CREATE DATABASE grail; CREATE USER grail WITH PASSWORD ...;'"
echo "       (cd apps/midlayer && npx prisma db push)"
echo "       (cd apps/midlayer && npm run prisma:seed)"
echo "    d) Top up escrow with devnet SOL:"
echo "       Visit https://faucet.solana.com  pubkey=E6aLwCgZ7GM8J9fPNfSmh8ykpExRD317Ek3zmKsNMB5z"
echo "    e) Start both apps (background):"
echo "       (cd apps/midlayer && nohup npm start > midlayer.log 2>&1 &)"
echo "       (cd apps/blink    && nohup npm start > blink.log    2>&1 &)"
echo "    f) Run OCPP smoke test (replace STATION_ID):"
echo "       curl -X POST 'http://localhost:8080/ocpp/1.6/evdriver/remoteStartTransaction?identifier=STATION_ID&tenantId=1' \\"
echo "         -H 'Content-Type: application/json' -d '{\"connectorId\":1,\"idTag\":\"SOLANA_BRIDGE_TOKEN_demo-cpo\"}'"
echo "    g) Expose Blink via ngrok: ngrok http 3000"
echo "    h) Update apps/blink/.env BLINK_BASE_URL with the ngrok https URL, restart blink"
