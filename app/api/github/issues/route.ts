import { NextResponse } from 'next/server'
import { fetchIssues } from '@/lib/refine/github'

export async function GET() {
  try {
    const issues = await fetchIssues()
    return NextResponse.json(issues)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch issues'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
