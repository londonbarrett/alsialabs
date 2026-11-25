import type { Locator, Page } from "@playwright/test"
import { test, expect } from "./fixtures"

const PROJECT_ID = "10000000-0000-4000-8000-000000000001"
const PROJECT_URL = `/app/proyectos/${PROJECT_ID}`
const TASK_NAME = "E2E plan the launch"

// A dedicated Bogotá project seeded in lib/drizzle/seed-e2e.ts. Its deadline is
// a fixed instant — 2026-12-25T02:00Z, i.e. 21:00 on 24 Dec in Bogotá — so the
// same stored instant can be checked under two different project zones.
const ZONED_PROJECT_ID = "10000000-0000-4000-8000-000000000007"
const ZONED_PROJECT_URL = `/app/proyectos/${ZONED_PROJECT_ID}`
const ZONED_TASK_NAME = "E2E zoned deadline"

/** The due cell shows the project's wall clock without naming its zone. */
async function assertZonedDueDate(
  row: Locator,
  day: string,
  time: string
): Promise<void> {
  const dueCell = row.locator("td").nth(4)
  await expect(dueCell).toContainText(day)
  await expect(dueCell).toContainText(time)
  await expect(dueCell).not.toContainText("Zona horaria:")
}

/** Labels the details-page edit dialog uses in each locale the specs drive. */
const ZONE_DIALOG_LABELS = {
  en: { edit: "Edit", save: "Save Changes", zone: "Time zone" },
  es: { edit: "Editar", save: "Guardar cambios", zone: "Zona horaria" },
} as const

type ZoneLocale = keyof typeof ZONE_DIALOG_LABELS

/** Changes only the project's zone through the details-page edit dialog. */
async function setProjectZone(
  page: Page,
  zone: string,
  locale: ZoneLocale = "en"
): Promise<void> {
  const labels = ZONE_DIALOG_LABELS[locale]
  await page.goto(`${ZONED_PROJECT_URL}/detalles`)
  await page.getByRole("button", { name: labels.edit, exact: true }).click()
  const dialog = page.getByRole("dialog")
  await dialog.locator("#timeZone").click()
  await page.getByRole("option", { name: zone, exact: true }).click()
  await dialog.getByRole("button", { name: labels.save }).click()
  await expect(dialog).toBeHidden()
  // Verify persisted state rather than a transient toast: a failed/zero-change
  // update would leave the old zone on the details page.
  await page.reload()
  await expect(
    page
      .getByText(labels.zone, { exact: true })
      .locator("..")
      .locator("p")
      .last()
  ).toHaveText(zone)
}

// Both tests edit the same fixture project's zone; serial order keeps the
// browser-timezone test's UTC edit from racing this spec's Bogotá setup.
test.describe.serial("project time zone", () => {
  // The browser is deliberately far from both Bogotá and UTC: the deadline
  // cell must follow the project's zone, never the browser's or the host's.
  test.use({ timezoneId: "Asia/Tokyo" })

  test("a deadline relabels when the project zone changes without moving the instant", async ({
    page,
    context,
    signInAs,
  }) => {
    test.setTimeout(120_000)
    await context.addCookies([
      { name: "NEXT_LOCALE", value: "en", domain: "localhost", path: "/" },
    ])
    await signInAs("user1")

    // Start from a known zone even when Playwright retries a partially run
    // attempt: the seed is recreated only once per `pnpm test:e2e` invocation.
    await setProjectZone(page, "America/Bogota")
    await page.goto(ZONED_PROJECT_URL)

    const row = page.getByRole("row", { name: new RegExp(ZONED_TASK_NAME) })
    await expect(row).toBeVisible()
    // 2026-12-25T02:00Z is 21:00 on 24 Dec in Bogotá but 11:00 on 25 Dec in
    // the browser's Asia/Tokyo zone. The displayed wall clock proves which
    // zone won; the row itself carries no zone label.
    await expect(row).toContainText("Dec 24")
    await expect(row).toContainText("9:00 PM")
    await expect(row).not.toContainText("America/Bogota")

    // A zone edit is metadata only: it must NOT rewrite the stored instant,
    // only relabel it. The same instant in UTC is 02:00 on 25 Dec — asserting
    // that exact shift rules out a wall-clock-preserving rewrite.
    await setProjectZone(page, "UTC")
    await page.goto(ZONED_PROJECT_URL)
    await expect(row).toContainText("Dec 25")
    await expect(row).toContainText("2:00 AM")
    await expect(row).not.toContainText("America/Bogota")
  })

  test("a task created with a wall clock renders in the project zone, not the browser's", async ({
    page,
    signInAs,
  }) => {
    test.setTimeout(120_000)
    await signInAs("user1")
    // The previous test leaves the fixture in UTC; start from a known zone.
    // Spanish labels: the details dialog still shows the project zone.
    await setProjectZone(page, "America/Bogota", "es")
    await page.goto(ZONED_PROJECT_URL)

    const taskName = `E2E zoned new task ${Date.now()}`
    await page.getByRole("button", { name: "Agregar Tarea" }).click()
    const dialog = page.getByRole("dialog", { name: "Agregar Tarea" })
    await expect(dialog).toBeVisible()
    await dialog.getByLabel("Nombre de la tarea").fill(taskName)
    await dialog.getByRole("button", { name: "Continuar" }).click()

    // Enter a wall clock, never an ISO instant: 24 Dec 20:00–21:00 in Bogotá
    // is 25 Dec 01:00–02:00 UTC and 25 Dec 10:00–11:00 in the browser's Tokyo.
    await dialog.getByRole("switch", { name: "Todo el día" }).click()
    await dialog.getByLabel("Fecha de vencimiento").fill("2026-12-24")
    await dialog.getByLabel("Hora de inicio").fill("20:00")
    await dialog.getByLabel("Hora de fin").fill("21:00")
    await dialog.getByRole("button", { name: "Crear Tarea" }).click()
    await expect(dialog).toBeHidden()
    await expect(page.getByText("Tarea creada").first()).toBeVisible()

    const row = page.getByRole("row", { name: new RegExp(taskName) })
    await expect(row).toBeVisible()
    // 21:00 on 24 Dec in Bogotá, not 11:00 on 25 Dec in Tokyo. The row shows
    // the project-zone wall clock but no zone label.
    await assertZonedDueDate(row, "24 dic", "21:00")

    await page.reload()
    const reloadedRow = page.getByRole("row", { name: new RegExp(taskName) })
    await expect(reloadedRow).toBeVisible()
    await assertZonedDueDate(reloadedRow, "24 dic", "21:00")
  })
})

test("a collaborator's assignment moves from active to past, read-only", async ({
  page,
  signInAs,
}) => {
  await signInAs("user2")
  await page.goto("/app/mis-tareas")

  const row = page.getByRole("row", { name: new RegExp(TASK_NAME) })
  await expect(row).toBeVisible()

  // Collaborators may pick from their three open statuses only.
  await row.getByRole("combobox").click()
  await expect(page.getByRole("option", { name: "En progreso" })).toBeVisible()
  await expect(page.getByRole("option", { name: "Completado" })).toHaveCount(0)
  await page.getByRole("option", { name: "En progreso" }).click()
  await expect(row.getByRole("combobox")).toContainText("En progreso")

  // The owner expands the assignee details — the collapsed row only
  // shows avatars and counts — and completes the assignment from the
  // per-person sub-row, which shows the name with the email underneath.
  await signInAs("admin")
  await page.goto(PROJECT_URL)
  const ownerRow = page.getByRole("row", { name: new RegExp(TASK_NAME) })
  await ownerRow
    .getByRole("button", { name: "Detalles de asignados" })
    .click()
  const assigneeRow = page.getByRole("row", {
    name: /E2E Collaborator/,
  })
  await expect(assigneeRow.getByText("E2E Collaborator")).toBeVisible()
  await expect(assigneeRow.getByText("user2@test.local")).toBeVisible()
  await assigneeRow.getByRole("combobox").click()
  await page.getByRole("option", { name: "Completado" }).click()
  // Optimistic UI flips immediately; the toast waits for the server commit.
  await expect(page.getByText("Estado actualizado")).toBeVisible()

  // Back under the collaborator: gone from Active, in Past and read-only.
  await signInAs("user2")
  await page.goto("/app/mis-tareas")
  await expect(
    page.getByRole("row", { name: new RegExp(TASK_NAME) })
  ).toHaveCount(0)

  await page.getByRole("tab", { name: "Pasadas" }).click()
  await page.waitForURL("**view=past")
  const pastRow = page.getByRole("row", { name: new RegExp(TASK_NAME) })
  await expect(pastRow).toBeVisible()
  await expect(pastRow.getByText("Completado")).toBeVisible()
  await expect(pastRow.getByRole("button")).toHaveCount(0)
})
