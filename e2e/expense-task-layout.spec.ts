import { test, expect } from "./fixtures"

const PROJECT_ID = "10000000-0000-4000-8000-000000000001"
const PROJECT_URL = `/app/proyectos/${PROJECT_ID}`
const GASTOS_URL = `${PROJECT_URL}/gastos`

function toDateInput(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

test("expanded task rows keep the expenses table aligned", async ({
  page,
  signInAs,
}) => {
  test.setTimeout(120_000)
  const taskName = `E2E layout ${Date.now()}`

  await signInAs("user1")
  await page.goto(PROJECT_URL)
  await page.getByRole("button", { name: "Agregar Tarea" }).click()
  const dialog = page.getByRole("dialog", { name: "Agregar Tarea" })
  await dialog.getByLabel("Costo base por asignación").fill("100")
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
  await expect(page.getByText("Estado actualizado")).toBeVisible({
    timeout: 20_000,
  })

  await page.goto(GASTOS_URL)
  const expenseRow = page.getByRole("row", { name: new RegExp(taskName) })
  const toggle = expenseRow.getByRole("button", {
    name: "Detalles de asignados",
  })

  // The caret shares the Actions column with expense action menus, centered.
  const actionCell = expenseRow.getByRole("cell").last()
  await expect(actionCell.getByRole("button")).toHaveCount(1)
  const caretOffset = await actionCell.evaluate(
    (cell, button) => {
      const cellBox = cell.getBoundingClientRect()
      const buttonBox = (button as HTMLElement).getBoundingClientRect()
      return Math.abs(
        cellBox.left + cellBox.width / 2 - (buttonBox.left + buttonBox.width / 2)
      )
    },
    await toggle.elementHandle()
  )
  expect(caretOffset).toBeLessThan(8)

  // A collapsed caret offers the up-down list chevrons, plus a tooltip.
  expect(await toggle.locator("svg").getAttribute("class")).toContain(
    "list-chevrons-up-down"
  )
  await toggle.hover()
  await expect(page.getByText("Mostrar asignaciones")).toBeVisible()

  // Actions column is centered, including its header.
  const headersAlign = await page.evaluate(() =>
    Array.from(document.querySelectorAll("thead th")).map(
      (cell) => getComputedStyle(cell).textAlign
    )
  )
  expect(headersAlign.at(-1)).toBe("center")
  expect(headersAlign.slice(1).every((value) => value === "center")).toBe(true)

  const taskCellAlign = await expenseRow
    .getByRole("cell")
    .evaluateAll((cells) =>
      cells.slice(1).map((cell) => getComputedStyle(cell).textAlign)
    )
  expect(taskCellAlign.every((value) => value === "center")).toBe(true)

  // Task dates use the tasks tab's locale-aware, date-only format.
  await expect(expenseRow.getByRole("cell").nth(3)).toContainText("nov")
  await expect(expenseRow.getByRole("cell").nth(3)).not.toContainText("2026-")
  await expect(expenseRow.getByRole("cell").nth(0)).toContainText("1 cerrada")

  const sortDates = await page
    .locator("table tbody tr[data-sort-date]")
    .evaluateAll((rows) =>
      rows.map((row) => row.getAttribute("data-sort-date") ?? "")
    )
  expect(sortDates).toEqual([...sortDates].sort().reverse())

  const widthsBefore = await expenseRow
    .getByRole("cell")
    .evaluateAll((cells) =>
      cells.map((cell) => Math.round(cell.getBoundingClientRect().width))
    )

  // Clicking anywhere on the task row expands it.
  await expenseRow.getByText(taskName).click()
  await expect(toggle).toHaveAttribute("aria-expanded", "true")
  expect(await toggle.locator("svg").getAttribute("class")).toContain(
    "list-chevrons-down-up"
  )
  await toggle.hover()
  await expect(page.getByText("Ocultar asignaciones")).toBeVisible()
  const assignmentRow = expenseRow.locator("xpath=following-sibling::tr[1]")
  const assignmentAlign = await assignmentRow
    .getByRole("cell")
    .evaluateAll((all) =>
      all.slice(1, 3).map((cell) => getComputedStyle(cell).textAlign)
    )
  expect(assignmentAlign).toEqual(["center", "center"])
  const cells = assignmentRow.getByRole("cell")

  // Expanding must not resize any column.
  const widthsAfter = await expenseRow
    .getByRole("cell")
    .evaluateAll((cells) =>
      cells.map((cell) => Math.round(cell.getBoundingClientRect().width))
    )
  expect(widthsAfter).toEqual(widthsBefore)

  // Cost belongs under Monto, status under Tipo, occurrence under Fecha.
  await expect(cells.nth(2).getByRole("textbox", { name: "Costo" })).toBeVisible()
  await expect(cells.nth(1)).toContainText("Completado")
  await expect(cells.nth(3)).toContainText("nov")
  await expect(cells.nth(3)).not.toContainText(":")

  // The cost input is 20px wider than the old 96px w-24.
  const inputWidth = await cells
    .nth(2)
    .getByRole("textbox", { name: "Costo" })
    .evaluate((el) => Math.round(el.getBoundingClientRect().width))
  expect(inputWidth).toBeGreaterThanOrEqual(116)

  await page.screenshot({ path: "/tmp/expense-task-expanded.png" })
})
