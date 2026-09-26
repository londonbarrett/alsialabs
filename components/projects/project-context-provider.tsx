"use client"

import type { ProjectContext } from "@/lib/actions/projects"
import {
  createProjectContextStore,
  ProjectContextStoreContext,
  type ProjectContextStore,
} from "@/stores/project-context-store"
import { useRef } from "react"

/**
 * Provides the project context fetched by the detail layout to the project
 * subtree.
 *
 * The ref guarantees the store is built exactly once per page session, so there
 * is no seeding side effect and no render-phase write to the store its
 * subscribers are reading. Navigating to another project remounts this
 * provider, which builds a fresh store for the new project; mutations within a
 * project go through the store's actions instead of re-reading the context.
 */
export function ProjectContextProvider({
  context,
  children,
}: {
  context: ProjectContext
  children: React.ReactNode
}) {
  const storeRef = useRef<ProjectContextStore | null>(null)
  if (storeRef.current == null) {
    storeRef.current = createProjectContextStore(context)
  }

  // Seeded once above and never reassigned, so it is not render-varying state.
  // eslint-disable-next-line react-hooks/refs
  const store = storeRef.current

  return (
    <ProjectContextStoreContext value={store}>
      {children}
    </ProjectContextStoreContext>
  )
}
