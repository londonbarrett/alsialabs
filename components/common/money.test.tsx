import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { Money } from "./money"

describe("Money", () => {
  it("hides cents for whole USD amounts", () => {
    expect(renderToStaticMarkup(<Money value={150} />)).toBe("$150")
  })

  it("shows both cents when a USD fraction is present", () => {
    expect(renderToStaticMarkup(<Money value="150.5" />)).toBe("$150.50")
  })

  it("renders COP amounts with no fraction digits", () => {
    const markup = renderToStaticMarkup(
      <Money value={150} currency="COP" locale="es-CO" />
    )
    expect(markup).toContain("150")
    expect(markup).not.toMatch(/[.,]\d/)
  })

  it("renders a negative value with a minus sign instead of blank", () => {
    const markup = renderToStaticMarkup(<Money value={-5} />)
    expect(markup).toContain("-")
    expect(markup).toContain("5")
  })

  it("renders the fallback for null values", () => {
    expect(renderToStaticMarkup(<Money value={null} />)).toBe("—")
  })

  it("lets explicit fraction props take precedence", () => {
    expect(
      renderToStaticMarkup(<Money value={150} minimumFractionDigits={2} />)
    ).toBe("$150.00")
  })
})
