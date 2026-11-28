import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { Logo } from "./alsia-logo"

describe("Logo", () => {
  it("renders the Agralia logo from the public folder", () => {
    const markup = renderToStaticMarkup(<Logo className="w-40" />)

    expect(markup).toContain("agralia-logo.svg")
    expect(markup).toContain('alt="Agralia"')
  })
})
