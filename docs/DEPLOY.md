# Lernraum auf dem Hostinger-VPS (neben n8n)

Der Lernraum läuft als eigener Docker-Container auf deinem VPS und hängt sich an den **Traefik** an, der mit der n8n-Vorlage bereits läuft. Traefik übernimmt Domain-Routing und HTTPS-Zertifikate – für n8n ändert sich nichts.

```
Internet ──► Traefik (aus der n8n-Vorlage, Ports 80/443, Let's Encrypt)
               ├─► n8n            (wie bisher)
               └─► lernraum:3000  (Next.js + SQLite, Daten in ./data)
```

## Voraussetzungen

- Hostinger-VPS mit der n8n-Vorlage (Traefik läuft), SSH-Zugang als `root`
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

- erkennt den laufenden Traefik (Netzwerk, Entrypoint, Zertifikats-Resolver),
- schlägt anhand der n8n-Domain eine Adresse vor (z. B. `lernraum.deine-domain.de`),
- fragt deinen Namen und ein Login-Passwort ab (leer lassen = zufällig erzeugen),
- erzeugt `SESSION_SECRET` und `LERNRAUM_API_TOKEN`,
- schreibt alles in `.env` (nur für root lesbar) und prüft den DNS-Eintrag.

## 4. Starten

```bash
docker compose up -d --build
```

Der erste Build dauert 3–5 Minuten. Danach:

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

Holt den neuesten Code (`git pull`), baut das Image, startet neu und wartet auf den Healthcheck. Deine Inhalte liegen in `./data` und bleiben erhalten. Inhalte von Claude brauchen **kein** Update – sie sind sofort online.

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
| `TRAEFIK_NETWORK` / `TRAEFIK_ENTRYPOINT` / `TRAEFIK_CERTRESOLVER` | Anbindung an den n8n-Traefik (vom Setup-Skript erkannt) |
| `LERNRAUM_LOCAL_PORT` | Diagnose-Port auf 127.0.0.1 (Standard 3100) |
| `MCP_URL_SECRET` | Notfall-Zugang für Claude ohne OAuth (siehe CLAUDE_VERBINDEN.md) |
| `OAUTH_ALLOWED_REDIRECTS` | Zusätzliche erlaubte OAuth-Redirect-URIs |
| `BACKUP_DISABLED=1` | Nächtliches Backup abschalten |

Nach Änderungen an `.env`: `docker compose up -d`.

## Fehlersuche

| Symptom | Ursache / Lösung |
|---|---|
| `docker compose ps` zeigt `unhealthy` | `docker compose logs --tail=100 app` ansehen. Häufig: `SESSION_SECRET` fehlt oder `./data` ist nicht beschreibbar (`chown 1000:1000 data`). |
| 404 von Traefik | Domain in `.env` stimmt nicht mit dem Aufruf überein oder falsches `TRAEFIK_NETWORK`. `docker network ls` und `docker inspect <traefik-container>` prüfen. |
| Zertifikatsfehler | DNS zeigt noch nicht auf den VPS oder Port 443 ist in der Hostinger-Firewall gesperrt. Traefik-Logs: `docker logs <traefik-container> 2>&1 \| grep -i acme`. |
| Traefik-Log: *nonexistent certificate resolver* | `TRAEFIK_CERTRESOLVER` in `.env` an den Namen aus der n8n-Konfiguration anpassen. |
| Traefik-Log: *client version 1.24 is too old* | Docker ≥ 29 braucht Traefik ≥ v3.6 – im n8n-Compose das Traefik-Image aktualisieren (betrifft auch n8n). |
| Build bricht mit „Killed“ ab | Zu wenig RAM → Swap anlegen: `fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile`. |
| Login klappt, danach sofort wieder Login-Seite | `PUBLIC_URL` muss mit `https://` beginnen und der aufgerufenen Adresse entsprechen. |

## Ohne Traefik

Falls n8n/Traefik irgendwann wegfällt, kann ein eigener Reverse-Proxy (z. B. Caddy) die HTTPS-Zertifikate übernehmen. Minimaler Caddy-Eintrag:

```
lernraum.deine-domain.de {
  reverse_proxy 127.0.0.1:3100
}
```

(`LERNRAUM_LOCAL_PORT=3100` ist bereits auf dem Server gebunden; die Traefik-Labels und das externe Netzwerk in `docker-compose.yml` dann entfernen.)
