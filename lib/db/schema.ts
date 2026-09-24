import { sql } from 'drizzle-orm'
import { index, integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core'

/*
 * Timestamps are stored as epoch milliseconds (plain numbers) so that rows can
 * be passed to client components without any serialization step.
 * Soft deletes: `deletedAt` holds the id of the delete batch (a timestamp) so a
 * whole subtree can be restored in one go ("Rückgängig").
 */

export type Topic = { id: string; title: string }
export type Answer = { id: string; text: string; correct: boolean }
export type QuestionType = 'mc' | 'tf' | 'text'
export type ContentSource = 'claude' | 'manual'
export type AttemptDetail = { questionId: string; correct: boolean }

export const subjects = sqliteTable(
  'subjects',
  {
    id: text('id').primaryKey(),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    hue: real('hue').notNull(),
    lightness: real('lightness').notNull().default(0.82),
    chroma: real('chroma').notNull().default(0.1),
    sort: integer('sort').notNull().default(0),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
    deletedAt: integer('deleted_at'),
  },
  (t) => [index('subjects_sort_idx').on(t.sort)],
)

export const pages = sqliteTable(
  'pages',
  {
    id: text('id').primaryKey(),
    subjectId: text('subject_id').references(() => subjects.id, { onDelete: 'cascade' }),
    parentId: text('parent_id'),
    slug: text('slug').notNull(),
    title: text('title').notNull(),
    heading: text('heading'),
    kicker: text('kicker'),
    lessonDate: text('lesson_date'),
    sort: integer('sort').notNull().default(0),
    contentMd: text('content_md').notNull().default(''),
    topics: text('topics', { mode: 'json' }).$type<Topic[]>().notNull().default(sql`'[]'`),
    wordCount: integer('word_count').notNull().default(0),
    source: text('source').$type<ContentSource>().notNull().default('manual'),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
    contentUpdatedAt: integer('content_updated_at'),
    deletedAt: integer('deleted_at'),
    lastOpenedAt: integer('last_opened_at'),
    readProgress: real('read_progress').notNull().default(0),
    topicProgress: text('topic_progress', { mode: 'json' })
      .$type<Record<string, number>>()
      .notNull()
      .default(sql`'{}'`),
  },
  (t) => [
    index('pages_tree_idx').on(t.subjectId, t.parentId, t.sort),
    index('pages_parent_idx').on(t.parentId),
    index('pages_opened_idx').on(t.lastOpenedAt),
  ],
)

export const quizzes = sqliteTable(
  'quizzes',
  {
    id: text('id').primaryKey(),
    pageId: text('page_id')
      .notNull()
      .references(() => pages.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    sort: integer('sort').notNull().default(0),
    source: text('source').$type<ContentSource>().notNull().default('claude'),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
    deletedAt: integer('deleted_at'),
  },
  (t) => [index('quizzes_page_idx').on(t.pageId)],
)

export const questions = sqliteTable(
  'questions',
  {
    id: text('id').primaryKey(),
    quizId: text('quiz_id')
      .notNull()
      .references(() => quizzes.id, { onDelete: 'cascade' }),
    sort: integer('sort').notNull().default(0),
    type: text('type').$type<QuestionType>().notNull(),
    prompt: text('prompt').notNull(),
    answers: text('answers', { mode: 'json' }).$type<Answer[]>().notNull().default(sql`'[]'`),
    explanation: text('explanation'),
    topicId: text('topic_id'),
  },
  (t) => [index('questions_quiz_idx').on(t.quizId, t.sort)],
)

export const attempts = sqliteTable(
  'attempts',
  {
    id: text('id').primaryKey(),
    quizId: text('quiz_id')
      .notNull()
      .references(() => quizzes.id, { onDelete: 'cascade' }),
    score: integer('score').notNull(),
    total: integer('total').notNull(),
    details: text('details', { mode: 'json' }).$type<AttemptDetail[]>().notNull().default(sql`'[]'`),
    finishedAt: integer('finished_at').notNull(),
  },
  (t) => [index('attempts_quiz_idx').on(t.quizId, t.finishedAt)],
)

export const inboxItems = sqliteTable(
  'inbox_items',
  {
    id: text('id').primaryKey(),
    kind: text('kind').$type<'page' | 'quiz'>().notNull(),
    refId: text('ref_id').notNull(),
    action: text('action').$type<'created' | 'updated'>().notNull().default('created'),
    createdAt: integer('created_at').notNull(),
    seenAt: integer('seen_at'),
  },
  (t) => [index('inbox_ref_idx').on(t.kind, t.refId), index('inbox_created_idx').on(t.createdAt)],
)

export const pageRevisions = sqliteTable(
  'page_revisions',
  {
    id: text('id').primaryKey(),
    pageId: text('page_id')
      .notNull()
      .references(() => pages.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    heading: text('heading'),
    kicker: text('kicker'),
    contentMd: text('content_md').notNull(),
    createdAt: integer('created_at').notNull(),
  },
  (t) => [index('revisions_page_idx').on(t.pageId, t.createdAt)],
)

export const oauthClients = sqliteTable('oauth_clients', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  redirectUris: text('redirect_uris', { mode: 'json' }).$type<string[]>().notNull(),
  secretHash: text('secret_hash'),
  createdAt: integer('created_at').notNull(),
  lastUsedAt: integer('last_used_at'),
})

export const oauthCodes = sqliteTable('oauth_codes', {
  codeHash: text('code_hash').primaryKey(),
  clientId: text('client_id')
    .notNull()
    .references(() => oauthClients.id, { onDelete: 'cascade' }),
  redirectUri: text('redirect_uri').notNull(),
  codeChallenge: text('code_challenge').notNull(),
  scope: text('scope').notNull(),
  resource: text('resource'),
  expiresAt: integer('expires_at').notNull(),
  usedAt: integer('used_at'),
})

export const oauthTokens = sqliteTable(
  'oauth_tokens',
  {
    id: text('id').primaryKey(),
    clientId: text('client_id')
      .notNull()
      .references(() => oauthClients.id, { onDelete: 'cascade' }),
    accessHash: text('access_hash').notNull(),
    refreshHash: text('refresh_hash').notNull(),
    prevRefreshHash: text('prev_refresh_hash'),
    rotatedAt: integer('rotated_at'),
    scope: text('scope').notNull(),
    resource: text('resource'),
    accessExpiresAt: integer('access_expires_at').notNull(),
    refreshExpiresAt: integer('refresh_expires_at').notNull(),
    createdAt: integer('created_at').notNull(),
    lastUsedAt: integer('last_used_at'),
    revokedAt: integer('revoked_at'),
  },
  (t) => [
    index('tokens_access_idx').on(t.accessHash),
    index('tokens_refresh_idx').on(t.refreshHash),
    index('tokens_prev_refresh_idx').on(t.prevRefreshHash),
  ],
)

export const appMeta = sqliteTable('app_meta', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
})
