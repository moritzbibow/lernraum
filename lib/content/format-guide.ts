import { BLOCKS } from './blocks'

/*
 * Single source of truth for the content format. Used by the MCP server
 * (instructions + get_format_guide) and exported to docs/CONTENT_FORMAT.md
 * via `npm run docs:format`.
 */

const blockLines = Object.entries(BLOCKS)
  .map(([name, def]) => `  - \`:::${name}\` … \`:::\` – ${def.description}`)
  .join('\n')

export const FORMAT_GUIDE = `# Lernraum – Inhaltsformat für Claude

Lernraum ist Moritz' persönliches Lerntool. Inhalte kommen ausschließlich über Claude: **Lernseiten** (Markdown) und **Quizze**. Die Oberfläche kann Seiten lesen, Quizze spielen und bearbeiten sowie Fächer/Ordner verwalten – aber keine Inhalte erstellen.

## Ablauf, wenn Moritz dir einen Lernzettel gibt

1. \`list_tree\` aufrufen und den passenden Ort wählen (Fach + Ordnerpfad). Vorhandene Namen exakt wiederverwenden; fehlende Fächer und Ordner werden automatisch angelegt.
2. Den Lernzettel **vollständig** in Lernraum-Markdown übertragen: nichts weglassen, offensichtliche Fehler korrigieren, mit \`##\`-Themen gliedern, Kernaussagen in \`:::merke\`-Blöcke.
3. Ein Quiz mit 8–12 Fragen erstellen, das die wichtigsten Inhalte abfragt (gemischte Typen, jede Frage mit \`explanation\` und \`topic\`).
4. \`ingest_page\` aufrufen – Seite und Quiz in einem Schritt.
5. Moritz den Link aus der Antwort geben. Warnungen aus der Antwort kurz erwähnen.

Überarbeiten: erst \`get_page\` (liefert Markdown und Quiz), dann \`ingest_page\` mit derselben \`page_id\`. Die vorige Version wird automatisch gesichert.

## Ort und Titel

- **subject** – Fach, z. B. \`"Sport"\`. Weglassen → allgemeine Seite ohne Fach.
- **path** – Ordner unterhalb des Fachs, z. B. \`["Sporttheorie"]\`; beliebig tief.
- **title** – Titel der Seite. Muster \`"Stunde 4 – Trainingsprinzipien"\`: Der Teil vor dem Gedankenstrich ist der Kurzname (Brotkrümel, Quiz-Kopf), der Teil danach der Anzeigename.
- **heading** (optional) – große Überschrift, falls sie vom Titel abweicht, z. B. \`"Trainingsprinzipien & Superkompensation"\`.
- **date** (optional, \`JJJJ-MM-TT\`) – Datum der Stunde, erscheint im Kicker („STUNDE 4 · 12. SEPTEMBER“).
- **kicker** (optional) – eigener Kicker-Text statt des automatischen.
- Gleicher Ort + gleicher Titel (oder \`page_id\`) → die Seite wird aktualisiert statt doppelt angelegt.

## Markdown

- \`## Thema\` – jede H2 ist ein **Thema**: Inhaltsverzeichnis, Nummerierung („1 · …“) und Lesefortschritt hängen daran. Keine \`#\`-Überschrift verwenden (der Titel kommt aus \`title\`).
- \`### Unterthema\`, Listen, **fett**, *kursiv*, Links, Zitate (\`>\`), Tabellen (GitHub-Stil), Fußnoten.
- Formeln (KaTeX): inline \`$a^2 + b^2 = c^2$\`, abgesetzt mit \`$$ … $$\` auf eigenen Zeilen.
- Diagramme: Codeblock mit \`\`\`mermaid (flowchart, timeline, mindmap, xychart-beta …).
  - mindmap: Die Ebenen ergeben sich nur aus der Einrückung mit Leerzeichen; genau ein Wurzelknoten, z. B. \`root((Thema))\`.
  - flowchart: Beschriftungen mit Sonderzeichen wie ( ) [ ] { } : ; # in Anführungszeichen setzen: \`A["Kraft (N)"]\`.
  - Jedes Diagramm wird beim Einspeisen mit dem Mermaid-Parser geprüft; ein fehlerhaftes wird mit Fehlermeldung abgelehnt (dann korrigieren und erneut einspeisen).
- Code: \`\`\`python usw.
- Blöcke (auf eigenen Zeilen, mit \`:::\` schließen):
${blockLines}
  - Eigenes Label: \`:::merke[Merksatz]\`; Quelle beim Zitat: \`:::zitat{quelle="Immanuel Kant"}\`.
- Kein HTML (wird entfernt). Bilder nur als externe URL.

## Quiz

\`quiz: { "title"?: "…", "questions": [ … ] }\` – ohne \`title\` heißt das Quiz wie der Anzeigename der Seite; gleicher Titel ersetzt ein vorhandenes Quiz.

- **Multiple Choice** – 2–8 Antworten, genau eine richtig:
  \`{ "type": "mc", "prompt": "Wann …?", "answers": [{ "text": "…" }, { "text": "…", "correct": true }, { "text": "…" }], "explanation": "…", "topic": "Superkompensation" }\`
- **Wahr/Falsch**:
  \`{ "type": "tf", "prompt": "Regeneration ist Teil des Trainings.", "correct": true, "explanation": "…" }\`
- **Freitext** – eine oder mehrere akzeptierte Antworten (Groß-/Kleinschreibung und kleine Tippfehler werden toleriert):
  \`{ "type": "text", "prompt": "Wie heißt …?", "correct": ["Superkompensation"] }\`

\`topic\` ist der Titel einer \`##\`-Überschrift der Seite – „Zur Seite →“ im Quiz springt dann genau dorthin.

## Qualitätsregeln für Quizze

- **Das Wesentliche abfragen:** Vor dem Schreiben der Fragen aus dem Inhalt herausarbeiten, was am Thema am Ende wirklich wichtig ist und was man mitnehmen sollte (Kernaussagen, Merke-Inhalte, Zusammenhänge, Ursache und Wirkung). Genau das abfragen – keine nebensächlichen Formalien oder bloß obligatorischen Daten.
- **Schwierigkeit:** nicht zu einfach, gern etwas anspruchsvoller (etwa 7 von 10). Verständnis, Anwendung und Zusammenhänge prüfen statt bloßes Wiedererkennen von Begriffen.
- **Position der richtigen Antwort:** gleichmäßig auf alle Positionen verteilen, nie bevorzugt an erster Stelle. Der Lernraum mischt die Antworten zusätzlich.
- **Falsche Antworten:** ähnlich lang, genauso genau formuliert und plausibel – die richtige Antwort darf nicht an Länge oder Detailgrad erkennbar sein.
- **Erklärungen:** den Inhalt nennen, nie eine Position („die zweite Antwort“, „B“) – die Reihenfolge ändert sich beim Spielen.
- **Wahr/Falsch:** ausgewogen, etwa gleich viele wahre und falsche Aussagen.

Beim Einspeisen prüft der Lernraum das Quiz und gibt Hinweise zurück, wenn die richtige Antwort auffällig oft an derselben Position steht, auffällig oft die längste ist oder eine Erklärung Positionen nennt.

## Beispiel

\`\`\`json
{
  "subject": "Sport",
  "path": ["Sporttheorie"],
  "title": "Stunde 5 – Ausdauertraining",
  "date": "2026-09-19",
  "content_md": "## Grundlagen\\n\\nAusdauer ist die Widerstandsfähigkeit gegen Ermüdung …\\n\\n:::merke\\nAerob = mit Sauerstoff.\\n:::\\n\\n## Methoden\\n\\n| Methode | Ziel |\\n|---|---|\\n| Dauermethode | Grundlagenausdauer |",
  "quiz": {
    "title": "Ausdauer",
    "questions": [
      { "type": "mc", "prompt": "Welche Methode trainiert die Grundlagenausdauer?", "answers": [{ "text": "Wiederholungsmethode" }, { "text": "Intervallmethode" }, { "text": "Dauermethode", "correct": true }, { "text": "Wettkampfmethode" }], "explanation": "Die Dauermethode setzt auf lange, gleichmäßige Belastung ohne Pausen – genau das entwickelt die Grundlagenausdauer.", "topic": "Methoden" },
      { "type": "tf", "prompt": "Bei aerober Energiebereitstellung entsteht vor allem Laktat.", "correct": false, "explanation": "Aerob wird mit Sauerstoff vollständig abgebaut; viel Laktat entsteht bei anaerober Belastung.", "topic": "Grundlagen" }
    ]
  }
}
\`\`\`

## Fehler

Ungültige Daten werden komplett abgelehnt (es wird nichts gespeichert) und kommen mit Pfad und Meldung zurück, z. B. \`quiz.questions[2].answers: Frage 3: Genau eine Antwort muss "correct": true haben\`. Korrigieren und erneut senden.

## REST statt MCP

Dasselbe Format funktioniert per \`POST /api/ingest\` mit \`Authorization: Bearer <Token>\`; dort stehen die Seitenfelder unter \`page\`: \`{ "subject", "path", "page": { "title", "content_md", "heading"?, "date"? }, "quiz"?, "mode": "upsert" | "append-quiz" }\`.
`

export const SERVER_INSTRUCTIONS = `Lernraum ist Moritz' persönliches Lerntool (Web-App). Inhalte kommen nur über dich: Lernseiten in Markdown plus Quizze. Alles, was du einspeist, ist sofort online.

Wenn Moritz dir einen Lernzettel gibt:
1. list_tree aufrufen, passendes Fach + Ordner wählen (vorhandene Namen exakt übernehmen; Fehlendes wird automatisch angelegt).
2. Inhalt vollständig in Lernraum-Markdown übertragen: ## Überschriften = Themen (keine # verwenden), :::merke … ::: für Kernaussagen, außerdem :::definition, :::beispiel, :::tipp, :::achtung, :::zitat{quelle="…"}, :::details[Lösung anzeigen]; Tabellen, KaTeX ($…$, $$…$$), \`\`\`mermaid.
3. Ein Quiz mit 8–12 Fragen erstellen (mc: genau eine Antwort correct; tf: "correct": true/false; text: "correct": ["…"]), jede mit explanation und topic (= Titel einer ##-Überschrift). Qualität: erst herausarbeiten, was am Thema wirklich wichtig ist, und genau das abfragen (keine Nebensächlichkeiten); eher anspruchsvoll (etwa 7/10); richtige Antwort gleichmäßig auf alle Positionen verteilen; falsche Antworten ähnlich lang und plausibel; Erklärungen ohne Positionsangaben; Wahr/Falsch ausgewogen.
4. ingest_page aufrufen (Seite + Quiz in einem Schritt), dann Moritz den Link geben.
Titelmuster: "Stunde 4 – Trainingsprinzipien" (vor dem Gedankenstrich Kurzname, danach Anzeigename). Zum Überarbeiten get_page, dann ingest_page mit page_id. Details: get_format_guide.`
