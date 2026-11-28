import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { PageHeader } from "./page-header"

describe("PageHeader", () => {
  it("renders the section eyebrow as a link above the title for subsections", () => {
    const markup = renderToStaticMarkup(
      <PageHeader
        title="Granadillas"
        section="My Projects"
        sectionHref="/app/proyectos"
      />
    )

    expect(markup).toContain('data-slot="page-header-section"')
    expect(markup).toContain('href="/app/proyectos"')
    expect(markup).toContain("My Projects")
    expect(markup.indexOf("My Projects")).toBeLessThan(
      markup.indexOf("Granadillas")
    )
  })

  it("omits the eyebrow for main sections", () => {
    const markup = renderToStaticMarkup(<PageHeader title="My Projects" />)

    expect(markup).not.toContain('data-slot="page-header-section"')
  })

  it("hides the subtitle on mobile", () => {
    const markup = renderToStaticMarkup(
      <PageHeader title="My Projects" subtitle="Track your work" />
    )

    expect(markup).toContain("hidden max-w-prose")
    expect(markup).toContain("md:block")
  })
})
