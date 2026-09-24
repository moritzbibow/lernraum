import GithubSlugger from 'github-slugger'
import type { Element, ElementContent, Root as HastRoot } from 'hast'
import type { Heading, Paragraph, PhrasingContent, Root as MdRoot, RootContent, Text } from 'mdast'
import { toString } from 'mdast-util-to-string'
import rehypeKatex from 'rehype-katex'
import rehypeSanitize, { defaultSchema, type Options as SanitizeSchema } from 'rehype-sanitize'
import rehypeStringify from 'rehype-stringify'
import remarkDirective from 'remark-directive'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import { unified, type Plugin } from 'unified'
import { SKIP, visit } from 'unist-util-visit'
import type { VFile } from 'vfile'
import type { Topic } from '../db/schema'
import { countWords } from '../text'
import { resolveBlock } from './blocks'

/*
 * Content pipeline for learning pages:
 * Markdown (GFM + KaTeX math + :::blocks + ```mermaid) → sanitized HTML.
 *
 * - The page title is rendered by the app, so a leading "# Titel" is dropped
 *   and any other H1 becomes an H2.
 * - Every H2 is a "Thema" (topic): it gets a stable id (t-<slug>) and appears
 *   in the table of contents; reading progress is tracked per topic.
 */

type DirectiveNode = {
  type: 'containerDirective' | 'leafDirective' | 'textDirective'
  name: string
  attributes?: Record<string, string | null | undefined> | null
  children: RootContent[]
  data?: Record<string, unknown>
}

type FileData = { topics: Topic[]; subheadings: string[]; hasMermaid: boolean; hasMath: boolean }

function isDirective(node: unknown): node is DirectiveNode {
  const t = (node as { type?: string }).type
  return t === 'containerDirective' || t === 'leafDirective' || t === 'textDirective'
}

function text(value: string): Text {
  return { type: 'text', value }
}

/** Turns an unknown `:name[label]` back into the literal text the author wrote. */
function directiveToText(node: DirectiveNode): PhrasingContent[] {
  const marker = node.type === 'textDirective' ? ':' : '::'
  const children = node.children as PhrasingContent[]
  if (children.length === 0) return [text(`${marker}${node.name}`)]
  return [text(`${marker}${node.name}[`), ...children, text(']')]
}

function slugTopics(titles: string[]): Topic[] {
  const slugger = new GithubSlugger()
  return titles.map((title) => ({ id: slugger.slug(title) || 'thema', title }))
}

/** mdast transform: headings, custom blocks, mermaid, stray directives. */
const remarkLernraum: Plugin<[], MdRoot> = () => (tree: MdRoot, file: VFile) => {
  // 1. Title handling: drop a leading H1, demote other H1s.
  const first = tree.children[0]
  if (first && first.type === 'heading' && first.depth === 1) tree.children.shift()
  visit(tree, 'heading', (node: Heading) => {
    if (node.depth === 1) node.depth = 2
  })

  // 2. Directives → blocks (containers) or literal text (unknown inline/leaf).
  visit(tree, (node, index, parent) => {
    if (!isDirective(node) || !parent || index === undefined) return
    if (node.type !== 'containerDirective') {
      const replacement = directiveToText(node)
      if (node.type === 'textDirective') {
        parent.children.splice(index, 1, ...(replacement as never[]))
      } else {
        const paragraph: Paragraph = { type: 'paragraph', children: replacement }
        parent.children.splice(index, 1, paragraph as never)
      }
      return [SKIP, index]
    }

    const resolved = resolveBlock(node.name)
    const def = resolved?.def
    // A directive label (`:::merke[Eigenes Label]`) is parsed as the first child paragraph.
    let label = def?.label ?? node.name.charAt(0).toUpperCase() + node.name.slice(1)
    const firstChild = node.children[0] as (Paragraph & { data?: { directiveLabel?: boolean } }) | undefined
    if (firstChild?.type === 'paragraph' && firstChild.data?.directiveLabel) {
      label = toString(firstChild) || label
      node.children.shift()
    }

    const tone = def?.tone ?? 'neutral'
    const labelNode = {
      type: 'paragraph',
      data: { hName: def?.collapsible ? 'summary' : 'div', hProperties: { className: ['callout__label'] } },
      children: [text(label)],
    }

    const body = {
      type: 'blockquote', // neutral container, renamed below
      data: { hName: 'div', hProperties: { className: ['callout__body'] } },
      children: node.children,
    }

    const children: unknown[] = [labelNode, body]
    const source = node.attributes?.quelle ?? node.attributes?.source ?? node.attributes?.autor
    if (def?.quote && source) {
      children.push({
        type: 'paragraph',
        data: { hName: 'div', hProperties: { className: ['callout__source'] } },
        children: [text(`— ${source}`)],
      })
    }

    node.data = {
      hName: def?.collapsible ? 'details' : 'aside',
      hProperties: {
        className: ['callout', `callout--${tone}`, ...(def?.quote ? ['callout--quote'] : [])],
      },
    }
    node.children = children as never
  })

  // 3. Mermaid diagrams are rendered in the browser.
  let hasMermaid = false
  visit(tree, 'code', (node, index, parent) => {
    if (node.lang !== 'mermaid' || !parent || index === undefined) return
    hasMermaid = true
    parent.children.splice(index, 1, {
      type: 'paragraph',
      data: { hName: 'div', hProperties: { className: ['mermaid-block'] } },
      children: [text(node.value)],
    } as never)
  })

  let hasMath = false
  visit(tree, (node) => {
    if (node.type === 'math' || node.type === 'inlineMath') hasMath = true
  })

  // 4. Topics = H2 headings (after demotion). Ids are assigned after sanitizing.
  const h2: string[] = []
  const h3: string[] = []
  visit(tree, 'heading', (node: Heading) => {
    const title = toString(node).trim()
    if (node.depth === 2) h2.push(title)
    else if (node.depth === 3) h3.push(title)
  })
  const data = file.data as Partial<FileData>
  data.topics = slugTopics(h2)
  data.subheadings = h3
  data.hasMermaid = hasMermaid
  data.hasMath = hasMath
}

/** hast transform after sanitizing: heading ids + numbering, table wrappers, links. */
const rehypeLernraum: Plugin<[], HastRoot> = () => (tree: HastRoot, file: VFile) => {
  const data = file.data as Partial<FileData>
  const topics = data.topics ?? []
  const subSlugger = new GithubSlugger()
  let h2Index = 0

  visit(tree, 'element', (node: Element, index, parent) => {
    if (node.tagName === 'h2') {
      const topic = topics[h2Index]
      h2Index++
      if (topic) {
        node.properties = { ...node.properties, id: `t-${topic.id}` }
        const num: Element = {
          type: 'element',
          tagName: 'span',
          properties: { className: ['h2-num'] },
          children: [{ type: 'text', value: `${h2Index} · ` }],
        }
        node.children = [num, ...node.children]
      }
      return
    }
    if (node.tagName === 'h3') {
      const title = node.children.map((c) => ('value' in c ? String(c.value) : '')).join('')
      node.properties = { ...node.properties, id: `s-${subSlugger.slug(title) || 'abschnitt'}` }
      return
    }
    if (node.tagName === 'table' && parent && index !== undefined) {
      const wrapper: Element = {
        type: 'element',
        tagName: 'div',
        properties: { className: ['table-wrap'] },
        children: [node],
      }
      ;(parent.children as ElementContent[])[index] = wrapper
      return SKIP
    }
    if (node.tagName === 'a') {
      const href = String(node.properties?.href ?? '')
      if (/^https?:\/\//i.test(href)) {
        node.properties = { ...node.properties, target: '_blank', rel: ['noopener', 'noreferrer'] }
      }
      return
    }
    if (node.tagName === 'img') {
      node.properties = { ...node.properties, loading: 'lazy', decoding: 'async' }
    }
  })
}

const sanitizeSchema: SanitizeSchema = {
  ...defaultSchema,
  clobberPrefix: '',
  tagNames: [...(defaultSchema.tagNames ?? []), 'aside', 'details', 'summary'],
  attributes: {
    ...defaultSchema.attributes,
    div: [...(defaultSchema.attributes?.div ?? []), ['className', 'callout__label', 'callout__body', 'callout__source', 'mermaid-block']],
    aside: [
      [
        'className',
        'callout',
        'callout--accent',
        'callout--blue',
        'callout--violet',
        'callout--amber',
        'callout--danger',
        'callout--neutral',
        'callout--quote',
      ],
    ],
    details: [
      ['className', 'callout', 'callout--neutral', 'callout--accent', 'callout--blue', 'callout--violet', 'callout--amber', 'callout--danger'],
      'open',
    ],
    summary: [['className', 'callout__label']],
    code: [...(defaultSchema.attributes?.code ?? []), ['className', /^language-./, 'math-inline', 'math-display']],
  },
}

const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkMath)
  .use(remarkDirective)
  .use(remarkLernraum)
  .use(remarkRehype, { footnoteLabel: 'Fußnoten', footnoteBackLabel: 'Zurück zum Text' })
  .use(rehypeSanitize, sanitizeSchema)
  .use(rehypeKatex, { strict: 'ignore', output: 'htmlAndMathml' })
  .use(rehypeLernraum)
  .use(rehypeStringify)

const analyzer = unified().use(remarkParse).use(remarkGfm).use(remarkMath).use(remarkDirective).use(remarkLernraum)

export type RenderedContent = {
  html: string
  topics: Topic[]
  hasMermaid: boolean
  hasMath: boolean
}

export function renderMarkdown(markdown: string): RenderedContent {
  const file = processor.processSync(markdown)
  const data = file.data as Partial<FileData>
  return {
    html: String(file),
    topics: data.topics ?? [],
    hasMermaid: data.hasMermaid ?? false,
    hasMath: data.hasMath ?? false,
  }
}

export type ContentAnalysis = { topics: Topic[]; wordCount: number }

/** Topics (from ## headings) and word count – computed at ingest time. */
export function analyzeMarkdown(markdown: string): ContentAnalysis {
  const tree = analyzer.parse(markdown)
  const file = { data: {} } as VFile
  // Run the transform synchronously on the parsed tree.
  const transformed = analyzer.runSync(tree, file as never) as MdRoot
  const data = (file.data ?? {}) as Partial<FileData>
  return { topics: data.topics ?? [], wordCount: countWords(toString(transformed)) }
}
