# Lernraum auf dem Hostinger-VPS (hinter Traefik)

Der Lernraum läuft als eigener Docker-Container auf deinem VPS und hängt sich an den **Traefik** an, der dort bereits läuft – egal ob aus der n8n-Vorlage oder als eigenes Traefik-Projekt. Traefik übernimmt Domain-Routing und HTTPS-Zertifikate – für deine anderen Apps ändert sich nichts.

```
Internet ──► Traefik (Ports 80/443, Let's Encrypt)
               ├─► deine anderen Apps  (wie bisher)
               └─► lernraum:3000       (Next.js + SQLite, Daten in ./data)
```

## Voraussetzungen

- Hostinger-VPS mit Docker und laufendem Traefik (z. B. n8n-Vorlage), Zugang als `root` per SSH oder Browser-Terminal im hPanel
- Eine (Sub-)Domain für den Lernraum, z. B. `lernraum.deine-domain.de`
- 1 GB freier Speicher; der erste Build braucht ca. 1,5 GB RAM (bei KVM 1 ggf. Swap anlegen, siehe unten)

## 1. DNS-Eintrag setzen

Beim Domain-Anbieter (bzw. im hPanel unter *Domains → DNS / Nameserver*) einen **A-Record** anlegen:

| Typ | Name | Wert |
|---|---|---|
| A | `lernraum` | IP deines VPS |

Prüfen (kann ein paar Minuten dauern): `dig +short lernraum.deine-domain.de` → muss die VPS-IP zeigen.

## 2. Code auf den Server holen

```bash
ssh root@<VPS-IP>
cd /opt
git clone https://github.com/moritzbibow/lernraum.git
cd lernraum
```

**Privates Repository?** Einmalig einen Deploy-Key anlegen:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/lernraum_deploy -N ""
cat ~/.ssh/lernraum_deploy.pub
```

Den Schlüssel auf GitHub unter *Repository → Settings → Deploy keys → Add deploy key* eintragen (nur Lesezugriff), dann:

```bash
cat >> ~/.ssh/config <<'CFG'
Host github-lernraum
  HostName github.com
  User git
  IdentityFile ~/.ssh/lernraum_deploy
CFG
git clone git@github-lernraum:moritzbibow/lernraum.git
```

## 3. Einrichten

```bash
./scripts/setup-vps.sh
```

Das Skript

- erkennt den laufenden Traefik samt Entrypoint und Zertifikats-Resolver:
  - Traefik im **Host-Netzwerk** (eigenes Traefik-Projekt): Der Lernraum bekommt ein eigenes Docker-Netzwerk, Traefik erreicht ihn dort direkt.
  - Traefik in einem **eigenen Docker-Netzwerk** (n8n-Vorlage): Der Lernraum tritt diesem Netzwerk zusätzlich bei (`TRAEFIK_NETWORK` + `COMPOSE_FILE` in `.env`).
- schlägt anhand einer schon laufenden Domain eine Adresse vor (z. B. `lernraum.deine-domain.de`) und bricht ab, wenn die gewählte Domain schon von einem anderen Container verwendet wird,
- fragt deinen Namen und ein Login-Passwort ab (leer lassen = zufällig erzeugen),
- erzeugt `SESSION_SECRET` und `LERNRAUM_API_TOKEN`,
- schreibt alles in `.env` (nur für root lesbar) und prüft den DNS-Eintrag.

## 4. Starten

```bash
./scripts/deploy.sh
```

Das Skript baut das Image (beim ersten Mal 3–5 Minuten), startet den Container und prüft am Ende, ob Traefik die Domain an den Lernraum weiterleitet und ob DNS und Zertifikat stimmen. Zusätzlich von Hand:

```bash
docker compose ps                         # STATUS: healthy
curl -s http://127.0.0.1:3100/api/health  # {"ok":true,...}
```

Jetzt `https://lernraum.deine-domain.de` öffnen und mit dem Passwort anmelden. Das Zertifikat holt Traefik beim ersten Aufruf (bis zu 1–2 Minuten).

## 5. Claude verbinden

Siehe [CLAUDE_VERBINDEN.md](CLAUDE_VERBINDEN.md) – in claude.ai einen Connector mit der URL `https://lernraum.deine-domain.de/api/mcp` hinzufügen, einmal anmelden, fertig.

## Optional: Demo-Inhalte

Zum Ausprobieren die Inhalte aus den Mockups einspeisen (lassen sich in *Verwalten* wieder löschen):

```bash
docker compose exec app sh -c 'LERNRAUM_URL=http://127.0.0.1:3000 node scripts/seed-demo.mjs'
```

## Updates

```bash
cd /opt/lernraum
./scripts/deploy.sh
```

Holt den neuesten Code (`git pull`) und führt dann die frisch geholte Fassung des Skripts aus: Image bauen, neu starten, auf den Healthcheck warten, Erreichbarkeit prüfen. Deine Inhalte liegen in `./data` und bleiben erhalten. Inhalte von Claude brauchen **kein** Update – sie sind sofort online.

## Backups

- **Automatisch:** jede Nacht um 03:15 nach `./data/backups/` (die letzten 14 werden behalten).
- **Manuell:** `docker compose exec app node scripts/backup.mjs` – oder in der App unter *Einstellungen → Backup → Jetzt sichern*.
- **Export:** *Einstellungen → Export* lädt alles als JSON herunter (Seiten als Markdown, Quizze, Ergebnisse).
- **Außerhalb des Servers sichern:** z. B. `scp root@<VPS-IP>:/opt/lernraum/data/backups/*.db .` und zusätzlich die Snapshot-Funktion im Hostinger-hPanel nutzen.

### Wiederherstellen

```bash
cd /opt/lernraum
docker compose stop app
cp data/backups/lernraum-<zeitpunkt>.db data/lernraum.db
rm -f data/lernraum.db-wal data/lernraum.db-shm
docker compose start app
```

## Konfiguration (`.env`)

| Variable | Bedeutung |
|---|---|
| `DOMAIN` | Domain für die Traefik-Regel |
| `PUBLIC_URL` | Öffentliche Adresse mit `https://` (für Links, OAuth und Weiterleitungen) |
| `APP_PASSWORD` | Login-Passwort. Ändern → `docker compose up -d` → alle Geräte werden abgemeldet |
| `APP_USER_NAME` | Name für Begrüßung und Initialen |
| `SESSION_SECRET` | Signatur der Login-Cookies (lang und zufällig) |
| `LERNRAUM_API_TOKEN` | Bearer-Token für REST-API und Claude Code |
| `TRAEFIK_ENTRYPOINT` / `TRAEFIK_CERTRESOLVER` | Namen von HTTPS-Entrypoint und Zertifikats-Resolver aus der Traefik-Konfiguration (vom Setup-Skript erkannt) |
| `TRAEFIK_NETWORK` + `COMPOSE_FILE` | Nur wenn Traefik in einem eigenen Docker-Netzwerk läuft (n8n-Vorlage): Der Lernraum tritt diesem Netzwerk bei. Bei Traefik im Host-Netzwerk beide weglassen. |
| `LERNRAUM_LOCAL_PORT` | Diagnose-Port auf 127.0.0.1 (Standard 3100) |
| `MCP_URL_SECRET` | Notfall-Zugang für Claude ohne OAuth (siehe CLAUDE_VERBINDEN.md) |
| `OAUTH_ALLOWED_REDIRECTS` | Zusätzliche erlaubte OAuth-Redirect-URIs |
| `BACKUP_DISABLED=1` | Nächtliches Backup abschalten |

Nach Änderungen an `.env`: `docker compose up -d`.

## Fehlersuche

| Symptom | Ursache / Lösung |
|---|---|
| `docker compose ps` zeigt `unhealthy` | `docker compose logs --tail=100 app` ansehen. Häufig: `SESSION_SECRET` fehlt oder `./data` ist nicht beschreibbar (`chown 1000:1000 data`). |
| `deploy.sh`: „Traefik leitet … nicht an den Lernraum weiter“ / 404 von Traefik | `TRAEFIK_ENTRYPOINT` passt nicht zum Namen des 443-Entrypoints in der Traefik-Konfiguration, oder Traefik liest keine Docker-Labels. Log: `docker logs <traefik-container> 2>&1 \| grep -i lernraum`. |
| `deploy.sh`: „… wird schon von … verwendet“ | Ein anderer Container nutzt die Domain bereits. Eine andere Subdomain in `.env` eintragen (`DOMAIN` und `PUBLIC_URL`). |
| *network … declared as external, but could not be found* | `TRAEFIK_NETWORK`/`COMPOSE_FILE` in `.env` zeigen auf ein Netzwerk, das es nicht gibt. `./scripts/setup-vps.sh` erneut ausführen – es erkennt die Traefik-Anbindung neu. |
| Zertifikatsfehler | DNS zeigt noch nicht auf den VPS oder Port 443 ist in der Hostinger-Firewall gesperrt. Traefik-Logs: `docker logs <traefik-container> 2>&1 \| grep -i acme`. |
| Traefik-Log: *nonexistent certificate resolver* | `TRAEFIK_CERTRESOLVER` in `.env` an den Namen aus der Traefik-Konfiguration anpassen. |
| Traefik-Log: *client version 1.24 is too old* | Docker ≥ 29 braucht Traefik ≥ v3.6 – im Compose-File von Traefik das Image aktualisieren (betrifft alle Apps hinter Traefik). |
| Build bricht mit „Killed“ ab | Zu wenig RAM → Swap anlegen: `fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile`. |
| Login klappt, danach sofort wieder Login-Seite | `PUBLIC_URL` muss mit `https://` beginnen und der aufgerufenen Adresse entsprechen. |

## Ohne Traefik

Läuft kein Traefik (mehr), kann ein anderer Reverse-Proxy (z. B. Caddy) die HTTPS-Zertifikate übernehmen. Minimaler Caddy-Eintrag:

```
lernraum.deine-domain.de {
  reverse_proxy 127.0.0.1:3100
}
```

(`LERNRAUM_LOCAL_PORT=3100` ist bereits auf dem Server gebunden; die Traefik-Labels in `docker-compose.yml` dann entfernen. `deploy.sh` meldet am Ende eine fehlende Traefik-Weiterleitung – das ist in diesem Fall zu erwarten.)
