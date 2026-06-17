import { promises as fs } from 'fs'
import path from 'path'
import type { GitHubIssue } from './github'

const SPECS_DIR = path.join(process.cwd(), 'specs')
const ACTIVE_FILE = path.join(SPECS_DIR, '.active')

function padNum(n: number): string {
  return String(n).padStart(3, '0')
}

function sanitizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)
}

function formatSpecFilename(issue: GitHubIssue): string {
  return `${padNum(issue.number)}-${sanitizeTitle(issue.title)}.md`
}

function formatSpecContent(issue: GitHubIssue): string {
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

export async function writeSpec(issue: GitHubIssue): Promise<string> {
  await fs.mkdir(SPECS_DIR, { recursive: true })
  const filename = formatSpecFilename(issue)
  const filepath = path.join(SPECS_DIR, filename)
  await fs.writeFile(filepath, formatSpecContent(issue), 'utf-8')
  return filename
}

export async function setActiveIssue(number: number): Promise<void> {
  await fs.mkdir(SPECS_DIR, { recursive: true })
  await fs.writeFile(ACTIVE_FILE, String(number), 'utf-8')
}

export async function getActiveIssue(): Promise<number | null> {
  try {
    const content = await fs.readFile(ACTIVE_FILE, 'utf-8')
    return parseInt(content.trim(), 10)
  } catch {
    return null
  }
}

export async function readSpec(number: number): Promise<{
  filepath: string
  content: string
} | null> {
  await fs.mkdir(SPECS_DIR, { recursive: true })
  const files = await fs.readdir(SPECS_DIR)
  const prefix = padNum(number)
  const file = files.find((f) => f.startsWith(prefix) && f.endsWith('.md'))
  if (!file) return null
  const filepath = path.join(SPECS_DIR, file)
  const content = await fs.readFile(filepath, 'utf-8')
  return { filepath, content }
}

export async function listSpecs(): Promise<string[]> {
  try {
    const files = await fs.readdir(SPECS_DIR)
    return files
      .filter((f) => f.endsWith('.md'))
      .sort()
  } catch {
    return []
  }
}
