import { NextResponse } from 'next/server'
import { execSync } from 'child_process'
import { getSpecForBranch, parseIssueNumber } from '@/lib/refine/specs'
import { fetchIssue } from '@/lib/refine/github'

export async function GET() {
  try {
    const branch = execSync('git branch --show-current', {
      encoding: 'utf-8',
    }).trim()

    if (branch === 'main' || branch === 'master' || branch === 'develop') {
      return NextResponse.json({ error: 'No ticket selected' }, { status: 404 })
    }

    const issueNumber = parseIssueNumber(branch)
    if (!issueNumber) {
      return NextResponse.json({ error: 'No ticket number in branch' }, { status: 404 })
    }

    const spec = await getSpecForBranch(branch)
    if (spec) {
      return NextResponse.json(spec)
    }

    try {
      const issue = await fetchIssue(issueNumber)
      return NextResponse.json({
        number: issue.number,
        title: issue.title,
        state: issue.state,
        html_url: issue.html_url,
        artifacts: { proposal: false, spec: false, design: false, tasks: false },
        scenarioCount: 0,
      })
    } catch {
      return NextResponse.json({ error: 'Issue not found' }, { status: 404 })
    }
  } catch {
    return NextResponse.json({ error: 'Failed to load spec' }, { status: 500 })
  }
}
