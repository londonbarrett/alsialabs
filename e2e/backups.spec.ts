import { test, expect } from "./fixtures"
import fs from "node:fs"
import path from "node:path"

const BACKUP_FILENAME_RE =
  /\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}(?:-\d+)?\.sql/

test("admin users cannot see or open the backups section", async ({
  page,
  signInAs,
}) => {
  await signInAs("admin")
  await page.goto("/app")
  await expect(
    page.getByRole("link", { name: "Respaldos" })
  ).toHaveCount(0)
  await page.goto("/app/backups")
  await expect(
    page.getByText("No tienes acceso a esta página.")
  ).toBeVisible()
})

test("super user creates, downloads, and restores a backup", async ({
  page,
  signInAs,
}) => {
  test.setTimeout(120_000)
  let createdFilename: string | null = null
  try {
    await signInAs("super")
    await page.goto("/app")
    await expect(
      page.getByRole("link", { name: "Respaldos" })
    ).toBeVisible()
    await page.goto("/app/backups")
    await expect(
      page.getByRole("heading", { name: "Respaldos" })
    ).toBeVisible()

    const selectAll = page.getByRole("switch", {
      name: "Seleccionar todo",
    })
    const roleSwitch = page.getByRole("switch", {
      name: "role",
      exact: true,
    })
    await expect(selectAll).toBeChecked()
    await roleSwitch.uncheck()
    await page.reload()
    await expect(selectAll).toBeChecked()

    await roleSwitch.uncheck()
    await page.getByRole("button", { name: "Crear respaldo" }).click()

    const firstRow = page
      .getByRole("row")
      .filter({ hasText: /\.sql/ })
      .first()
    await expect(firstRow).toBeVisible({ timeout: 60_000 })
    await expect(firstRow).toContainText(BACKUP_FILENAME_RE, {
      timeout: 60_000,
    })
    await expect(page.getByText("Respaldo creado")).toBeVisible({
      timeout: 60_000,
    })
    await expect(firstRow).not.toContainText("Desconocidas")
    const matched = (await firstRow.textContent())?.match(
      BACKUP_FILENAME_RE
    )
    expect(matched).not.toBeNull()
    const filename = matched![0]
    createdFilename = filename

    await page.reload()
    await expect(roleSwitch).not.toBeChecked()

    const downloadPromise = page.waitForEvent("download")
    await firstRow.getByRole("link", { name: "Descargar" }).click()
    const download = await downloadPromise
    expect(download.suggestedFilename()).toBe(filename)

    await firstRow.getByRole("button", { name: "Restaurar" }).click()
    const dialog = page.getByRole("dialog")
    const confirm = dialog.getByRole("button", {
      name: "Restaurar",
      exact: true,
    })
    await expect(confirm).toBeDisabled()
    await dialog.getByRole("textbox").fill("wrong-name.sql")
    await expect(confirm).toBeDisabled()
    await dialog.getByRole("textbox").fill(filename)
    await expect(confirm).toBeEnabled()
    await confirm.click()
    await expect(page.getByText("Respaldo restaurado")).toBeVisible({
      timeout: 60_000,
    })
  } finally {
    if (createdFilename !== null) {
      const dir = path.join(process.cwd(), "backups")
      if (fs.existsSync(dir)) {
        const stem = createdFilename.replace(/\.sql$/, "")
        for (const entry of fs.readdirSync(dir)) {
          if (entry.startsWith(stem)) {
            fs.rmSync(path.join(dir, entry), { force: true })
          }
        }
      }
    }
  }
})
