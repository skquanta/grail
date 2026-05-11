#!/usr/bin/env bash
# SPDX-License-Identifier: LicenseRef-Grail-Proprietary
# Copyright (c) 2026 Shashwot Bhattarai. All Rights Reserved.
#
# One-shot: prepend SPDX license headers to new code files.
# - Proprietary files (apps/, infra/, prisma/seed.ts): LicenseRef-Grail-Proprietary
# - b2g-protocol files: Apache-2.0
# Idempotent — skips files that already have a SPDX-License-Identifier.

set -euo pipefail
cd "$(dirname "$0")/../.."

YEAR=2026
HOLDER="Shashwot Bhattarai"

prepend() {
  local file="$1" comment_open="$2" comment_close="$3" license="$4" rights="$5"
  [[ ! -f "$file" ]] && { echo "  skip (missing): $file"; return; }
  if grep -q "SPDX-License-Identifier" "$file"; then
    echo "  skip (has header): $file"
    return
  fi
  local tmp
  tmp=$(mktemp)
  {
    echo "${comment_open} SPDX-License-Identifier: ${license}${comment_close}"
    echo "${comment_open} Copyright (c) ${YEAR} ${HOLDER}. ${rights}${comment_close}"
    echo ""
    cat "$file"
  } > "$tmp"
  mv "$tmp" "$file"
  echo "  added: $file"
}

# TypeScript / JavaScript — proprietary
TS_PROP=(
  apps/blink/src/main.ts
  apps/blink/src/app.module.ts
  apps/blink/src/actions.controller.ts
  apps/blink/src/midlayer.client.ts
  apps/blink/src/charge/charge.controller.ts
  apps/blink/src/charge/charge.service.ts
  apps/midlayer/src/main.ts
  apps/midlayer/src/app.module.ts
  apps/midlayer/src/health.controller.ts
  apps/midlayer/src/prisma/prisma.module.ts
  apps/midlayer/src/prisma/prisma.service.ts
  apps/midlayer/src/solana/solana.module.ts
  apps/midlayer/src/solana/solana.service.ts
  apps/midlayer/src/ocpp/ocpp.module.ts
  apps/midlayer/src/ocpp/ocpp.client.ts
  apps/midlayer/src/session/session.module.ts
  apps/midlayer/src/session/session.service.ts
  apps/midlayer/src/session/session.controller.ts
  apps/midlayer/src/session/session.dto.ts
  apps/midlayer/src/settlement/settlement.module.ts
  apps/midlayer/src/settlement/settlement.service.ts
  apps/midlayer/src/webhook/webhook.module.ts
  apps/midlayer/src/webhook/webhook.controller.ts
  apps/midlayer/prisma/seed.ts
  infra/seed/setup-solana.ts
)
echo "TypeScript (proprietary):"
for f in "${TS_PROP[@]}"; do prepend "$f" "//" "" "LicenseRef-Grail-Proprietary" "All Rights Reserved."; done

# TypeScript — Apache 2.0
TS_APACHE=(
  packages/b2g-protocol/src/index.ts
)
echo "TypeScript (Apache-2.0):"
for f in "${TS_APACHE[@]}"; do prepend "$f" "//" "" "Apache-2.0" ""; done

# SQL — proprietary
SQL_PROP=(
  infra/seed/idtag.sql
  infra/seed/subscription.sql
)
echo "SQL (proprietary):"
for f in "${SQL_PROP[@]}"; do prepend "$f" "--" "" "LicenseRef-Grail-Proprietary" "All Rights Reserved."; done

# Shell — proprietary
SH_PROP=(
  infra/deploy/bootstrap-ec2.sh
  infra/deploy/after-citrineos-up.sh
)
echo "Shell (proprietary):"
for f in "${SH_PROP[@]}"; do prepend "$f" "#" "" "LicenseRef-Grail-Proprietary" "All Rights Reserved."; done

# Dockerfile / compose — proprietary
DOCKER_PROP=(
  infra/Dockerfile.midlayer
  infra/Dockerfile.blink
  infra/docker-compose.ec2.yml
)
echo "Docker (proprietary):"
for f in "${DOCKER_PROP[@]}"; do prepend "$f" "#" "" "LicenseRef-Grail-Proprietary" "All Rights Reserved."; done

# Markdown — proprietary
MD_PROP=(
  infra/deploy/EC2_DEPLOY.md
)
echo "Markdown (proprietary):"
for f in "${MD_PROP[@]}"; do prepend "$f" "<!--" " -->" "LicenseRef-Grail-Proprietary" "All Rights Reserved."; done

echo "Done."
