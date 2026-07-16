import { auth, getUserPermissions } from "@/lib/auth"
import { getContractors } from "@/lib/actions/contractors"
import { ContractorsView } from "@/components/contractors/contractors-view"

export default async function ContractorsPage() {
  const session = await auth()
  const permissions = session?.user?.id
    ? await getUserPermissions(session.user.id)
    : []

  let contractors: Awaited<ReturnType<typeof getContractors>> = []
  try {
    contractors = await getContractors()
  } catch {
    // User may not have permission - the component will handle empty state
  }

  return <ContractorsView contractors={contractors} permissions={permissions} />
}
