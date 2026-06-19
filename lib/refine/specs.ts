import { promises as fs } from 'fs'
import path from 'path'

const OPENSPEC_DIR = path.join(process.cwd(), 'openspec')
const CHANGES_DIR = path.join(OPENSPEC_DIR, 'changes')

export function parseIssueNumber(branch: string): number | null {
  const match = branch.match(/^(\d+)/)
  if (match) return parseInt(match[1], 10)
  const match2 = branch.match(/[-/](\d+)[-/]/)
  if (match2) return parseInt(match2[1], 10)
  return null
}

export async function findChangeDir(issueNumber: number): Promise<string | null> {
  try {
    const entries = await fs.readdir(CHANGES_DIR, { withFileTypes: true })
    const prefix = `${issueNumber}-`
    const dir = entries.find(
      (e) => e.isDirectory() && e.name.startsWith(prefix)
    )
    return dir ? path.join(CHANGES_DIR, dir.name) : null
  } catch {
    return null
  }
}

interface ArtifactStatus {
  proposal: boolean
  spec: boolean
  design: boolean
  tasks: boolean
  scenarioCount: number
}

async function getArtifactStatus(dir: string): Promise<ArtifactStatus> {
  const status: ArtifactStatus = {
    proposal: false,
    spec: false,
    design: false,
    tasks: false,
    scenarioCount: 0,
  }

  try {
    const files = await fs.readdir(dir, { withFileTypes: true })
    for (const file of files) {
      if (file.name === 'proposal.md' && file.isFile()) {
        const content = await fs.readFile(path.join(dir, file.name), 'utf-8')
        status.proposal = content.trim().length > 50
      }
      if (file.name === 'design.md' && file.isFile()) {
        const content = await fs.readFile(path.join(dir, file.name), 'utf-8')
        status.design = content.trim().length > 50
      }
      if (file.name === 'tasks.md' && file.isFile()) {
        const content = await fs.readFile(path.join(dir, file.name), 'utf-8')
        status.tasks = content.trim().length > 50
      }
    }

    try {
      const content = await fs.readFile(path.join(dir, 'specs', 'spec.md'), 'utf-8')
      status.spec = content.trim().length > 50
      status.scenarioCount = (content.match(/### Scenario:/g) || []).length
    } catch {
      // no spec file
    }
  } catch {
    // dir doesn't exist
  }

  return status
}

export interface SpecInfo {
  number: number
  title: string
  state: string
  html_url: string
  artifacts: ArtifactStatus
  scenarioCount: number
}

export async function getSpecForBranch(branch: string): Promise<SpecInfo | null> {
  const issueNumber = parseIssueNumber(branch)
  if (!issueNumber) return null

  const dir = await findChangeDir(issueNumber)
  if (!dir) return null

  const artifacts = await getArtifactStatus(dir)

  return {
    number: issueNumber,
    title: branch.replace(/^\d+-/, '').replace(/[-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    state: 'open',
    html_url: `https://github.com/londonbarrett/alsialabs/issues/${issueNumber}`,
    artifacts,
    scenarioCount: artifacts.scenarioCount,
  }
}
