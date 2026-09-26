import { RoutinesView } from "@/components/projects/routines/routines-view"
import { getProjectRoutines } from "@/lib/actions/routines"

interface Props {
  params: Promise<{ id: string }>
}

export default async function RoutinesPage({ params }: Props) {
  const { id } = await params
  const routines = await getProjectRoutines(id)

  return <RoutinesView initialRoutines={routines} />
}
