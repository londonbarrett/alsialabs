import { test, expect } from "./fixtures"

const project = "/app/proyectos/10000000-0000-4000-8000-000000000001"

function toDateInput(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

test("compare task row heights across tabs", async ({ page, signInAs }) => {
  const taskName = `E2E spacing ${Date.now()}`
  await signInAs("user1")
  await page.goto(project)
  await page.getByRole("button", { name: "Agregar Tarea" }).click()
  const dialog = page.getByRole("dialog", { name: "Agregar Tarea" })
  await dialog.getByLabel("Nombre de la tarea").fill(taskName)
  await dialog.getByRole("button", { name: "Agregar asignado" }).click()
  await page
    .getByRole("menuitemcheckbox", { name: /user1@test\.local/ })
    .click()
  await dialog.getByRole("button", { name: "Continuar" }).click()
  await dialog.getByLabel("Fecha de vencimiento").fill(toDateInput(new Date()))
  await dialog.getByRole("button", { name: "Crear Tarea" }).click()
  await expect(dialog).toBeHidden()
  await expect(page.getByText("Tarea creada")).toBeVisible({ timeout: 20_000 })
  await page.reload()

  const taskRow = page.getByRole("row", { name: new RegExp(taskName) })
  await taskRow.getByRole("button", { name: "Detalles de asignados" }).click()
  const openRow = taskRow.locator("xpath=following-sibling::tr[1]")
  await openRow.getByRole("combobox").click()
  await page.getByRole("option", { name: "Completado" }).click()
  await expect(page.getByText("Estado actualizado")).toBeVisible()
  await page.reload()

  const finalizedTaskRow = page.getByRole("row", { name: new RegExp(taskName) })
  const taskHeight = (await finalizedTaskRow.boundingBox())?.height

  await page.goto(`${project}/gastos`)
  const expenseRow = page.getByRole("row", { name: new RegExp(taskName) })
  await expect(expenseRow).toBeVisible()
  const expenseHeight = (await expenseRow.boundingBox())?.height

  // Different padding values are fine; the rendered row heights must match.
  expect(Math.abs((taskHeight ?? 0) - (expenseHeight ?? 0))).toBeLessThan(2)
})
