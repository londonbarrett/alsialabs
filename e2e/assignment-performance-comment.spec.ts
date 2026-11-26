import { test, expect } from "./fixtures"

const PROJECT_URL = "/app/proyectos/10000000-0000-4000-8000-000000000001"

function toDateInput(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

test("an owner stages cost and comment, sees both indicators, and both persist", async ({
  page,
  signInAs,
}) => {
  // Two server mutations plus two reloads; the dev server compiles routes on
  // demand and the suite shares it with parallel workers.
  test.setTimeout(120_000)
  const taskName = `E2E performance note ${Date.now()}`
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

  await expect(page.getByText("Tarea creada")).toBeVisible({
    timeout: 20_000,
  })
  await page.reload()

  const taskRow = page.getByRole("row", { name: new RegExp(taskName) })
  await expect(taskRow).toBeVisible()
  await taskRow
    .getByRole("button", { name: "Detalles de asignados" })
    .click()
  const detailRow = taskRow.locator("xpath=following-sibling::tr[1]")
  const costInput = detailRow.getByRole("textbox", { name: "Costo" })
  await expect(costInput).toHaveValue("$100")

  // Cost and note are local drafts: nothing is written until Save is clicked.
  await costInput.fill("150")
  const noteInput = detailRow.getByRole("textbox", {
    name: "Comentario",
  })
  await noteInput.fill("Delivered early")
  const saveButton = detailRow.getByRole("button", { name: "Guardar cambios" })
  await expect(saveButton).toBeVisible()

  await saveButton.click()
  // While the combined write is in flight the Save button shows the Spinner
  // and the global loading bar is active. The bar is always mounted (opacity
  // 0 when idle), so aria-busy is the signal that it is actually running.
  await expect(detailRow.getByRole("status")).toBeVisible()
  await expect(page.getByRole("progressbar")).toHaveAttribute(
    "aria-busy",
    "true"
  )
  await expect(saveButton).toBeHidden()
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
  const reloadedDetailRow = reloadedRow.locator(
    "xpath=following-sibling::tr[1]"
  )
  await expect(
    reloadedDetailRow.getByRole("textbox", { name: "Costo" })
  ).toHaveValue("$150")
  await expect(
    reloadedDetailRow.getByRole("textbox", {
      name: "Comentario",
    })
  ).toHaveValue("Delivered early")
})

test("a collaborator reads the note inline in My Tasks and cannot edit it", async ({
  page,
  signInAs,
}) => {
  // One task creation plus one server mutation; allow room for cold compiles.
  test.setTimeout(120_000)
  const taskName = `E2E collaborator note ${Date.now()}`
  const today = toDateInput(new Date())

  // The owner records the note on a task assigned to E2E Collaborator (user2).
  await signInAs("user1")
  await page.goto(PROJECT_URL)
  await page.getByRole("button", { name: "Agregar Tarea" }).click()
  const dialog = page.getByRole("dialog")
  await dialog.getByLabel("Costo base por asignación").fill("100")
  await dialog.getByLabel("Nombre de la tarea").fill(taskName)
  await dialog.getByRole("button", { name: "Agregar asignado" }).click()
  await page
    .getByRole("menuitemcheckbox", { name: /E2E Collaborator/ })
    .click()
  await dialog.getByRole("button", { name: "Continuar" }).click()
  await dialog.getByLabel("Fecha de vencimiento").fill(today)
  await dialog.getByRole("button", { name: "Crear Tarea" }).click()
  await expect(dialog).toBeHidden()
  await expect(page.getByText("Tarea creada")).toBeVisible({
    timeout: 20_000,
  })
  await page.reload()

  const taskRow = page.getByRole("row", { name: new RegExp(taskName) })
  await expect(taskRow).toBeVisible()
  await taskRow
    .getByRole("button", { name: "Detalles de asignados" })
    .click()
  const detailRow = taskRow.locator("xpath=following-sibling::tr[1]")
  await detailRow
    .getByRole("textbox", { name: "Comentario" })
    .fill("Delivered early")
  await detailRow.getByRole("button", { name: "Guardar cambios" }).click()
  await expect(page.getByText("Comentario actualizado")).toBeVisible({
    timeout: 20_000,
  })

  // The assigned collaborator reads the note inline, with no editing controls.
  await signInAs("user2")
  await page.goto("/app/mis-tareas")
  const myTaskRow = page.getByRole("row", { name: new RegExp(taskName) })
  await expect(myTaskRow).toBeVisible()
  await expect(myTaskRow.getByText("Delivered early")).toBeVisible()
  await expect(
    myTaskRow.getByRole("textbox", { name: "Comentario" })
  ).toHaveCount(0)
  await expect(
    myTaskRow.getByRole("button", { name: "Guardar cambios" })
  ).toHaveCount(0)
})
