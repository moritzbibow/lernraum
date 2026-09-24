# Handoff: Lernraum – persönliches Lerntool (Web-App)

## Overview
Persönliche Lern-Web-App für einen einzelnen Nutzer (Moritz), selbst gehostet auf einem Hostinger-VPS.
- Eigene **Fächer** (Sport, Englisch, Mathe, Philosophie, Geschichte, …)
- Innerhalb eines Fachs **Lernseiten mit beliebig tiefen Unterseiten** (z. B. Sport › Sporttheorie › Stunde 1–5), jede Seite hat **Themen** (Abschnitte)
- **Allgemeine Lernseiten** ohne Fach
- **Quizze** hängen an einer Lernseite. Sie werden **nie in der UI erstellt**, sondern von Claude per Chat/API eingespeist. In der UI kann man sie nur spielen und bearbeiten.
- Verwalten: verschieben, umbenennen, löschen – mehr nicht
- **Dark Mode ist Standard**, Umschalter auf Hell in der Sidebar (Toggle unten) bzw. in den Einstellungen

Der wichtigste Ablauf: Moritz gibt Claude einen Lernzettel → Claude wandelt ihn in das Inhaltsformat unten um → schickt ihn an die Ingest-API → die Seite ist sofort online und erscheint im **Eingang**.

## About the Design Files
Die Dateien in diesem Paket sind **Design-Referenzen in HTML**. Sie zeigen Aussehen und Verhalten, sind aber kein Produktionscode. Die Aufgabe ist, diese Designs in einer echten App neu umzusetzen (Stack-Empfehlung unten). `Lerntool Dashboard.dc.html` öffnet sich direkt im Browser (`support.js` muss daneben liegen).

Maßgeblich sind die Screens in **Turn 2 (Option 2a)** und **Turn 3 (3a–3d)**. Turn 1 und 2b sind verworfene Richtungen und dienen nur als Kontext.

## Fidelity
**High-fidelity.** Farben, Typografie, Abstände und Radien sind final. Pixelgenau umsetzen. Der helle Modus ist noch nicht gestaltet: Die Tokens unten invertieren, Akzentfarben beibehalten (im hellen Modus die Akzent-Helligkeit auf ~0.55 senken, damit der Kontrast reicht).

---

## Empfohlene Architektur

### Stack
- **Next.js 15 (App Router, TypeScript)** – SSR, API-Routen und UI in einem Projekt
- **SQLite + Drizzle ORM** – eine Datei, kein DB-Server, einfaches Backup
- **Markdown (MDX-frei, `remark`/`rehype`)** für Seiteninhalte, mit eigenen Blöcken (Merke, Tabelle, Formel über KaTeX)
- **Tailwind** oder CSS-Module mit den Tokens unten als CSS-Variablen (`[data-theme="dark"|"light"]`)
- **Auth:** Single-User-Passwort-Login (Session-Cookie) für die UI, separater **API-Token** für die Ingest-API
- **Deployment:** Docker Compose auf dem VPS: `app` (Node) + `caddy` (Reverse Proxy, automatisches HTTPS). Die SQLite-Datei liegt auf einem Volume, dazu ein nächtliches Backup per Cron.

### Datenmodell
```
Subject   id, slug, name, color(hue), sort, createdAt
Page      id, subjectId|null, parentId|null, slug, title, sort,
          contentMd, topics(json: [{id,title}]), source('claude'|'manual'),
          createdAt, updatedAt, readProgress(0–1), lastOpenedAt
Quiz      id, pageId, title, createdAt, updatedAt
Question  id, quizId, sort, type('mc'|'tf'|'text'), prompt,
          answers(json: [{text, correct}]), explanation
Attempt   id, quizId, score, total, finishedAt
InboxItem id, kind('page'|'quiz'), refId, createdAt, seenAt|null
```
- `subjectId = null` → allgemeine Lernseite
- `parentId` bildet den Baum (Fach › Ordner/Seite › Unterseite). „Ordner“ ist einfach eine Seite ohne oder mit kurzem Inhalt.
- Pfad-URL: `/f/sport/sporttheorie/stunde-4`

### Ingest-API (Kern der Claude-Integration)
`POST /api/ingest` · Header `Authorization: Bearer <INGEST_TOKEN>`

```json
{
  "subject": "Sport",
  "path": ["Sporttheorie", "Stunde 5 – Ausdauertraining"],
  "page": {
    "title": "Stunde 5 – Ausdauertraining",
    "content_md": "## Grundlagen\n...\n:::merke\nText\n:::\n## Methoden\n..."
  },
  "quiz": {
    "title": "Ausdauer",
    "questions": [
      { "type": "mc", "prompt": "…?", "answers": [{"text":"…","correct":true},{"text":"…"}], "explanation": "…" },
      { "type": "tf", "prompt": "…", "answers": [{"text":"Wahr","correct":true},{"text":"Falsch"}] }
    ]
  },
  "mode": "upsert"
}
```
Regeln:
- Fehlende Fächer und Pfad-Segmente werden automatisch angelegt (Upsert nach Slug)
- `topics` werden serverseitig aus den `##`-Überschriften erzeugt
- `mode: "upsert"` überschreibt eine bestehende Seite mit gleichem Pfad, `"append-quiz"` hängt nur ein Quiz an eine bestehende Seite
- Validierung mit Zod. Fehler kommen als `400` mit einer klaren Meldung zurück, damit Claude selbst korrigieren kann.
- Jeder erfolgreiche Ingest erzeugt ein `InboxItem` (sichtbar im Eingang, Badge in der Sidebar)
- Antwort: `{ "url": "https://…/f/sport/sporttheorie/stunde-5", "pageId": "…", "quizId": "…" }`

Weitere Endpunkte (ebenfalls per Token): `GET /api/tree` (damit Claude die bestehende Struktur kennt), `GET /api/pages/:id`, `PATCH /api/quizzes/:id`.

**Optional, empfohlen:** ein kleiner **MCP-Server** (`/mcp` oder ein separates Paket) mit den Tools `list_tree`, `ingest_page`, `ingest_quiz`. Dann kann Claude direkt aus dem Chat einspeisen, ohne dass Moritz JSON kopieren muss. Zusätzlich eine `CONTENT_FORMAT.md` im Repo ablegen, die man Claude als Anleitung geben kann.

---

## Screens / Views

### Globales Layout
- Desktop-Referenz: 1280 × 820. Das Layout ist fluid, die Sidebar hat eine feste Breite.
- **Sidebar** 268 px, `border-right: 1px solid rgba(255,245,230,.07)`, Padding 26/18 px, Gap 22 px
  - Logo: Kreis 20 px in Akzentfarbe + „Lernraum“ in Instrument Serif 25 px
  - Navigation (14 px): Übersicht · Eingang (Badge: Akzent-Hintergrund, Text #131211, JetBrains Mono 600 10.5 px, Pill) · Alle Quizze · Verwalten. Aktiver Eintrag: `background: rgba(255,245,230,.07)`, 600, Radius 8
  - „BIBLIOTHEK“-Label: JetBrains Mono 500 10.5 px, letter-spacing .1em, #6f6c66
  - Baum: Fach = 7-px-Punkt in Fachfarbe + Name (13.5 px). Unterebene um 26 px eingerückt. Blätter in einer Spalte mit `border-left 1px rgba(255,245,230,.1)`. Aktive Seite: `border-left 2px Akzent`, Hintergrund `rgba(255,245,230,.05)`. Neue Seiten tragen das Label „NEU“ (Mono 9.5 px, Akzent). Pfeile ▾/▸ in #7d7a74.
  - Unten: „Dunkler Modus“ + Toggle 40 × 22 (an = Akzent-Track, Knopf #131211)
- Fokus-Screens (Quiz bearbeiten, Verwalten) nutzen eine **Icon-Rail** von 72 px statt der vollen Sidebar
- Mobil (390 breit): kein Sidebar-Baum. Unten eine Pill-Navigation „Start · Bibliothek · Eingang“ (Hintergrund #1f1d1b, aktiver Eintrag #ece9e4 mit Text #131211)

### 1. Übersicht / Dashboard (Option 2a)
- Kopf: Datum (Mono 11 px, .1em, #7d7a74, Großbuchstaben) + „Guten Abend, Moritz.“ (Instrument Serif 48 px, lh 1.05; Begrüßung abhängig von der Tageszeit) + Avatar 36 px rechts
- **Suche** (öffnet die ⌘K-Befehlspalette): Hintergrund #1b1a18, `border 1px rgba(255,245,230,.1)`, Radius 16, Padding 17/20, Ring `0 0 0 6px rgba(255,245,230,.025)`, Platzhalter 16 px #7d7a74, darunter Chips mit den letzten Seiten (12.5 px, Pill, Border .09)
- **Bento-Raster**: 3 Spalten × 2 Zeilen, Gap 14, Radius 22
  - Große Kachel (1 Spalte × 2 Zeilen) „Weiterlernen“: Akzent-Hintergrund, Text #131211, Titel Serif 46 px, Themenliste mit Status ✓/—, Buttons „Öffnen“ (Pill, #131211) und „Quiz · N“ (Outline 1.5 px)
  - „Frisch eingespeist“ (2 Spalten breit): Liste aus Typ-Label (Mono 10 px, LERNSEITE = Akzent, QUIZ = Amber), Titel Serif 20 px, Pfad 12.5 px #8f8b84, Zeit
  - 2 Kacheln „zuletzt geöffnet“: Label „FACH › BEREICH“ in Fachfarbe, Titel Serif 27 px unten, Fortschritt 2 px hoch

### 2. Lernseite lesen (3a)
- Breadcrumb-Leiste 13 px mit den Buttons „Verschieben“ und „···“
- Artikel: Padding 40/56, Textbreite max. 640 px. Kicker in Mono Akzent, H1 Serif 52 px, Meta-Zeile, H2 Serif 28 px nummeriert („1 · …“), Fließtext 16/1.7 in #cfcbc4
- „Merke“-Block: `background: Akzent/10 %`, `border: Akzent/28 %`, Radius 14
- Rechte Spalte (250 px): THEMEN-Inhaltsverzeichnis mit Scroll-Spy und eine Quiz-Karte (Akzent) mit dem letzten Ergebnis und „Starten“

### 3. Quiz spielen (3b)
- Vollbild, keine Sidebar. ✕ schließt (zurück zur Seite)
- Fortschritt als N Segmente (3 px): richtig = Akzent, falsch = oklch(.72 .13 30), aktuell = #ece9e4, offen = rgba(255,245,230,.1)
- Frage Serif 42 px, Breite 720 px zentriert. Antworten als Karten (Buchstaben-Badge A–D)
- Nach der Antwort: die richtige Antwort bekommt einen Akzent-Rahmen 1.5 px und das Label „RICHTIG“, eine falsche Wahl wird rot markiert, darunter der Block „WARUM“ mit Erklärung + Link „Zur Seite →“
- Tastatur: A–D bzw. 1–4 wählt, Enter geht weiter. Am Ende eine Ergebnisseite (Score, falsche Fragen wiederholen), das Ergebnis wird als `Attempt` gespeichert.

### 4. Quiz bearbeiten (3c)
- Spalte mit der Fragenliste (330 px): Drag-Handle ⋮⋮, Nummer (Mono), Fragetext. Aktive Frage hervorgehoben.
- Editor: Typ-Umschalter (Multiple Choice / Wahr/Falsch / Freitext), Fragefeld (Serif 22 px), Antworten mit Radio für „richtig“ + Drag-Handle, Erklärung
- Kopfzeile: Status „UNGESPEICHERT“, Buttons „Frage löschen“ (rot), „Verwerfen“, „Speichern“ (Akzent)
- **Kein „Neues Quiz“ und kein „Frage hinzufügen“** – das kommt ausschließlich über Claude

### 5. Verwalten (3d)
- Baumtabelle: Spalten Checkbox 40 · Name · Typ 120 · Quiz 110 · Geändert 110. Einrückung 22 px pro Ebene.
- Drag & Drop: Das gezogene Element schwebt als Karte (leicht gedreht, mit Schatten). Das Ziel wird mit Akzent/7 % + Unterlinie 2 px + „HIER ABLEGEN“ markiert. Ein Quiz wandert mit seiner Seite mit.
- Auswahl-Leiste unten (hell, #ece9e4): „N ausgewählt · Verschieben nach… · Umbenennen · Löschen“. „Verschieben nach…“ öffnet einen Baum-Picker.
- Buttons „+ Fach“ und „+ Ordner“ (Fächer und Ordner anlegen ist erlaubt, Inhalte erstellen nicht)

## Interactions & Behavior
- ⌘K / Strg+K: Befehlspalette mit Volltextsuche über Titel, Themen und Inhalt (SQLite FTS5)
- Eingang: Ein Eintrag gilt beim Öffnen als gesehen, das Badge zählt die ungesehenen
- Lesefortschritt: Scroll-Position pro Thema. Ein Thema gilt ab 80 % gesehen als ✓.
- Theme: `localStorage` + `prefers-color-scheme` ignorieren (Dark ist Standard). Übergang 150 ms bei `background-color` und `color`.
- Hover: Listenzeilen `rgba(255,245,230,.04)`, Buttons −8 % Helligkeit. Fokus-Ring 2 px Akzent.
- Löschen immer mit Bestätigung, dazu 10 s „Rückgängig“-Toast

## Design Tokens (Dark)
| Token | Wert |
|---|---|
| bg | #131211 |
| surface | #1b1a18 |
| surface-2 / Chip | #1f1d1b · #2a2826 |
| border | rgba(255,245,230,.07) (stark: .10–.14) |
| text | #ece9e4 |
| text-2 | #cfcbc4 |
| muted | #a8a49d · #8f8b84 |
| dim | #7d7a74 · #6f6c66 · #5d5a55 |
| accent | oklch(.84 .11 140) (Salbei-Limette) |
| danger | oklch(.72 .13 30) · Text auf hell oklch(.5 .16 30) |
| Fach Sport | oklch(.84 .11 140) |
| Fach Englisch | oklch(.8 .1 235) |
| Fach Mathe | oklch(.8 .1 290) |
| Fach Philosophie | oklch(.82 .1 75) |
| Fach Geschichte | oklch(.78 .11 30) |

Neue Fächer bekommen eine Farbe mit gleichem L/C und einem freien Hue.

**Typografie**
- Display/Titel: *Instrument Serif* 400 – 20 / 22 / 24 / 27 / 28 / 42 / 46 / 48 / 52 px, lh 1.0–1.1
- UI/Text: *Plus Jakarta Sans* 400/500/600/700 – 12.5 / 13 / 13.5 / 14 / 14.5 / 15.5 / 16 px
- Labels: *JetBrains Mono* 500/600 – 9.5–12 px, Großbuchstaben, letter-spacing .08–.1em

**Radien:** 5 (Tags) · 8–10 (Buttons, Inputs) · 12–14 (Karten, Callouts) · 16 (Suche) · 20–22 (Bento-Kacheln) · Pill 30
**Abstände:** 4er-Raster; gängig sind 6 / 8 / 10 / 12 / 14 / 18 / 22 / 26 / 34 / 40
**Schatten:** nur für schwebende Elemente: `0 18px 40px -10px rgba(0,0,0,.6)`

## Assets
Keine Bilder. Icons in der Icon-Rail sind Platzhalter-Formen, bitte durch ein schlichtes Icon-Set ersetzen (z. B. Lucide, 1.5 px Strich). Fonts kommen von Google Fonts.

## Files
- `Lerntool Dashboard.dc.html` – alle Screens. Maßgeblich sind Turn 3 (3a–3d) und 2a.
- `support.js` – Laufzeit, damit die HTML-Datei lokal im Browser öffnet
