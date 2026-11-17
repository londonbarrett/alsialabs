import { test, expect } from "./fixtures"

// Serial: test 3 deletes user3's project membership (restored only by the
// next run's seed), so it must always run after tests 1-2 — never beside
// them in a second worker while they still pick user3 from the picker.
test.describe.configure({ mode: "serial" })

const PROJECT_ID = "10000000-0000-4000-8000-000000000001"
const PROJECT_URL = `/app/proyectos/${PROJECT_ID}`

function toDateInput(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

test("a task with several assignees shows counts, stack, and per-person rows", async ({
  page,
  signInAs,
}) => {
  // Unique per attempt: a retry must not collide with the row the failed
  // attempt left behind (the seed also clears them before the next run).
  const taskName = `E2E multi assign ${Date.now()}`

  // user1 is the project admin with global projects:edit — the only
  // fixture user for whom the task wizard and action menu render.
  await signInAs("user1")
  await page.goto(PROJECT_URL)
  await page.getByRole("button", { name: "Agregar Tarea" }).click()
  const dialog = page.getByRole("dialog", { name: "Agregar Tarea" })
  await expect(dialog).toBeVisible()

  await dialog.getByLabel("Nombre de la tarea").fill(taskName)

  // The assignee picker lives on step 1 (Details): pick both people
  // before continuing to the schedule step.
  await dialog.getByRole("button", { name: "Agregar asignado" }).click()
  await page
    .getByRole("menuitemcheckbox", { name: /E2E Collaborator/ })
    .click()
  await dialog.getByRole("button", { name: "Agregar asignado" }).click()
  await page
    .getByRole("menuitemcheckbox", { name: /user1@test\.local/ })
    .click()

  await dialog.getByRole("button", { name: "Continuar" }).click()

  // Dates stay on today: the list predicate hides a task whose due date
  // has passed, and the row assertions below need this one visible.
  const today = toDateInput(new Date())
  await dialog.getByLabel("Fecha de inicio").fill(today)
  await dialog.getByLabel("Fecha de vencimiento").fill(today)
  await dialog.getByRole("button", { name: "Crear Tarea" }).click()
  await expect(dialog).toBeHidden()
  // The server commit swaps the optimistic temp task id for the real
  // one, re-keying the row and resetting the expansion below — wait
  // for the commit (the toast lands after the swap) before expanding.
  await expect(page.getByText("Tarea creada")).toBeVisible()

  const row = page.getByRole("row", { name: new RegExp(taskName) })
  await expect(row).toContainText("2 abiertas")
  // The collapsed row carries no per-assignment controls — its only
  // combobox is the priority select; status selects live in sub-rows.
  await expect(row.getByRole("combobox")).toHaveCount(1)

  await row
    .getByRole("button", { name: "Detalles de asignados" })
    .click()

  // The table renders assignee sub-rows as sibling <tr>s, not descendants,
  // so scope them to the rows right under this task's row (one per
  // assignee) instead of page-level lookups.
  const subRows = row.locator("xpath=following-sibling::tr[position() <= 2]")
  const collaboratorRow = subRows.filter({ hasText: "E2E Collaborator" })
  await expect(collaboratorRow).toBeVisible()
  await expect(collaboratorRow.getByRole("combobox")).toHaveCount(1)
  await expect(
    collaboratorRow.getByText("user2@test.local")
  ).toBeVisible()

  const user1Row = subRows.filter({ hasText: "user1@test.local" })
  await expect(user1Row).toBeVisible()
  await expect(user1Row.getByRole("combobox")).toHaveCount(1)

  // Completing one assignee drops the count. The task is
  // non-repeating, so full history keeps the closed row visible
  // beside the still-open one — and this kind of task never gets a
  // Load More control.
  await collaboratorRow.getByRole("combobox").click()
  await page.getByRole("option", { name: "Completado" }).click()
  await expect(page.getByText("Estado actualizado")).toBeVisible()
  await expect(row).toContainText("1 abierta")
  await expect(subRows.filter({ hasText: "E2E Collaborator" })).toHaveCount(
    1
  )
  await expect(collaboratorRow).toContainText("Completado")
  await expect(collaboratorRow.getByRole("combobox")).toHaveCount(0)
  await expect(user1Row).toBeVisible()
  await expect(user1Row.getByRole("combobox")).toHaveCount(1)
  await expect(
    page.getByRole("button", { name: "Cargar más" })
  ).toHaveCount(0)

  // Last assignment terminal: the whole task leaves the list.
  await user1Row.getByRole("combobox").click()
  await page.getByRole("option", { name: "Completado" }).click()
  await expect(
    page.getByRole("row", { name: new RegExp(taskName) })
  ).toHaveCount(0)
})

test("unassigning the last person asks what to do and leaves the task visible", async ({
  page,
  signInAs,
}) => {
  // Unique per attempt: a retry must not collide with the row the failed
  // attempt left behind (the seed also clears them before the next run).
  const taskName = `E2E multi unassign ${Date.now()}`

  await signInAs("user1")
  await page.goto(PROJECT_URL)
  await page.getByRole("button", { name: "Agregar Tarea" }).click()
  const createDialog = page.getByRole("dialog", {
    name: "Agregar Tarea",
  })
  await expect(createDialog).toBeVisible()

  await createDialog.getByLabel("Nombre de la tarea").fill(taskName)

  await createDialog
    .getByRole("button", { name: "Agregar asignado" })
    .click()
  await page
    .getByRole("menuitemcheckbox", { name: /E2E Collaborator/ })
    .click()

  await createDialog.getByRole("button", { name: "Continuar" }).click()
  const today = toDateInput(new Date())
  await createDialog.getByLabel("Fecha de inicio").fill(today)
  await createDialog.getByLabel("Fecha de vencimiento").fill(today)
  await createDialog
    .getByRole("button", { name: "Crear Tarea" })
    .click()
  await expect(createDialog).toBeHidden()
  // The server commit swaps the optimistic temp task id for the real
  // one, remounting the row and its action menu — wait for it before
  // opening the menu.
  await expect(page.getByText("Tarea creada")).toBeVisible()

  const row = page.getByRole("row", { name: new RegExp(taskName) })
  await expect(row).toBeVisible()

  // Edit reopens on step 1 (Details), where the assignee chips live.
  await row
    .getByRole("button", { name: `Acciones para ${taskName}` })
    .click()
  await page
    .getByRole("menuitem", { name: `Editar ${taskName}` })
    .click()

  const editDialog = page.getByRole("dialog", { name: "Editar Tarea" })
  await expect(editDialog).toBeVisible()
  const confirm = page.getByRole("dialog", {
    name: "¿Quitar asignado?",
  })
  const chip = editDialog.getByRole("button", {
    name: "Eliminar E2E Collaborator",
  })

  // Chip X on a protected member (open assignment on the server) asks
  // for the disposition immediately; Cancel leaves the chip in place.
  await chip.click()
  await expect(confirm).toBeVisible()
  await confirm.getByRole("button", { name: "Cancelar" }).click()
  await expect(confirm).toBeHidden()
  await expect(chip).toBeVisible()

  // Unchecking a protected member in the menu opens the same dialog.
  await editDialog
    .getByRole("button", { name: "Agregar asignado" })
    .click()
  await page
    .getByRole("menuitemcheckbox", { name: /E2E Collaborator/ })
    .click()
  await expect(confirm).toBeVisible()
  await confirm.getByRole("button", { name: "Cancelar" }).click()
  await expect(confirm).toBeHidden()
  await expect(chip).toBeVisible()

  // Confirming the removal records the disposition and drops the chip.
  await chip.click()
  await expect(confirm).toBeVisible()
  await confirm
    .getByRole("button", { name: "Marcar como cancelado" })
    .click()
  await expect(confirm).toBeHidden()
  await expect(chip).toHaveCount(0)

  // A member added this session has no server row: checking them is
  // dialog-free and removing them goes straight out.
  await editDialog
    .getByRole("button", { name: "Agregar asignado" })
    .click()
  await page
    .getByRole("menuitemcheckbox", { name: /user3@test\.local/ })
    .click()
  await expect(confirm).toHaveCount(0)
  const freshChip = editDialog.getByRole("button", {
    name: "Eliminar user3@test.local",
  })
  await expect(freshChip).toBeVisible()
  await freshChip.click()
  await expect(confirm).toHaveCount(0)
  await expect(freshChip).toHaveCount(0)

  // Save closes directly — no dialog at save time anymore.
  await editDialog.getByRole("button", { name: "Continuar" }).click()
  await editDialog
    .getByRole("button", { name: "Guardar cambios" })
    .click()
  await expect(editDialog).toBeHidden()
  await expect(confirm).toHaveCount(0)

  // The task stays visible (due today) with nobody open on it.
  await expect(row).toBeVisible()
  await expect(row).toContainText("Sin asignar")

  // Reopening the form seeds assignees from current members only: the
  // closed collaborator must not come back as a chip on step 1.
  await row
    .getByRole("button", { name: `Acciones para ${taskName}` })
    .click()
  await page
    .getByRole("menuitem", { name: `Editar ${taskName}` })
    .click()
  await expect(editDialog).toBeVisible()
  await expect(
    editDialog.getByRole("button", { name: "Agregar asignado" })
  ).toBeVisible()
  await expect(
    editDialog.getByRole("button", { name: "Eliminar E2E Collaborator" })
  ).toHaveCount(0)
  await editDialog.getByRole("button", { name: "Cancelar" }).click()
  await expect(editDialog).toBeHidden()

  // History is preserved: the collaborator sees the closed row as past.
  await signInAs("user2")
  await page.goto("/app/mis-tareas")
  await page.getByRole("tab", { name: "Pasadas" }).click()
  await page.waitForURL("**view=past")
  const pastRow = page.getByRole("row", {
    name: new RegExp(taskName),
  })
  await expect(pastRow).toBeVisible()
  await expect(pastRow.getByText("Cancelado")).toBeVisible()
})

test("removing a member cancels their open assignments", async ({
  page,
  signInAs,
}) => {
  // Unique per attempt: a retry must not collide with the row the failed
  // attempt left behind (the seed also clears them before the next run).
  const taskName = `E2E multi member ${Date.now()}`

  await signInAs("user1")
  await page.goto(PROJECT_URL)
  await page.getByRole("button", { name: "Agregar Tarea" }).click()
  const createDialog = page.getByRole("dialog", { name: "Agregar Tarea" })
  await expect(createDialog).toBeVisible()

  await createDialog.getByLabel("Nombre de la tarea").fill(taskName)

  await createDialog
    .getByRole("button", { name: "Agregar asignado" })
    .click()
  await page
    .getByRole("menuitemcheckbox", { name: /user3@test\.local/ })
    .click()

  await createDialog.getByRole("button", { name: "Continuar" }).click()
  const today = toDateInput(new Date())
  await createDialog.getByLabel("Fecha de inicio").fill(today)
  await createDialog.getByLabel("Fecha de vencimiento").fill(today)
  await createDialog.getByRole("button", { name: "Crear Tarea" }).click()
  await expect(createDialog).toBeHidden()
  await expect(page.getByText("Tarea creada")).toBeVisible()

  // Removal from the People tab goes through the confirm dialog.
  // This spec deletes user3's project membership mid-run: serial mode
  // protects tests 1-2 in this file, and NO other spec may rely on user3
  // being a member within the same run.
  await page.goto(`${PROJECT_URL}/personas`)
  const removeButton = page.getByRole("button", {
    name: "Eliminar a user3@test.local",
  })
  await expect(removeButton).toBeVisible()
  await removeButton.click()

  const confirmDialog = page.getByRole("dialog", {
    name: "¿Eliminar miembro?",
  })
  await expect(confirmDialog).toBeVisible()
  await confirmDialog.getByRole("button", { name: "Eliminar" }).click()
  await expect(confirmDialog).toBeHidden()
  await expect(removeButton).toHaveCount(0)
  // The success toast lands after the server commit (membership removal +
  // open assignments cancelled in the same action) — wait for it before
  // navigating, so the task list cannot render a stale open row.
  await expect(page.getByText("Colaborador eliminado")).toBeVisible()

  await page.goto(PROJECT_URL)
  const row = page.getByRole("row", { name: new RegExp(taskName) })
  await expect(row).toBeVisible()
  await expect(row).toContainText("Sin asignar")
})
