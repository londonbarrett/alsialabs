import { test, expect } from "./fixtures"

test("row actions are inline icons on desktop and a dropdown on mobile", async ({
  page,
  signInAs,
}) => {
  await signInAs("super")
  await page.goto("/app/categorias")

  const inlineEdit = page.locator('button[aria-label="Editar"]').first()
  const menuTrigger = page
    .locator('button[aria-label^="Acciones para"]')
    .first()

  await page.setViewportSize({ width: 1280, height: 800 })
  await expect(inlineEdit).toBeVisible()
  await expect(menuTrigger).toBeHidden()

  await page.setViewportSize({ width: 390, height: 844 })
  await expect(inlineEdit).toBeHidden()
  await expect(menuTrigger).toBeVisible()
})

test("task table comments and actions columns are labelled and centred", async ({
  page,
  signInAs,
}) => {
  await signInAs("user1")
  await page.goto("/app/proyectos/10000000-0000-4000-8000-000000000001")

  const comments = page.getByRole("columnheader", { name: "Comentarios" }).first()
  const actions = page.getByRole("columnheader", { name: "Acciones" }).first()

  await expect(comments).toBeVisible()
  await expect(comments).toHaveCSS("text-align", "center")
  await expect(actions).toHaveCSS("text-align", "center")

  // Seeded assignments belong to user2, not user1.
  await signInAs("user2")
  await page.goto("/app/mis-tareas")
  const myTasksComments = page
    .getByRole("columnheader", { name: "Comentarios" })
    .first()
  await expect(myTasksComments).toBeVisible()
  await expect(myTasksComments).toHaveCSS("text-align", "center")
})

test("the delete icon has the same resting background as the other icons", async ({
  page,
  signInAs,
}) => {
  await signInAs("super")
  await page.goto("/app/categorias")
  await page.setViewportSize({ width: 1280, height: 800 })

  const edit = page.locator('button[aria-label="Editar"]').first()
  const del = page.locator('button[aria-label="Eliminar"]').first()
  await expect(del).toBeVisible()

  const [editStyle, deleteStyle] = await Promise.all([
    edit.evaluate((el) => {
      const s = getComputedStyle(el)
      return { background: s.backgroundColor, color: s.color }
    }),
    del.evaluate((el) => {
      const s = getComputedStyle(el)
      return { background: s.backgroundColor, color: s.color }
    }),
  ])

  expect(deleteStyle.background).toBe(editStyle.background)
  expect(deleteStyle.color).not.toBe(editStyle.color)
})
