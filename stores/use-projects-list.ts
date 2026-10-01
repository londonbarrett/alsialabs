"use client"

import { useProjectsStore } from "@/stores/projects-store"
import { useMemo } from "react"

export function useProjectsList() {
  const store = useProjectsStore()
  const projects = store.getProjects()
  const pending = store.getPending()

  const pendingIds = useMemo(() => {
    const ids = new Set<string>()
    for (const item of pending) {
      if (item.action.type === "add") ids.add(item.action.project.id)
      else if (item.action.type === "replaceTemp")
        ids.add(item.action.tempId)
    }
    return ids
  }, [pending])

  return { projects, pendingIds }
}
