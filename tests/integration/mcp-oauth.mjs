/**
 * Integration test against a running Lernraum (npm run dev / start):
 *   1. MCP with the static bearer token (tools, ingest, read, search)
 *   2. Full OAuth flow with the official MCP SDK client, incl. browser consent
 *
 *   LERNRAUM_URL=http://localhost:3000 LERNRAUM_API_TOKEN=… APP_PASSWORD=… node tests/integration/mcp-oauth.mjs
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { UnauthorizedError } from '@modelcontextprotocol/sdk/client/auth.js'
import { chromium } from 'playwright'
import assert from 'node:assert/strict'

const BASE = (process.env.LERNRAUM_URL || 'http://localhost:3000').replace(/\/+$/, '')
const TOKEN = process.env.LERNRAUM_API_TOKEN
const PASSWORD = process.env.APP_PASSWORD || 'lernraum'
const MCP = new URL(`${BASE}/api/mcp`)
const ok = (msg) => console.log(`  ✓ ${msg}`)

// ------------------------------------------------------------- 1. bearer
console.log('1) MCP mit statischem Token')
{
  const unauth = await fetch(MCP, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' }, body: '{}' })
  assert.equal(unauth.status, 401)
  assert.match(unauth.headers.get('www-authenticate') ?? '', /resource_metadata="[^"]+\/\.well-known\/oauth-protected-resource\/api\/mcp"/)
  ok('401 mit resource_metadata ohne Token')

  const client = new Client({ name: 'lernraum-test', version: '1.0.0' })
  await client.connect(new StreamableHTTPClientTransport(MCP, { requestInit: { headers: { Authorization: `Bearer ${TOKEN}` } } }))
  assert.match(client.getInstructions() ?? '', /Lernzettel/)
  ok('initialize + Server-Instructions')

  const tools = (await client.listTools()).tools.map((t) => t.name).sort()
  assert.deepEqual(tools, ['get_format_guide', 'get_page', 'ingest_page', 'ingest_quiz', 'list_tree', 'search'])
  ok(`tools/list: ${tools.join(', ')}`)

  const tree = await client.callTool({ name: 'list_tree', arguments: {} })
  assert.ok(!tree.isError)
  ok('list_tree')

  const bad = await client.callTool({
    name: 'ingest_page',
    arguments: {
      subject: 'Testfach',
      title: 'Kaputt',
      content_md: '## A\n\nx',
      quiz: { questions: [{ type: 'mc', prompt: 'x?', answers: [{ text: 'a' }, { text: 'b' }] }] },
    },
  })
  assert.equal(bad.isError, true)
  assert.match(bad.content[0].text, /Genau eine Antwort/)
  ok('Validierungsfehler kommt als lesbare Tool-Antwort zurück')

  const res = await client.callTool({
    name: 'ingest_page',
    arguments: {
      subject: 'Testfach',
      path: ['MCP'],
      title: 'Stunde 1 – Über MCP',
      content_md: '## Grundlagen\n\nDas Model Context Protocol verbindet Claude mit Werkzeugen.\n\n:::merke\nTools + Ressourcen.\n:::',
      quiz: { questions: [{ type: 'tf', prompt: 'MCP verbindet Claude mit Werkzeugen.', correct: true, topic: 'Grundlagen' }] },
    },
  })
  assert.ok(!res.isError, res.content?.[0]?.text)
  const url = res.structuredContent.url
  assert.ok(url.startsWith(BASE) && url.endsWith('/f/testfach/mcp/stunde-1-ueber-mcp'), url)
  ok(`ingest_page → ${url}`)

  const page = await client.callTool({ name: 'get_page', arguments: { page: url } })
  assert.match(page.content[0].text, /Model Context Protocol/)
  assert.equal(page.structuredContent.quizzes[0].questions[0].topic, 'grundlagen')
  ok('get_page per URL (Markdown + Quiz)')

  const found = await client.callTool({ name: 'search', arguments: { query: 'Werkzeugen' } })
  assert.match(found.content[0].text, /Über MCP/)
  ok('search')

  const quiz = await client.callTool({
    name: 'ingest_quiz',
    arguments: { page_id: page.structuredContent.page_id, quiz: { title: 'Extra', questions: [{ type: 'text', prompt: 'Wofür steht MCP?', correct: ['Model Context Protocol'] }] } },
  })
  assert.ok(!quiz.isError, quiz.content?.[0]?.text)
  ok('ingest_quiz an bestehende Seite')
  await client.close()
}

// ------------------------------------------------------------- 2. OAuth
console.log('2) OAuth-Flow mit dem SDK-Client (wie claude.ai)')
{
  const CALLBACK = 'http://localhost:53682/callback'
  const store = { client: undefined, tokens: undefined, verifier: undefined, authUrl: undefined }
  const provider = {
    get redirectUrl() {
      return CALLBACK
    },
    get clientMetadata() {
      return { client_name: 'Claude (Test)', redirect_uris: [CALLBACK], grant_types: ['authorization_code', 'refresh_token'], response_types: ['code'], token_endpoint_auth_method: 'none' }
    },
    clientInformation: () => store.client,
    saveClientInformation: (c) => void (store.client = c),
    tokens: () => store.tokens,
    saveTokens: (t) => void (store.tokens = t),
    redirectToAuthorization: (url) => void (store.authUrl = url),
    saveCodeVerifier: (v) => void (store.verifier = v),
    codeVerifier: () => store.verifier,
  }

  let transport = new StreamableHTTPClientTransport(MCP, { authProvider: provider })
  let client = new Client({ name: 'oauth-test', version: '1.0.0' })
  await assert.rejects(client.connect(transport), UnauthorizedError)
  assert.ok(store.client?.client_id?.startsWith('lr_client_'), 'Client registriert')
  assert.ok(store.authUrl?.href.startsWith(`${BASE}/oauth/authorize`), 'Redirect zur Autorisierung')
  ok(`Discovery + Dynamic Client Registration (${store.client.client_id})`)

  // Browser: login + consent, capture the redirect with the code.
  const browser = await chromium.launch()
  const pageCtx = await browser.newContext()
  const page = await pageCtx.newPage()
  let code = null
  await page.route('http://localhost:53682/**', (route) => {
    const u = new URL(route.request().url())
    code = u.searchParams.get('code')
    assert.equal(u.searchParams.get('iss'), BASE)
    route.fulfill({ status: 200, body: 'ok' })
  })
  await page.goto(store.authUrl.href)
  assert.ok(page.url().includes('/login'), 'Login wird verlangt')
  await page.fill('input[name=password]', PASSWORD)
  await page.click('button[type=submit]')
  await page.waitForSelector('text=möchte auf deinen Lernraum zugreifen')
  ok('Login, dann Zustimmungsseite')
  await page.click('button[value=allow]')
  for (let i = 0; i < 50 && !code; i++) await page.waitForTimeout(100)
  await browser.close()
  assert.ok(code?.startsWith('lr_code_'), 'Code erhalten')
  ok('„Zulassen“ → Redirect mit code + iss')

  await transport.finishAuth(code)
  assert.ok(store.tokens?.access_token?.startsWith('lr_at_'))
  assert.ok(store.tokens?.refresh_token?.startsWith('lr_rt_'))
  ok('Token-Tausch mit PKCE')

  transport = new StreamableHTTPClientTransport(MCP, { authProvider: provider })
  client = new Client({ name: 'oauth-test', version: '1.0.0' })
  await client.connect(transport)
  const tools = await client.listTools()
  assert.ok(tools.tools.length === 6)
  ok('MCP-Aufruf mit OAuth-Access-Token')
  await client.close()

  // Refresh token rotation
  const tokenUrl = `${BASE}/oauth/token`
  const refresh = async (rt) =>
    fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: rt, client_id: store.client.client_id }),
    })
  const r1 = await refresh(store.tokens.refresh_token)
  assert.equal(r1.status, 200)
  const t1 = await r1.json()
  assert.notEqual(t1.refresh_token, store.tokens.refresh_token)
  ok('Refresh-Token-Rotation')
  const grace = await refresh(store.tokens.refresh_token)
  assert.equal(grace.status, 200, 'alter Refresh-Token in der Kulanzzeit')
  ok('Kulanzzeit für gerade rotierten Refresh-Token')
  const replay = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'authorization_code', code, client_id: store.client.client_id, code_verifier: store.verifier, redirect_uri: CALLBACK }),
  })
  assert.equal(replay.status, 400)
  ok('Code kann nicht zweimal verwendet werden')

  const badRedirect = await fetch(`${BASE}/oauth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ redirect_uris: ['https://evil.example/cb'] }),
  })
  assert.equal(badRedirect.status, 400)
  ok('Fremde Redirect-URIs werden abgelehnt')
}

console.log('\nAlle MCP/OAuth-Tests bestanden.')
