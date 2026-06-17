'use client'

import { useState, useEffect } from 'react'
import type { GitHubIssue } from '@/lib/github'

interface IssueEditorProps {
  issue: GitHubIssue | null
  onSave: (title: string, body: string) => Promise<void>
  loading: boolean
}

export function IssueEditor({ issue, onSave, loading }: IssueEditorProps) {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [preview, setPreview] = useState(false)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    if (issue) {
      setTitle(issue.title)
      setBody(issue.body || '')
      setDirty(false)
      setPreview(false)
      setMessage(null)
    }
  }, [issue])

  if (!issue) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        Select an issue to edit
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        Loading issue details...
      </div>
    )
  }

  const handleSave = async () => {
    if (!dirty) return
    setSaving(true)
    setMessage(null)
    try {
      await onSave(title, body)
      setDirty(false)
      setMessage({ type: 'success', text: 'Issue updated successfully' })
    } catch {
      setMessage({ type: 'error', text: 'Failed to update issue' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-3">
          <span className={issue.state === 'open'
            ? 'size-2 rounded-full bg-green-500'
            : 'size-2 rounded-full bg-gray-400'
          } />
          <span className="text-sm font-medium text-muted-foreground">
            #{issue.number} · {issue.state}
          </span>
          <a
            href={issue.html_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-muted-foreground hover:text-foreground underline"
          >
            open on github
          </a>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPreview(!preview)}
            className="text-xs px-3 py-1.5 rounded-md border hover:bg-accent transition-colors"
          >
            {preview ? 'Edit' : 'Preview'}
          </button>
          <button
            onClick={handleSave}
            disabled={!dirty || saving}
            className="text-xs px-3 py-1.5 rounded-md bg-foreground text-background hover:opacity-90 transition-opacity disabled:opacity-40"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      {message && (
        <div className={message.type === 'success'
          ? 'px-4 py-2 text-xs bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400'
          : 'px-4 py-2 text-xs bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'
        }>
          {message.text}
        </div>
      )}

      <div className="flex-1 p-4 overflow-auto">
        <input
          type="text"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value)
            setDirty(true)
          }}
          className="w-full text-lg font-semibold bg-transparent border-none outline-none mb-4 placeholder:text-muted-foreground/50"
          placeholder="Issue title"
        />

        {preview ? (
          <div className="prose prose-sm dark:prose-invert max-w-none">
            {body ? (
              <div className="whitespace-pre-wrap font-mono text-sm leading-relaxed text-foreground/80">
                {body}
              </div>
            ) : (
              <span className="text-muted-foreground italic">No description</span>
            )}
          </div>
        ) : (
          <textarea
            value={body}
            onChange={(e) => {
              setBody(e.target.value)
              setDirty(true)
            }}
            className="w-full h-full min-h-[200px] bg-transparent border-none outline-none resize-none font-mono text-sm leading-relaxed placeholder:text-muted-foreground/50"
            placeholder="Issue description (supports markdown)"
          />
        )}
      </div>
    </div>
  )
}
