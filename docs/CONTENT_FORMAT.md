<!-- Generiert aus lib/content/format-guide.ts – nicht direkt bearbeiten (npm run docs:format). -->

# Lernraum – Inhaltsformat für Claude

Lernraum ist Moritz' persönliches Lerntool. Inhalte kommen ausschließlich über Claude: **Lernseiten** (Markdown) und **Quizze**. Die Oberfläche kann Seiten lesen, Quizze spielen und bearbeiten sowie Fächer/Ordner verwalten – aber keine Inhalte erstellen.

## Ablauf, wenn Moritz dir einen Lernzettel gibt

1. `list_tree` aufrufen und den passenden Ort wählen (Fach + Ordnerpfad). Vorhandene Namen exakt wiederverwenden; fehlende Fächer und Ordner werden automatisch angelegt.
2. Den Lernzettel **vollständig** in Lernraum-Markdown übertragen: nichts weglassen, offensichtliche Fehler korrigieren, mit `##`-Themen gliedern, Kernaussagen in `:::merke`-Blöcke.
3. Ein Quiz mit 8–12 Fragen erstellen, das die wichtigsten Inhalte abfragt (gemischte Typen, jede Frage mit `explanation` und `topic`).
4. `ingest_page` aufrufen – Seite und Quiz in einem Schritt.
5. Moritz den Link aus der Antwort geben. Warnungen aus der Antwort kurz erwähnen.

Überarbeiten: erst `get_page` (liefert Markdown und Quiz), dann `ingest_page` mit derselben `page_id`. Die vorige Version wird automatisch gesichert.

## Ort und Titel

- **subject** – Fach, z. B. `"Sport"`. Weglassen → allgemeine Seite ohne Fach.
- **path** – Ordner unterhalb des Fachs, z. B. `["Sporttheorie"]`; beliebig tief.
- **title** – Titel der Seite. Muster `"Stunde 4 – Trainingsprinzipien"`: Der Teil vor dem Gedankenstrich ist der Kurzname (Brotkrümel, Quiz-Kopf), der Teil danach der Anzeigename.
- **heading** (optional) – große Überschrift, falls sie vom Titel abweicht, z. B. `"Trainingsprinzipien & Superkompensation"`.
- **date** (optional, `JJJJ-MM-TT`) – Datum der Stunde, erscheint im Kicker („STUNDE 4 · 12. SEPTEMBER“).
- **kicker** (optional) – eigener Kicker-Text statt des automatischen.
- Gleicher Ort + gleicher Titel (oder `page_id`) → die Seite wird aktualisiert statt doppelt angelegt.

## Markdown

- `## Thema` – jede H2 ist ein **Thema**: Inhaltsverzeichnis, Nummerierung („1 · …“) und Lesefortschritt hängen daran. Keine `#`-Überschrift verwenden (der Titel kommt aus `title`).
- `### Unterthema`, Listen, **fett**, *kursiv*, Links, Zitate (`>`), Tabellen (GitHub-Stil), Fußnoten.
- Formeln (KaTeX): inline `$a^2 + b^2 = c^2$`, abgesetzt mit `$$ … $$` auf eigenen Zeilen.
- Diagramme: Codeblock mit ```mermaid (flowchart, timeline, mindmap, xychart-beta …).
- Code: ```python usw.
- Blöcke (auf eigenen Zeilen, mit `:::` schließen):
  - `:::merke` … `:::` – Kernaussage, die man sich einprägen soll
  - `:::definition` … `:::` – Begriffsdefinition
  - `:::beispiel` … `:::` – Konkretes Beispiel oder Anwendung
  - `:::tipp` … `:::` – Eselsbrücke, Lerntipp, Hinweis
  - `:::achtung` … `:::` – Typischer Fehler, Stolperstelle
  - `:::zitat` … `:::` – Zitat, optional mit {quelle="…"}
  - `:::details` … `:::` – Aufklappbarer Bereich, z. B. :::details[Lösung anzeigen]
  - Eigenes Label: `:::merke[Merksatz]`; Quelle beim Zitat: `:::zitat{quelle="Immanuel Kant"}`.
- Kein HTML (wird entfernt). Bilder nur als externe URL.

## Quiz

`quiz: { "title"?: "…", "questions": [ … ] }` – ohne `title` heißt das Quiz wie der Anzeigename der Seite; gleicher Titel ersetzt ein vorhandenes Quiz.

- **Multiple Choice** – 2–8 Antworten, genau eine richtig:
  `{ "type": "mc", "prompt": "Wann …?", "answers": [{ "text": "…", "correct": true }, { "text": "…" }], "explanation": "…", "topic": "Superkompensation" }`
- **Wahr/Falsch**:
  `{ "type": "tf", "prompt": "Regeneration ist Teil des Trainings.", "correct": true, "explanation": "…" }`
- **Freitext** – eine oder mehrere akzeptierte Antworten (Groß-/Kleinschreibung und kleine Tippfehler werden toleriert):
  `{ "type": "text", "prompt": "Wie heißt …?", "correct": ["Superkompensation"] }`

`topic` ist der Titel einer `##`-Überschrift der Seite – „Zur Seite →“ im Quiz springt dann genau dorthin.

## Beispiel

```json
{
  "subject": "Sport",
  "path": ["Sporttheorie"],
  "title": "Stunde 5 – Ausdauertraining",
  "date": "2026-09-19",
  "content_md": "## Grundlagen\n\nAusdauer ist die Widerstandsfähigkeit gegen Ermüdung …\n\n:::merke\nAerob = mit Sauerstoff.\n:::\n\n## Methoden\n\n| Methode | Ziel |\n|---|---|\n| Dauermethode | Grundlagenausdauer |",
  "quiz": {
    "title": "Ausdauer",
    "questions": [
      { "type": "mc", "prompt": "Welche Methode trainiert die Grundlagenausdauer?", "answers": [{ "text": "Dauermethode", "correct": true }, { "text": "Wiederholungsmethode" }], "explanation": "Lange, gleichmäßige Belastung.", "topic": "Methoden" },
      { "type": "tf", "prompt": "Aerob bedeutet „mit Sauerstoff“.", "correct": true, "topic": "Grundlagen" }
    ]
  }
}
```

## Fehler

Ungültige Daten werden komplett abgelehnt (es wird nichts gespeichert) und kommen mit Pfad und Meldung zurück, z. B. `quiz.questions[2].answers: Frage 3: Genau eine Antwort muss "correct": true haben`. Korrigieren und erneut senden.

## REST statt MCP

Dasselbe Format funktioniert per `POST /api/ingest` mit `Authorization: Bearer <Token>`; dort stehen die Seitenfelder unter `page`: `{ "subject", "path", "page": { "title", "content_md", "heading"?, "date"? }, "quiz"?, "mode": "upsert" | "append-quiz" }`.
