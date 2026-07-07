import Link from "next/link"
import { getTranslations } from "next-intl/server"

export default async function Home() {
  const t = await getTranslations("landing")

  return (
    <div className="flex h-dvh items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-8 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">
          {t("title")}
        </h1>
        <p className="max-w-md text-muted-foreground">
          {t("subtitle")}
        </p>
        <Link
          href="/dashboard"
          className="inline-flex items-center justify-center rounded-md bg-foreground px-6 py-3 text-sm font-medium text-background transition-opacity hover:opacity-90"
        >
          {t("openDashboard")}
        </Link>
      </div>
    </div>
  )
}
