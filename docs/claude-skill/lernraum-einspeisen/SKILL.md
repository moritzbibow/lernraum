---
name: lernraum-einspeisen
description: Wandelt Lernzettel, Mitschriften, Unterrichtsnotizen, Fotos oder PDFs in Lernseiten mit Quiz für Moritz' Lernraum um und speist sie über den Lernraum-Connector ein. Verwenden, wenn Moritz Lernstoff schickt und ihn "einspeisen", "in den Lernraum", "als Lernseite" oder "als Quiz" haben möchte, oder wenn eine vorhandene Lernseite bzw. ein Quiz überarbeitet werden soll.
---

# Lernzettel → Lernraum

Der Lernraum ist Moritz' persönliches Lerntool. Du bist die einzige Quelle für Inhalte: Lernseiten (Markdown) und Quizze. Was du einspeist, ist sofort online.

## Ablauf

1. **Struktur ansehen:** `list_tree` aufrufen. Passendes Fach und passenden Ordner wählen und die Namen exakt übernehmen. Unterrichtsreihen als nummerierte Seiten anlegen („Stunde 5 – Ausdauertraining“). Nur wenn der Ort wirklich unklar ist, kurz nachfragen – sonst sinnvoll entscheiden und im Ergebnis nennen.
2. **Inhalt vollständig übertragen:** Nichts weglassen, was auf dem Lernzettel steht. Handschrift/Fotos sorgfältig lesen, offensichtliche Fehler korrigieren, unklare Stellen markieren statt raten.
3. **Gliedern:** Jede Sinneinheit wird ein `##`-Thema (3–7 Themen pro Seite). Keine `#`-Überschrift.
4. **Aufwerten, nicht aufblähen:**
   - Kernaussagen in `:::merke`, Begriffe in `:::definition`, Anwendungen in `:::beispiel`, Eselsbrücken in `:::tipp`, typische Fehler in `:::achtung`.
   - Tabellen für Gegenüberstellungen, KaTeX für Formeln (`$…$`, `$$…$$`), `mermaid` für Abläufe/Zeitleisten.
   - Selbsttests als `:::details[Lösung anzeigen]`.
5. **Quiz bauen (8–12 Fragen):** alle Themen abdecken, Mischung aus `mc`, `tf` und `text`; plausible Falschantworten; jede Frage mit kurzer `explanation` (warum richtig) und `topic` (= exakter Titel des `##`-Themas).
6. **Einspeisen:** `ingest_page` mit `subject`, `path`, `title` (Muster „Stunde 4 – Trainingsprinzipien“), optional `heading` und `date`, `content_md` und `quiz` – alles in einem Aufruf.
7. **Antworten:** Link zur Seite nennen, kurz sagen wo sie liegt, wie viele Themen/Fragen, und Hinweise (`warnings`) weitergeben.

Bei einem Fehler kommt eine Liste mit Pfad und Meldung zurück – korrigieren und erneut senden (es wurde nichts gespeichert).

## Überarbeiten

`get_page` (per page_id oder Link) → Änderungen einarbeiten → `ingest_page` mit derselben `page_id`. Nur ein Quiz ersetzen: `ingest_quiz` mit `quiz_id`.

## Qualitätsregeln

- Sprache wie der Lernzettel (meist Deutsch), klar und prüfungsnah.
- Fachbegriffe beim ersten Auftreten fett.
- Keine erfundenen Inhalte; Ergänzungen nur, wenn sie das Verständnis sichern, und dann knapp.
- Quizfragen prüfen Verständnis, nicht nur Auswendiglernen; Antworten eindeutig.

Das vollständige Format liefert `get_format_guide`.
