/**
 * spec:push
 * Reads the active spec file and pushes changes to GitHub.
 */

import { loadEnv } from './_env.mjs'
import { readFile, readdir } from 'fs/promises'

const { GITHUB_TOKEN, GITHUB_REPO } = loadEnv()

if (!GITHUB_TOKEN) {
  console.error('Error: GITHUB_TOKEN is required to push changes.')
  process.exit(1)
}

const API = 'https://api.github.com'
const REPO = GITHUB_REPO || 'londonbarrett/alsialabs'

function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
  if (!match) return null
  const frontmatter = {}
  for (const line of match[1].split('\n')) {
    const [, key, value] = line.match(/^(\w+):\s*(.+)$/) || []
    if (key) frontmatter[key] = value.replace(/^"(.*)"$/, '$1')
  }
  const body = match[2].trim()
  const number = parseInt(frontmatter.number, 10)
  if (isNaN(number)) return null
  return { number, title: frontmatter.title, body, state: frontmatter.state }
}

async function updateIssue(num, data) {
  const res = await fetch(`${API}/repos/${REPO}/issues/${num}`, {
    method: 'PATCH',
    headers: {
      Accept: 'application/vnd.github.v3+json',
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`GitHub API error ${res.status}: ${err}`)
  }
  return res.json()
}

async function getActiveFile() {
  try {
    const active = await readFile('specs/.active', 'utf-8')
    const number = parseInt(active.trim(), 10)
    if (isNaN(number)) return null
    const files = await readdir('specs')
    const prefix = String(number).padStart(3, '0')
    const file = files.find((f) => f.startsWith(prefix) && f.endsWith('.md'))
    if (!file) return null
    return { number, filepath: `specs/${file}` }
  } catch {
    return null
  }
}

try {
  const active = await getActiveFile()
  if (!active) {
    console.error('No active spec found. Run spec:pull first.')
    process.exit(1)
  }

  const content = await readFile(active.filepath, 'utf-8')
  const spec = parseFrontmatter(content)
  if (!spec) {
    console.error(`Could not parse spec file: ${active.filepath}`)
    process.exit(1)
  }

  const updated = await updateIssue(spec.number, {
    title: spec.title,
    body: spec.body,
  })

  console.log(`Pushed #${updated.number} → GitHub (${updated.html_url})`)
} catch (err) {
  console.error('Error:', err.message)
  process.exit(1)
}
