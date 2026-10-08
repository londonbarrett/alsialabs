import { RoutinesProvider } from "@/components/projects/routines/routines-provider"
import { RoutinesView } from "@/components/projects/routines/routines-view"
import { getProjectRoutines } from "@/actions/routines"
import { unwrapResponse } from "@/lib/util/unwrap"

interface Props {
  params: Promise<{ id: string }>
}

export default async function RoutinesPage({ params }: Props) {
  const { id } = await params
  const routines = unwrapResponse(await getProjectRoutines({ projectId: id }))

  return (
    <RoutinesProvider routines={routines}>
      <RoutinesView />
    </RoutinesProvider>
  )
}
