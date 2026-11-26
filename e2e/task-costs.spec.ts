import { test, expect } from "./fixtures"

const PROJECT_ID = "10000000-0000-4000-8000-000000000001"
const PROJECT_URL = `/app/proyectos/${PROJECT_ID}`

function toDateInput(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

test("an owner recosts an assignment inline and the new cost persists", async ({
  page,
  signInAs,
}) => {
  // Two server mutations plus two reloads; the dev server compiles routes on
  // demand and the suite shares it with parallel workers.
  test.setTimeout(120_000)
  const taskName = `E2E recost ${Date.now()}`
  const today = toDateInput(new Date())

  await signInAs("user1")
  await page.goto(PROJECT_URL)
  await page.getByRole("button", { name: "Agregar Tarea" }).click()
  const dialog = page.getByRole("dialog")

  // The task default (100) is copied onto its single assignee.
  await dialog.getByLabel("Costo base por asignación").fill("100")
  await dialog.getByLabel("Nombre de la tarea").fill(taskName)
  await dialog.getByRole("button", { name: "Agregar asignado" }).click()
  await page
    .getByRole("menuitemcheckbox", { name: /user1@test\.local/ })
    .click()
  await dialog.getByRole("button", { name: "Continuar" }).click()
  await dialog.getByLabel("Fecha de vencimiento").fill(today)
  await dialog.getByRole("button", { name: "Crear Tarea" }).click()
  await expect(dialog).toBeHidden()

  // Wait for the server commit before expanding: it swaps the temp task id
  // for the real one and would otherwise reset the expansion.
  await expect(page.getByText("Tarea creada")).toBeVisible({
    timeout: 20_000,
  })
  await page.reload()

  const taskRow = page.getByRole("row", { name: new RegExp(taskName) })
  await expect(taskRow).toBeVisible()
  await taskRow
    .getByRole("button", { name: "Detalles de asignados" })
    .click()
  const costCell = taskRow.locator("xpath=following-sibling::tr[1]")
  const costInput = costCell.getByRole("textbox", { name: "Costo" })
  await expect(costInput).toHaveValue("$100")

  // Cost and note are local drafts: nothing is written until Save is clicked.
  await costInput.fill("150")
  await expect(costInput).toHaveValue("$150")
  const noteInput = costCell.getByRole("textbox", {
    name: "Comentario",
  })
  await noteInput.fill("Buen desempeño")
  const saveButton = costCell.getByRole("button", { name: "Guardar cambios" })
  await expect(saveButton).toBeVisible()
  await saveButton.click()
  await expect(saveButton).toBeHidden()
  // The combined save settles with the assignment-details toast, not the
  // old cost-only one. With one assignee this input is also the task's total.
  await expect(page.getByText("Comentario actualizado")).toBeVisible({
    timeout: 20_000,
  })

  // A fresh server seed must report the persisted values, not the optimistic
  // ones: reloading and re-expanding reads the assignment straight from the DB.
  await page.reload()
  const reloadedRow = page.getByRole("row", { name: new RegExp(taskName) })
  await expect(reloadedRow).toBeVisible()
  await reloadedRow
    .getByRole("button", { name: "Detalles de asignados" })
    .click()
  const reloadedAssignmentRow = reloadedRow.locator(
    "xpath=following-sibling::tr[1]"
  )
  await expect(
    reloadedAssignmentRow.getByRole("textbox", { name: "Costo" })
  ).toHaveValue("$150")
  await expect(
    reloadedAssignmentRow.getByRole("textbox", {
      name: "Comentario",
    })
  ).toHaveValue("Buen desempeño")
})

test("total cost shows on the task row and in both My Tasks tabs", async ({
  page,
  signInAs,
}) => {
  // Two server mutations plus several reloads; the dev server compiles
  // routes on demand and the suite shares it with parallel workers.
  test.setTimeout(120_000)
  const taskName = `E2E total ${Date.now()}`
  const today = toDateInput(new Date())

  await signInAs("user1")
  await page.goto(PROJECT_URL)
  await page.getByRole("button", { name: "Agregar Tarea" }).click()
  const dialog = page.getByRole("dialog", { name: "Agregar Tarea" })

  // The task cost is copied onto each assignee, so two assignees at 75
  // give a server-authoritative task total of 150.
  await dialog.getByLabel("Costo base por asignación").fill("75")
  await dialog.getByLabel("Nombre de la tarea").fill(taskName)
  await dialog.getByRole("button", { name: "Agregar asignado" }).click()
  await page
    .getByRole("menuitemcheckbox", { name: /E2E Collaborator/ })
    .click()
  await dialog.getByRole("button", { name: "Agregar asignado" }).click()
  await page
    .getByRole("menuitemcheckbox", { name: /user1@test\.local/ })
    .click()
  await dialog.getByRole("button", { name: "Continuar" }).click()
  await dialog.getByLabel("Fecha de vencimiento").fill(today)
  await dialog.getByRole("button", { name: "Crear Tarea" }).click()
  await expect(dialog).toBeHidden()
  await expect(page.getByText("Tarea creada")).toBeVisible({
    timeout: 20_000,
  })
  await page.reload()

  // Name, assignees, status, priority, due date, then the total column.
  // Both assignments are still open, so the closed-only server total is $0.
  const taskRow = page.getByRole("row", { name: new RegExp(taskName) })
  await expect(taskRow).toBeVisible()
  await expect(taskRow.getByRole("cell").nth(5)).toHaveText("$0")

  // The collaborator sees their assignment's own cost in the active tab.
  await signInAs("user2")
  await page.goto("/app/mis-tareas")
  const activeRow = page.getByRole("row", { name: new RegExp(taskName) })
  await expect(activeRow).toBeVisible()
  // Name, project, status, priority, due date, then the new cost column.
  await expect(activeRow.getByRole("cell").nth(5)).toHaveText("$75")

  // Completing the assignment moves that same row into the read-only Past
  // tab, where the cost must still be displayed.
  await signInAs("user1")
  await page.goto(PROJECT_URL)
  const ownerRow = page.getByRole("row", { name: new RegExp(taskName) })
  await expect(ownerRow).toBeVisible()
  await ownerRow
    .getByRole("button", { name: "Detalles de asignados" })
    .click()
  const collaboratorRow = ownerRow
    .locator("xpath=following-sibling::tr[position() <= 2]")
    .filter({ hasText: "E2E Collaborator" })
  await collaboratorRow.getByRole("combobox").click()
  await page.getByRole("option", { name: "Completado" }).click()
  await expect(page.getByText("Estado actualizado")).toBeVisible()
  // The owner's task row now counts the one closed (done) assignment: $75.
  await expect(ownerRow.getByRole("cell").nth(5)).toHaveText("$75")

  await signInAs("user2")
  await page.goto("/app/mis-tareas")
  await page.getByRole("tab", { name: "Pasadas" }).click()
  await page.waitForURL("**view=past")
  const pastRow = page.getByRole("row", { name: new RegExp(taskName) })
  await expect(pastRow).toBeVisible()
  await expect(pastRow.getByRole("cell").nth(5)).toHaveText("$75")
  // The past view stays read-only: no status select and no comments button.
  await expect(pastRow.getByRole("combobox")).toHaveCount(0)
  await expect(pastRow.getByRole("button")).toHaveCount(0)
})
