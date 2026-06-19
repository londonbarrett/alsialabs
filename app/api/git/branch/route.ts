import { NextResponse } from 'next/server'
import { execSync } from 'child_process'

export async function GET() {
  try {
    const branch = execSync('git branch --show-current', {
      encoding: 'utf-8',
    }).trim()
    return NextResponse.json({ branch })
  } catch {
    return NextResponse.json({ branch: 'unknown' })
  }
}
