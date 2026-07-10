import { Suspense } from "react"
import { auth, getUserPermissions } from "@/lib/auth"
import { getProjectsWithDetails } from "@/lib/actions/projects"
import { getProjectCategories } from "@/lib/actions/project-categories"
import { ProjectListView } from "@/components/projects/project-list-view"

export default function ProjectsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-1 flex-col gap-6 p-6">
          <div className="flex justify-between">
            <header className="flex flex-col gap-2">
              <div className="h-4 w-20 animate-pulse rounded bg-muted" />
              <div className="h-8 w-40 animate-pulse rounded bg-muted md:h-9" />
              <div className="h-5 w-80 animate-pulse rounded bg-muted md:w-96" />
            </header>
            <div className="h-9 w-36 animate-pulse self-start rounded-md bg-muted" />
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="h-64 animate-pulse rounded-xl bg-muted" />
            <div className="h-64 animate-pulse rounded-xl bg-muted" />
          </div>
        </div>
      }
    >
      <ProjectsContent />
    </Suspense>
  )
}

async function ProjectsContent() {
  const session = await auth()

  const [projects, categories, permissions] = await Promise.all([
    getProjectsWithDetails(),
    getProjectCategories(),
    getUserPermissions(session?.user?.id ?? ""),
  ])

  return (
    <ProjectListView
      projects={projects}
      categories={categories}
      permissions={permissions}
    />
  )
}
