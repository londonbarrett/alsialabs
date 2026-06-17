'use client'

import type { GitHubIssue } from '@/lib/github'
import { cn } from '@/lib/utils'

interface IssueListProps {
  issues: GitHubIssue[]
  selectedNumber: number | null
  onSelect: (issue: GitHubIssue) => void
  loading: boolean
  error?: string
}

export function IssueList({ issues, selectedNumber, onSelect, loading, error }: IssueListProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        Loading issues...
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full text-destructive">
        {error}
      </div>
    )
  }

  if (issues.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        No open issues found
      </div>
    )
  }

  return (
    <div className="divide-y">
      {issues.map((issue) => (
        <button
          key={issue.number}
          onClick={() => onSelect(issue)}
          className={cn(
            'w-full text-left px-4 py-3 transition-colors hover:bg-accent/50',
            selectedNumber === issue.number && 'bg-accent'
          )}
        >
          <div className="flex items-start justify-between gap-2">
            <span className="text-sm font-medium leading-snug line-clamp-2">
              {issue.title}
            </span>
            <span className={cn(
              'shrink-0 text-xs px-1.5 py-0.5 rounded-full font-medium',
              issue.state === 'open'
                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
            )}>
              #{issue.number}
            </span>
          </div>
          <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
            {issue.assignees.length > 0 && (
              <span>@{issue.assignees[0].login}</span>
            )}
            {issue.labels.length > 0 && (
              <span className="truncate">
                {issue.labels.map((l) => l.name).join(', ')}
              </span>
            )}
          </div>
        </button>
      ))}
    </div>
  )
}
