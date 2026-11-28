import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

vi.mock("@/stores/project-context/use-project-context-state", () => ({
  useProjectContextState: () => ({
    projectId: "p1",
    project: { name: "Granadillas", status: "active", location: null },
  }),
}))

vi.mock("next-intl", () => ({
  useTranslations: () => {
    const labels: Record<string, string> = {
      "nav.proyectos": "My Projects",
      "common.tasks": "Tasks",
      "common.details": "Details",
      "common.people": "People",
      "common.expenses": "Expenses",
      "projects.status.active": "Active",
    }
    return (key: string) => labels[key] ?? key
  },
}))

vi.mock("next/navigation", () => ({
  usePathname: () => "/app/proyectos/p1/gastos",
  useRouter: () => ({ push: vi.fn() }),
}))

import { ProjectView } from "./project-view"

describe("ProjectView", () => {
  it("links the section eyebrow to My Projects with its icon", () => {
    const markup = renderToStaticMarkup(
      <ProjectView>
        <div>content</div>
      </ProjectView>
    )

    expect(markup).toContain('href="/app/proyectos"')
    expect(markup).toContain("My Projects")
    expect(markup).toContain("lucide-folder-kanban")
  })

  it("renders a section select showing the current section and its icon", () => {
    const markup = renderToStaticMarkup(
      <ProjectView>
        <div>content</div>
      </ProjectView>
    )

    expect(markup).toContain('data-slot="select-trigger"')
    expect(markup).toContain("Expenses")
    expect(markup).toContain("lucide-receipt")
  })

  it("shows the select on mobile and the tabs on desktop", () => {
    const markup = renderToStaticMarkup(
      <ProjectView>
        <div>content</div>
      </ProjectView>
    )

    expect(markup).toContain('class="md:hidden"')
    expect(markup).toContain('class="hidden md:block"')
  })

  it("does not show the project status badge", () => {
    const markup = renderToStaticMarkup(
      <ProjectView>
        <div>content</div>
      </ProjectView>
    )

    expect(markup).not.toContain('data-slot="badge"')
    expect(markup).not.toContain("Active")
  })

  it("has no back button", () => {
    const markup = renderToStaticMarkup(
      <ProjectView>
        <div>content</div>
      </ProjectView>
    )

    expect(markup).not.toContain("lucide-arrow-left")
  })
})
