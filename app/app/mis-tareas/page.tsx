import { Suspense } from "react"
import { auth } from "@/lib/auth"
import { getMyTasks } from "@/actions/tasks"
import { MyTasksView } from "@/components/my-tasks/my-tasks-view"
import { MyTasksProvider } from "@/components/my-tasks/my-tasks-provider"
import { unwrapResponse } from "@/lib/util/unwrap"

interface MyTasksPageProps {
  searchParams: Promise<{ view?: string }>
}

export default async function MyTasksPage({
  searchParams,
}: MyTasksPageProps) {
  const session = await auth()

  const userId = session!.user.id

  const { view } = await searchParams
  const tab = view === "past" ? ("past" as const) : ("active" as const)

  const assignments = unwrapResponse(await getMyTasks({ view: tab }))

  return (
    <Suspense
      fallback={
        <div className="flex flex-1 flex-col gap-6 p-6">
          <header className="flex flex-col gap-2">
            <div className="h-5 w-80 animate-pulse rounded bg-muted md:w-96" />
            <div className="h-8 w-32 animate-pulse rounded bg-muted md:h-9" />
          </header>
          <div className="h-64 animate-pulse rounded-xl bg-muted" />
        </div>
      }
    >
      <MyTasksProvider assignments={assignments}>
        <MyTasksView currentUserId={userId} tab={tab} />
      </MyTasksProvider>
    </Suspense>
  )
}
