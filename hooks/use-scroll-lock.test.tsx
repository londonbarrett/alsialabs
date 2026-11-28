// @vitest-environment jsdom
import { render } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

import { useScrollLock } from "./use-scroll-lock"

function Probe({ active }: { active: boolean }) {
  useScrollLock(active)
  return null
}

describe("useScrollLock", () => {
  afterEach(() => {
    const root = document.documentElement
    root.style.overflow = ""
    root.style.scrollbarWidth = ""
    root.style.paddingRight = ""
    root.classList.remove("scroll-lock")
  })

  it("hides the document scrollbar while active and restores it after", () => {
    const root = document.documentElement
    const { rerender } = render(<Probe active />)

    expect(root.style.overflow).toBe("hidden")
    expect(root.classList.contains("scroll-lock")).toBe(true)

    rerender(<Probe active={false} />)

    expect(root.style.overflow).toBe("")
    expect(root.classList.contains("scroll-lock")).toBe(false)
  })
})
