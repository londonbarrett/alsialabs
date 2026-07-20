import { Suspense } from "react"
import { auth, isSuperUser } from "@/lib/auth"
import { getMyTasks } from "@/lib/actions/project-tasks"
import { MyTasksView } from "@/components/my-tasks/my-tasks-view"

export default function MyTasksPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-1 flex-col gap-6 p-6">
          <header className="flex flex-col gap-2">
            <div className="h-5 w-80 animate-pulse rounded bg-muted md:w-96" />
            <div className="h-8 w-32 animate-pulse rounded bg-muted md:h-9" />
          </header>
          <div className="flex gap-3">
            <div className="h-9 w-44 animate-pulse rounded-md bg-muted" />
            <div className="h-9 w-56 animate-pulse rounded-md bg-muted" />
          </div>
          <div className="h-64 animate-pulse rounded-xl bg-muted" />
        </div>
      }
    >
      <MyTasksContent />
    </Suspense>
  )
}

async function MyTasksContent() {
  const session = await auth()
  const userId = session?.user?.id ?? ""
  const superUser = isSuperUser(session as { user: { role: string | null } })

  const tasks = await getMyTasks()

  return (
    <MyTasksView
      initialTasks={tasks}
      currentUserId={userId}
      isSuperUser={superUser}
    />
  )
}
