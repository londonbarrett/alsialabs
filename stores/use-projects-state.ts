"use client"

import { useProjectsStore } from "@/stores/projects-store"
import type { Project } from "@/lib/types"
import type { ProjectsAction } from "@/stores/projects-reducer"
import type { OptimisticStore } from "@/lib/optimistic-store"
import { useMemo } from "react"

type StoreType = OptimisticStore<Project[], ProjectsAction>

export function useProjectsState() {
  const store = useProjectsStore()
  const projects = store((s: StoreType) => s.optimistic)
  const pending = store((s: StoreType) => s.pending)

  const pendingIds = useMemo(() => {
    const ids = new Set<string>()
    for (const item of pending) {
      if (item.action.type === "add") ids.add(item.action.project.id)
      else if (item.action.type === "replaceTemp")
        ids.add(item.action.tempId)
    }
    return ids
  }, [pending])

  return { projects, pending, pendingIds }
}
