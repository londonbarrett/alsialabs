import { test, expect } from "./fixtures"

const PROJECT_ID = "10000000-0000-4000-8000-000000000001"
const PROJECT_URL = `/app/proyectos/${PROJECT_ID}`
const PROJECT_NAME = "E2E Roles Project"

test("owner adds a collaborator who cannot see the project", async ({
  page,
  signInAs,
}) => {
  await signInAs("admin")
  await page.goto(`${PROJECT_URL}/personas`)

  // The invite combobox searches by email for users not on the project yet.
  await page.getByPlaceholder("Agregar colaborador...").fill("user4")
  await page.getByRole("option", { name: /user4@test\.local/ }).click()
  await page
    .getByRole("button", { name: "Invitar", disabled: false })
    .click()
  await expect(page.getByText("user4@test.local")).toBeVisible()
  // Wait for the server commit before a different user reads the membership.
  await expect(page.getByText("Colaborador agregado")).toBeVisible()

  // The new collaborator: absent from the projects section...
  await signInAs("user4")
  await page.goto("/app/proyectos")
  await expect(page.getByText(PROJECT_NAME)).toHaveCount(0)

  // ...and the project route refuses them.
  await page.goto(PROJECT_URL)
  await expect(page.getByText("403")).toBeVisible()
  await expect(page.getByText(PROJECT_NAME)).toHaveCount(0)
})

test("an admin manages tasks but cannot change the project or its admins", async ({
  page,
  signInAs,
}) => {
  await signInAs("user1")

  // Admin membership keeps the project visible in the list.
  await page.goto("/app/proyectos")
  await expect(page.getByText(PROJECT_NAME)).toBeVisible()

  // Managing work: the task wizard opens.
  await page.goto(PROJECT_URL)
  await page.getByRole("button", { name: "Agregar Tarea" }).click()
  await expect(page.getByRole("dialog")).toBeVisible()
  await page.keyboard.press("Escape")

  // Project details and deletion stay with the owner.
  await page.goto(`${PROJECT_URL}/detalles`)
  await expect(
    page.getByRole("button", { name: "Editar" })
  ).toHaveCount(0)
  await expect(
    page.getByRole("button", { name: "Eliminar proyecto" })
  ).toHaveCount(0)

  // Role changes on admins stay with the owner.
  await page.goto(`${PROJECT_URL}/personas`)
  await expect(page.getByLabel("Hacer administrador")).toHaveCount(0)
  await expect(page.getByLabel("Hacer colaborador")).toHaveCount(0)
})
