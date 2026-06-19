import { NextResponse } from 'next/server'
import { fetchIssue, updateIssue } from '@/lib/refine/github'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ number: string }> }
) {
  const { number } = await params
  const num = parseInt(number, 10)
  if (isNaN(num)) {
    return NextResponse.json({ error: 'Invalid issue number' }, { status: 400 })
  }

  try {
    const issue = await fetchIssue(num)
    return NextResponse.json(issue)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch issue'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ number: string }> }
) {
  const { number } = await params
  const num = parseInt(number, 10)
  if (isNaN(num)) {
    return NextResponse.json({ error: 'Invalid issue number' }, { status: 400 })
  }

  try {
    const body = await request.json()
    const { title, body: issueBody, state } = body

    if (!title && issueBody === undefined && !state) {
      return NextResponse.json(
        { error: 'At least one field (title, body, state) is required' },
        { status: 400 }
      )
    }

    const issue = await updateIssue(num, {
      ...(title !== undefined && { title }),
      ...(issueBody !== undefined && { body: issueBody }),
      ...(state !== undefined && { state }),
    })

    return NextResponse.json(issue)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update issue'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
