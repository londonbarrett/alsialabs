import type { Locator, Page } from "@playwright/test"
import { test, expect } from "./fixtures"

const PROJECT_ID = "10000000-0000-4000-8000-000000000001"
const PROJECT_URL = `/app/proyectos/${PROJECT_ID}`
const GASTOS_URL = `${PROJECT_URL}/gastos`

function toDateInput(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

function daysFromNow(days: number): Date {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000)
}

function uniqueName(prefix: string): string {
  return `${prefix} ${Date.now()}`
}

/**
 * Creates a one-off task with a single assignee (user1) through the wizard.
 * A missing `cost` leaves the base-cost field empty, the zero-cost case. The
 * caller must already be on the project's tasks tab; this reloads it so the
 * optimistic temp id is swapped for the server one.
 */
async function createOneOffTask(
  page: Page,
  name: string,
  cost?: string
): Promise<void> {
  await page.getByRole("button", { name: "Agregar Tarea" }).click()
  const dialog = page.getByRole("dialog", { name: "Agregar Tarea" })
  if (cost !== undefined) {
    await dialog.getByLabel("Costo base por asignación").fill(cost)
  }
  await dialog.getByLabel("Nombre de la tarea").fill(name)
  await dialog.getByRole("button", { name: "Agregar asignado" }).click()
  await page
    .getByRole("menuitemcheckbox", { name: /user1@test\.local/ })
    .click()
  await dialog.getByRole("button", { name: "Continuar" }).click()
  await dialog.getByLabel("Fecha de vencimiento").fill(toDateInput(new Date()))
  await dialog.getByRole("button", { name: "Crear Tarea" }).click()
  await expect(dialog).toBeHidden()
  await expect(page.getByText("Tarea creada")).toBeVisible({
    timeout: 20_000,
  })
  await page.reload()
}

/** Creates a daily repeating task with an active schedule and one assignee. */
async function createRepeatingTask(page: Page, name: string): Promise<void> {
  await page.getByRole("button", { name: "Agregar Tarea" }).click()
  const dialog = page.getByRole("dialog", { name: "Agregar Tarea" })
  await dialog.getByLabel("Nombre de la tarea").fill(name)
  await dialog.getByRole("button", { name: "Agregar asignado" }).click()
  await page
    .getByRole("menuitemcheckbox", { name: /user1@test\.local/ })
    .click()
  await dialog.getByRole("button", { name: "Continuar" }).click()
  await dialog.getByRole("switch", { name: "Repetir esta tarea" }).click()
  await dialog.getByRole("switch", { name: "Todo el día" }).click()
  await dialog.getByLabel("Fecha de inicio").fill(toDateInput(new Date()))
  await dialog
    .getByLabel("Fecha de vencimiento")
    .fill(toDateInput(daysFromNow(30)))
  await dialog.getByLabel("Realizar a las").fill("09:00")
  await dialog.getByLabel("Hora de fin").fill("17:00")
  await dialog.getByLabel("Frecuencia").click()
  await page.getByRole("option", { name: "Diaria" }).click()
  await dialog.getByRole("button", { name: "Crear Tarea" }).click()
  await expect(dialog).toBeHidden()
  await expect(page.getByText("Tarea creada")).toBeVisible({
    timeout: 20_000,
  })
  await page.reload()
}

/** Closes the single open occurrence, spawning the next one. */
async function closeOpenOccurrence(page: Page, row: Locator): Promise<void> {
  const open = row.locator("xpath=following-sibling::tr[1]")
  await open.evaluate((el) => el.scrollIntoView({ block: "center" }))
  await open.getByRole("combobox").click()
  await page.getByRole("option", { name: "Completado" }).click()
  await expect(page.getByText("Estado actualizado")).toBeVisible({
    timeout: 20_000,
  })
}

/** Assignee sub-rows of an expanded repeating task (flat sibling <tr>s). */
function repeatingPersonRows(row: Locator): Locator {
  return row
    .locator("xpath=following-sibling::tr")
    .filter({ hasText: "user1@test.local" })
}

/** The one open occurrence: the only person row with a status combobox. */
function openOccurrence(page: Page, person: Locator): Locator {
  return person.filter({ has: page.getByRole("combobox") })
}

test("task rows in expenses are read-only and count only closed assignments", async ({
  page,
  signInAs,
}) => {
  // Create + close + recost + two navigations + reload; the shared dev server
  // compiles routes on demand.
  test.setTimeout(120_000)
  const taskName = uniqueName("E2E expense task")

  await signInAs("user1")
  await page.goto(PROJECT_URL)
  await createOneOffTask(page, taskName, "100")

  // Close the single assignment on the tasks tab so its cost counts.
  const taskRow = page.getByRole("row", { name: new RegExp(taskName) })
  await expect(taskRow).toBeVisible()
  await taskRow.getByRole("button", { name: "Detalles de asignados" }).click()
  await closeOpenOccurrence(page, taskRow)

  await page.goto(GASTOS_URL)

  // The task row is present, read-only, and reports the closed-only total.
  const expenseRow = page.getByRole("row", { name: new RegExp(taskName) })
  await expect(expenseRow).toBeVisible()
  await expect(expenseRow.getByRole("cell").nth(2)).toHaveText("$100")
  // No ActionMenu: the only button is the assignments toggle.
  await expect(
    expenseRow.getByRole("button", { name: "Detalles de asignados" })
  ).toBeVisible()
  await expect(expenseRow.getByRole("button")).toHaveCount(1)

  // Expanding shows one closed assignment: a Costo textbox and a status badge,
  // but no status combobox and no task actions.
  await expenseRow
    .getByRole("button", { name: "Detalles de asignados" })
    .click()
  const closedRow = expenseRow.locator("xpath=following-sibling::tr[1]")
  const costInput = closedRow.getByRole("textbox", { name: "Costo" })
  await expect(costInput).toBeVisible()
  await expect(closedRow).toContainText("Completado")
  await expect(closedRow.getByRole("combobox")).toHaveCount(0)
  await expect(
    closedRow.getByRole("button", { name: "Reabrir" })
  ).toHaveCount(0)

  // Recosting the closed assignment moves the row amount and the footer total.
  await costInput.fill("150")
  await expect(costInput).toHaveValue("$150")
  await closedRow.getByRole("button", { name: "Guardar" }).click()
  await expect(expenseRow.getByRole("cell").nth(2)).toHaveText("$150", {
    timeout: 20_000,
  })
  // The footer sums every row (expenses, paid invoices, and task closed
  // totals). Other specs share this project, so assert the invariant at one
  // snapshot: our $150 task is in the row sum and the footer equals that sum.
  const amountTexts = await page
    .getByRole("row")
    .filter({ has: page.getByRole("cell") })
    .locator("xpath=./td[3]")
    .allTextContents()
  const rowSum = amountTexts
    .filter((text) => text.includes("$"))
    .reduce(
      (sum, text) => sum + (Number(text.replace(/[$,]/g, "")) || 0),
      0
    )
  expect(rowSum).toBeGreaterThanOrEqual(150)
  const footerText = (await page.getByText(/^Total:/).textContent()) ?? ""
  const footerValue = Number(
    (footerText.match(/\$([\d,.]+)/)?.[1] ?? "0").replace(/,/g, "")
  )
  expect(footerValue).toBe(rowSum)

  // The combined save settles with the assignment-details toast.
  await expect(page.getByText("Comentario actualizado")).toBeVisible({
    timeout: 20_000,
  })
  await page.reload()
  const reloadedRow = page.getByRole("row", { name: new RegExp(taskName) })
  await expect(reloadedRow).toBeVisible()
  await expect(reloadedRow.getByRole("cell").nth(2)).toHaveText("$150")
})

test("zero-cost tasks still appear in expenses", async ({
  page,
  signInAs,
}) => {
  test.setTimeout(120_000)
  const taskName = uniqueName("E2E expense zero")

  await signInAs("user1")
  await page.goto(PROJECT_URL)
  await createOneOffTask(page, taskName)

  // Close the zero-cost assignment so the task has a closed row to report.
  const taskRow = page.getByRole("row", { name: new RegExp(taskName) })
  await taskRow.getByRole("button", { name: "Detalles de asignados" }).click()
  await closeOpenOccurrence(page, taskRow)

  await page.goto(GASTOS_URL)
  const expenseRow = page.getByRole("row", { name: new RegExp(taskName) })
  await expect(expenseRow).toBeVisible()
  await expect(expenseRow.getByRole("cell").nth(2)).toHaveText("$0")
})

test("tasks without closed assignments are not shown in expenses", async ({
  page,
  signInAs,
}) => {
  test.setTimeout(120_000)
  const taskName = uniqueName("E2E expense open only")

  await signInAs("user1")
  await page.goto(PROJECT_URL)
  await createOneOffTask(page, taskName)

  await page.goto(GASTOS_URL)
  await expect(
    page.getByRole("row", { name: new RegExp(taskName) })
  ).toHaveCount(0)
})

test("a repeating task's closed history is paginated in expenses", async ({
  page,
  signInAs,
}) => {
  // 11 closes (each a status write + successor spawn), two paginated
  // fetches, and a recost: the shared dev server compiles routes on
  // demand, so give the whole flow room under full-suite load.
  test.setTimeout(180_000)
  const taskName = uniqueName("E2E expense repeat")

  await signInAs("user1")
  await page.goto(PROJECT_URL)
  await createRepeatingTask(page, taskName)

  const taskRow = page.getByRole("row", { name: new RegExp(taskName) })
  await expect(taskRow).toBeVisible()
  // Caret, title and recurring badge share one line; the badge is fixed-size.
  await expect(taskRow.getByLabel("Recurrente")).toBeVisible()
  const badgeBox = await taskRow.getByLabel("Recurrente").boundingBox()
  const caretBox = await taskRow
    .getByRole("button", { name: "Detalles de asignados" })
    .boundingBox()
  const titleBox = await taskRow
    .getByText(taskName, { exact: true })
    .boundingBox()
  const centers = [badgeBox, caretBox, titleBox].map(
    (box) => (box?.y ?? 0) + (box?.height ?? 0) / 2
  )
  expect(Math.max(...centers) - Math.min(...centers)).toBeLessThan(14)

  // Close 11 occurrences on the tasks tab. Every close spawns the next
  // day's successor and is absorbed into the still-mounted history panel,
  // so the person rows grow by exactly one each time. Pinning the count
  // (not just a toast) is what makes all 11 server closes certain — the
  // proven pagination fixture in task-filter.spec.ts closes 11 too.
  await taskRow.getByRole("button", { name: "Detalles de asignados" }).click()
  const person = repeatingPersonRows(taskRow)
  await expect(person).toHaveCount(1)
  const open = openOccurrence(page, person)
  for (let i = 0; i < 11; i++) {
    await open.evaluate((el) => el.scrollIntoView({ block: "center" }))
    await open.getByRole("combobox").click()
    await page.getByRole("option", { name: "Completado" }).click()
    await expect(person).toHaveCount(i + 2)
    await expect(open).toHaveCount(1)
  }
  // Task-level terminal total (a server-side count) confirms 11 closes.
  await expect(taskRow).toContainText("11 cerradas")

  await page.goto(GASTOS_URL)

  // Expanding shows only the latest closed assignment per assignee (at most
  // one row here) plus Load more; older rows arrive on demand.
  const expenseRow = page.getByRole("row", { name: new RegExp(taskName) })
  await expect(expenseRow).toBeVisible()
  await expect(
    expenseRow.getByRole("cell").nth(3).getByLabel("Recurrente")
  ).toBeVisible()
  const rowText = (await expenseRow.textContent()) ?? ""
  expect(rowText).toContain("cerradas")
  await expenseRow
    .getByRole("button", { name: "Detalles de asignados" })
    .click()
  const closedCostRows = expenseRow
    .locator("xpath=following-sibling::tr")
    .filter({ has: page.getByRole("textbox", { name: "Costo" }) })
  const loadMore = page.getByRole("button", { name: "Cargar más" })
  const amountCell = expenseRow.getByRole("cell").nth(2)
  await expect(amountCell).toHaveText("$0")
  expect(await closedCostRows.count()).toBeLessThanOrEqual(1)
  await expect(loadMore).toBeVisible()

  // Hold the fetch so the spinner inside Load more is observable.
  let delayFirstPost = true
  await page.route("**/gastos**", async (route) => {
    if (delayFirstPost && route.request().method() === "POST") {
      delayFirstPost = false
      await new Promise((resolve) => setTimeout(resolve, 1500))
    }
    await route.continue()
  })
  await loadMore.click()
  await expect(loadMore.getByRole("status")).toBeVisible({ timeout: 5_000 })
  await expect(page.getByText("Cargando...")).toHaveCount(0)
  await expect(closedCostRows).toHaveCount(11, { timeout: 20_000 })
  await expect(loadMore).toHaveCount(0)

  // The oldest row can only have come from a Cargar más fetch — the slim
  // store set is at most the newest-per-assignee row, never this one. It
  // must expose an editable Costo textbox, and recosting it must move the
  // server-authoritative task total by the delta: the recost action carries
  // previousCost explicitly, so a fetched, non-store-backed row still counts.
  const delta = 40
  const fetchedRow = closedCostRows.last()
  const fetchedCost = fetchedRow.getByRole("textbox", { name: "Costo" })
  const fetchedNote = fetchedRow.getByRole("textbox", {
    name: "Comentarios",
  })
  await expect(fetchedCost).toBeVisible()
  await fetchedCost.fill(String(delta))
  await fetchedNote.fill("Recost de historial")
  await expect(fetchedCost).toHaveValue(`$${delta}`)
  await fetchedRow.getByRole("button", { name: "Guardar" }).click()
  // This row lives in the panel's local `displayed` list, not the store, so
  // its props never advance to the saved values. Both drafts must survive the
  // save without a reload instead of snapping back to the old cost/note.
  await expect(fetchedCost).toHaveValue(`$${delta}`)
  await expect(fetchedNote).toHaveValue("Recost de historial")
  // Pinned at "$0" above, so the total must now read the +40 delta.
  await expect(amountCell).toHaveText(`$${delta}`, { timeout: 20_000 })
  await expect(page.getByText("Comentario actualizado")).toBeVisible({
    timeout: 20_000,
  })
})
