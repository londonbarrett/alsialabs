"use client"

import type { OptimisticStore } from "@/lib/optimistic-store"
import type { Project } from "@/lib/types"
import { useMemo } from "react"
import { useStore } from "zustand"
import type { ProjectsAction } from "./projects-reducer"
import { useProjectsStore } from "./projects-store"

type StoreType = OptimisticStore<Project[], ProjectsAction>

export function useProjectsState() {
  const store = useProjectsStore()
  const projects = useStore(store, (s: StoreType) => s.optimistic)
  const pending = useStore(store, (s: StoreType) => s.pending)

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
