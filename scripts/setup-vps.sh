#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Lernraum – Einrichtung auf dem VPS (neben dem bestehenden n8n/Traefik).
#
#   ./scripts/setup-vps.sh
#
# Erkennt den laufenden Traefik-Container (Netzwerk, Entrypoint, Zertifikats-
# Resolver), fragt Domain und Passwort ab, erzeugt Secrets und schreibt .env.
# Werte können auch vorab als Umgebungsvariablen gesetzt werden
# (DOMAIN, APP_PASSWORD, APP_USER_NAME, TRAEFIK_NETWORK, …) – dann wird nicht gefragt.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail
cd "$(dirname "$0")/.."

bold() { printf '\033[1m%s\033[0m\n' "$*"; }
info() { printf '  %s\n' "$*"; }
warn() { printf '\033[33m  ! %s\033[0m\n' "$*"; }
fail() { printf '\033[31m  ✗ %s\033[0m\n' "$*"; exit 1; }
ok()   { printf '\033[32m  ✓ %s\033[0m\n' "$*"; }
ask()  { # ask VAR "Frage" "Default"
  local __var=$1 __q=$2 __def=${3:-} __ans
  if [ -n "${!__var:-}" ]; then return; fi
  if [ -n "$__def" ]; then read -r -p "  $__q [$__def]: " __ans || true; else read -r -p "  $__q: " __ans || true; fi
  printf -v "$__var" '%s' "${__ans:-$__def}"
}
rand() { head -c 48 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c "${1:-40}"; }

bold "1/5 Voraussetzungen"
command -v docker >/dev/null || fail "Docker fehlt. Installation: https://docs.docker.com/engine/install/ubuntu/"
docker compose version >/dev/null 2>&1 || fail "Docker Compose (Plugin) fehlt."
docker info >/dev/null 2>&1 || fail "Docker läuft nicht oder keine Berechtigung (als root oder Mitglied der Gruppe docker ausführen)."
ok "Docker $(docker version --format '{{.Server.Version}}' 2>/dev/null) mit Compose"

bold "2/5 Traefik erkennen"
TRAEFIK_ID=$(docker ps --format '{{.ID}} {{.Image}} {{.Names}}' | awk 'tolower($2) ~ /traefik/ || tolower($3) ~ /traefik/ {print $1; exit}')
DETECTED_DOMAIN=""
if [ -z "$TRAEFIK_ID" ]; then
  warn "Kein laufender Traefik-Container gefunden."
  warn "Läuft n8n noch? Sonst siehe docs/DEPLOY.md, Abschnitt „Ohne Traefik“."
else
  TRAEFIK_NAME=$(docker inspect -f '{{.Name}}' "$TRAEFIK_ID" | sed 's#^/##')
  ok "Traefik gefunden: $TRAEFIK_NAME"
  ARGS=$(docker inspect -f '{{range .Args}}{{println .}}{{end}}{{range .Config.Cmd}}{{println .}}{{end}}' "$TRAEFIK_ID" 2>/dev/null || true)
  if [ -z "${TRAEFIK_NETWORK:-}" ]; then
    TRAEFIK_NETWORK=$(docker inspect -f '{{range $k, $v := .NetworkSettings.Networks}}{{println $k}}{{end}}' "$TRAEFIK_ID" | grep -vE '^(bridge|host|none)?$' | head -1 || true)
  fi
  if [ -z "${TRAEFIK_CERTRESOLVER:-}" ]; then
    TRAEFIK_CERTRESOLVER=$(printf '%s\n' "$ARGS" | sed -nE 's/^--certificatesresolvers\.([^.=]+)\..*/\1/Ip' | head -1)
  fi
  if [ -z "${TRAEFIK_ENTRYPOINT:-}" ]; then
    TRAEFIK_ENTRYPOINT=$(printf '%s\n' "$ARGS" | sed -nE 's/^--entrypoints\.([^.=]+)\.address=:?443$/\1/Ip' | head -1)
  fi
  # Domain des n8n-Containers als Vorschlag (lernraum.<domain>)
  DETECTED_DOMAIN=$(docker ps -q | xargs -r docker inspect -f '{{range $k, $v := .Config.Labels}}{{$k}}={{$v}}{{println}}{{end}}' 2>/dev/null \
    | sed -nE 's/^traefik\.http\.routers\.[^.]+\.rule=.*Host\(`([^`]+)`\).*/\1/p' | head -1)
fi
TRAEFIK_NETWORK=${TRAEFIK_NETWORK:-root_default}
TRAEFIK_CERTRESOLVER=${TRAEFIK_CERTRESOLVER:-mytlschallenge}
TRAEFIK_ENTRYPOINT=${TRAEFIK_ENTRYPOINT:-websecure}
info "Netzwerk:      $TRAEFIK_NETWORK"
info "Entrypoint:    $TRAEFIK_ENTRYPOINT"
info "Cert-Resolver: $TRAEFIK_CERTRESOLVER"
docker network inspect "$TRAEFIK_NETWORK" >/dev/null 2>&1 || warn "Netzwerk $TRAEFIK_NETWORK existiert nicht – bitte in .env korrigieren."

bold "3/5 Adresse und Zugang"
SUGGEST=""
if [ -n "$DETECTED_DOMAIN" ]; then
  BASE_DOMAIN=${DETECTED_DOMAIN#*.}
  [[ "$BASE_DOMAIN" == *.* ]] || BASE_DOMAIN=$DETECTED_DOMAIN
  SUGGEST="lernraum.$BASE_DOMAIN"
  info "(n8n läuft unter $DETECTED_DOMAIN)"
fi
ask DOMAIN "Domain für den Lernraum" "$SUGGEST"
[ -n "$DOMAIN" ] || fail "Domain ist erforderlich."
ask APP_USER_NAME "Dein Name (Begrüßung, Initialen)" "Moritz Bibow"
if [ -z "${APP_PASSWORD:-}" ]; then
  read -r -s -p "  Login-Passwort (leer = zufällig erzeugen): " APP_PASSWORD || true
  echo
  if [ -z "$APP_PASSWORD" ]; then APP_PASSWORD=$(rand 20); GENERATED_PW=1; fi
fi

bold "4/5 .env schreiben"
if [ -f .env ] && [ -z "${FORCE:-}" ]; then
  read -r -p "  .env existiert bereits. Überschreiben? [j/N]: " yn || true
  [[ "${yn:-n}" =~ ^[jJyY] ]] || { info "Abgebrochen – bestehende .env bleibt."; exit 0; }
  cp .env ".env.backup-$(date +%Y%m%d-%H%M%S)"
fi
umask 177
cat > .env <<ENV
DOMAIN=$DOMAIN
PUBLIC_URL=https://$DOMAIN
APP_PASSWORD=$APP_PASSWORD
APP_USER_NAME=$APP_USER_NAME
SESSION_SECRET=$(rand 64)
LERNRAUM_API_TOKEN=lr_$(rand 40)
TRAEFIK_NETWORK=$TRAEFIK_NETWORK
TRAEFIK_ENTRYPOINT=$TRAEFIK_ENTRYPOINT
TRAEFIK_CERTRESOLVER=$TRAEFIK_CERTRESOLVER
TZ=Europe/Berlin
ENV
umask 022
mkdir -p data
chown 1000:1000 data 2>/dev/null || warn "Konnte ./data nicht an UID 1000 übergeben – ggf. mit sudo: chown 1000:1000 data"
ok ".env geschrieben (nur für den Eigentümer lesbar)"
if [ -n "${GENERATED_PW:-}" ]; then info "Erzeugtes Login-Passwort: $APP_PASSWORD  (steht in .env)"; fi

bold "5/5 DNS prüfen"
SERVER_IP=$( (curl -fsS --max-time 5 https://api.ipify.org 2>/dev/null || hostname -I 2>/dev/null | awk '{print $1}') || true)
DNS_IP=$( (getent ahostsv4 "$DOMAIN" 2>/dev/null | awk 'NR==1{print $1}') || true)
if [ -z "$DNS_IP" ]; then
  warn "$DOMAIN löst noch nicht auf. A-Record auf ${SERVER_IP:-die VPS-IP} setzen (siehe docs/DEPLOY.md)."
elif [ -n "$SERVER_IP" ] && [ "$DNS_IP" != "$SERVER_IP" ]; then
  warn "$DOMAIN zeigt auf $DNS_IP, der Server hat aber $SERVER_IP."
else
  ok "$DOMAIN → $DNS_IP"
fi

echo
bold "Fertig. Starten mit:"
info "docker compose up -d --build"
info "Danach: https://$DOMAIN  (Zertifikat holt Traefik automatisch, kann 1–2 Minuten dauern)"
