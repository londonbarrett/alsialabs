import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"

export default async function DashboardPage() {
  const session = await auth()

  if (session?.user?.role === "user") {
    redirect("/dashboard/profile")
  }

  redirect("/dashboard/reports")
}
