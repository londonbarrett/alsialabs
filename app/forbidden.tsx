import { getTranslations } from "next-intl/server"

export default async function Forbidden() {
  const t = await getTranslations("forbidden")

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4">
      <h1 className="text-4xl font-bold">{t("title")}</h1>
      <p className="text-muted-foreground">{t("message")}</p>
    </div>
  )
}
