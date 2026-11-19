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
    startDate,
    endDate,
  }: {
    name: string
    assignee?: boolean
    startDate: Date
    endDate: Date
  }
): Promise<void> {
  const dialog = await openCreateDialog(page)
  await fillDetails(page, dialog, name, assignee)
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
  await dialog.getByLabel("Realizar a las").fill("09:00")
  await dialog.getByLabel("Hora de fin").fill("17:00")
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
function personRows(row: Locator): Locator {
  return row
    .locator("xpath=following-sibling::tr")
    .filter({ hasText: ASSIGNEE_EMAIL })
}

/**
 * The occurrence cell renders the row's start date first, in the pinned
 * es-ES locale ("dd/mm/yyyy – …"). Returns it as a day timestamp so a
 * region of cells can be checked newest-first.
 */
function occurrenceStart(text: string): number {
  const match = text.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (!match) throw new Error(`unparseable occurrence cell: ${text}`)
  const [, day, month, year] = match
  return new Date(
    Number(year),
    Number(month) - 1,
    Number(day)
  ).getTime()
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
  await expect(
    page.getByText("Estado actualizado").first()
  ).toBeVisible()
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
  await expect(
    page.getByText("Estado actualizado").first()
  ).toBeVisible()
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

  // A finished repeating task gets Load More; its single closed row is
  // already on screen, so the click fetches nothing new (deduped
  // against the zero-open scope) and the button goes away without
  // duplicating the row.
  const loadMore = page.getByRole("button", { name: "Cargar más" })
  await expect(loadMore).toBeVisible()
  await loadMore.click()
  await expect(loadMore).toHaveCount(0)
  await expect(person).toHaveCount(1)

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
  await expect(
    page.getByText("Estado actualizado").first()
  ).toBeVisible()
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

  await createOneOffTask(page, {
    name: tomorrowName,
    day: daysFromNow(1),
  })
  await createOneOffTask(page, { name: laterName, day: daysFromNow(3) })
  // Due yesterday with nobody open: already finished at creation.
  await createOneOffTask(page, { name: doneName, day: daysFromNow(-1) })

  const unfinished = page.getByRole("button", { name: "Sin finalizar" })
  const both = page.getByRole("button", { name: "Ambas" })
  const tomorrowRow = page.getByRole("row", {
    name: new RegExp(tomorrowName),
  })
  const laterRow = page.getByRole("row", {
    name: new RegExp(laterName),
  })
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
  const indexes = await page
    .getByRole("row")
    .evaluateAll(
      (rows, names) =>
        names.map((name) =>
          rows.findIndex((row) =>
            (row.textContent ?? "").includes(name)
          )
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

  // Pin the row mid-viewport (pinRow): sonner stacks success toasts at
  // the bottom-right through this loop, and a row scrolled low — or
  // parked under the sticky header, whose overlay makes Playwright
  // re-scroll it low — would put its status control and the options
  // portal inside the toast zone, making every click wait out a
  // toast's lifetime.
  await pinRow(person.first())

  // Close the open occurrence 11 times: every close spawns the next day's
  // successor, which is the row closed next. Waiting for the occurrence
  // window to advance pins the spawn commit — a toast alone could be stale.
  // The last window read is the row closed last: the newest history entry.
  // Re-pin every iteration: each close unmounts and remounts the row
  // (optimistic terminal-only state hides it under Sin finalizar), and
  // the scroll position shifts with it.
  let lastClosedWindow = ""
  for (let i = 0; i < 11; i++) {
    const before = await occurrence.textContent()
    if (!before) throw new Error("occurrence cell had no text")
    lastClosedWindow = before
    await pinRow(person.first())
    await person.getByRole("combobox").click()
    await page.getByRole("option", { name: "Completado" }).click()
    await expect(occurrence).not.toContainText(before)
    await expect(person).toHaveCount(1)
  }

  // Feature pin: the status cell carries the task-level terminal total
  // — all 11 closed rows, including the ten still behind Load More (a
  // server-side count, never a count of loaded rows) — beside the
  // single open successor.
  await expect(row).toContainText("1 abierta")
  await expect(row).toContainText("11 cerradas")

  // Display rule: the default expanded view keeps only the open
  // successor. The 11 closed rows arrive through Load More, ten at a
  // time, appended below it. (Under Sin finalizar the close's
  // optimistic done state hides the task row, so the panel remounts
  // fresh after every close — mount fetches nothing and never absorbs,
  // so no closed row can appear before a click here. The no-click
  // surface path is pinned in the rearm and absorb scenarios below,
  // which close under Ambas.)
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
  // The heaviest scenario in this file (11 closes + three Load More
  // clicks + a filter switch): under full-suite load the dev server
  // pushes it past the 45s default before the decisive close runs.
  test.setTimeout(90_000)
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
  const occurrence = person.locator("td").nth(1)

  // Pin the row mid-viewport (same reason as the paging scenario:
  // keep the status control clear of the sticky header and of
  // sonner's bottom-right toast corner).
  await pinRow(person.first())

  // Close the open occurrence ten times: ten closed rows fill exactly
  // one history page. Under Sin finalizar the optimistic done state
  // hides the task row, so the panel remounts fresh after each close
  // — mount fetches nothing, only the open successor shows — and the
  // ten closes are what make the exhaustion below exact. Re-pin every
  // iteration: each close unmounts and remounts the row, and the
  // scroll position shifts with it.
  for (let i = 0; i < 10; i++) {
    const before = await occurrence.textContent()
    if (!before) throw new Error("occurrence cell had no text")
    await pinRow(person.first())
    await person.getByRole("combobox").click()
    await page.getByRole("option", { name: "Completado" }).click()
    await expect(occurrence).not.toContainText(before)
    await expect(person).toHaveCount(1)
  }

  // Exhaust the single page: one click fetches all ten closed rows,
  // the button goes.
  const loadMore = page.getByRole("button", { name: "Cargar más" })
  await expect(loadMore).toBeVisible()
  await loadMore.click()
  await expect(person).toHaveCount(11)
  await expect(loadMore).toHaveCount(0)

  // Move to Ambas before the decisive close: under Sin finalizar the
  // optimistic terminal-only state hides the whole task row
  // (shouldShowTask), which unmounts the expanded region and remounts
  // the panel fresh — masking the panel's close handling. Ambas
  // re-sorts the row between segments instead, so the exhausted panel
  // stays mounted.
  const both = page.getByRole("button", { name: "Ambas" })
  await both.click()
  await expect(both).toHaveAttribute("aria-pressed", "true")
  await expect(person).toHaveCount(11)
  await expect(loadMore).toHaveCount(0)

  // Close the open successor: the spawn inserts fresh history — now
  // eleven closed rows, one page beyond what the panel displays.
  // Drain the loop's toasts first: they only reappear after this
  // close commits, and a stack still on screen can sit on top of the
  // options portal mid-click.
  await expect(page.locator("[data-sonner-toast]")).toHaveCount(0)

  await pinRow(person.first())
  const justClosedWindow = await occurrence.textContent()
  if (!justClosedWindow) throw new Error("occurrence cell had no text")
  await person.getByRole("combobox").click()
  await page.getByRole("option", { name: "Completado" }).click()
  // The occurrence window advancing pins the spawn commit — during the
  // optimistic flip the default row still shows the same window.
  await expect(occurrence).not.toContainText(justClosedWindow)

  // The just-closed row is visible WITHOUT any click: the panel
  // absorbed the open→terminal transition at pend (the copy persists
  // past the spawn commit). History loads only on Load More, so the
  // close itself issues no history request and the ten previously
  // fetched rows keep their place (nth(1): the open successor leads,
  // the newest closed row is first in the sorted closed region).
  await expect(person).toHaveCount(12)
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
  // the fixed panel issues no history request at all (closed history
  // loads only on Load More), so nothing even reaches the route.
  let blockedHistoryFetches = 0
  await page.route("**/*", async (route) => {
    if (isHistoryCall(route.request())) {
      blockedHistoryFetches += 1
      await route.abort()
      return
    }
    await route.continue()
  })

  // Ambas keeps the task row mounted through the close: under Sin
  // finalizar the optimistic terminal-only state hides the whole row,
  // which unmounts the panel and masks the transition being pinned.
  const both = page.getByRole("button", { name: "Ambas" })
  await both.click()
  await expect(both).toHaveAttribute("aria-pressed", "true")

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
  await expect(person.nth(1)).toContainText("Completado")
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
  const occurrence = person.locator("td").nth(1)

  // Old closed history: two closes under Sin finalizar hide the task
  // row at pend (the panel unmounts and remounts fresh each time —
  // mount fetches nothing), so two closed rows exist server-side while
  // the panel shows only the open successor. No Load More click
  // anywhere below.
  const oldWindows: string[] = []
  for (let i = 0; i < 2; i++) {
    const before = await occurrence.textContent()
    if (!before) throw new Error("occurrence cell had no text")
    oldWindows.push(before)
    await pinRow(person.first())
    await person.getByRole("combobox").click()
    await page.getByRole("option", { name: "Completado" }).click()
    await expect(occurrence).not.toContainText(before)
    await expect(person).toHaveCount(1)
  }

  // Ambas keeps the panel mounted across the decisive close (under Sin
  // finalizar the optimistic terminal-only state hides the whole row,
  // remounting the panel fresh — which would mask the bug this pin
  // exists for).
  const both = page.getByRole("button", { name: "Ambas" })
  await both.click()
  await expect(both).toHaveAttribute("aria-pressed", "true")
  await expect(person).toHaveCount(1)

  // Drain the creation/close toasts: the next success toast is this
  // close's settle, which lands once the spawn commit has landed.
  await expect(page.locator("[data-sonner-toast]")).toHaveCount(0)

  // Listen BEFORE the close so even a pend-time history request (the
  // first thing the auto-fetch used to fire) cannot slip past the wait.
  const historyResponse = page
    .waitForResponse((response) => isHistoryCall(response.request()), {
      timeout: 5_000,
    })
    .catch(() => null)

  await pinRow(person.first())
  const justClosedWindow = await occurrence.textContent()
  if (!justClosedWindow) throw new Error("occurrence cell had no text")
  await person.getByRole("combobox").click()
  await page.getByRole("option", { name: "Completado" }).click()
  await expect(occurrence).not.toContainText(justClosedWindow)

  // The close issues NO history request: history loads only on Load
  // More. The old auto-fetch answered this wait (and then dumped the
  // old rows below) → red; the fixed panel times it out empty.
  expect(await historyResponse).toBeNull()

  // The just-closed row IS visible — through absorption alone — and it
  // is the ONLY closed row on screen: three closed rows exist on the
  // server (two old + this one), zero Load More clicks have happened,
  // so the two pre-existing rows must still be behind the button.
  await expect(person).toHaveCount(2)
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

  // Zero-open lingering task: closed-count summary, closed row with
  // Reopen — the terminal total replaces the old unassigned summary.
  await expect(row).toBeVisible()
  await expect(row).toContainText("1 cerrada")
  await expandAssignments(row)
  const person = personRows(row)
  await expect(person).toHaveCount(1)
  await expect(person).toContainText("Cancelado")
  await expect(
    person.getByRole("button", { name: "Reabrir" })
  ).toBeVisible()
  await expect(person.getByRole("combobox")).toHaveCount(0)

  // Reassign the same member: their open row returns beside the old
  // cancelled row — non-repeating tasks load full history, so both
  // show immediately and there is no Load More control.
  const secondEdit = await openEdit(page, row, taskName)
  await secondEdit
    .getByRole("button", { name: "Agregar asignado" })
    .click()
  await page
    .getByRole("menuitemcheckbox", { name: /E2E Collaborator/ })
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
  await expect(
    page.getByRole("button", { name: "Reabrir" })
  ).toHaveCount(0)
  await expect(
    page.getByRole("button", { name: "Agregar Tarea" })
  ).toHaveCount(0)
})
