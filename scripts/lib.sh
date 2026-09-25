# Gemeinsame Helfer für setup-vps.sh und deploy.sh (wird eingebunden, nicht ausgeführt).

bold() { printf '\033[1m%s\033[0m\n' "$*"; }
info() { printf '  %s\n' "$*"; }
warn() { printf '\033[33m  ! %s\033[0m\n' "$*"; }
fail() { printf '\033[31m  ✗ %s\033[0m\n' "$*"; exit 1; }
ok()   { printf '\033[32m  ✓ %s\033[0m\n' "$*"; }

# Wert aus .env lesen (nicht sourcen – Werte dürfen Leerzeichen enthalten).
env_value() { sed -n "s/^$1=//p" .env 2>/dev/null | tail -1; }

# ID des laufenden Traefik-Containers – erkannt am Image „traefik“ (auch „traefik:v3.6“,
# „docker.io/library/traefik“), nicht an Images wie „traefik/whoami“.
traefik_container() {
  docker ps --format '{{.ID}} {{.Image}}' | awk '$2 ~ /(^|\/)traefik(:|@|$)/ {print $1; exit}'
}

# Traefik-Router-Regeln aller laufenden Container außer dem Lernraum („name rule“ je Zeile).
other_router_rules() {
  local c
  for c in $(docker ps --format '{{.Names}}'); do
    [ "$c" = lernraum ] && continue
    docker inspect -f '{{range $k, $v := .Config.Labels}}{{$k}}={{$v}}{{println}}{{end}}' "$c" 2>/dev/null \
      | sed -nE "s/^traefik\.http\.routers\.[^=]+\.rule=(.*)$/$c \1/p"
  done
  return 0
}

# Container, deren Traefik-Router die Domain schon verwenden.
domain_users() {
  other_router_rules | grep -F "\`$1\`" | awk '{print $1}' | sort -u
  return 0
}

# Öffentliche IPv4 des Servers und die IPv4, auf die die Domain zeigt.
server_ip() { (curl -fsS --max-time 5 https://api.ipify.org 2>/dev/null || hostname -I 2>/dev/null | awk '{print $1}') || true; }
dns_ip() { (getent ahostsv4 "$1" 2>/dev/null | awk 'NR==1{print $1}') || true; }

# Leitet der Traefik auf diesem Server die Domain an den Lernraum weiter?
# (direkt über 127.0.0.1 – unabhängig von DNS und Zertifikat)
routes_to_lernraum() {
  local _
  for _ in $(seq 1 10); do
    curl -sk --noproxy '*' --max-time 5 --resolve "$1:443:127.0.0.1" "https://$1/api/health" 2>/dev/null \
      | grep -q '"service":"lernraum"' && return 0
    sleep 2
  done
  return 1
}

# Ist der Lernraum von außen mit gültigem Zertifikat erreichbar?
public_ok() {
  curl -fsS --max-time 8 "https://$1/api/health" 2>/dev/null | grep -q '"service":"lernraum"'
}
