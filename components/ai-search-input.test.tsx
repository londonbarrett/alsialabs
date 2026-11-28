import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

const placeholder = vi.hoisted(() => ({ value: "" }))

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => placeholder.value || key,
}))

import { AiSearchInput } from "./ai-search-input"

describe("AiSearchInput", () => {
  it("renders the translated placeholder and an AI icon", () => {
    placeholder.value = "What can I help you today?"

    const markup = renderToStaticMarkup(<AiSearchInput />)

    expect(markup).toContain('placeholder="What can I help you today?"')
    expect(markup).toContain("lucide-sparkles")
    expect(markup).toContain("text-ring")
  })
})
