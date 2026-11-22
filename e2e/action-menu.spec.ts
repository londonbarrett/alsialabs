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
