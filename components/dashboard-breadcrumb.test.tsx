import type { ReactNode } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

const route = vi.hoisted(() => ({ pathname: "/app/proyectos" }))

vi.mock("next/navigation", () => ({
  usePathname: () => route.pathname,
}))

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}))

vi.mock("next-intl", () => ({
  useTranslations: () => {
    const labels: Record<string, string> = {
      dashboard: "Dashboard",
      proyectos: "My Projects",
      gastos: "Expenses",
      perfil: "Profile",
    }
    const t = (key: string) => labels[key] ?? key
    t.has = (key: string) => key in labels
    return t
  },
}))

import { DashboardBreadcrumb } from "./dashboard-breadcrumb"

describe("DashboardBreadcrumb", () => {
  it("omits the app segment but keeps links under /app", () => {
    route.pathname = "/app/proyectos/123/gastos"

    const markup = renderToStaticMarkup(<DashboardBreadcrumb />)

    expect(markup).not.toContain("App")
    expect(markup).toContain("My Projects")
    expect(markup).toContain('href="/app/proyectos"')
    expect(markup).not.toContain('href="/app"')
  })

  it("renders only the page label on a direct child of /app", () => {
    route.pathname = "/app/perfil"

    const markup = renderToStaticMarkup(<DashboardBreadcrumb />)

    expect(markup).toContain("Profile")
    expect(markup).not.toContain("App")
  })
})
