import { RoutinesProvider } from "@/components/projects/routines/routines-provider"
import { RoutinesView } from "@/components/projects/routines/routines-view"
import { getProjectRoutines } from "@/actions/routines"

interface Props {
  params: Promise<{ id: string }>
}

export default async function RoutinesPage({ params }: Props) {
  const { id } = await params
  const routines = await getProjectRoutines(id)

  return (
    <RoutinesProvider routines={routines}>
      <RoutinesView />
    </RoutinesProvider>
  )
}
