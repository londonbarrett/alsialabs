import { it, expect } from "vitest"
import { getSidebarMenu } from "./sidebar-menu"

const ALL_PERMS = [
  "users:manage",
  "permissions:manage",
  "categories:view",
  "projects:view",
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
it("omits my invoices from the navigation menu", () => {
  const urls = getSidebarMenu("super", ALL_PERMS)
    .flatMap((s) => s.items)
    .map((i) => i.url)
  expect(urls).not.toContain("/app/mis-facturas")
})
it("omits profile from the navigation menu", () => {
  const urls = getSidebarMenu("super", ALL_PERMS)
    .flatMap((s) => s.items)
    .map((i) => i.url)
  expect(urls).not.toContain("/app/perfil")
})
it("lists my projects before my tasks in the navigation menu", () => {
  const urls = getSidebarMenu("super", ALL_PERMS)
    .flatMap((s) => s.items)
    .map((i) => i.url)
  const projectsAt = urls.indexOf("/app/proyectos")
  const tasksAt = urls.indexOf("/app/mis-tareas")
  expect(projectsAt).toBeGreaterThanOrEqual(0)
  expect(tasksAt).toBeGreaterThanOrEqual(0)
  expect(projectsAt).toBeLessThan(tasksAt)
})
