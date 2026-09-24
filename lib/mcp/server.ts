import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'
import { FORMAT_GUIDE, SERVER_INSTRUCTIONS } from '../content/format-guide'
import { getPageForApi } from '../services/api-views'
import { AppError } from '../services/errors'
import { ingest, replaceQuiz } from '../services/ingest'
import { outlineJson, outlineText } from '../services/outline'
import { search } from '../services/search'
import { buildTree } from '../services/tree'
import { questionInput } from '../validation/content'

/*
 * MCP tools for Claude. Thin wrappers around the same services the REST API
 * and the UI use. Errors come back as tool results (isError) with readable
 * German messages so Claude can correct its input and retry.
 */

const quizShape = z.object({
  title: z.string().trim().min(1).max(200).optional().describe('Titel des Quiz. Weglassen = Anzeigename der Seite.'),
  questions: z
    .array(questionInput)
    .min(1)
    .max(200)
    .describe(
      'Fragen. mc: answers mit genau einer correct:true. tf: correct true/false. text: correct = akzeptierte Antwort(en). Jede Frage mit explanation und topic (= Titel einer ##-Überschrift).',
    ),
})

function text(t: string, structured?: Record<string, unknown>): CallToolResult {
  return { content: [{ type: 'text', text: t }], ...(structured ? { structuredContent: structured } : {}) }
}

function failure(e: unknown): CallToolResult {
  if (e instanceof AppError) {
    const details = e.issues.map((i) => `- ${i.path ? `${i.path}: ` : ''}${i.message}`).join('\n')
    return {
      isError: true,
      content: [{ type: 'text', text: `${e.message}${details ? `\n${details}` : ''}\n\nEs wurde nichts gespeichert. Bitte korrigieren und erneut aufrufen.` }],
    }
  }
  console.error('[lernraum] MCP-Tool-Fehler:', e)
  return { isError: true, content: [{ type: 'text', text: 'Interner Fehler im Lernraum. Details stehen im Server-Log.' }] }
}

export function createMcpServer(opts: { baseUrl: string }) {
  const abs = (path: string | null) => (path ? `${opts.baseUrl}${path}` : null)
  const server = new McpServer(
    { name: 'lernraum', title: 'Lernraum', version: '1.0.0' },
    { instructions: SERVER_INSTRUCTIONS },
  )

  server.registerTool(
    'list_tree',
    {
      title: 'Struktur anzeigen',
      description:
        'Zeigt Fächer, Ordner und Lernseiten des Lernraums (mit page_id und Quiz-Infos). Vor jedem Einspeisen aufrufen, um vorhandene Fächer und Ordner exakt wiederzuverwenden.',
      inputSchema: {},
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async () => {
      try {
        const tree = buildTree()
        return text(outlineText(tree), outlineJson(tree) as unknown as Record<string, unknown>)
      } catch (e) {
        return failure(e)
      }
    },
  )

  server.registerTool(
    'ingest_page',
    {
      title: 'Lernseite einspeisen',
      description:
        'Legt eine Lernseite an oder aktualisiert sie (gleicher Ort + Titel oder page_id) – optional direkt mit Quiz. Fehlende Fächer/Ordner werden angelegt. Inhalt in Lernraum-Markdown (## = Themen, :::merke usw., siehe get_format_guide). Die Seite ist sofort online; die Antwort enthält den Link.',
      inputSchema: {
        subject: z.string().trim().max(100).optional().describe('Fach, z. B. "Sport". Weglassen = allgemeine Seite ohne Fach.'),
        path: z.array(z.string().trim().min(1).max(200)).max(10).optional().describe('Ordner unterhalb des Fachs, z. B. ["Sporttheorie"].'),
        title: z.string().trim().min(1).max(200).describe('Titel, Muster "Stunde 4 – Trainingsprinzipien".'),
        heading: z.string().trim().max(300).optional().describe('Große Überschrift, falls abweichend vom Titel.'),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe('Datum der Stunde (JJJJ-MM-TT), erscheint im Kicker.'),
        kicker: z.string().trim().max(120).optional().describe('Eigener Kicker-Text (optional).'),
        content_md: z.string().max(500_000).describe('Inhalt in Lernraum-Markdown, gegliedert mit ##-Überschriften (Themen).'),
        quiz: quizShape.optional().describe('Optionales Quiz zur Seite (8–12 Fragen empfohlen).'),
        page_id: z.string().optional().describe('Bestehende Seite gezielt aktualisieren (aus list_tree/get_page).'),
      },
      annotations: { destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (args) => {
      try {
        const result = ingest(
          {
            subject: args.subject,
            path: args.path,
            page_id: args.page_id,
            page: { title: args.title, heading: args.heading, date: args.date, kicker: args.kicker, content_md: args.content_md },
            quiz: args.quiz,
            mode: 'upsert',
          },
          { source: 'claude' },
        )
        const url = abs(result.url)!
        const lines = [
          `${result.created ? 'Neu angelegt' : 'Aktualisiert'}: ${result.path}`,
          `Link: ${url}`,
          `Themen: ${result.topics.map((t) => t.title).join(', ') || '—'}`,
        ]
        if (result.quizId) lines.push(`Quiz: ${result.questionCount} Fragen – spielen: ${abs(result.quizUrl)}`)
        if (result.createdFolders.length) lines.push(`Neu angelegt: ${result.createdFolders.join(', ')}`)
        if (result.warnings.length) lines.push(`Hinweise:\n${result.warnings.map((w) => `- ${w}`).join('\n')}`)
        return text(lines.join('\n'), {
          ...result,
          url,
          shortUrl: abs(result.shortUrl),
          quizUrl: abs(result.quizUrl),
          quizEditUrl: abs(result.quizEditUrl),
        })
      } catch (e) {
        return failure(e)
      }
    },
  )

  server.registerTool(
    'ingest_quiz',
    {
      title: 'Quiz einspeisen',
      description:
        'Hängt ein Quiz an eine bestehende Lernseite (page_id, oder subject + path + page_title) oder ersetzt ein vorhandenes Quiz (quiz_id). Gleicher Quiz-Titel an derselben Seite ersetzt das alte Quiz.',
      inputSchema: {
        quiz: quizShape,
        page_id: z.string().optional().describe('Zielseite (aus list_tree).'),
        subject: z.string().trim().max(100).optional(),
        path: z.array(z.string().trim().min(1).max(200)).max(10).optional(),
        page_title: z.string().trim().max(200).optional().describe('Titel der Zielseite, falls keine page_id angegeben ist.'),
        quiz_id: z.string().optional().describe('Vorhandenes Quiz komplett ersetzen.'),
      },
      annotations: { destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (args) => {
      try {
        if (args.quiz_id) {
          const r = replaceQuiz(args.quiz_id, args.quiz, { source: 'claude' })
          return text(`Quiz ersetzt (${r.questionCount} Fragen): ${abs(r.quizUrl)}`, { ...r, quizUrl: abs(r.quizUrl) })
        }
        const r = ingest(
          {
            mode: 'append-quiz',
            page_id: args.page_id,
            subject: args.subject,
            path: args.path,
            page: args.page_title ? { title: args.page_title } : undefined,
            quiz: args.quiz,
          },
          { source: 'claude' },
        )
        return text(
          [`Quiz an „${r.path}“: ${r.questionCount} Fragen`, `Spielen: ${abs(r.quizUrl)}`, ...r.warnings.map((w) => `Hinweis: ${w}`)].join('\n'),
          { ...r, url: abs(r.url), quizUrl: abs(r.quizUrl), quizEditUrl: abs(r.quizEditUrl) },
        )
      } catch (e) {
        return failure(e)
      }
    },
  )

  server.registerTool(
    'get_page',
    {
      title: 'Lernseite lesen',
      description: 'Liefert eine Lernseite mit Markdown, Themen und Quizzen (inkl. Fragen) – zum Überarbeiten oder Nachschlagen. Akzeptiert page_id oder Link.',
      inputSchema: { page: z.string().min(1).describe('page_id oder URL der Seite') },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ page }) => {
      try {
        const data = getPageForApi(page)
        const withUrls = {
          ...data,
          url: abs(data.url),
          short_url: abs(data.short_url),
          quizzes: data.quizzes.map((q) => ({ ...q, url: abs(q.url) })),
        }
        return text(JSON.stringify(withUrls, null, 2), withUrls as unknown as Record<string, unknown>)
      } catch (e) {
        return failure(e)
      }
    },
  )

  server.registerTool(
    'search',
    {
      title: 'Suchen',
      description: 'Volltextsuche über Titel, Themen und Inhalte aller Lernseiten sowie Fächer und Quizze.',
      inputSchema: { query: z.string().trim().min(1).max(200) },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ query }) => {
      try {
        const results = search(query, 20).map((r) => ({
          kind: r.kind,
          id: r.id,
          title: r.title,
          path: r.path,
          url: abs(r.url),
          snippet: r.snippet?.replace(/<\/?mark>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>'),
        }))
        const lines = results.map((r) => `- [${r.kind}] ${r.title}${r.path ? ` (${r.path})` : ''} – ${r.url}${r.snippet ? `\n  ${r.snippet}` : ''}`)
        return text(lines.length ? lines.join('\n') : `Nichts gefunden für „${query}“.`, { results })
      } catch (e) {
        return failure(e)
      }
    },
  )

  server.registerTool(
    'get_format_guide',
    {
      title: 'Inhaltsformat',
      description: 'Vollständige Anleitung zum Lernraum-Format (Markdown-Blöcke, Quiz-Typen, Beispiele). Bei Unsicherheit vor dem Einspeisen lesen.',
      inputSchema: {},
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async () => text(FORMAT_GUIDE),
  )

  return server
}
