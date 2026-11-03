import { it, expect } from "vitest"
import { getSidebarMenu } from "./sidebar-menu"

const ALL_PERMS = [
  "users:manage",
  "permissions:manage",
  "categories:view",
]
const findBackups = (role: string | null) =>
  getSidebarMenu(role, ALL_PERMS)
    .flatMap((s) => s.items)
    .find((i) => i.url === "/app/backups")

it("shows the backups item only for the super role", () => {
  expect(findBackups("super")).toBeDefined()
  expect(findBackups("admin")).toBeUndefined()
  expect(findBackups("retailer")).toBeUndefined()
  expect(findBackups("user")).toBeUndefined()
  expect(findBackups(null)).toBeUndefined()
})
it("leaves the other admin items permission-driven", () => {
  const urls = getSidebarMenu("admin", ["users:manage"])
    .flatMap((s) => s.items)
    .map((i) => i.url)
  expect(urls).toContain("/app/usuarios")
  expect(urls).not.toContain("/app/backups")
})
