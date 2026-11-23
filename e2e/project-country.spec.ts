import type { BrowserContext, Locator, Page } from "@playwright/test"
import { test, expect } from "./fixtures"

const PROJECTS_URL = "/app/proyectos"
const DETAILS_SUFFIX = "/detalles"

// UI locale is pinned to English in these tests so the Intl.DisplayNames
// labels are deterministic. The country's own format locale is independent:
// US → USD/en-US, CO → COP/es-CO.
const US_COUNTRY = "United States" // Intl.DisplayNames("en", { type: "region" }).of("US")
const CO_COUNTRY = "Colombia" // Intl.DisplayNames("en", { type: "region" }).of("CO")
// Details page renders the derived ISO code plus its localized name.
const US_CURRENCY = "USD — US Dollar" // code + Intl.DisplayNames("en", { type: "currency" }).of("USD")
const CO_CURRENCY = "COP — Colombian Peso" // code + ...of("COP")

const USD_BUDGET = "$1,500"
const USD_SPEND = "$250"
// COP is a zero-fraction currency and es-CO groups with a dot. ICU uses a
// non-breaking space between the symbol and the amount, so match \s.
const COP_BUDGET = /\$\s*1\.500/
const COP_SPEND = /\$\s*250/

function toDateInput(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

function uniqueName(prefix: string): string {
  return `${prefix} ${Date.now()}`
}

async function setLocale(context: BrowserContext, locale: "en" | "es") {
  await context.addCookies([
    { name: "NEXT_LOCALE", value: locale, domain: "localhost", path: "/" },
  ])
}

/** The value next to a label in the details card's field grid. */
function detailValue(page: Page, label: string): Locator {
  return page.getByText(label, { exact: true }).locator("..").locator("p").last()
}

/** The single project card whose link points at this project. */
function projectCard(page: Page, name: string): Locator {
  return page
    .locator('[data-slot="card"]')
    .filter({ has: page.getByRole("link", { name, exact: true }) })
}

/** The card's Country <dd>, scoped to its <dt> label. */
function cardCountry(card: Locator): Locator {
  return card.locator("dl > div").filter({ hasText: "Country" }).locator("dd")
}

/** The card's Currency <dd>, scoped to its <dt> label. */
function cardCurrency(card: Locator): Locator {
  return card.locator("dl > div").filter({ hasText: "Currency" }).locator("dd")
}

/** The card's "spend / budget" line. */
function cardMoney(card: Locator): Locator {
  return card.locator("span.tabular-nums").filter({ hasText: "/" }).first()
}

/** Creates a US project with a 1500 budget; returns its detail-page href. */
async function createUsProject(
  page: Page,
  name: string,
  location: string
): Promise<string> {
  await page.goto(PROJECTS_URL)
  await page.getByRole("button", { name: "Add Project" }).click()
  const dialog = page.getByRole("dialog")

  await dialog.getByLabel("Name").fill(name)
  await dialog.locator("#categoryId").click()
  await page.getByRole("option", { name: "Crop" }).click()
  await dialog.getByLabel("Start Date").fill(toDateInput(new Date()))
  await dialog.locator("#country").click()
  await page.getByRole("option", { name: new RegExp(US_COUNTRY) }).click()
  await dialog.getByLabel("Location").fill(location)

  const budget = dialog.getByLabel("Budget")
  await budget.fill("1500")
  // Selecting US re-formats the derived currency in the money input itself.
  await expect(budget).toHaveValue(USD_BUDGET)

  await dialog.getByRole("radio", { name: "Blue" }).click()
  await dialog.getByRole("button", { name: "Create Project" }).click()
  await expect(dialog).toBeHidden()
  await expect(page.getByText("Project created")).toBeVisible({
    timeout: 20_000,
  })

  const link = page.getByRole("link", { name, exact: true })
  await expect(link).toBeVisible()
  const href = await link.getAttribute("href")
  expect(href).toBeTruthy()
  return href!
}

// Role: `user1` is the least-privileged seeded account that can create
// projects; the creator becomes the primary owner and can edit the project
// (see decimal-money.spec.ts for the same pattern).

test("a US project shows United States, USD and US-formatted money on both surfaces", async ({
  page,
  context,
  signInAs,
}) => {
  test.setTimeout(120_000)
  const name = uniqueName("E2E country US")
  const location = "E2E free-text location 42"

  await setLocale(context, "en")
  await signInAs("user1")
  const href = await createUsProject(page, name, location)
  await page.reload()

  // Project card: country label and USD budget from the country map.
  const card = projectCard(page, name)
  await expect(card).toBeVisible()
  await expect(cardCountry(card)).toHaveText(US_COUNTRY)
  await expect(cardCurrency(card)).toHaveText(US_CURRENCY)
  await expect(cardMoney(card)).toContainText(USD_BUDGET)
  // The free-text Location stays a separate, unchanged field on the card.
  await expect(card.locator("dd").filter({ hasText: location })).toHaveText(
    location
  )

  // Details page: country, derived read-only currency, USD budget, location.
  await page.goto(`${href}${DETAILS_SUFFIX}`)
  await expect(page.getByText("Project Details")).toBeVisible()
  await expect(detailValue(page, "Country")).toHaveText(US_COUNTRY)
  await expect(detailValue(page, "Currency")).toHaveText(US_CURRENCY)
  await expect(detailValue(page, "Budget")).toHaveText(USD_BUDGET)
  await expect(detailValue(page, "Location")).toHaveText(location)
})

test("editing a US project to Colombia updates both surfaces to COP/es-CO, including card spend", async ({
  page,
  context,
  signInAs,
}) => {
  test.setTimeout(120_000)
  const name = uniqueName("E2E country CO")
  const location = "E2E free-text location 99"

  await setLocale(context, "en")
  await signInAs("user1")
  const href = await createUsProject(page, name, location)

  // A spend is needed to prove the card's spend figure is re-formatted (not
  // converted) when the country changes. Amounts stay 1500 / 250 throughout.
  await page.goto(`${href}/gastos`)
  await page.getByRole("button", { name: "Add Expense" }).first().click()
  const expenseDialog = page.getByRole("dialog")
  await expenseDialog.getByLabel("Description").fill("E2E country expense")
  await expenseDialog.locator("#categoryId").click()
  await page.getByRole("option", { name: "Supplies" }).click()
  await expenseDialog.getByLabel("Amount").fill("250")
  await expenseDialog.getByLabel("Date").fill(toDateInput(new Date()))
  await expenseDialog.getByRole("button", { name: "Create Expense" }).click()
  await expect(expenseDialog).toBeHidden()
  await expect(page.getByText("Expense created")).toBeVisible({
    timeout: 20_000,
  })

  await page.goto(PROJECTS_URL)
  await expect(cardMoney(projectCard(page, name))).toContainText(USD_SPEND)

  // Edit the same project to Colombia.
  await page.goto(`${href}${DETAILS_SUFFIX}`)
  await page.getByRole("button", { name: "Edit", exact: true }).click()
  const dialog = page.getByRole("dialog")
  await expect(dialog).toBeVisible()
  await expect(dialog.locator("#country")).toContainText(US_COUNTRY)
  await dialog.locator("#country").click()
  await page.getByRole("option", { name: new RegExp(CO_COUNTRY) }).click()
  // Same stored amount, new derived currency/locale in the form.
  await expect(dialog.getByLabel("Budget")).toHaveValue(COP_BUDGET)
  await dialog.getByRole("button", { name: "Save Changes" }).click()
  await expect(dialog).toBeHidden()
  await expect(page.getByText("Project updated")).toBeVisible({
    timeout: 20_000,
  })
  await page.reload()

  // Details page reflects Colombia, COP and es-CO formatting.
  await expect(detailValue(page, "Country")).toHaveText(CO_COUNTRY)
  await expect(detailValue(page, "Currency")).toHaveText(CO_CURRENCY)
  await expect(detailValue(page, "Budget")).toHaveText(COP_BUDGET)
  // Location is still the same free-text value after the edit.
  await expect(detailValue(page, "Location")).toHaveText(location)

  // Card reflects the same values, including the spend figure.
  await page.goto(PROJECTS_URL)
  const card = projectCard(page, name)
  await expect(cardCountry(card)).toHaveText(CO_COUNTRY)
  await expect(cardCurrency(card)).toHaveText(CO_CURRENCY)
  await expect(cardMoney(card)).toContainText(COP_SPEND)
  await expect(cardMoney(card)).toContainText(COP_BUDGET)
})

test("a new project's Country select starts empty and is required", async ({
  page,
  context,
  signInAs,
}) => {
  test.setTimeout(120_000)
  await signInAs("user1")

  await setLocale(context, "es")
  await page.goto(PROJECTS_URL)
  await page.getByRole("button", { name: "Agregar Proyecto" }).click()
  const esDialog = page.getByRole("dialog")
  await expect(esDialog.locator("#country")).toContainText("País - Moneda")
  await expect(esDialog.locator("#country")).not.toContainText("Colombia")
  await esDialog.locator("#country").click()
  const countryPopup = page.locator('[data-slot="select-content"]')
  await expect(countryPopup).toBeVisible()
  expect(
    await countryPopup.evaluate(
      (element) => element.scrollWidth <= element.clientWidth
    )
  ).toBe(true)
  await page.keyboard.press("Escape")
  await esDialog.getByRole("button", { name: "Crear Proyecto" }).click()
  await expect(esDialog.getByText("El país es obligatorio")).toBeVisible()
  await esDialog.getByRole("button", { name: "Cancelar" }).click()
  await expect(esDialog).toBeHidden()

  // The app's locale switch writes the same NEXT_LOCALE cookie used above.
  await setLocale(context, "en")
  await page.reload()
  await page.getByRole("button", { name: "Add Project" }).click()
  const enDialog = page.getByRole("dialog")
  await expect(enDialog.locator("#country")).toContainText("Country - Currency")
  await expect(enDialog.locator("#country")).not.toContainText(US_COUNTRY)
  await enDialog.getByRole("button", { name: "Create Project" }).click()
  await expect(enDialog.getByText("Country is required")).toBeVisible()
  await enDialog.getByRole("button", { name: "Cancel" }).click()
})
