"use client"

import type { ProjectContext } from "@/actions/projects"
import {
  createProjectContextStore,
  ProjectContextStoreContext,
} from "@/stores/project-context/project-context-store"
import { useServerReseed } from "@/hooks/use-server-reseed"
import { useState } from "react"

/**
 * Provides the project context fetched by the detail layout to the project
 * subtree.
 *
 * The lazy initializer builds the store exactly once per page session, so
 * there is no seeding side effect and no render-phase write to the store its
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
  const [store] = useState(() => createProjectContextStore(context))
  useServerReseed(store, context)

  return (
    <ProjectContextStoreContext value={store}>
      {children}
    </ProjectContextStoreContext>
  )
}
