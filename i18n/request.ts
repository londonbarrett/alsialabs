import { cookies, headers } from "next/headers"
import { getRequestConfig } from "next-intl/server"

export default getRequestConfig(async () => {
  const store = await cookies()
  let locale = store.get("NEXT_LOCALE")?.value

  if (!locale) {
    const headersList = await headers()
    const acceptLanguage = headersList.get("accept-language")
    const preferred = acceptLanguage?.split(",")[0]?.split("-")[0]?.trim()
    if (preferred === "en") locale = "en"
    locale ??= "es"
  }

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  }
})
