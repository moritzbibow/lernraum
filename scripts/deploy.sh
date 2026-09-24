#!/usr/bin/env bash
# Lernraum aktualisieren: neuesten Code holen, Image bauen, neu starten.
#   ./scripts/deploy.sh
set -euo pipefail
cd "$(dirname "$0")/.."

[ -f .env ] || { echo "Keine .env – zuerst ./scripts/setup-vps.sh ausführen."; exit 1; }

echo "→ Code aktualisieren"
git pull --ff-only

echo "→ Image bauen"
docker compose build --pull

echo "→ Neu starten"
docker compose up -d

echo "→ Warte auf Healthcheck"
status=unknown
for _ in $(seq 1 45); do
  status=$(docker inspect -f '{{.State.Health.Status}}' lernraum 2>/dev/null || echo unknown)
  [ "$status" = "healthy" ] && break
  sleep 2
done

if [ "$status" = "healthy" ]; then
  echo "✓ Lernraum läuft ($(git rev-parse --short HEAD))"
  docker image prune -f >/dev/null 2>&1 || true
else
  echo "✗ Status: $status – Logs: docker compose logs --tail=100 app"
  exit 1
fi
