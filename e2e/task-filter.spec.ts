import type { Locator, Page, Request } from "@playwright/test"
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

const COLLABORATOR = /E2E Collaborator/
const OWNER = /user1@test\.local/

async function fillDetails(
  page: Page,
  dialog: Locator,
  name: string,
  assignees: RegExp[]
): Promise<void> {
  await dialog.getByLabel("Nombre de la tarea").fill(name)
  for (const assignee of assignees) {
    await dialog
      .getByRole("button", { name: "Agregar asignado" })
      .click()
    await page
      .getByRole("menuitemcheckbox", { name: assignee })
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
  await fillDetails(page, dialog, name, assignee ? [COLLABORATOR] : [])
  await dialog.getByLabel("Fecha de vencimiento").fill(toDateInput(day))
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
    assignees = assignee ? [COLLABORATOR] : [],
    startDate,
    endDate,
    startTime = "09:00",
    endTime = "17:00",
  }: {
    name: string
    assignee?: boolean
    assignees?: RegExp[]
    startDate: Date
    endDate: Date
    startTime?: string
    endTime?: string
  }
): Promise<void> {
  const dialog = await openCreateDialog(page)
  await fillDetails(page, dialog, name, assignees)
  await dialog
    .getByRole("switch", { name: "Repetir esta tarea" })
    .click()
  // All-day is the default and hides the occurrence time — switch it off.
  await dialog.getByRole("switch", { name: "Todo el día" }).click()
  await expect(dialog.getByLabel("Realizar a las")).toBeVisible()
  await dialog
    .getByLabel("Fecha de inicio")
    .fill(toDateInput(startDate))
  await dialog
    .getByLabel("Fecha de vencimiento")
    .fill(toDateInput(endDate))
  await dialog.getByLabel("Realizar a las").fill(startTime)
  await dialog.getByLabel("Hora de fin").fill(endTime)
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
  await page
    .getByRole("menuitem", { name: `Editar ${taskName}` })
    .click()
  const dialog = page.getByRole("dialog", { name: "Editar Tarea" })
  await expect(dialog).toBeVisible()
  return dialog
}

async function saveEdit(page: Page, dialog: Locator): Promise<void> {
  await dialog.getByRole("button", { name: "Continuar" }).click()
  await dialog.getByRole("button", { name: "Guardar cambios" }).click()
  await expect(dialog).toBeHidden()
  await expect(
    page.getByText("Tarea actualizada").first()
  ).toBeVisible()
}

async function removeAssigneeAsCancelled(
  page: Page,
  dialog: Locator
): Promise<void> {
  await dialog
    .getByRole("button", { name: "Eliminar E2E Collaborator" })
    .click()
  const confirm = page.getByRole("dialog", {
    name: "¿Quitar asignado?",
  })
  await expect(confirm).toBeVisible()
  await confirm
    .getByRole("button", { name: "Marcar como cancelado" })
    .click()
  await expect(confirm).toBeHidden()
  await expect(
    dialog.getByRole("button", { name: "Eliminar E2E Collaborator" })
  ).toHaveCount(0)
}

/** Expand unless a previous step already left the row expanded. */
async function expandAssignments(row: Locator): Promise<void> {
  const toggle = row.getByRole("button", {
    name: "Detalles de asignados",
  })
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
function personRows(row: Locator, email = ASSIGNEE_EMAIL): Locator {
  return row
    .locator("xpath=following-sibling::tr")
    .filter({ hasText: email })
}

/**
 * The occurrence cell renders the row's due date with time in the pinned
 * es-ES locale ("20 nov, 17:00"). Returns its day as a timestamp so a
 * region of cells can be checked newest-first. Year is inferred from the
 * current date so ordering stays correct across a December→January run.
 */
const ES_MONTHS = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sep",
  "oct",
  "nov",
  "dic",
]

function occurrenceStart(text: string): number {
  const match = text.match(/(\d{1,2})\s+([a-z]+)/i)
  if (!match) throw new Error(`unparseable occurrence cell: ${text}`)
  const day = Number(match[1])
  const month = ES_MONTHS.findIndex((name) =>
    (match![2] ?? "").toLowerCase().startsWith(name)
  )
  if (month < 0) throw new Error(`unparseable occurrence month: ${text}`)
  const now = new Date()
  let year = now.getFullYear()
  if (month > now.getMonth() + 6) year -= 1
  if (month < now.getMonth() - 6) year += 1
  return new Date(year, month, day).getTime()
}

/**
 * The history panel's fetches are the only POSTs on this page whose
 * arguments carry limit/offset — the key for intercepting or counting
 * them (the action id on the wire is an opaque hash, not the name).
 */
function isHistoryCall(request: Request): boolean {
  const body = request.postData() ?? ""
  return (
    request.method() === "POST" &&
    body.includes('"limit"') &&
    body.includes('"offset"')
  )
}

/**
 * Bring a row to the middle of the viewport before driving its status
 * select. `block: "start"` parks it under the sticky header, whose
 * overlay fails the hit-target check and makes Playwright re-scroll
 * the row into sonner's bottom-right toast corner — where the option
 * then can't be clicked. Center clears both hazards.
 */
async function pinRow(row: Locator): Promise<void> {
  await row.evaluate((el) => el.scrollIntoView({ block: "center" }))
}

const openFilter = (page: Page): Locator =>
  page.getByRole("button", { name: "Abiertas", exact: true })
const archivedFilter = (page: Page): Locator =>
  page.getByRole("button", { name: "Archivadas", exact: true })

async function openTaskMenu(
  page: Page,
  row: Locator,
  taskName: string
): Promise<void> {
  await row
    .getByRole("button", { name: `Acciones para ${taskName}` })
    .click()
}

async function archiveTask(
  page: Page,
  row: Locator,
  taskName: string,
  closeAs: "finalizada" | "cancelada"
): Promise<void> {
  await openTaskMenu(page, row, taskName)
  await page
    .getByRole("menuitem", { name: "Archivar", exact: true })
    .click()
  const dialog = page.getByRole("dialog", { name: "¿Archivar tarea?" })
  await expect(dialog).toBeVisible()
  await dialog
    .getByRole("button", { name: `Marcar como ${closeAs}` })
    .click()
  await expect(dialog).toBeHidden()
  await expect(page.getByText("Tarea archivada").first()).toBeVisible()
}

async function unarchiveTask(
  page: Page,
  row: Locator,
  taskName: string
): Promise<void> {
  await openTaskMenu(page, row, taskName)
  await page
    .getByRole("menuitem", { name: "Desarchivar", exact: true })
    .click()
  await expect(page.getByText("Tarea restaurada").first()).toBeVisible()
}

/** Step 2 of the edit wizard: move the due date, then save. */
async function changeDueDate(
  page: Page,
  dialog: Locator,
  day: Date
): Promise<void> {
  await dialog.getByRole("button", { name: "Continuar" }).click()
  await dialog.getByLabel("Fecha de vencimiento").fill(toDateInput(day))
  await dialog.getByRole("button", { name: "Guardar cambios" }).click()
  await expect(dialog).toBeHidden()
  await expect(
    page.getByText("Tarea actualizada").first()
  ).toBeVisible()
}

test("a completed one-off task stays under Open with a Reopen control", async ({
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
  await expect(openFilter(page)).toHaveAttribute("aria-pressed", "true")
  await expandAssignments(row)

  // Status no longer drives list membership: Done keeps the task in Open.
  const person = personRows(row)
  await expect(person).toHaveCount(1)
  await person.getByRole("combobox").click()
  await page.getByRole("option", { name: "Completado" }).click()
  await expect(
    page.getByText("Estado actualizado").first()
  ).toBeVisible()
  await expect(row).toBeVisible()
  await expect(row).toContainText("1 cerrada")
  await expect(openFilter(page)).toHaveAttribute("aria-pressed", "true")

  // Read-only badge and a Reopen control — never a status select.
  await expandAssignments(row)
  await expect(person).toHaveCount(1)
  await expect(person).toContainText("Completado")
  await expect(person.getByRole("combobox")).toHaveCount(0)
  const reopen = person.getByRole("button", { name: "Reabrir" })
  await expect(reopen).toBeVisible()

  await reopen.click()
  await expect(
    page.getByText("Estado actualizado").first()
  ).toBeVisible()
  await expect(row).toBeVisible()
  await expect(row).toContainText("1 abierta")
  await expandAssignments(row)
  await expect(person.getByRole("combobox")).toHaveCount(1)
  await expect(reopen).toHaveCount(0)

  // The task never moved: nothing is under Archived.
  await archivedFilter(page).click()
  await expect(archivedFilter(page)).toHaveAttribute(
    "aria-pressed",
    "true"
  )
  await expect(row).toHaveCount(0)
})

test("a repeating task emptied through the wizard stays under Open without reopen", async ({
  page,
  signInAs,
}) => {
  const taskName = `E2E filter repeating ${Date.now()}`
  await signInAs("user1")
  await page.goto(PROJECT_URL)

  // A schedule that already ended: once its only assignment is cancelled the
  // task has zero open rows past its due date — and still lives under Open.
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

  await expect(row).toBeVisible()
  await expect(openFilter(page)).toHaveAttribute("aria-pressed", "true")

  await expandAssignments(row)
  const person = personRows(row)
  // Zero-open: the initial block renders nothing and the history
  // panel owns the closed row (its storeTerminal zero-open scope) —
  // the selector is block-agnostic, so the row-count claims hold.
  await expect(person).toHaveCount(1)
  await expect(person).toContainText("Cancelado")
  await expect(person.getByRole("combobox")).toHaveCount(0)
  // Recurrence forbids reopen-by-flip: badges only.
  await expect(
    person.getByRole("button", { name: "Reabrir" })
  ).toHaveCount(0)

  // A zero-open repeating task gets Load More; its single closed row is
  // already on screen, so the click fetches nothing new (deduped
  // against the zero-open scope) and the button goes away without
  // duplicating the row.
  const loadMore = page.getByRole("button", { name: "Cargar más" })
  await expect(loadMore).toBeVisible()
  await loadMore.click()
  await expect(loadMore).toHaveCount(0)
  await expect(person).toHaveCount(1)

  // The wizard is still the way back: Edit stays in the action menu.
  await openTaskMenu(page, row, taskName)
  await expect(
    page.getByRole("menuitem", { name: `Editar ${taskName}` })
  ).toBeVisible()
  await page.keyboard.press("Escape")
})

test("archiving a repeating task spawns nothing, stays editable, and unarchiving reopens it", async ({
  page,
  signInAs,
}) => {
  const taskName = `E2E filter archive ${Date.now()}`
  await signInAs("user1")
  await page.goto(PROJECT_URL)

  // Occurrence at 23:58 today: archive preserves the dates and times, so the
  // unarchive check finds the in-range occurrence later the same day.
  const originalEndDate = daysFromNow(30)
  await createDailyRepeatingTask(page, {
    name: taskName,
    assignee: true,
    startDate: new Date(),
    endDate: originalEndDate,
    startTime: "23:58",
    endTime: "23:59",
  })
  const row = page.getByRole("row", { name: new RegExp(taskName) })
  await expect(row).toBeVisible()
  await expect(row).toContainText("1 abierta")

  // A comment written while the task is live must stay readable once it
  // is archived.
  const note = `E2E archived note ${Date.now()}`
  await row.getByRole("button", { name: /^\d+$/ }).click()
  const liveSheet = page.getByRole("dialog", { name: taskName })
  await liveSheet.getByPlaceholder("Agregar un comentario...").fill(note)
  await page.keyboard.press("Enter")
  await expect(liveSheet.getByText(note)).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(liveSheet).toBeHidden()

  await archiveTask(page, row, taskName, "finalizada")

  // The task leaves Open; the filter never auto-flips.
  await expect(row).toHaveCount(0)
  await expect(openFilter(page)).toHaveAttribute("aria-pressed", "true")

  await archivedFilter(page).click()
  await expect(archivedFilter(page)).toHaveAttribute(
    "aria-pressed",
    "true"
  )
  await expect(row).toBeVisible()

  // The assignee column is roster-driven: the collaborator's avatar shows
  // on the archived row, never the Unassigned label.
  await expect(row).not.toContainText("Sin asignar")
  await expect(
    row.locator('[data-slot="avatar-fallback"]')
  ).toHaveCount(1)
  await expect(row.getByText("E2", { exact: true })).toBeVisible()

  // Archive closed the open occurrence and spawned no successor.
  await expect(row).not.toContainText("abierta")
  await expect(row).toContainText("1 cerrada")
  await expandAssignments(row)
  const person = personRows(row)
  await expect(person).toHaveCount(1)
  await expect(person).toContainText("Completado")

  // The history rows are badge-only because repeat chains can't be
  // reopened — recurrence, not a freeze. The row itself is editable: the
  // priority select is live on the archived task; the due cell keeps the
  // task's original date and time, unchanged by archive.
  await expect(person.getByRole("combobox")).toHaveCount(0)
  await expect(
    person.getByRole("button", { name: "Reabrir" })
  ).toHaveCount(0)
  await expect(row.getByRole("combobox")).toHaveCount(1)
  const originalDueDay = new Intl.DateTimeFormat("es-ES", {
    month: "short",
    day: "numeric",
  }).format(originalEndDate)
  const dueCell = row.locator("td").nth(4)
  await expect(dueCell).toContainText(originalDueDay)
  await expect(dueCell).toContainText("23:59")

  // Comments stay fully writable on the archived task: the note is
  // readable, a new comment posts, and own comments keep edit/delete.
  await row.getByRole("button", { name: /^\d+$/ }).click()
  const archivedSheet = page.getByRole("dialog", { name: taskName })
  await expect(archivedSheet.getByText(note)).toBeVisible()
  const input = archivedSheet.getByPlaceholder("Agregar un comentario...")
  await expect(input).toBeVisible()
  await input.fill("E2E archived reply")
  await page.keyboard.press("Enter")
  await expect(
    archivedSheet.getByText("E2E archived reply")
  ).toBeVisible()
  await expect(archivedSheet.locator(".lucide-pencil")).toHaveCount(2)
  await expect(archivedSheet.locator(".lucide-trash-2")).toHaveCount(2)
  await page.keyboard.press("Escape")
  await expect(archivedSheet).toBeHidden()

  // Menu: Edit, Unarchive and Delete; Archive is gone (already archived).
  await openTaskMenu(page, row, taskName)
  await expect(
    page.getByRole("menuitem", { name: `Editar ${taskName}` })
  ).toBeVisible()
  await expect(
    page.getByRole("menuitem", { name: "Desarchivar", exact: true })
  ).toBeVisible()
  await expect(
    page.getByRole("menuitem", { name: `Eliminar ${taskName}` })
  ).toBeVisible()
  await expect(
    page.getByRole("menuitem", { name: "Archivar", exact: true })
  ).toHaveCount(0)
  await page.keyboard.press("Escape")

  // Unarchive: the row leaves Archived (no auto-flip) and, being
  // repeating with an in-range occurrence, reopens work immediately.
  await unarchiveTask(page, row, taskName)
  await expect(row).toHaveCount(0)
  await expect(archivedFilter(page)).toHaveAttribute(
    "aria-pressed",
    "true"
  )

  await openFilter(page).click()
  await expect(openFilter(page)).toHaveAttribute("aria-pressed", "true")
  await expect(row).toBeVisible()
  await expect(row).toContainText("1 abierta")
  await expandAssignments(row)
  await expect(person.getByRole("combobox")).toHaveCount(1)
})

test("archiving a task with no open assignments skips the disposition dialog", async ({
  page,
  signInAs,
}) => {
  const taskName = `E2E filter no-open archive ${Date.now()}`
  await signInAs("user1")
  await page.goto(PROJECT_URL)

  // The column header is plural: it lists the roster, not one assignee.
  await expect(
    page.getByRole("columnheader", { name: "Asignadas" })
  ).toBeVisible()

  // A task without an assignee has zero assignment rows, so there is no
  // open work for the disposition dialog to close.
  const dueDay = daysFromNow(2)
  await createOneOffTask(page, {
    name: taskName,
    assignee: false,
    day: dueDay,
  })
  const row = page.getByRole("row", { name: new RegExp(taskName) })
  await expect(row).toBeVisible()

  // An all-day task's due cell shows the date only — no assignment-row
  // date or time leaks into it.
  const dueCell = (await row.locator("td").nth(4).textContent()) ?? ""
  expect(dueCell).toContain(
    new Intl.DateTimeFormat("es-ES", {
      month: "short",
      day: "numeric",
    }).format(dueDay)
  )
  expect(dueCell).not.toContain(":")

  await openTaskMenu(page, row, taskName)
  await page.getByRole("menuitem", { name: "Archivar", exact: true }).click()

  // No dialog: the archive fires immediately and the row leaves Open.
  await expect(
    page.getByRole("dialog", { name: "¿Archivar tarea?" })
  ).toHaveCount(0)
  await expect(page.getByText("Tarea archivada").first()).toBeVisible()
  await expect(row).toHaveCount(0)

  await archivedFilter(page).click()
  await expect(row).toBeVisible()
})

test("a one-off task archived as cancelled returns to Open with its roster intact", async ({
  page,
  signInAs,
}) => {
  const taskName = `E2E filter roster ${Date.now()}`
  await signInAs("user1")
  await page.goto(PROJECT_URL)

  await createOneOffTask(page, {
    name: taskName,
    assignee: true,
    day: daysFromNow(2),
  })
  const row = page.getByRole("row", { name: new RegExp(taskName) })
  await expect(row).toBeVisible()

  await archiveTask(page, row, taskName, "cancelada")
  await expect(row).toHaveCount(0)

  await archivedFilter(page).click()
  await expect(row).toBeVisible()

  // The assignee column is roster-driven on an archived row too: the
  // collaborator's avatar shows, never the Unassigned label.
  await expect(row).not.toContainText("Sin asignar")
  await expect(
    row.locator('[data-slot="avatar-fallback"]')
  ).toHaveCount(1)
  await expect(row.getByText("E2", { exact: true })).toBeVisible()

  await expandAssignments(row)
  const person = personRows(row)
  await expect(person).toHaveCount(1)
  await expect(person).toContainText("Cancelado")

  // Frozen no more: the archived row reopens its closed occurrence and
  // the reopened row drives the status select. Re-closing as Cancelado
  // leaves the task exactly as it was — nothing spawns while archived.
  await pinRow(row)
  const reopen = person.getByRole("button", { name: "Reabrir" })
  await expect(reopen).toBeVisible()
  await reopen.click()
  await expect(
    page.getByText("Estado actualizado").first()
  ).toBeVisible()
  await expect(row).toContainText("1 abierta")
  await pinRow(person)
  await person.getByRole("combobox").click()
  await page.getByRole("option", { name: "Cancelado" }).click()
  await expect(row).toContainText("1 cerrada")
  await expect(row).not.toContainText("abierta")
  await expect(person).toHaveCount(1)
  await expect(person).toContainText("Cancelado")

  // Editing the archived task is allowed: the added assignee takes the
  // membership row but opens nothing, and the roster-driven column shows
  // both people.
  const edit = await openEdit(page, row, taskName)
  await edit.getByRole("button", { name: "Agregar asignado" }).click()
  await page
    .getByRole("menuitemcheckbox", { name: /user1@test\.local/ })
    .click()
  await expect(
    edit.getByRole("button", { name: "Eliminar user1@test.local" })
  ).toBeVisible()
  await saveEdit(page, edit)
  await expect(row).toContainText("1 cerrada")
  await expect(row).not.toContainText("abierta")
  // The added owner has no assignment row (archived tasks never open
  // one) yet the roster-driven column renders both people.
  await expect(
    row.locator('[data-slot="avatar-fallback"]')
  ).toHaveCount(2)
  await expect(row.getByText("E2", { exact: true })).toBeVisible()
  await expect(row).not.toContainText("Sin asignar")

  await unarchiveTask(page, row, taskName)
  await expect(row).toHaveCount(0)
  await openFilter(page).click()
  await expect(row).toBeVisible()

  // Non-repeating: unarchive spawns nothing — the task is zero-open with
  // its closed history and the Reopen control.
  await expect(row).toContainText("1 cerrada")
  await expect(row).not.toContainText("abierta")
  await expandAssignments(row)
  await expect(person).toHaveCount(1)
  await expect(person).toContainText("Cancelado")
  await expect(
    person.getByRole("button", { name: "Reabrir" })
  ).toBeVisible()

  // The form seeds from the roster, not from open rows: a zero-open task
  // still shows its assignee.
  const dialog = await openEdit(page, row, taskName)
  await expect(
    dialog.getByRole("button", { name: "Eliminar E2E Collaborator" })
  ).toBeVisible()
  await dialog.getByRole("button", { name: "Cancelar" }).click()
  await expect(dialog).toBeHidden()
})

test("date-edit spawn opens only for active assignees", async ({
  page,
  signInAs,
}) => {
  const taskName = `E2E filter dateedit ${Date.now()}`
  await signInAs("user1")
  await page.goto(PROJECT_URL)

  // One-day schedule in the past: closing an occurrence cannot spawn a
  // successor, so a single close leaves the task zero-open.
  await createDailyRepeatingTask(page, {
    name: taskName,
    assignees: [COLLABORATOR, OWNER],
    startDate: daysFromNow(-3),
    endDate: daysFromNow(-3),
  })
  const row = page.getByRole("row", { name: new RegExp(taskName) })
  await expect(row).toBeVisible()
  await expect(row).toContainText("2 abiertas")

  // Unassign the collaborator (membership gone), then close the owner's
  // occurrence: zero-open, one active assignee left.
  const dialog = await openEdit(page, row, taskName)
  await removeAssigneeAsCancelled(page, dialog)
  await saveEdit(page, dialog)
  await expect(row).toContainText("1 abierta")

  await expandAssignments(row)
  const ownerRow = personRows(row, "user1@test.local")
  await expect(ownerRow).toHaveCount(1)
  await ownerRow.getByRole("combobox").click()
  await page.getByRole("option", { name: "Completado" }).click()
  await expect(
    page.getByText("Estado actualizado").first()
  ).toBeVisible()
  await expect(row).not.toContainText("abierta")
  await expect(row).toContainText("2 cerradas")

  // Moving the due date out opens a fresh row for the owner only.
  const edit = await openEdit(page, row, taskName)
  await changeDueDate(page, edit, daysFromNow(10))
  await expect(row).toContainText("1 abierta")
  await expect(row).toContainText("2 cerradas")
  await expandAssignments(row)
  await expect(ownerRow.getByRole("combobox")).toHaveCount(1)
  await expect(
    personRows(row).getByRole("combobox")
  ).toHaveCount(0)
})

test("a removed project member never spawns on a later date change", async ({
  page,
  signInAs,
}) => {
  const taskName = `E2E filter removedmember ${Date.now()}`
  await signInAs("user1")
  // A project no parallel spec shares: user4 joins and leaves here only.
  await page.goto(`${EMPTY_PROJECT_URL}/personas`)
  await page.getByPlaceholder("Agregar colaborador...").fill("user4")
  await page.getByRole("option", { name: /user4@test\.local/ }).click()
  await page
    .getByRole("button", { name: "Invitar", disabled: false })
    .click()
  await expect(page.getByText("Colaborador agregado")).toBeVisible()

  await page.goto(EMPTY_PROJECT_URL)
  await createDailyRepeatingTask(page, {
    name: taskName,
    assignees: [/user4@test\.local/],
    startDate: daysFromNow(-3),
    endDate: daysFromNow(-3),
  })
  const row = page.getByRole("row", { name: new RegExp(taskName) })
  await expect(row).toBeVisible()
  await expect(row).toContainText("1 abierta")

  // Removing the person from the project cancels their open assignment
  // and drops their roster row.
  await page.goto(`${EMPTY_PROJECT_URL}/personas`)
  await page
    .getByRole("button", { name: "Eliminar a user4@test.local" })
    .click()
  const confirm = page.getByRole("dialog", { name: "¿Eliminar miembro?" })
  await expect(confirm).toBeVisible()
  await confirm.getByRole("button", { name: "Eliminar" }).click()
  await expect(page.getByText("Colaborador eliminado")).toBeVisible()

  await page.goto(EMPTY_PROJECT_URL)
  await expect(row).toBeVisible()
  await expect(row).toContainText("1 cerrada")
  await expect(row).not.toContainText("abierta")

  // The date change finds no active assignee: nothing spawns.
  const dialog = await openEdit(page, row, taskName)
  await changeDueDate(page, dialog, daysFromNow(10))
  await expect(row).toContainText("1 cerrada")
  await expect(row).not.toContainText("abierta")
})

test("adding an assignee to a repeating task with an in-range date opens their assignment", async ({
  page,
  signInAs,
}) => {
  const taskName = `E2E filter addassignee ${Date.now()}`
  await signInAs("user1")
  await page.goto(PROJECT_URL)

  await createDailyRepeatingTask(page, {
    name: taskName,
    startDate: new Date(),
    endDate: daysFromNow(30),
  })
  const row = page.getByRole("row", { name: new RegExp(taskName) })
  await expect(row).toBeVisible()
  await expect(row).toContainText("Sin asignar")

  const dialog = await openEdit(page, row, taskName)
  await dialog.getByRole("button", { name: "Agregar asignado" }).click()
  await page
    .getByRole("menuitemcheckbox", { name: COLLABORATOR })
    .click()
  await saveEdit(page, dialog)

  await expect(row).toContainText("1 abierta")
  await expandAssignments(row)
  const person = personRows(row)
  await expect(person).toHaveCount(1)
  await expect(person.getByRole("combobox")).toHaveCount(1)
})

test("the Open view orders by due date ascending regardless of status", async ({
  page,
  signInAs,
}) => {
  const stamp = Date.now()
  const tomorrowName = `E2E filter tomorrow ${stamp}`
  const laterName = `E2E filter later ${stamp}`
  const pastName = `E2E filter past ${stamp}`

  await signInAs("user1")
  await page.goto(PROJECT_URL)

  await createOneOffTask(page, {
    name: tomorrowName,
    day: daysFromNow(1),
  })
  await createOneOffTask(page, { name: laterName, day: daysFromNow(3) })
  // Due yesterday with nobody open: still a working task under Open.
  await createOneOffTask(page, { name: pastName, day: daysFromNow(-1) })

  await expect(openFilter(page)).toHaveAttribute("aria-pressed", "true")
  const tomorrowRow = page.getByRole("row", {
    name: new RegExp(tomorrowName),
  })
  const laterRow = page.getByRole("row", { name: new RegExp(laterName) })
  const pastRow = page.getByRole("row", { name: new RegExp(pastName) })
  await expect(tomorrowRow).toBeVisible()
  await expect(laterRow).toBeVisible()
  await expect(pastRow).toBeVisible()

  const indexes = await page
    .getByRole("row")
    .evaluateAll(
      (rows, names) =>
        names.map((name) =>
          rows.findIndex((row) =>
            (row.textContent ?? "").includes(name)
          )
        ),
      [pastName, tomorrowName, laterName]
    )
  expect(indexes[0]).toBeGreaterThan(-1)
  expect(indexes[1]).toBeGreaterThan(indexes[0])
  expect(indexes[2]).toBeGreaterThan(indexes[1])
})

/** The one open occurrence among a repeating task's person rows. */
function openOccurrenceRow(page: Page, person: Locator): Locator {
  return person.filter({ has: page.getByRole("combobox") })
}

/**
 * Close the open occurrence and wait for the spawn commit: the closed row
 * is absorbed into the (still mounted) history panel and the successor
 * takes its place, so the person rows grow by exactly one.
 */
async function closeOpenOccurrence(
  page: Page,
  person: Locator,
  rowsBefore: number
): Promise<void> {
  const open = openOccurrenceRow(page, person)
  await pinRow(open)
  await open.getByRole("combobox").click()
  await page.getByRole("option", { name: "Completado" }).click()
  await expect(person).toHaveCount(rowsBefore + 1)
  await expect(open).toHaveCount(1)
}

test("closed assignment history pages ten rows at a time", async ({
  page,
  signInAs,
}) => {
  test.setTimeout(90_000)
  const taskName = `E2E filter paging ${Date.now()}`
  await signInAs("user1")
  await page.goto(PROJECT_URL)

  const windowEnd = daysFromNow(30)
  await createDailyRepeatingTask(page, {
    name: taskName,
    assignee: true,
    startDate: new Date(),
    endDate: windowEnd,
  })
  const row = page.getByRole("row", { name: new RegExp(taskName) })
  await expect(row).toBeVisible()
  await expect(row).toContainText("Recurrente")
  await expandAssignments(row)

  const person = personRows(row)
  await expect(person).toHaveCount(1)
  const open = openOccurrenceRow(page, person)
  const occurrence = open.locator("td").nth(1)

  // Display split: the due cell reads the task's own due date (the
  // window end, 30 days out), not the lead occurrence's date, while an
  // assignment row shows its own occurrence due time and never a range.
  const dueCell = (await row.locator("td").nth(4).textContent()) ?? ""
  const windowDay = new Intl.DateTimeFormat("es-ES", {
    month: "short",
    day: "numeric",
  }).format(windowEnd)
  expect(dueCell).toContain(windowDay)
  const occurrenceCell = (await occurrence.textContent()) ?? ""
  expect(occurrenceCell).toContain(":")
  expect(occurrenceCell).not.toContain("–")

  // Close the open occurrence 11 times: every close spawns the next day's
  // successor, which is the row closed next. The last window read is the
  // row closed last: the newest history entry. The row stays mounted
  // under Open, so each closed row is absorbed as it happens.
  let lastClosedWindow = ""
  for (let i = 0; i < 11; i++) {
    const before = await occurrence.textContent()
    if (!before) throw new Error("occurrence cell had no text")
    lastClosedWindow = before
    await closeOpenOccurrence(page, person, i + 1)
  }

  // The status cell carries the task-level terminal total — all 11
  // closed rows (a server-side count, never a count of loaded rows) —
  // beside the single open successor.
  await expect(row).toContainText("1 abierta")
  await expect(row).toContainText("11 cerradas")

  // A fresh mount shows only the open successor: closed history loads
  // through Load More, ten at a time, appended below it.
  await page.reload()
  await expandAssignments(row)
  await expect(person).toHaveCount(1)
  await expect(person.getByRole("combobox")).toHaveCount(1)
  const loadMore = page.getByRole("button", { name: "Cargar más" })
  await expect(loadMore).toBeVisible()
  await loadMore.click()
  await expect(person).toHaveCount(11)
  await expect(person.getByRole("combobox")).toHaveCount(1)
  await loadMore.click()
  await expect(person).toHaveCount(12)
  await expect(loadMore).toHaveCount(0)

  // Newest first (createdAt DESC): the first appended row is the
  // occurrence closed last, with the older page below it instead of
  // above; the open successor still leads the block.
  await expect(person.nth(1).locator("td").nth(1)).toHaveText(
    lastClosedWindow
  )

  // Newest first across the whole merged closed region too: the panel
  // re-sorts everything it renders by startDate DESC (sortClosedRows),
  // so the two fetched pages' order can never leak into the display.
  // The spawn loop gives strictly ordered occurrence days.
  const closedDays: number[] = []
  const personCount = await person.count()
  for (let i = 1; i < personCount; i++) {
    const cell = await person.nth(i).locator("td").nth(1).textContent()
    closedDays.push(occurrenceStart(cell ?? ""))
  }
  expect(closedDays).toHaveLength(11)
  for (let i = 1; i < closedDays.length; i++) {
    expect(closedDays[i]).toBeLessThan(closedDays[i - 1])
  }
})

test("closing after an exhausted history re-arms Load More for the new row", async ({
  page,
  signInAs,
}) => {
  // The heaviest scenario in this file (11 closes + Load More clicks
  // + a reload): under full-suite load the dev server pushes it past the
  // 45s default before the decisive close runs.
  test.setTimeout(120_000)
  const taskName = `E2E filter rearm ${Date.now()}`
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
  await expandAssignments(row)

  const person = personRows(row)
  await expect(person).toHaveCount(1)

  // Close the open occurrence ten times: ten closed rows fill exactly
  // one history page.
  for (let i = 0; i < 10; i++) {
    await closeOpenOccurrence(page, person, i + 1)
  }
  await expect(row).toContainText("10 cerradas")

  // A fresh mount (reload) shows only the open successor; one click
  // fetches all ten closed rows and the button goes.
  await page.reload()
  await expandAssignments(row)
  await expect(person).toHaveCount(1)
  const loadMore = page.getByRole("button", { name: "Cargar más" })
  await expect(loadMore).toBeVisible()
  await loadMore.click()
  await expect(person).toHaveCount(11)
  await expect(loadMore).toHaveCount(0)

  // Close the open successor: the spawn inserts fresh history — now
  // eleven closed rows, one page beyond what the panel displays.
  // Drain the toasts first: a stack still on screen can sit on top of
  // the options portal mid-click.
  await expect(page.locator("[data-sonner-toast]")).toHaveCount(0)

  const open = openOccurrenceRow(page, person)
  await pinRow(open)
  const justClosedWindow = await open.locator("td").nth(1).textContent()
  if (!justClosedWindow) throw new Error("occurrence cell had no text")
  await open.getByRole("combobox").click()
  await page.getByRole("option", { name: "Completado" }).click()

  // The just-closed row is visible WITHOUT any click: the panel
  // absorbed the open→terminal transition at pend (the copy persists
  // past the spawn commit). History loads only on Load More, so the
  // close itself issues no history request and the ten previously
  // fetched rows keep their place (nth(1): the open successor leads,
  // the newest closed row is first in the sorted closed region).
  await expect(person).toHaveCount(12)
  await expect(open).toHaveCount(1)
  await expect(person.nth(1)).toContainText(justClosedWindow)

  // The signature reset re-arms the button: eleven closed rows are one
  // page beyond the ten the panel had paged before the close, and the
  // offset restarts at 0.
  await expect(loadMore).toBeVisible()
  await loadMore.click()
  // Offset 0 returns the ten newest closed rows — the absorbed one
  // plus nine already displayed — so the page dedupes to nothing and
  // the count holds; hasMore stays true (eleven closed rows in all).
  await expect(person).toHaveCount(12)
  await expect(person.nth(1)).toContainText(justClosedWindow)
  await expect(loadMore).toBeVisible()
  // The second click pages the last row (offset 10): already
  // displayed → deduped again, hasMore false, the button leaves.
  await loadMore.click()
  await expect(loadMore).toHaveCount(0)
  await expect(person).toHaveCount(12)
  await expect(person.nth(1)).toContainText(justClosedWindow)
})

test("a repeating close keeps its closed badge while history is blocked", async ({
  page,
  signInAs,
}) => {
  const taskName = `E2E filter absorb ${Date.now()}`
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
  await expandAssignments(row)

  const person = personRows(row)
  await expect(person).toHaveCount(1)

  // Block the history panel's fetches (their arguments carry
  // limit/offset) before the close: the closed row that appears must
  // come from the panel absorbing the open→terminal transition — and
  // the panel issues no history request at all (closed history loads
  // only on Load More), so nothing even reaches the route.
  let blockedHistoryFetches = 0
  await page.route("**/*", async (route) => {
    if (isHistoryCall(route.request())) {
      blockedHistoryFetches += 1
      await route.abort()
      return
    }
    await route.continue()
  })

  // Drain the creation toasts: the next success toast is this close's
  // settle, which fires once the spawn commit has landed.
  await expect(page.locator("[data-sonner-toast]")).toHaveCount(0)

  await pinRow(person.first())
  await person.getByRole("combobox").click()
  await page.getByRole("option", { name: "Completado" }).click()
  await expect(
    page.getByText("Estado actualizado").first()
  ).toBeVisible()

  // Post-commit the store holds only the open successor and no
  // history request was issued: the closed badge on screen is the
  // absorbed copy, beside the successor's open select — and it is the
  // only closed row (the pre-existing history never loaded).
  await expect(person).toHaveCount(2)
  await expect(person.getByRole("combobox")).toHaveCount(1)
  await expect(
    person.filter({ hasText: "Completado" })
  ).toHaveCount(1)
  expect(blockedHistoryFetches).toBe(0)
})

test("a close surfaces only the session-closed row, never old history", async ({
  page,
  signInAs,
}) => {
  const taskName = `E2E filter no stale history ${Date.now()}`
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
  await expandAssignments(row)

  const person = personRows(row)
  await expect(person).toHaveCount(1)
  const open = openOccurrenceRow(page, person)
  const occurrence = open.locator("td").nth(1)

  // Old closed history: two closes, then a reload so the panel mounts
  // fresh — two closed rows exist server-side while the panel shows
  // only the open successor. No Load More click anywhere below.
  const oldWindows: string[] = []
  for (let i = 0; i < 2; i++) {
    const before = await occurrence.textContent()
    if (!before) throw new Error("occurrence cell had no text")
    oldWindows.push(before)
    await closeOpenOccurrence(page, person, i + 1)
  }
  await expect(row).toContainText("2 cerradas")
  await page.reload()
  await expandAssignments(row)
  await expect(person).toHaveCount(1)

  // Drain the creation/close toasts: the next success toast is this
  // close's settle, which lands once the spawn commit has landed.
  await expect(page.locator("[data-sonner-toast]")).toHaveCount(0)

  // Listen BEFORE the close so even a pend-time history request cannot
  // slip past the wait.
  const historyResponse = page
    .waitForResponse((response) => isHistoryCall(response.request()), {
      timeout: 5_000,
    })
    .catch(() => null)

  await pinRow(open)
  const justClosedWindow = await occurrence.textContent()
  if (!justClosedWindow) throw new Error("occurrence cell had no text")
  await open.getByRole("combobox").click()
  await page.getByRole("option", { name: "Completado" }).click()
  await expect(person).toHaveCount(2)
  await expect(open).toHaveCount(1)

  // The close issues NO history request: history loads only on Load
  // More.
  expect(await historyResponse).toBeNull()

  // The just-closed row IS visible — through absorption alone — and it
  // is the ONLY closed row on screen: three closed rows exist on the
  // server (two old + this one), zero Load More clicks have happened,
  // so the two pre-existing rows must still be behind the button.
  await expect(person.nth(1)).toContainText(justClosedWindow)
  for (const oldWindow of oldWindows) {
    await expect(person.filter({ hasText: oldWindow })).toHaveCount(0)
  }
  await expect(
    page.getByRole("button", { name: "Cargar más" })
  ).toBeVisible()
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

  // Zero-open lingering task: a Done label leads the closed-count
  // summary ("Completado · 1 cerrada"), plus a closed row with Reopen.
  await expect(row).toBeVisible()
  await expect(row).toContainText("1 cerrada")
  await expect(row).toContainText("Completado")
  await expandAssignments(row)
  const person = personRows(row)
  await expect(person).toHaveCount(1)
  await expect(person).toContainText("Cancelado")
  await expect(
    person.getByRole("button", { name: "Reabrir" })
  ).toBeVisible()
  await expect(person.getByRole("combobox")).toHaveCount(0)

  // Reassign the same member: membership returns (a removed person is
  // re-selectable) and their open row lands beside the old cancelled
  // row — non-repeating tasks load full history, so both show
  // immediately and there is no Load More control.
  const secondEdit = await openEdit(page, row, taskName)
  await secondEdit
    .getByRole("button", { name: "Agregar asignado" })
    .click()
  await page
    .getByRole("menuitemcheckbox", { name: COLLABORATOR })
    .click()
  await saveEdit(page, secondEdit)

  await expandAssignments(row)
  await expect(row).toContainText("1 abierta")
  await expect(person).toHaveCount(2)
  await expect(person.getByRole("combobox")).toHaveCount(1)
  await expect(person.filter({ hasText: "Por hacer" })).toHaveCount(1)
  await expect(person.filter({ hasText: "Cancelado" })).toHaveCount(1)
  await expect(
    person.getByRole("button", { name: "Reabrir" })
  ).toHaveCount(1)
  await expect(
    page.getByRole("button", { name: "Cargar más" })
  ).toHaveCount(0)
})

test("the Archived filter has its own empty message", async ({
  page,
  signInAs,
}) => {
  const taskName = `E2E filter empty ${Date.now()}`
  await signInAs("user1")
  // A fresh project no parallel spec archives into: the Roles project
  // collects archived work from the other specs during the same run.
  await page.goto(EMPTY_PROJECT_URL)

  // Give the Open side content, so the message below can only be the
  // Archived filter's own empty state.
  await createOneOffTask(page, { name: taskName, day: new Date() })
  const row = page.getByRole("row", { name: new RegExp(taskName) })
  await expect(row).toBeVisible()
  await expect(page.getByText("No hay tareas aún")).toHaveCount(0)

  await archivedFilter(page).click()
  await expect(archivedFilter(page)).toHaveAttribute(
    "aria-pressed",
    "true"
  )
  await expect(
    page.getByText("Aún no hay tareas archivadas")
  ).toBeVisible()
  await expect(row).toHaveCount(0)

  await openFilter(page).click()
  await expect(row).toBeVisible()
})

test("a plain save after unarchive never reopens work, and extending the due date spawns from today", async ({
  page,
  signInAs,
}) => {
  const taskName = `E2E filter noreopen ${Date.now()}`
  await signInAs("user1")
  await page.goto(PROJECT_URL)

  // A one-day schedule in the past with a 00:01 slot: a close spawns no
  // successor, and archive preserves that past due date, so the next slot
  // (tomorrow) is out of range and the task unarchives with zero open rows.
  await createDailyRepeatingTask(page, {
    name: taskName,
    assignee: true,
    startDate: daysFromNow(-3),
    endDate: daysFromNow(-3),
    startTime: "00:01",
    endTime: "00:02",
  })
  const row = page.getByRole("row", { name: new RegExp(taskName) })
  await expect(row).toBeVisible()
  await expect(row).toContainText("1 abierta")

  await expandAssignments(row)
  const person = personRows(row)
  await pinRow(person)
  await person.getByRole("combobox").click()
  await page.getByRole("option", { name: "Completado" }).click()
  await expect(page.getByText("Estado actualizado").first()).toBeVisible()
  await expect(row).not.toContainText("abierta")

  // The only row is already terminal, so there is no open work to close:
  // Archive skips the disposition dialog and archives immediately.
  await openTaskMenu(page, row, taskName)
  await page.getByRole("menuitem", { name: "Archivar", exact: true }).click()
  await expect(
    page.getByRole("dialog", { name: "¿Archivar tarea?" })
  ).toHaveCount(0)
  await expect(page.getByText("Tarea archivada").first()).toBeVisible()
  await archivedFilter(page).click()
  await expect(row).toBeVisible()
  await unarchiveTask(page, row, taskName)
  await openFilter(page).click()
  await expect(row).toBeVisible()
  await expect(row).toContainText("1 cerrada")
  await expect(row).not.toContainText("abierta")

  // A plain save (no date edit) keeps the preserved due date untouched:
  // it never reopens work.
  const plain = await openEdit(page, row, taskName)
  await saveEdit(page, plain)
  await expect(row).toContainText("1 cerrada")
  await expect(row).not.toContainText("abierta")

  // Extending the due date is the way back: the new occurrence starts
  // from today, never at the task's original (past) start date.
  const edit = await openEdit(page, row, taskName)
  await changeDueDate(page, edit, daysFromNow(10))
  await expect(row).toContainText("1 abierta")
  await expandAssignments(row)
  const open = openOccurrenceRow(page, personRows(row))
  await expect(open).toHaveCount(1)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const startCell = await open.locator("td").nth(1).textContent()
  expect(occurrenceStart(startCell ?? "")).toBeGreaterThanOrEqual(
    today.getTime()
  )
})

test("a project owner's own repeating occurrence spawns a successor when closed", async ({
  page,
  signInAs,
}) => {
  const taskName = `E2E filter ownerspawn ${Date.now()}`
  await signInAs("user1")
  // user1 is this project's primary owner and holds no membership row.
  await page.goto(EMPTY_PROJECT_URL)

  await createDailyRepeatingTask(page, {
    name: taskName,
    assignees: [OWNER],
    startDate: new Date(),
    endDate: daysFromNow(30),
  })
  const row = page.getByRole("row", { name: new RegExp(taskName) })
  await expect(row).toBeVisible()
  await expect(row).toContainText("1 abierta")

  await expandAssignments(row)
  const person = personRows(row, "user1@test.local")
  await expect(person).toHaveCount(1)
  await pinRow(person)
  await person.getByRole("combobox").click()
  await page.getByRole("option", { name: "Completado" }).click()

  // The toast lands only once the close spawned the owner's successor.
  await expect(
    page.getByText("Siguiente ocurrencia creada").first()
  ).toBeVisible()
  await expect(row).toContainText("1 abierta")
  await expect(row).toContainText("1 cerrada")
  await expect(openOccurrenceRow(page, person)).toHaveCount(1)
})

test("switching filters preserves each view's expanded task rows", async ({
  page,
  signInAs,
}) => {
  const stamp = Date.now()
  const openName = `E2E state open ${stamp}`
  const archivedName = `E2E state archived ${stamp}`
  await signInAs("user1")
  await page.goto(PROJECT_URL)

  // One open task and one archived task, so each filter renders its own
  // TasksTable and the two views can be expanded independently.
  await createOneOffTask(page, {
    name: openName,
    assignee: true,
    day: daysFromNow(2),
  })
  await createOneOffTask(page, {
    name: archivedName,
    assignee: true,
    day: daysFromNow(3),
  })
  const openRow = page.getByRole("row", { name: new RegExp(openName) })
  const archivedRow = page.getByRole("row", {
    name: new RegExp(archivedName),
  })
  // Archive inline rather than via the toast-waiting helper: under full
  // suite load a delayed sonner toast can flake, while the optimistic
  // store update that moves the row is the signal this test cares about.
  await openTaskMenu(page, archivedRow, archivedName)
  await page.getByRole("menuitem", { name: "Archivar", exact: true }).click()
  const archiveDialog = page.getByRole("dialog", { name: "¿Archivar tarea?" })
  await expect(archiveDialog).toBeVisible()
  await archiveDialog
    .getByRole("button", { name: "Marcar como finalizada" })
    .click()
  await expect(archiveDialog).toBeHidden()
  await expect(archivedRow).toHaveCount(0)

  // Expand the open task's assignments, then leave the view.
  await expandAssignments(openRow)
  await expect(personRows(openRow)).toHaveCount(1)
  await expect(
    openRow.getByRole("button", { name: "Detalles de asignados" })
  ).toHaveAttribute("aria-expanded", "true")

  // The hidden view is removed from the accessibility tree, so the open
  // row is gone while Archived is selected.
  await archivedFilter(page).click()
  await expect(archivedFilter(page)).toHaveAttribute(
    "aria-pressed",
    "true"
  )
  await expect(openRow).toHaveCount(0)

  // Expand the archived task's assignments too — its own view's state.
  await expect(archivedRow).toBeVisible()
  await expandAssignments(archivedRow)
  await expect(personRows(archivedRow)).toHaveCount(1)
  await expect(
    archivedRow.getByRole("button", { name: "Detalles de asignados" })
  ).toHaveAttribute("aria-expanded", "true")

  // Back to Open: the open row kept its expanded assignment rows instead
  // of remounting fresh, while the archived row is now hidden.
  await openFilter(page).click()
  await expect(openFilter(page)).toHaveAttribute("aria-pressed", "true")
  await expect(archivedRow).toHaveCount(0)
  await expect(openRow).toBeVisible()
  await expect(
    openRow.getByRole("button", { name: "Detalles de asignados" })
  ).toHaveAttribute("aria-expanded", "true")
  await expect(personRows(openRow)).toHaveCount(1)

  // Switching again, the Archived view still holds its own expansion.
  await archivedFilter(page).click()
  await expect(archivedRow).toBeVisible()
  await expect(
    archivedRow.getByRole("button", { name: "Detalles de asignados" })
  ).toHaveAttribute("aria-expanded", "true")
  await expect(personRows(archivedRow)).toHaveCount(1)
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
  await expect(
    page.getByRole("button", { name: "Reabrir" })
  ).toHaveCount(0)
  await expect(
    page.getByRole("button", { name: "Agregar Tarea" })
  ).toHaveCount(0)
})
