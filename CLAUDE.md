@AGENTS.md

# Lernraum – Hinweise für die Arbeit am Code

Persönliches Lerntool (Next.js 16 + SQLite). Inhalte kommen ausschließlich über Claude (MCP/REST); die UI liest, spielt/bearbeitet Quizze und verwaltet. UI-Texte sind Deutsch.

## Befehle

- `npm run dev` (Passwort lokal: `lernraum`), `npm run build`, `npm test`, `npm run test:e2e`, `npm run lint`, `npm run typecheck`
- MCP/OAuth-Integrationstest gegen laufende Instanz: `LERNRAUM_URL=… LERNRAUM_API_TOKEN=… node tests/integration/mcp-oauth.mjs`
- Schema ändern: `lib/db/schema.ts` anpassen → `npm run db:generate` → Migration in `drizzle/` committen
- Inhaltsformat ändern: `lib/content/format-guide.ts` → `npm run docs:format`

## Konventionen

- **Fachlogik nur in `lib/services/`.** UI-Aktionen (`lib/actions/`, `'use server'`, prüfen `assertSession`), REST (`app/api/`, `withApi`) und MCP (`lib/mcp/server.ts`) sind dünne Hüllen darum.
- Zeitstempel sind Epoch-Millisekunden. Löschen ist soft (`deletedAt` = Batch-ID für „Rückgängig“), `purgeDeleted` räumt nach 7 Tagen auf.
- Seiten-URLs entstehen aus Slugs (`lib/services/library.ts`); stabile Kurzlinks `/p/<id>`.
- Validierung mit zod v4 (`lib/validation/content.ts`), Fehlermeldungen deutsch und mit Pfad – sie gehen an Claude zurück.
- Design: Tokens in `app/globals.css` (`[data-theme]`), Komponenten mit CSS-Modulen. Maße stammen aus `design/` – dort gilt `box-sizing: content-box` (z. B. Sidebar 268 px + Padding = 305 px).
- Next.js 16: `proxy.ts` statt Middleware, `params`/`cookies()` sind async. Vor Änderungen an Next-APIs die Doku in `node_modules/next/dist/docs/` lesen.
