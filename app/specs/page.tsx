'use client'

import { useState, useEffect } from 'react'
import { CurrentSpec } from '@/components/specs/current-spec'
import type { SpecInfo } from '@/lib/refine/specs'

export default function SpecsPage() {
  const [spec, setSpec] = useState<SpecInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | undefined>()
  const [branch, setBranch] = useState('')

  useEffect(() => {
    async function load() {
      try {
        const [branchRes, specRes] = await Promise.all([
          fetch('/api/git/branch'),
          fetch('/api/specs/current'),
        ])

        const branchData = await branchRes.json()
        setBranch(branchData.branch)

        if (branchData.branch === 'main' || branchData.branch === 'master' || branchData.branch === 'develop') {
          setError('no-ticket')
          setLoading(false)
          return
        }

        if (!specRes.ok) {
          setError('no-ticket')
          setLoading(false)
          return
        }

        const specData = await specRes.json()
        if (specData && specData.number) {
          setSpec(specData)
        } else {
          setError('no-ticket')
        }
      } catch {
        setError('no-ticket')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  return (
    <div className="flex flex-col h-dvh bg-background">
      <header className="flex items-center justify-between px-6 py-3 border-b">
        <h1 className="text-lg font-semibold">Specs Dashboard</h1>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="size-1.5 rounded-full bg-muted-foreground/50" />
          {branch}
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        <CurrentSpec
          spec={spec}
          loading={loading}
          error={error}
        />
      </main>
    </div>
  )
}
