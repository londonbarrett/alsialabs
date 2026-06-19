'use client'

interface SpecStatus {
  number: number
  title: string
  state: string
  html_url: string
  artifacts: {
    proposal: boolean
    spec: boolean
    design: boolean
    tasks: boolean
  }
  scenarioCount?: number
}

interface CurrentSpecProps {
  spec: SpecStatus | null
  loading: boolean
  error?: string
}

function ArtifactRow({ label, done }: { label: string; done: boolean }) {
  return (
    <div className="flex items-center gap-3 py-1.5">
      <span className={done
        ? 'text-green-600 dark:text-green-400 font-bold'
        : 'text-muted-foreground'
      }>
        {done ? '✓' : '○'}
      </span>
      <span className={done ? 'text-foreground' : 'text-muted-foreground'}>
        {label}
      </span>
    </div>
  )
}

export function CurrentSpec({ spec, loading, error }: CurrentSpecProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        Loading...
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <p className="text-destructive font-medium">No ticket selected</p>
        <p className="text-muted-foreground text-sm text-center max-w-md">
          Run <code className="text-xs bg-muted px-1.5 py-0.5 rounded">/refine</code> on a feature branch to start.
        </p>
      </div>
    )
  }

  if (!spec) {
    return null
  }

  const doneCount = Object.values(spec.artifacts).filter(Boolean).length

  return (
    <div className="max-w-lg mx-auto pt-12 px-6">
      <div className="flex items-center gap-3 mb-1">
        <span className={spec.state === 'open'
          ? 'size-2 rounded-full bg-green-500'
          : 'size-2 rounded-full bg-gray-400'
        } />
        <span className="text-sm font-medium text-muted-foreground">
          #{spec.number} · {spec.state}
        </span>
      </div>

      <h1 className="text-2xl font-semibold tracking-tight mb-6">
        {spec.title}
      </h1>

      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm text-muted-foreground">
            Spec artifacts ({doneCount}/4)
          </span>
          <span className="text-xs text-muted-foreground">
            {spec.scenarioCount ? `${spec.scenarioCount} scenarios` : ''}
          </span>
        </div>
        <div className="space-y-0.5">
          <ArtifactRow label="proposal.md — problem and intent" done={spec.artifacts.proposal} />
          <ArtifactRow label="specs/spec.md — Gherkin scenarios" done={spec.artifacts.spec} />
          <ArtifactRow label="design.md — technical notes" done={spec.artifacts.design} />
          <ArtifactRow label="tasks.md — implementation checklist" done={spec.artifacts.tasks} />
        </div>
      </div>

      <a
        href={spec.html_url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex text-xs text-muted-foreground hover:text-foreground underline"
      >
        Open on GitHub →
      </a>
    </div>
  )
}
