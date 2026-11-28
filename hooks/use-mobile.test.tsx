import { renderToStaticMarkup } from "react-dom/server"
import { afterEach, describe, expect, it, vi } from "vitest"

import { useIsMobile } from "./use-mobile"

function Probe() {
  return <span>{useIsMobile() ? "mobile" : "desktop"}</span>
}

describe("useIsMobile", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("uses the server snapshot on first render even on a narrow viewport", () => {
    vi.stubGlobal("window", {
      innerWidth: 390,
      matchMedia: () => ({
        matches: true,
        addEventListener: () => {},
        removeEventListener: () => {},
      }),
    })

    // Static render has no effects, so it represents the first render that
    // must match the server HTML during hydration.
    expect(renderToStaticMarkup(<Probe />)).toContain("desktop")
  })
})
