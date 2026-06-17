'use client'

import { useState, useEffect, useCallback } from 'react'
import { IssueList } from '@/components/specs/issue-list'
import { IssueEditor } from '@/components/specs/issue-editor'
import type { GitHubIssue } from '@/lib/github'

export default function SpecsPage() {
  const [issues, setIssues] = useState<GitHubIssue[]>([])
  const [selectedIssue, setSelectedIssue] = useState<GitHubIssue | null>(null)
  const [loadingList, setLoadingList] = useState(true)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [listError, setListError] = useState<string | undefined>()
  const [search, setSearch] = useState('')

  const fetchIssues = useCallback(async () => {
    setLoadingList(true)
    setListError(undefined)
    try {
      const res = await fetch('/api/github/issues')
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to load issues')
      }
      const data = await res.json()
      setIssues(data)
    } catch (err) {
      setListError(err instanceof Error ? err.message : 'Failed to load issues')
    } finally {
      setLoadingList(false)
    }
  }, [])

  useEffect(() => {
    fetchIssues()
  }, [fetchIssues])

  const handleSelect = useCallback(async (issue: GitHubIssue) => {
    setLoadingDetail(true)
    try {
      const res = await fetch(`/api/github/issues/${issue.number}`)
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to load issue')
      }
      const data = await res.json()
      setSelectedIssue(data)
    } catch {
      setSelectedIssue(issue)
    } finally {
      setLoadingDetail(false)
    }
  }, [])

  const handleSave = useCallback(async (title: string, body: string) => {
    if (!selectedIssue) return
    const res = await fetch(`/api/github/issues/${selectedIssue.number}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, body }),
    })
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.error || 'Failed to update issue')
    }
    const updated = await res.json()
    setSelectedIssue(updated)
    setIssues((prev) =>
      prev.map((i) => (i.number === updated.number ? updated : i))
    )
  }, [selectedIssue])

  const filteredIssues = search
    ? issues.filter(
        (i) =>
          i.title.toLowerCase().includes(search.toLowerCase()) ||
          `#${i.number}`.includes(search)
      )
    : issues

  return (
    <div className="flex flex-col h-dvh bg-background">
      <header className="flex items-center justify-between px-6 py-3 border-b">
        <h1 className="text-lg font-semibold">Specs Dashboard</h1>
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search issues..."
            className="text-sm px-3 py-1.5 rounded-md border bg-transparent outline-none w-48 placeholder:text-muted-foreground/50"
          />
          <button
            onClick={fetchIssues}
            className="text-xs px-3 py-1.5 rounded-md border hover:bg-accent transition-colors"
          >
            Refresh
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-80 border-r overflow-y-auto shrink-0">
          <IssueList
            issues={filteredIssues}
            selectedNumber={selectedIssue?.number ?? null}
            onSelect={handleSelect}
            loading={loadingList}
            error={listError}
          />
          {!loadingList && !listError && (
            <div className="px-4 py-2 text-xs text-muted-foreground border-t">
              {issues.length} open {issues.length === 1 ? 'issue' : 'issues'}
              {search && ` · ${filteredIssues.length} matched`}
            </div>
          )}
        </aside>

        <main className="flex-1 overflow-y-auto">
          <IssueEditor
            issue={selectedIssue}
            onSave={handleSave}
            loading={loadingDetail}
          />
        </main>
      </div>
    </div>
  )
}
