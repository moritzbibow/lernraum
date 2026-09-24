import fs from 'node:fs'
import path from 'node:path'
import { FORMAT_GUIDE } from '../lib/content/format-guide'

const target = path.join(process.cwd(), 'docs', 'CONTENT_FORMAT.md')
fs.mkdirSync(path.dirname(target), { recursive: true })
fs.writeFileSync(target, `<!-- Generiert aus lib/content/format-guide.ts – nicht direkt bearbeiten (npm run docs:format). -->\n\n${FORMAT_GUIDE}`)
console.log(`geschrieben: ${path.relative(process.cwd(), target)}`)
