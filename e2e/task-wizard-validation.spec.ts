import { test, expect } from "./fixtures"

const PROJECT_ID = "10000000-0000-4000-8000-000000000001"
const PROJECT_URL = `/app/proyectos/${PROJECT_ID}`

test("the wizard validates details before scheduling and dates on the schedule step", async ({
  page,
  signInAs,
}) => {
  await signInAs("user1")
  await page.goto(PROJECT_URL)
  await page.getByRole("button", { name: "Agregar Tarea" }).click()
  const dialog = page.getByRole("dialog")
  await expect(dialog).toBeVisible()

  // The step is titled Scheduling, and its content (window + repeat switch)
  // lives only there — details owns no dates.
  await expect(dialog.getByText("Programación")).toBeVisible()
  await expect(dialog.getByLabel("Fecha de inicio")).toHaveCount(0)
  await expect(dialog.getByText("Repetir esta tarea")).toHaveCount(0)

  // A blank name cannot pass to the schedule step.
  await dialog.getByRole("button", { name: "Continuar" }).click()
  await expect(
    dialog.getByText("El nombre de la tarea es obligatorio")
  ).toBeVisible()
  await expect(dialog.getByText("Repetir esta tarea")).toHaveCount(0)

  // Valid details open the Scheduling step, which owns the date window.
  await dialog.getByLabel("Nombre de la tarea").fill("E2E wizard gate")
  await dialog.getByRole("button", { name: "Continuar" }).click()
  await expect(dialog.getByText("Repetir esta tarea")).toBeVisible()
  await expect(dialog.getByLabel("Fecha de inicio")).toBeVisible()
  await expect(dialog.getByLabel("Fecha de vencimiento")).toBeVisible()

  // A broken window blocks the create, reported in place.
  await dialog.getByLabel("Fecha de inicio").fill("2026-11-10")
  await dialog.getByLabel("Fecha de vencimiento").fill("2026-11-09")
  await dialog.getByRole("button", { name: "Crear Tarea" }).click()
  await expect(
    dialog.getByText(
      "La fecha de fin debe ser posterior a la fecha de inicio"
    )
  ).toBeVisible()
  await expect(dialog).toBeVisible()

  // A fixed window goes through.
  await dialog.getByLabel("Fecha de vencimiento").fill("2026-11-10")
  await dialog.getByRole("button", { name: "Crear Tarea" }).click()
  await expect(dialog).toBeHidden()
  await expect(
    page.getByRole("row", { name: /E2E wizard gate/ })
  ).not.toHaveCount(0)
})

function toDateInput(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

test("a repeating schedule shows dates anchored on a start date that defaults to today", async ({
  page,
  signInAs,
}) => {
  const today = toDateInput(new Date())
  // Unique per attempt: a retry must not collide with the row the failed
  // attempt left behind (the seed also clears them before the next run).
  const taskName = `E2E repeat gate ${Date.now()}`

  await signInAs("user1")
  await page.goto(PROJECT_URL)
  await page.getByRole("button", { name: "Agregar Tarea" }).click()
  const dialog = page.getByRole("dialog")

  await dialog.getByLabel("Nombre de la tarea").fill(taskName)
  await dialog.getByRole("button", { name: "Continuar" }).click()

  // One-off scheduling shows the full window first...
  await expect(dialog.getByLabel("Fecha de inicio")).toBeVisible()
  await expect(dialog.getByLabel("Fecha de vencimiento")).toBeVisible()

  // ...and switching to a repeating schedule swaps it for the anchor date
  // (defaulting to today), the optional end of the schedule, and the
  // occurrence time.
  await dialog.getByRole("switch").click()
  await expect(dialog.getByLabel("Fecha de inicio")).toHaveValue(today)
  await expect(dialog.getByLabel("Fecha de vencimiento")).toBeVisible()
  await expect(dialog.getByLabel("Realizar a las")).toBeVisible()

  await dialog.getByLabel("Fecha de vencimiento").fill("2026-12-31")
  await dialog.getByLabel("Realizar a las").fill("09:00")
  await dialog.getByRole("button", { name: "Lun" }).click()
  await dialog.getByRole("button", { name: "Crear Tarea" }).click()
  await expect(dialog).toBeHidden()

  // Editing it: the stored anchor and times are there, still no due date.
  const row = page.getByRole("row", { name: new RegExp(taskName) })
  await expect(row).toBeVisible()
  await row
    .getByRole("button", { name: `Acciones para ${taskName}` })
    .click()
  await page.getByRole("menuitem", { name: `Editar ${taskName}` }).click()
  await dialog.getByRole("button", { name: "Continuar" }).click()
  await expect(dialog.getByLabel("Fecha de inicio")).toHaveValue(today)
  await expect(dialog.getByLabel("Fecha de vencimiento")).toHaveValue(
    "2026-12-31"
  )
  await expect(dialog.getByLabel("Realizar a las")).toBeVisible()
})
