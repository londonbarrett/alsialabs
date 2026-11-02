import { test, expect } from "./fixtures"

const PROJECT_ID = "10000000-0000-4000-8000-000000000001"
const PROJECT_URL = `/app/proyectos/${PROJECT_ID}`
const TASK_NAME = "E2E plan the launch"

test("a collaborator's assignment moves from active to past, read-only", async ({
  page,
  signInAs,
}) => {
  await signInAs("user2")
  await page.goto("/app/mis-tareas")

  const row = page.getByRole("row", { name: new RegExp(TASK_NAME) })
  await expect(row).toBeVisible()

  // Collaborators may pick from their three open statuses only.
  await row.getByRole("combobox").click()
  await expect(page.getByRole("option", { name: "En progreso" })).toBeVisible()
  await expect(page.getByRole("option", { name: "Completado" })).toHaveCount(0)
  await page.getByRole("option", { name: "En progreso" }).click()
  await expect(row.getByRole("combobox")).toContainText("En progreso")

  // The owner completes that assignment from the project task list, which
  // shows the assignee's name with their email underneath.
  await signInAs("admin")
  await page.goto(PROJECT_URL)
  const ownerRow = page.getByRole("row", { name: new RegExp(TASK_NAME) })
  await expect(ownerRow.getByText("E2E Collaborator")).toBeVisible()
  await expect(ownerRow.getByText("user2@test.local")).toBeVisible()
  await ownerRow.getByRole("combobox").click()
  await page.getByRole("option", { name: "Completado" }).click()
  // Optimistic UI flips immediately; the toast waits for the server commit.
  await expect(page.getByText("Estado actualizado")).toBeVisible()

  // Back under the collaborator: gone from Active, in Past and read-only.
  await signInAs("user2")
  await page.goto("/app/mis-tareas")
  await expect(
    page.getByRole("row", { name: new RegExp(TASK_NAME) })
  ).toHaveCount(0)

  await page.getByRole("tab", { name: "Pasadas" }).click()
  await page.waitForURL("**view=past")
  const pastRow = page.getByRole("row", { name: new RegExp(TASK_NAME) })
  await expect(pastRow).toBeVisible()
  await expect(pastRow.getByText("Completado")).toBeVisible()
  await expect(pastRow.getByRole("button")).toHaveCount(0)
})
