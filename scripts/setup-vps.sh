#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Lernraum – Einrichtung auf dem VPS (hinter dem Traefik, der dort schon läuft).
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
. scripts/lib.sh

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
TRAEFIK_ID=$(traefik_container)
DETECTED_DOMAIN=""
if [ -z "$TRAEFIK_ID" ]; then
  warn "Kein laufender Traefik-Container gefunden."
  warn "Der Lernraum braucht einen Reverse-Proxy für Domain und HTTPS – siehe docs/DEPLOY.md, Abschnitt „Ohne Traefik“."
else
  TRAEFIK_NAME=$(docker inspect -f '{{.Name}}' "$TRAEFIK_ID" | sed 's#^/##')
  ok "Traefik gefunden: $TRAEFIK_NAME"
  ARGS=$(docker inspect -f '{{range .Args}}{{println .}}{{end}}{{range .Config.Cmd}}{{println .}}{{end}}' "$TRAEFIK_ID" 2>/dev/null || true)
  if [ "$(docker inspect -f '{{.HostConfig.NetworkMode}}' "$TRAEFIK_ID")" = host ]; then
    # Traefik im Host-Netzwerk erreicht Container in jedem Docker-Netzwerk direkt.
    info "Traefik läuft im Host-Netzwerk – der Lernraum bekommt ein eigenes Netzwerk."
  elif [ -z "${TRAEFIK_NETWORK:-}" ]; then
    TRAEFIK_NETWORK=$(docker inspect -f '{{range $k, $v := .NetworkSettings.Networks}}{{println $k}}{{end}}' "$TRAEFIK_ID" | grep -vE '^(bridge|host|none)?$' | head -1 || true)
    [ -n "$TRAEFIK_NETWORK" ] || warn "Traefik hängt nur im Standard-Netzwerk von Docker – TRAEFIK_NETWORK bitte von Hand in .env setzen."
  fi
  if [ -z "${TRAEFIK_CERTRESOLVER:-}" ]; then
    TRAEFIK_CERTRESOLVER=$(printf '%s\n' "$ARGS" | sed -nE 's/^--certificatesresolvers\.([^.=]+)\..*/\1/Ip' | head -1)
  fi
  if [ -z "${TRAEFIK_ENTRYPOINT:-}" ]; then
    TRAEFIK_ENTRYPOINT=$(printf '%s\n' "$ARGS" | sed -nE 's#^--entrypoints\.([^.=]+)\.address=[^:]*:443(/tcp)?$#\1#Ip' | head -1)
  fi
  # Domain eines anderen Containers als Vorschlag (lernraum.<domain>)
  DETECTED_DOMAIN=$(other_router_rules | sed -nE 's/^[^ ]+ .*Host\(`([^`]+)`\).*/\1/p' | head -1)
fi
TRAEFIK_NETWORK=${TRAEFIK_NETWORK:-}
TRAEFIK_CERTRESOLVER=${TRAEFIK_CERTRESOLVER:-mytlschallenge}
TRAEFIK_ENTRYPOINT=${TRAEFIK_ENTRYPOINT:-websecure}
if [ -n "$TRAEFIK_NETWORK" ]; then
  info "Netzwerk:      $TRAEFIK_NETWORK"
  docker network inspect "$TRAEFIK_NETWORK" >/dev/null 2>&1 || warn "Netzwerk $TRAEFIK_NETWORK existiert nicht – bitte in .env korrigieren."
else
  info "Netzwerk:      eigenes (lernraum_default)"
fi
info "Entrypoint:    $TRAEFIK_ENTRYPOINT"
info "Cert-Resolver: $TRAEFIK_CERTRESOLVER"

bold "3/5 Adresse und Zugang"
SUGGEST=""
if [ -n "$DETECTED_DOMAIN" ]; then
  BASE_DOMAIN=${DETECTED_DOMAIN#*.}
  [[ "$BASE_DOMAIN" == *.* ]] || BASE_DOMAIN=$DETECTED_DOMAIN
  SUGGEST="lernraum.$BASE_DOMAIN"
  info "(auf diesem Server läuft schon $DETECTED_DOMAIN)"
fi
ask DOMAIN "Domain für den Lernraum" "$SUGGEST"
[ -n "$DOMAIN" ] || fail "Domain ist erforderlich."
USERS=$(domain_users "$DOMAIN")
[ -z "$USERS" ] || fail "$DOMAIN wird schon von $(echo $USERS) verwendet – bitte eine andere (Sub-)Domain wählen."
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
{
  cat <<ENV
DOMAIN=$DOMAIN
PUBLIC_URL=https://$DOMAIN
APP_PASSWORD=$APP_PASSWORD
APP_USER_NAME=$APP_USER_NAME
SESSION_SECRET=$(rand 64)
LERNRAUM_API_TOKEN=lr_$(rand 40)
TRAEFIK_ENTRYPOINT=$TRAEFIK_ENTRYPOINT
TRAEFIK_CERTRESOLVER=$TRAEFIK_CERTRESOLVER
TZ=Europe/Berlin
ENV
  if [ -n "$TRAEFIK_NETWORK" ]; then
    # Traefik im eigenen Docker-Netzwerk: der Lernraum tritt diesem Netzwerk zusätzlich bei.
    printf 'TRAEFIK_NETWORK=%s\nCOMPOSE_FILE=docker-compose.yml:docker-compose.traefik-net.yml\n' "$TRAEFIK_NETWORK"
  fi
} > .env
umask 022
mkdir -p data
chown 1000:1000 data 2>/dev/null || warn "Konnte ./data nicht an UID 1000 übergeben – ggf. mit sudo: chown 1000:1000 data"
ok ".env geschrieben (nur für den Eigentümer lesbar)"
if [ -n "${GENERATED_PW:-}" ]; then info "Erzeugtes Login-Passwort: $APP_PASSWORD  (steht in .env)"; fi

bold "5/5 DNS prüfen"
SERVER_IP=$(server_ip)
DNS_IP=$(dns_ip "$DOMAIN")
if [ -z "$DNS_IP" ]; then
  warn "$DOMAIN löst noch nicht auf. A-Record auf ${SERVER_IP:-die VPS-IP} setzen (siehe docs/DEPLOY.md)."
elif [ -n "$SERVER_IP" ] && [ "$DNS_IP" != "$SERVER_IP" ]; then
  warn "$DOMAIN zeigt auf $DNS_IP, der Server hat aber $SERVER_IP."
else
  ok "$DOMAIN → $DNS_IP"
fi

echo
bold "Fertig. Starten mit:"
info "./scripts/deploy.sh"
info "Danach: https://$DOMAIN  (Zertifikat holt Traefik automatisch, kann 1–2 Minuten dauern)"
