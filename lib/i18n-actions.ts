import { cookies } from "next/headers"
import { getTranslations } from "next-intl/server"

export async function getActionT(namespace: string) {
  const store = await cookies()
  const locale = store.get("NEXT_LOCALE")?.value || "es"
  return getTranslations({ locale, namespace })
}
