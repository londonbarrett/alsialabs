import { expect, it } from "vitest"
import { COST_DEBOUNCE_MS } from "./cost"

it("waits one second before saving an assignment cost", () => {
  expect(COST_DEBOUNCE_MS).toBe(1000)
})
