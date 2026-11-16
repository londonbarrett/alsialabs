import type { Locator, Page } from "@playwright/test"
import { test, expect } from "./fixtures"

const PROJECT_ID = "10000000-0000-4000-8000-000000000001"
const PROJECT_URL = `/app/proyectos/${PROJECT_ID}`
const EMPTY_PROJECT_URL = `/app/proyectos/10000000-0000-4000-8000-000000000006`

// E2E Collaborator (user2): the one seeded member every scenario shares.
// Never user3 — multi-assignee.spec deletes that membership mid-run.
const ASSIGNEE_EMAIL = "user2@test.local"

function toDateInput(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

function daysFromNow(days: number): Date {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000)
}

async function openCreateDialog(page: Page): Promise<Locator> {
  await page.getByRole("button", { name: "Agregar Tarea" }).click()
  const dialog = page.getByRole("dialog", { name: "Agregar Tarea" })
  await expect(dialog).toBeVisible()
  return dialog
}

async function fillDetails(
  page: Page,
  dialog: Locator,
  name: string,
  assignee: boolean
): Promise<void> {
  await dialog.getByLabel("Nombre de la tarea").fill(name)
  if (assignee) {
    await dialog
      .getByRole("button", { name: "Agregar asignado" })
      .click()
    await page
      .getByRole("menuitemcheckbox", { name: /E2E Collaborator/ })
      .click()
  }
  await dialog.getByRole("button", { name: "Continuar" }).click()
}

async function createOneOffTask(
  page: Page,
  {
    name,
    assignee = false,
    day,
  }: { name: string; assignee?: boolean; day: Date }
): Promise<void> {
  const dialog = await openCreateDialog(page)
  await fillDetails(page, dialog, name, assignee)
  const date = toDateInput(day)
  await dialog.getByLabel("Fecha de inicio").fill(date)
  await dialog.getByLabel("Fecha de vencimiento").fill(date)
  await dialog.getByRole("button", { name: "Crear Tarea" }).click()
  await expect(dialog).toBeHidden()
  // The commit swaps the optimistic temp id for the real one; expanding
  // before it would key expansion on the temp row.
  await expect(page.getByText("Tarea creada").first()).toBeVisible()
}

async function createDailyRepeatingTask(
  page: Page,
  {
    name,
    assignee = false,
    startDate,
    endDate,
  }: { name: string; assignee?: boolean; startDate: Date; endDate: Date }
): Promise<void> {
  const dialog = await openCreateDialog(page)
  await fillDetails(page, dialog, name, assignee)
  await dialog.getByRole("switch").click()
  await expect(dialog.getByLabel("Realizar a las")).toBeVisible()
  await dialog.getByLabel("Fecha de inicio").fill(toDateInput(startDate))
  await dialog
    .getByLabel("Fecha de vencimiento")
    .fill(toDateInput(endDate))
  await dialog.getByLabel("Realizar a las").fill("09:00")
  await dialog.getByLabel("Frecuencia").click()
  await page.getByRole("option", { name: "Diaria" }).click()
  await expect(dialog.getByLabel("Frecuencia")).toContainText("Diaria")
  await dialog.getByRole("button", { name: "Crear Tarea" }).click()
  await expect(dialog).toBeHidden()
  await expect(page.getByText("Tarea creada").first()).toBeVisible()
}

async function openEdit(
  page: Page,
  row: Locator,
  taskName: string
): Promise<Locator> {
  await row
    .getByRole("button", { name: `Acciones para ${taskName}` })
    .click()
  await page.getByRole("menuitem", { name: `Editar ${taskName}` }).click()
  const dialog = page.getByRole("dialog", { name: "Editar Tarea" })
  await expect(dialog).toBeVisible()
  return dialog
}

async function saveEdit(page: Page, dialog: Locator): Promise<void> {
  await dialog.getByRole("button", { name: "Continuar" }).click()
  await dialog.getByRole("button", { name: "Guardar cambios" }).click()
  await expect(dialog).toBeHidden()
  await expect(page.getByText("Tarea actualizada").first()).toBeVisible()
}

async function removeAssigneeAsCancelled(
  page: Page,
  dialog: Locator
): Promise<void> {
  await dialog
    .getByRole("button", { name: "Eliminar E2E Collaborator" })
    .click()
  const confirm = page.getByRole("dialog", { name: "¿Quitar asignado?" })
  await expect(confirm).toBeVisible()
  await confirm.getByRole("button", { name: "Marcar como cancelado" }).click()
  await expect(confirm).toBeHidden()
  await expect(
    dialog.getByRole("button", { name: "Eliminar E2E Collaborator" })
  ).toHaveCount(0)
}

/** Expand unless a previous step already left the row expanded. */
async function expandAssignments(row: Locator): Promise<void> {
  const toggle = row.getByRole("button", { name: "Detalles de asignados" })
  if ((await toggle.getAttribute("aria-expanded")) !== "true") {
    await toggle.click()
  }
  await expect(toggle).toHaveAttribute("aria-expanded", "true")
}

/**
 * The assignee's sub-rows are sibling <tr>s right under the task's row (the
 * table renders them flat, see multi-assignee.spec); they carry the email,
 * which the collapsed task row never renders (avatars only).
 */
function personRows(row: Locator): Locator {
  return row
    .locator("xpath=following-sibling::tr")
    .filter({ hasText: ASSIGNEE_EMAIL })
}

test("finished filter shows a completed task read-only with a non-repeating reopen", async ({
  page,
  signInAs,
}) => {
  const taskName = `E2E filter reopen ${Date.now()}`
  await signInAs("user1")
  await page.goto(PROJECT_URL)

  await createOneOffTask(page, {
    name: taskName,
    assignee: true,
    day: new Date(),
  })
  const row = page.getByRole("row", { name: new RegExp(taskName) })
  await expect(row).toBeVisible()
  await expandAssignments(row)

  // Done: the task leaves the default Unfinished list.
  const person = personRows(row)
  await expect(person).toHaveCount(1)
  await person.getByRole("combobox").click()
  await page.getByRole("option", { name: "Completado" }).click()
  await expect(page.getByText("Estado actualizado").first()).toBeVisible()
  await expect(row).toHaveCount(0)

  const finished = page.getByRole("button", { name: "Finalizadas" })
  const unfinished = page.getByRole("button", { name: "Sin finalizar" })
  await expect(unfinished).toHaveAttribute("aria-pressed", "true")
  await finished.click()
  await expect(finished).toHaveAttribute("aria-pressed", "true")
  await expect(row).toBeVisible()

  // Read-only badges and a Reopen control — never a status select.
  await expandAssignments(row)
  await expect(person).toHaveCount(1)
  await expect(person).toContainText("Completado")
  await expect(person.getByRole("combobox")).toHaveCount(0)
  const reopen = person.getByRole("button", { name: "Reabrir" })
  await expect(reopen).toBeVisible()

  // Reopen pulls the task out of Finished; the filter never auto-flips.
  await reopen.click()
  await expect(page.getByText("Estado actualizado").first()).toBeVisible()
  await expect(row).toHaveCount(0)
  await expect(finished).toHaveAttribute("aria-pressed", "true")

  await unfinished.click()
  await expect(unfinished).toHaveAttribute("aria-pressed", "true")
  await expect(row).toBeVisible()
  await expandAssignments(row)
  await expect(person).toHaveCount(1)
  await expect(person.getByRole("combobox")).toHaveCount(1)
  await expect(reopen).toHaveCount(0)
})

test("a repeating task finished through the wizard shows badges without reopen", async ({
  page,
  signInAs,
}) => {
  const taskName = `E2E filter repeating ${Date.now()}`
  await signInAs("user1")
  await page.goto(PROJECT_URL)

  // A schedule that already ended: once its only assignment is cancelled the
  // task has zero open rows past its due date, which is Finished.
  await createDailyRepeatingTask(page, {
    name: taskName,
    assignee: true,
    startDate: daysFromNow(-5),
    endDate: daysFromNow(-3),
  })
  const row = page.getByRole("row", { name: new RegExp(taskName) })
  await expect(row).toBeVisible()
  await expect(row).toContainText("Recurrente")

  const dialog = await openEdit(page, row, taskName)
  await removeAssigneeAsCancelled(page, dialog)
  await saveEdit(page, dialog)

  await expect(row).toHaveCount(0)
  const finished = page.getByRole("button", { name: "Finalizadas" })
  await finished.click()
  await expect(finished).toHaveAttribute("aria-pressed", "true")
  await expect(row).toBeVisible()

  await expandAssignments(row)
  const person = personRows(row)
  await expect(person).toHaveCount(1)
  await expect(person).toContainText("Cancelado")
  await expect(person.getByRole("combobox")).toHaveCount(0)
  // Recurrence forbids reopen-by-flip: badges only.
  await expect(
    person.getByRole("button", { name: "Reabrir" })
  ).toHaveCount(0)

  // The wizard is still the way back: Edit stays in the action menu.
  await row
    .getByRole("button", { name: `Acciones para ${taskName}` })
    .click()
  await expect(
    page.getByRole("menuitem", { name: `Editar ${taskName}` })
  ).toBeVisible()
  await page.keyboard.press("Escape")
})

test("reassigning from the finished view keeps the finished filter pressed", async ({
  page,
  signInAs,
}) => {
  const taskName = `E2E filter autoflip ${Date.now()}`
  await signInAs("user1")
  await page.goto(PROJECT_URL)

  await createOneOffTask(page, {
    name: taskName,
    assignee: true,
    day: new Date(),
  })
  const row = page.getByRole("row", { name: new RegExp(taskName) })
  await expect(row).toBeVisible()

  await expandAssignments(row)
  await personRows(row).getByRole("combobox").click()
  await page.getByRole("option", { name: "Completado" }).click()
  await expect(page.getByText("Estado actualizado").first()).toBeVisible()
  await expect(row).toHaveCount(0)

  const finished = page.getByRole("button", { name: "Finalizadas" })
  const unfinished = page.getByRole("button", { name: "Sin finalizar" })
  await finished.click()
  await expect(finished).toHaveAttribute("aria-pressed", "true")
  await expect(row).toBeVisible()

  // Reassign through the wizard while Finished is active.
  const dialog = await openEdit(page, row, taskName)
  await dialog.getByRole("button", { name: "Agregar asignado" }).click()
  await page
    .getByRole("menuitemcheckbox", { name: /E2E Collaborator/ })
    .click()
  await saveEdit(page, dialog)

  // No auto-flip: still Finished, and the reworked task no longer belongs.
  await expect(finished).toHaveAttribute("aria-pressed", "true")
  await expect(row).toHaveCount(0)

  await unfinished.click()
  await expect(unfinished).toHaveAttribute("aria-pressed", "true")
  await expect(row).toBeVisible()
})

test("the both view queues unfinished work before finished, by due date", async ({
  page,
  signInAs,
}) => {
  const stamp = Date.now()
  const tomorrowName = `E2E filter tomorrow ${stamp}`
  const laterName = `E2E filter later ${stamp}`
  const doneName = `E2E filter done ${stamp}`

  await signInAs("user1")
  await page.goto(PROJECT_URL)

  await createOneOffTask(page, { name: tomorrowName, day: daysFromNow(1) })
  await createOneOffTask(page, { name: laterName, day: daysFromNow(3) })
  // Due yesterday with nobody open: already finished at creation.
  await createOneOffTask(page, { name: doneName, day: daysFromNow(-1) })

  const unfinished = page.getByRole("button", { name: "Sin finalizar" })
  const both = page.getByRole("button", { name: "Ambas" })
  const tomorrowRow = page.getByRole("row", {
    name: new RegExp(tomorrowName),
  })
  const laterRow = page.getByRole("row", { name: new RegExp(laterName) })
  const doneRow = page.getByRole("row", { name: new RegExp(doneName) })

  // Default queue: the two future tasks are there, the past one is not.
  await expect(unfinished).toHaveAttribute("aria-pressed", "true")
  await expect(tomorrowRow).toBeVisible()
  await expect(laterRow).toBeVisible()
  await expect(doneRow).toHaveCount(0)

  await both.click()
  await expect(both).toHaveAttribute("aria-pressed", "true")
  await expect(tomorrowRow).toBeVisible()
  await expect(laterRow).toBeVisible()
  await expect(doneRow).toBeVisible()

  // DOM order: unfinished first (sooner due date ahead of the later one),
  // finished last.
  const indexes = await page.getByRole("row").evaluateAll(
    (rows, names) =>
      names.map((name) =>
        rows.findIndex((row) => (row.textContent ?? "").includes(name))
      ),
    [tomorrowName, laterName, doneName]
  )
  expect(indexes[0]).toBeGreaterThan(-1)
  expect(indexes[1]).toBeGreaterThan(indexes[0])
  expect(indexes[2]).toBeGreaterThan(indexes[1])
})

test("closed assignment history pages ten rows at a time", async ({
  page,
  signInAs,
}) => {
  const taskName = `E2E filter paging ${Date.now()}`
  await signInAs("user1")
  await page.goto(PROJECT_URL)

  await createDailyRepeatingTask(page, {
    name: taskName,
    assignee: true,
    startDate: new Date(),
    endDate: daysFromNow(30),
  })
  const row = page.getByRole("row", { name: new RegExp(taskName) })
  await expect(row).toBeVisible()
  await expect(row).toContainText("Recurrente")
  await expandAssignments(row)

  const person = personRows(row)
  await expect(person).toHaveCount(1)
  const occurrence = person.locator("td").nth(1)

  // Pin the row at the top of the viewport: sonner stacks success toasts at
  // the bottom-right through this loop, and a row scrolled low would put its
  // status control — and the options portal — inside the toast zone, making
  // every click wait out a toast's lifetime.
  await person.evaluate((el) => el.scrollIntoView({ block: "start" }))

  // Close the open occurrence 11 times: every close spawns the next day's
  // successor, which is the row closed next. Waiting for the occurrence
  // window to advance pins the spawn commit — a toast alone could be stale.
  // The last window read is the row closed last: the newest history entry.
  let lastClosedWindow = ""
  for (let i = 0; i < 11; i++) {
    const before = await occurrence.textContent()
    if (!before) throw new Error("occurrence cell had no text")
    lastClosedWindow = before
    await person.getByRole("combobox").click()
    await page.getByRole("option", { name: "Completado" }).click()
    await expect(occurrence).not.toContainText(before)
    await expect(person).toHaveCount(1)
  }

  // Display rule: the default expanded view keeps only the open successor.
  // The 11 closed rows live behind the history switch, ten to a page.
  await expect(person.getByRole("combobox")).toHaveCount(1)
  const showClosed = page.getByRole("button", {
    name: "Mostrar asignaciones cerradas",
  })
  await expect(showClosed).toHaveAttribute("aria-pressed", "false")
  await showClosed.click()
  await expect(showClosed).toHaveAttribute("aria-pressed", "true")
  await expect(person).toHaveCount(10)
  await expect(person.getByRole("combobox")).toHaveCount(0)

  const loadMore = page.getByRole("button", { name: "Cargar más" })
  await expect(loadMore).toBeVisible()
  await loadMore.click()
  await expect(person).toHaveCount(11)
  await expect(loadMore).toHaveCount(0)
  await expect(showClosed).toHaveAttribute("aria-pressed", "true")

  // Newest first (createdAt DESC): the top row stays the occurrence closed
  // last, and the older page appended below it instead of above.
  await expect(person.first().locator("td").nth(1)).toHaveText(
    lastClosedWindow
  )
})

test("a removed assignee can be reassigned with the closed row in history", async ({
  page,
  signInAs,
}) => {
  const taskName = `E2E filter removed ${Date.now()}`
  await signInAs("user1")
  await page.goto(PROJECT_URL)

  await createOneOffTask(page, {
    name: taskName,
    assignee: true,
    day: new Date(),
  })
  const row = page.getByRole("row", { name: new RegExp(taskName) })
  await expect(row).toBeVisible()

  // Removal through the wizard closes the assignment with no spawn.
  const firstEdit = await openEdit(page, row, taskName)
  await removeAssigneeAsCancelled(page, firstEdit)
  await saveEdit(page, firstEdit)

  // Zero-open lingering task: unassigned summary, closed row with Reopen.
  await expect(row).toBeVisible()
  await expect(row).toContainText("Sin asignar")
  await expandAssignments(row)
  const person = personRows(row)
  await expect(person).toHaveCount(1)
  await expect(person).toContainText("Cancelado")
  await expect(person.getByRole("button", { name: "Reabrir" })).toBeVisible()
  await expect(person.getByRole("combobox")).toHaveCount(0)

  // Reassign the same member: their open row returns, the cancelled row
  // stays behind the history switch.
  const secondEdit = await openEdit(page, row, taskName)
  await secondEdit.getByRole("button", { name: "Agregar asignado" }).click()
  await page
    .getByRole("menuitemcheckbox", { name: /E2E Collaborator/ })
    .click()
  await saveEdit(page, secondEdit)

  await expandAssignments(row)
  await expect(row).toContainText("1 abierta")
  await expect(person).toHaveCount(1)
  await expect(person).toContainText("Por hacer")
  await expect(person.getByRole("combobox")).toHaveCount(1)

  const showClosed = page.getByRole("button", {
    name: "Mostrar asignaciones cerradas",
  })
  await showClosed.click()
  await expect(showClosed).toHaveAttribute("aria-pressed", "true")
  await expect(person).toHaveCount(1)
  await expect(person).toContainText("Cancelado")
  await expect(person.getByRole("combobox")).toHaveCount(0)

  await showClosed.click()
  await expect(showClosed).toHaveAttribute("aria-pressed", "false")
  await expect(person).toHaveCount(1)
  await expect(person).toContainText("Por hacer")
  await expect(person.getByRole("combobox")).toHaveCount(1)
})

test("the finished filter has its own empty message", async ({
  page,
  signInAs,
}) => {
  const taskName = `E2E filter empty ${Date.now()}`
  await signInAs("user1")
  // A fresh project no parallel spec writes to: the Roles project collects
  // finished work from the other specs during the same run.
  await page.goto(EMPTY_PROJECT_URL)

  // Give the unfinished side content, so the message below can only be the
  // finished filter's own empty state.
  await createOneOffTask(page, { name: taskName, day: new Date() })
  const row = page.getByRole("row", { name: new RegExp(taskName) })
  await expect(row).toBeVisible()
  await expect(page.getByText("No hay tareas aún")).toHaveCount(0)

  const finished = page.getByRole("button", { name: "Finalizadas" })
  await finished.click()
  await expect(finished).toHaveAttribute("aria-pressed", "true")
  await expect(
    page.getByText("Aún no hay tareas finalizadas")
  ).toBeVisible()
  await expect(row).toHaveCount(0)
})

test("a collaborator never sees a Reopen control", async ({
  page,
  signInAs,
}) => {
  await signInAs("user2")
  await page.goto(PROJECT_URL)

  // getProjectContext is owner/admin-only: the project route renders the
  // 403 page for a collaborator, so the Tasks card — and any Reopen
  // control on it — is unreachable without weakening the server guard.
  await expect(page.getByRole("heading", { name: "403" })).toBeVisible()
  await expect(
    page.getByText("No tienes acceso a esta página.")
  ).toBeVisible()
  await expect(page.getByRole("button", { name: "Reabrir" })).toHaveCount(
    0
  )
  await expect(
    page.getByRole("button", { name: "Agregar Tarea" })
  ).toHaveCount(0)
})
