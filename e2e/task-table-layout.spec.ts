import { test, expect } from "./fixtures"

const PROJECT_ID = "10000000-0000-4000-8000-000000000001"
const PROJECT_URL = `/app/proyectos/${PROJECT_ID}`

function toDateInput(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

test("expanding a task does not reflow the tasks table", async ({
  page,
  signInAs,
}) => {
  test.setTimeout(120_000)
  const taskName = `E2E task layout with a deliberately long name ${Date.now()}`

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
  const titleBox = await taskRow
    .getByText(taskName, { exact: true })
    .boundingBox()
  const caretBox = await taskRow
    .getByRole("button", { name: "Detalles de asignados" })
    .boundingBox()
  const titleCenter = (titleBox?.y ?? 0) + (titleBox?.height ?? 0) / 2
  const caretCenter = (caretBox?.y ?? 0) + (caretBox?.height ?? 0) / 2
  expect(Math.abs(titleCenter - caretCenter)).toBeLessThan(12)
  expect(titleBox?.height ?? 0).toBeGreaterThan(24)
  const nameColumnWidth = (
    await taskRow.getByRole("cell").nth(0).boundingBox()
  )?.width
  expect(nameColumnWidth ?? 999).toBeLessThan(220)

  const centerDiffs = await Promise.all([
    taskRow.getByRole("cell").nth(1).evaluate((cell) => {
      const child = cell.firstElementChild?.firstElementChild
      if (!child) return 999
      const cellBox = cell.getBoundingClientRect()
      const childBox = child.getBoundingClientRect()
      return Math.abs(
        cellBox.left + cellBox.width / 2 - (childBox.left + childBox.width / 2)
      )
    }),
    taskRow.getByRole("cell").nth(3).evaluate((cell) => {
      const child = cell.firstElementChild?.firstElementChild
      if (!child) return 999
      const cellBox = cell.getBoundingClientRect()
      const childBox = child.getBoundingClientRect()
      return Math.abs(
        cellBox.left + cellBox.width / 2 - (childBox.left + childBox.width / 2)
      )
    }),
  ])
  expect(centerDiffs.every((diff) => diff < 4)).toBe(true)

  const widthsBefore = await taskRow
    .getByRole("cell")
    .evaluateAll((cells) =>
      cells.map((cell) => Math.round(cell.getBoundingClientRect().width))
    )
  // Clicking the row (not just the caret) expands assignments.
  await taskRow.getByText(taskName, { exact: true }).click()
  await expect(
    taskRow.getByRole("button", { name: "Detalles de asignados" })
  ).toHaveAttribute("aria-expanded", "true")
  const widthsAfter = await taskRow
    .getByRole("cell")
    .evaluateAll((cells) =>
      cells.map((cell) => Math.round(cell.getBoundingClientRect().width))
    )

  expect(widthsAfter).toEqual(widthsBefore)

  // Headers must not overlap or overflow; scope to this row's table because
  // TasksCard mounts both the Open and Archived tables.
  const headers = await taskRow.evaluate((row) => {
    const cells = Array.from(
      row.closest("table")!.querySelectorAll("thead th")
    )
    return {
      overlap: cells.slice(1).map(
        (cell, index) =>
          cells[index].getBoundingClientRect().right -
          cell.getBoundingClientRect().left
      ),
      overflow: cells.map((cell) => cell.scrollWidth - cell.clientWidth),
    }
  })
  expect(headers.overlap.every((overlap) => overlap <= 1)).toBe(true)
  expect(headers.overflow.every((overflow) => overflow <= 1)).toBe(true)

  // The assignment's assignee/name stays left-aligned.
  const assignmentRow = taskRow.locator("xpath=following-sibling::tr[1]")
  const assigneeInset = await assignmentRow
    .getByRole("cell")
    .nth(0)
    .evaluate((cell) => {
      const child = cell.firstElementChild
      if (!child) return 999
      return (
        child.getBoundingClientRect().left - cell.getBoundingClientRect().left
      )
    })
  expect(assigneeInset).toBeLessThan(40)

  // The assignment's status control is centered too.
  const statusCentered = await assignmentRow
    .getByRole("cell")
    .nth(2)
    .evaluate((cell) => {
      const child = cell.firstElementChild?.firstElementChild
      if (!child) return false
      const cellBox = cell.getBoundingClientRect()
      const childBox = child.getBoundingClientRect()
      return (
        Math.abs(
          cellBox.left + cellBox.width / 2 - (childBox.left + childBox.width / 2)
        ) < 4
      )
    })
  expect(statusCentered).toBe(true)

  // The assignment's due date sits under the task's Due date column.
  const taskDueCell = await taskRow.getByRole("cell").nth(4).boundingBox()
  const assignmentDueCell = await assignmentRow
    .getByRole("cell")
    .nth(4)
    .boundingBox()
  expect(
    Math.abs((taskDueCell?.x ?? 0) - (assignmentDueCell?.x ?? 0))
  ).toBeLessThan(2)

  // The status summary only reports open and closed counts, not detail labels.
  await assignmentRow.getByRole("combobox").click()
  await page.getByRole("option", { name: "Bloqueado" }).click()
  await expect(page.getByText("Estado actualizado").first()).toBeVisible()
  await expect(taskRow).toContainText("1 abierta")
  await expect(taskRow).not.toContainText("bloqueada")

  await page.screenshot({ path: "/tmp/task-table-expanded.png" })
})
