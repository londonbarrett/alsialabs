import { test, expect } from "./fixtures"

const PROJECT_ID = "10000000-0000-4000-8000-000000000001"
const PROJECT_URL = `/app/proyectos/${PROJECT_ID}`
const TASK_NAME = "E2E weekly report"

test("completing a repeating occurrence spawns the next one", async ({
  page,
  signInAs,
}) => {
  await signInAs("user2")
  await page.goto("/app/mis-tareas")

  const activeRow = page.getByRole("row", { name: new RegExp(TASK_NAME) })
  await expect(activeRow).toBeVisible()
  await expect(activeRow.getByText("Recurrente")).toBeVisible()

  // The owner closes the occurrence; the repeat cascade creates the next.
  await signInAs("admin")
  await page.goto(PROJECT_URL)
  const ownerRow = page.getByRole("row", { name: new RegExp(TASK_NAME) })
  await ownerRow.getByRole("combobox").click()
  await page.getByRole("option", { name: "Completado" }).click()
  // The row flips optimistically; the toast only lands once the action has
  // committed the completion AND spawned the next occurrence.
  await expect(page.getByText("Siguiente ocurrencia creada")).toBeVisible()

  // The assignee: the closed occurrence is in Past, the fresh one in Active.
  await signInAs("user2")
  await page.goto("/app/mis-tareas")
  await expect(
    page.getByRole("row", { name: new RegExp(TASK_NAME) })
  ).toHaveCount(1)

  await page.getByRole("tab", { name: "Pasadas" }).click()
  await page.waitForURL("**view=past")
  await expect(
    page.getByRole("row", { name: new RegExp(TASK_NAME) })
  ).toHaveCount(1)
})
