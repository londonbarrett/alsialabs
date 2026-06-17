const GITHUB_API = 'https://api.github.com'
const REPO = process.env.GITHUB_REPO || 'londonbarrett/alsialabs'
const TOKEN = process.env.GITHUB_TOKEN

export interface GitHubLabel {
  name: string
  color: string
}

export interface GitHubUser {
  login: string
}

export interface GitHubIssue {
  number: number
  title: string
  state: string
  body: string
  html_url: string
  labels: GitHubLabel[]
  assignees: GitHubUser[]
  created_at: string
  updated_at: string
}

const headers = (): Record<string, string> => {
  const h: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
  }
  if (TOKEN) h['Authorization'] = `Bearer ${TOKEN}`
  return h
}

export async function fetchIssues(): Promise<GitHubIssue[]> {
  const res = await fetch(
    `${GITHUB_API}/repos/${REPO}/issues?state=open&per_page=100`,
    { headers: headers() }
  )
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`GitHub API error ${res.status}: ${err}`)
  }
  return res.json()
}

export async function fetchIssue(number: number): Promise<GitHubIssue> {
  const res = await fetch(`${GITHUB_API}/repos/${REPO}/issues/${number}`, {
    headers: headers(),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`GitHub API error ${res.status}: ${err}`)
  }
  return res.json()
}

export async function updateIssue(
  number: number,
  data: { title?: string; body?: string; state?: string }
): Promise<GitHubIssue> {
  if (!TOKEN) throw new Error('GITHUB_TOKEN is required to update issues')
  const res = await fetch(`${GITHUB_API}/repos/${REPO}/issues/${number}`, {
    method: 'PATCH',
    headers: {
      ...headers(),
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
