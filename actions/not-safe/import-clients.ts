"use server"

import { auth } from "@/lib/auth"
import { getEffectiveStoreId } from "@/actions/not-safe/stores"
import { db } from "@/lib/drizzle/client"
import { clientsTable } from "@/lib/drizzle/schema"
import { runAction, throwActionError } from "@/lib/action-result"
import { CsvRecordSchema } from "@/actions/schemas/import"
import { inArray } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import Papa from "papaparse"

const REQUIRED_COLUMNS = [
  "NAME",
  "PHONE",
  "LOCATION",
  "COMMENTS",
  "EMAIL",
]

export async function importClients(formData: FormData) {
  return runAction<{ importedCount: number }>(async () => {
    const session = await auth()
    if (!session?.user) throwActionError("UNAUTHORIZED")

    const file = formData.get("file")
    if (!(file instanceof File)) throwActionError("NO_FILE_PROVIDED")

    const text = await file.text()

    const parsed = Papa.parse<Record<string, string>>(text, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim().toUpperCase(),
    })

    if (parsed.errors.length > 0) throwActionError("VALIDATION_FAILED")

    if (parsed.data.length === 0) throwActionError("CSV_EMPTY")

    const headers = Object.keys(parsed.data[0])
    const missing = REQUIRED_COLUMNS.filter((c) => !headers.includes(c))
    if (missing.length > 0) throwActionError("MISSING_REQUIRED_COLUMNS")

    const phones = [
      ...new Set(parsed.data.map((r) => r.PHONE).filter(Boolean)),
    ]
    if (phones.length === 0) throwActionError("NO_VALID_ROWS")

    const existing = await db
      .select({ phone: clientsTable.phone })
      .from(clientsTable)
      .where(inArray(clientsTable.phone, phones))

    const existingPhones = new Set(existing.map((r) => r.phone))
    const effectiveStoreId = await getEffectiveStoreId()

    const toInsert: Array<{
      name: string
      phone: string
      location: string | null
      comments: string | null
      email: string | null
      store_id: string | null
    }> = []
    for (const row of parsed.data) {
      if (!row.PHONE || existingPhones.has(row.PHONE)) continue
      const result = CsvRecordSchema.safeParse({
        name: row.NAME,
        phone: row.PHONE,
        location: row.LOCATION,
        comments: row.COMMENTS,
        email: row.EMAIL,
      })
      if (!result.success) continue
      toInsert.push({
        name: result.data.name,
        phone: result.data.phone,
        location: result.data.location || null,
        comments: result.data.comments || null,
        email: result.data.email || null,
        store_id: effectiveStoreId,
      })
    }

    if (toInsert.length === 0) return { importedCount: 0 }

    await db.insert(clientsTable).values(toInsert)

    revalidatePath("/app/clientes")
    return { importedCount: toInsert.length }
  })
}
