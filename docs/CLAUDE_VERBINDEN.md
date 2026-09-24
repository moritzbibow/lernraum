# Claude mit dem Lernraum verbinden

Der Lernraum stellt einen **MCP-Server** bereit (`https://<deine-domain>/api/mcp`). Damit kann Claude direkt aus dem Chat Lernseiten und Quizze einspeisen, die Struktur lesen und bestehende Seiten überarbeiten. Alles ist sofort online.

## A) claude.ai / Claude-App (empfohlen)

1. Im Lernraum *Einstellungen → Claude verbinden* öffnen und die URL kopieren (`https://<deine-domain>/api/mcp`).
2. In claude.ai: *Einstellungen → Connectors → Benutzerdefinierten Connector hinzufügen* (engl. „Add custom connector“).
3. Name `Lernraum`, die URL einfügen, hinzufügen.
4. Auf **Verbinden** klicken. Es öffnet sich der Lernraum: mit deinem Passwort anmelden und **Zulassen** wählen.
5. Im Chat über das Werkzeug-/Connector-Menü „Lernraum“ aktivieren.

Der Connector ist an dein Claude-Konto gebunden und steht damit auch in der Desktop- und Mobil-App zur Verfügung. Verbundene Apps siehst (und trennst) du unter *Einstellungen → Verbundene Clients* im Lernraum.

## B) Claude Code

```bash
claude mcp add --transport http lernraum https://<deine-domain>/api/mcp \
  --header "Authorization: Bearer <LERNRAUM_API_TOKEN aus der .env>"
```

Alternativ ohne Token: `claude mcp add --transport http lernraum https://<deine-domain>/api/mcp`, dann in Claude Code `/mcp` → *Authenticate* (gleicher Login wie oben).

## C) REST (Skripte, n8n-Workflows)

```bash
curl -X POST https://<deine-domain>/api/ingest \
  -H "Authorization: Bearer $LERNRAUM_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "subject": "Sport",
    "path": ["Sporttheorie"],
    "page": { "title": "Stunde 6 – Beweglichkeit", "content_md": "## Grundlagen\n\n…" },
    "quiz": { "questions": [ { "type": "tf", "prompt": "Dehnen vor dem Sprint erhöht die Leistung.", "correct": false } ] }
  }'
```

Weitere Endpunkte: `GET /api/tree` (`?format=text`), `GET /api/pages/<id>`, `GET|PATCH /api/quizzes/<id>`, `GET /api/search?q=…`. Das vollständige Format steht in [CONTENT_FORMAT.md](CONTENT_FORMAT.md).

## So sprichst du mit Claude

- „Hier ist mein Lernzettel zu Stunde 6 in Sporttheorie – speise ihn in den Lernraum ein.“ *(Foto, PDF oder Text anhängen)*
- „Mach aus diesem Kapitel eine Lernseite unter Geschichte › 20. Jh. mit 10 Quizfragen.“
- „Ergänze auf ‚Stunde 4 – Trainingsprinzipien‘ ein Thema zu Übertraining.“
- „Das Quiz zu Stunde 2 ist zu leicht – ersetze es durch 12 schwerere Fragen.“
- „Welche Seiten habe ich schon zu Kant?“

Claude antwortet mit dem Link zur neuen Seite. Sie erscheint sofort im **Eingang** (mit Badge in der Seitenleiste) und unter „Frisch eingespeist“ auf der Übersicht.

## Werkzeuge des Connectors

| Tool | Zweck |
|---|---|
| `list_tree` | Fächer, Ordner und Seiten mit IDs – Claude nutzt das, um vorhandene Orte wiederzuverwenden |
| `ingest_page` | Lernseite anlegen/aktualisieren, optional mit Quiz |
| `ingest_quiz` | Quiz an eine bestehende Seite hängen oder ein Quiz ersetzen |
| `get_page` | Seite mit Markdown und Quiz lesen (zum Überarbeiten) |
| `search` | Volltextsuche |
| `get_format_guide` | Das komplette Inhaltsformat |

Claude kann **nichts löschen** – Löschen, Verschieben und Umbenennen passieren nur in der Oberfläche (*Verwalten*). Überschreibt Claude eine Seite, wird die vorige Version automatisch gesichert.

## Optional: Skill für gleichbleibende Qualität

Im Ordner [`claude-skill/lernraum-einspeisen`](claude-skill/lernraum-einspeisen/SKILL.md) liegt ein Skill, der Claude genau beschreibt, wie ein Lernzettel aufbereitet wird (Vollständigkeit, Gliederung in Themen, Merke-Blöcke, Quiz-Qualität). Den Ordner als ZIP packen und in claude.ai unter *Einstellungen → Fähigkeiten → Skills* hochladen.

```bash
cd docs/claude-skill && zip -r lernraum-einspeisen.zip lernraum-einspeisen
```

## Fehlerbehebung

| Problem | Lösung |
|---|---|
| Connector lässt sich nicht verbinden | `https://<deine-domain>/.well-known/oauth-authorization-server` im Browser öffnen – muss JSON zeigen, `issuer` muss exakt deiner `PUBLIC_URL` entsprechen. Zertifikat gültig? |
| „Redirect-URI nicht erlaubt“ | Die Callback-Adresse des Clients in `OAUTH_ALLOWED_REDIRECTS` (`.env`) eintragen und neu starten. |
| Claude meldet „Anmeldung erforderlich“ | Verbindung in claude.ai trennen und neu verbinden (z. B. nach Passwortänderung). |
| Notfall ohne OAuth | In `.env` `MCP_URL_SECRET=<mind. 24 zufällige Zeichen>` setzen, neu starten und `https://<deine-domain>/api/mcp/k/<secret>` als Connector-URL verwenden. Diese URL wie ein Passwort behandeln. |
