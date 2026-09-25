#!/usr/bin/env bash
# Lernraum starten bzw. aktualisieren: neuesten Code holen, Image bauen, neu starten
# und prüfen, ob die Domain beim Lernraum ankommt.
#   ./scripts/deploy.sh
set -euo pipefail
cd "$(dirname "$0")/.."

[ -f .env ] || { echo "Keine .env – zuerst ./scripts/setup-vps.sh ausführen."; exit 1; }

if [ -z "${LERNRAUM_PULLED:-}" ]; then
  echo "→ Code aktualisieren"
  git pull --ff-only
  # Die frisch geholte Fassung dieses Skripts ausführen.
  LERNRAUM_PULLED=1 exec bash "$PWD/scripts/deploy.sh" "$@"
fi
. scripts/lib.sh

DOMAIN=$(env_value DOMAIN)
[ -n "$DOMAIN" ] || fail "DOMAIN fehlt in .env."
USERS=$(domain_users "$DOMAIN")
[ -z "$USERS" ] || fail "$DOMAIN wird schon von $(echo $USERS) verwendet. Bitte in .env eine andere Domain eintragen (DOMAIN und PUBLIC_URL)."

echo "→ Image bauen"
docker compose build --pull

echo "→ Starten"
docker compose up -d

echo "→ Warte auf Healthcheck"
status=unknown
for _ in $(seq 1 45); do
  status=$(docker inspect -f '{{.State.Health.Status}}' lernraum 2>/dev/null || echo unknown)
  [ "$status" = "healthy" ] && break
  sleep 2
done
if [ "$status" != "healthy" ]; then
  echo "✗ Status: $status – Logs: docker compose logs --tail=100 app"
  exit 1
fi
echo "✓ Lernraum läuft ($(git rev-parse --short HEAD))"
docker image prune -f >/dev/null 2>&1 || true

echo "→ Erreichbarkeit prüfen"
command -v curl >/dev/null || { warn "curl fehlt – Prüfung übersprungen. Jetzt https://$DOMAIN öffnen."; exit 0; }
if routes_to_lernraum "$DOMAIN"; then
  ok "Traefik leitet $DOMAIN an den Lernraum weiter"
else
  warn "Traefik leitet $DOMAIN nicht an den Lernraum weiter."
  info "Passen TRAEFIK_ENTRYPOINT und TRAEFIK_CERTRESOLVER in .env zur Traefik-Konfiguration?"
  TRAEFIK_ID=$(traefik_container)
  [ -z "$TRAEFIK_ID" ] || info "Traefik-Log: docker logs --tail 50 $TRAEFIK_ID 2>&1 | grep -i lernraum"
  exit 1
fi

SERVER_IP=$(server_ip)
DNS_IP=$(dns_ip "$DOMAIN")
online=""
if [ -n "$DNS_IP" ]; then
  # Beim ersten Start holt Traefik das Zertifikat – das dauert einen Moment.
  for _ in $(seq 1 12); do
    if public_ok "$DOMAIN"; then online=1; break; fi
    sleep 5
  done
fi
if [ -n "$online" ]; then
  ok "Online: https://$DOMAIN"
elif [ -z "$DNS_IP" ]; then
  warn "$DOMAIN hat noch keinen DNS-Eintrag. A-Record anlegen: $DOMAIN → ${SERVER_IP:-IP des VPS}"
elif [ -n "$SERVER_IP" ] && [ "$DNS_IP" != "$SERVER_IP" ]; then
  warn "$DOMAIN zeigt auf $DNS_IP, dieser Server hat aber $SERVER_IP – A-Record anpassen."
else
  warn "DNS stimmt, aber noch kein gültiges Zertifikat. In 1–2 Minuten https://$DOMAIN öffnen."
  TRAEFIK_ID=$(traefik_container)
  [ -z "$TRAEFIK_ID" ] || info "Zertifikat-Log: docker logs --tail 50 $TRAEFIK_ID 2>&1 | grep -iE 'acme|$DOMAIN'"
fi
