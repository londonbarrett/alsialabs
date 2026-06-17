/**
 * spec:pull <issue-number>
 * Fetches a GitHub issue and saves it as a local spec file.
 */

import { loadEnv } from './_env.mjs'

const { GITHUB_TOKEN, GITHUB_REPO } = loadEnv()

const API = 'https://api.github.com'
const REPO = GITHUB_REPO || 'londonbarrett/alsialabs'
const HEADERS = {
  Accept: 'application/vnd.github.v3+json',
  ...(GITHUB_TOKEN ? { Authorization: `Bearer ${GITHUB_TOKEN}` } : {}),
}

const number = process.argv[2]
if (!number || !/^\d+$/.test(number)) {
  console.error('Usage: node scripts/spec-pull.mjs <issue-number>')
  process.exit(1)
}

async function fetchIssue(num) {
  const res = await fetch(`${API}/repos/${REPO}/issues/${num}`, {
    headers: HEADERS,
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`GitHub API error ${res.status}: ${err}`)
  }
  return res.json()
}

function padNum(n) {
  return String(n).padStart(3, '0')
}

function sanitizeTitle(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)
}

function formatSpecContent(issue) {
  const labels = issue.labels.map((l) => l.name).join(', ')
  const assignees = issue.assignees.map((a) => a.login).join(', ')
  return [
    '---',
    `number: ${issue.number}`,
    `title: "${issue.title.replace(/"/g, '\\"')}"`,
    `state: ${issue.state}`,
    `url: ${issue.html_url}`,
    labels ? `labels: [${labels}]` : 'labels: []',
    assignees ? `assignees: [${assignees}]` : 'assignees: []',
    `updated: ${issue.updated_at}`,
    '---',
    '',
    issue.body || '',
  ].join('\n')
}

try {
  const issue = await fetchIssue(number)
  const filename = `${padNum(issue.number)}-${sanitizeTitle(issue.title)}.md`
  const filepath = `specs/${filename}`
  const fs = await import('fs/promises')
  await fs.mkdir('specs', { recursive: true })
  await fs.writeFile(filepath, formatSpecContent(issue), 'utf-8')
  await fs.writeFile('specs/.active', String(issue.number), 'utf-8')
  console.log(`Pulled #${issue.number} → ${filepath}`)
} catch (err) {
  console.error('Error:', err.message)
  process.exit(1)
}
