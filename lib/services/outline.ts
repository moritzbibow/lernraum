import type { LibraryTree, TreeNode } from './tree'

/* Compact representations of the library for Claude (REST + MCP). */

export type OutlineNode = {
  id: string
  title: string
  type: 'fach' | 'ordner' | 'lernseite' | 'allgemein'
  url: string
  quizzes: number
  questions: number
  children: OutlineNode[]
}

function toNode(n: TreeNode): OutlineNode {
  return {
    id: n.id,
    title: n.title,
    type: n.kind === 'subject' ? 'fach' : n.kind === 'general' ? 'allgemein' : n.isFolder ? 'ordner' : 'lernseite',
    url: n.url,
    quizzes: n.kind === 'page' ? n.quizCount : n.subtreeQuizCount,
    questions: n.questionCount,
    children: n.children.map(toNode),
  }
}

export function outlineJson(tree: LibraryTree): { subjects: OutlineNode[]; general: OutlineNode } {
  return { subjects: tree.subjects.map(toNode), general: toNode(tree.general) }
}

export function outlineText(tree: LibraryTree): string {
  const lines: string[] = []
  const walk = (nodes: TreeNode[], depth: number) => {
    for (const n of nodes) {
      const info: string[] = []
      if (n.isFolder && n.children.length) info.push('Ordner')
      else if (n.isFolder) info.push('leer')
      if (n.quizCount) info.push(`Quiz: ${n.questionCount} Fragen`)
      lines.push(`${'  '.repeat(depth)}- ${n.title} [page_id: ${n.id}]${info.length ? ` – ${info.join(', ')}` : ''}`)
      walk(n.children, depth + 1)
    }
  }
  if (tree.subjects.length === 0 && tree.general.children.length === 0) {
    return 'Der Lernraum ist noch leer. Neue Fächer und Ordner werden beim Einspeisen automatisch angelegt.'
  }
  lines.push('Fächer (subject) mit Seiten. Pfade für "path" sind die Titel der Ordner unterhalb des Fachs.')
  for (const s of tree.subjects) {
    lines.push('')
    lines.push(`# ${s.title}${s.subtreeQuizCount ? ` (${s.subtreeQuizCount === 1 ? '1 Quiz' : `${s.subtreeQuizCount} Quizze`})` : ''}`)
    if (s.children.length === 0) lines.push('  (noch keine Seiten)')
    walk(s.children, 1)
  }
  lines.push('')
  lines.push('# Allgemeine Seiten (ohne Fach – subject weglassen)')
  if (tree.general.children.length === 0) lines.push('  (keine)')
  walk(tree.general.children, 1)
  return lines.join('\n')
}
