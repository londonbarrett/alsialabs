import { test, expect } from "./fixtures"

const PROJECT_ID = "10000000-0000-4000-8000-000000000001"
const PROJECT_URL = `/app/proyectos/${PROJECT_ID}`

function toDateInput(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

function uniqueName(prefix: string): string {
  return `${prefix} ${Date.now()}`
}

// Roles: `user1` is the least-privileged seeded account that can still edit
// project data — its global "user" role owns projects/expenses permissions and
// it is an admin member of the seeded Roles project. `admin` is the
// least-privileged account with sales access for the invoice form.

test("a task cost of 12.50 persists and its row total shows cents", async ({
  page,
  signInAs,
}) => {
  // One create plus a reload; the shared dev server compiles routes on demand.
  test.setTimeout(120_000)
  const taskName = uniqueName("E2E decimal task")
  const today = toDateInput(new Date())

  await signInAs("user1")
  await page.goto(PROJECT_URL)
  await page.getByRole("button", { name: "Agregar Tarea" }).click()
  const dialog = page.getByRole("dialog", { name: "Agregar Tarea" })

  const costField = dialog.getByLabel("Costo base por asignación")
  await costField.fill("12.50")
  // The input round-trips the canonical decimal string back into a formatted
  // value, keeping the cents visible rather than collapsing to "$12".
  await expect(costField).toHaveValue("$12.50")
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

  // The assignment is still open, so the closed-only task total is $0; the
  // decimal itself is preserved on the assignment's Costo input below.
  await page.reload()
  const taskRow = page.getByRole("row", { name: new RegExp(taskName) })
  await expect(taskRow).toBeVisible()
  await expect(taskRow.getByRole("cell").nth(3)).toHaveText("$0")

  // The inline assignment cost input reads the persisted decimal string.
  await taskRow
    .getByRole("button", { name: "Detalles de asignados" })
    .click()
  const costCell = taskRow.locator("xpath=following-sibling::tr[1]")
  await expect(
    costCell.getByRole("textbox", { name: "Costo" })
  ).toHaveValue("$12.50")
})

test("an expense amount of 10.75 survives a reload", async ({
  page,
  signInAs,
}) => {
  test.setTimeout(120_000)
  const description = uniqueName("E2E decimal expense")
  const today = toDateInput(new Date())

  await signInAs("user1")
  await page.goto(`${PROJECT_URL}/gastos`)
  await page.getByRole("button", { name: "Agregar Gasto" }).click()
  const dialog = page.getByRole("dialog")

  await dialog.getByLabel("Descripción").fill(description)
  await dialog.locator("#categoryId").click()
  await page.getByRole("option", { name: "Suministros" }).click()

  const amountField = dialog.getByLabel("Monto")
  await amountField.fill("10.75")
  await expect(amountField).toHaveValue("$10.75")
  await dialog.getByLabel("Fecha").fill(today)
  await dialog.getByRole("button", { name: "Crear Gasto" }).click()
  await expect(dialog).toBeHidden()
  await expect(page.getByText("Gasto creado")).toBeVisible({
    timeout: 20_000,
  })

  await page.reload()
  const expenseRow = page.getByRole("row", { name: new RegExp(description) })
  await expect(expenseRow).toBeVisible()
  await expect(expenseRow.getByRole("cell").nth(2)).toHaveText("$10.75")
  // Dates use the same locale-aware, date-only format as the tasks tab.
  await expect(expenseRow.getByRole("cell").nth(3)).not.toContainText(today)

  // Reopening the form prefills the MoneyInput with the stored decimal.
  await expenseRow.getByRole("button", { name: "Editar" }).click()
  await expect(dialog.getByLabel("Monto")).toHaveValue("$10.75")
})

test("an invoice line-item price of 25.50 drives the displayed totals", async ({
  page,
  signInAs,
}) => {
  test.setTimeout(120_000)

  await signInAs("admin")
  await page.goto("/app/ventas")
  // The empty state repeats the header's create button; either opens it.
  await page.getByRole("button", { name: "Nueva Factura" }).first().click()
  const dialog = page.getByRole("dialog")

  // A service line needs no catalog product, so only the decimal price matters.
  await dialog.locator("#type").click()
  await page.getByRole("option", { name: "Servicio" }).click()
  await dialog
    .getByPlaceholder("Descripción del servicio")
    .fill("E2E decimal service")

  // The line-item MoneyInput is the only decimal input besides "Monto Pagado".
  const unitPrice = dialog.locator(
    'input[inputmode="decimal"]:not([id="paidAmount"])'
  )
  await unitPrice.fill("25.50")
  await expect(unitPrice).toHaveValue("$25.50")

  const lineRow = dialog.getByRole("row", {
    name: /E2E decimal service/,
  })
  // Description, qty, price, discount %, tax %, then the line total.
  await expect(lineRow.getByRole("cell").nth(5)).toHaveText("$25.50")

  // Quantity 1 with no discount or tax makes the grand total match the price.
  const grandTotal = dialog.getByText("Total", { exact: true }).locator("..")
  await expect(grandTotal.getByText("$25.50", { exact: true })).toBeVisible()
})

test("a project budget of 1500.50 renders with cents on the details page", async ({
  page,
  signInAs,
}) => {
  test.setTimeout(120_000)
  const projectName = uniqueName("E2E decimal budget")
  const today = toDateInput(new Date())

  await signInAs("user1")
  await page.goto("/app/proyectos")
  await page.getByRole("button", { name: "Agregar Proyecto" }).click()
  const dialog = page.getByRole("dialog")

  await dialog.getByLabel("Nombre").fill(projectName)
  await dialog.locator("#categoryId").click()
  await page.getByRole("option", { name: "Cultivo" }).click()
  await dialog.getByLabel("Fecha de inicio").fill(today)
  await dialog.getByLabel("Ubicación").fill("E2E decimal")
  // The project form now preselects CO for the es UI locale, which would make
  // the budget input use COP/es-CO. Pick US explicitly so this test keeps
  // verifying USD/en-US cents.
  await dialog.locator("#country").click()
  await page.getByRole("option", { name: /Estados Unidos/ }).click()

  const budgetField = dialog.getByLabel("Presupuesto")
  await budgetField.fill("1500.50")
  await expect(budgetField).toHaveValue("$1,500.50")

  await dialog.getByRole("radio", { name: "Azul" }).click()
  await dialog.getByRole("button", { name: "Crear Proyecto" }).click()
  await expect(dialog).toBeHidden()
  await expect(page.getByText("Proyecto creado")).toBeVisible({
    timeout: 20_000,
  })

  await page.reload()
  const projectLink = page.getByRole("link", { name: projectName })
  await expect(projectLink).toBeVisible()
  const href = await projectLink.getAttribute("href")
  expect(href).toBeTruthy()
  await page.goto(`${href}/detalles`)

  await expect(page.getByText("Detalles del Proyecto")).toBeVisible()
  const budgetLabel = page.getByText("Presupuesto", { exact: true })
  await expect(
    budgetLabel.locator("..").getByText("$1,500.50", { exact: true })
  ).toBeVisible()
})

test("Backspace on a grouped whole amount keeps the whole value before submit", async ({
  page,
  signInAs,
}) => {
  test.setTimeout(120_000)

  await signInAs("user1")
  await page.goto("/app/proyectos")
  await page.getByRole("button", { name: "Agregar Proyecto" }).click()
  const dialog = page.getByRole("dialog")
  // US keeps this test's en-US grouping assertions; the es-UI default is CO.
  await dialog.locator("#country").click()
  await page.getByRole("option", { name: /Estados Unidos/ }).click()
  const budgetField = dialog.getByLabel("Presupuesto")

  await budgetField.fill("1500")
  await expect(budgetField).toHaveValue("$1,500")

  // Caret is at the end after fill(). Backspace leaves the raw text "$1,50";
  // the comma is still grouping, so the value must become 150, not 1.50.
  await budgetField.press("Backspace")
  await expect(budgetField).toHaveValue("$150")

  // Pasting an already-grouped value over a grouped value keeps the grouping.
  await budgetField.fill("1500")
  await expect(budgetField).toHaveValue("$1,500")
  await budgetField.press("ControlOrMeta+A")
  await page.keyboard.insertText("$2,500")
  await expect(budgetField).toHaveValue("$2,500")
})

test("a whole-dollar cost still renders as $150 with no cents", async ({
  page,
  signInAs,
}) => {
  test.setTimeout(120_000)
  const taskName = uniqueName("E2E whole task")
  const today = toDateInput(new Date())

  await signInAs("user1")
  await page.goto(PROJECT_URL)
  await page.getByRole("button", { name: "Agregar Tarea" }).click()
  const dialog = page.getByRole("dialog", { name: "Agregar Tarea" })

  const costField = dialog.getByLabel("Costo base por asignación")
  await costField.fill("150")
  await expect(costField).toHaveValue("$150")
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
  // The assignment is still open, so the closed-only task total is $0.
  const totalCell = taskRow.getByRole("cell").nth(3)
  await expect(totalCell).toHaveText("$0")

  // The stored "150" must normalize back to whole dollars (no ".00" cents)
  // on edit. The edit dialog has a different title, so re-resolve it by its
  // generic role.
  await taskRow.getByRole("button", { name: "Editar", exact: true }).click()
  await expect(
    page.getByRole("dialog").getByLabel("Costo base por asignación")
  ).toHaveValue("$150")
})
