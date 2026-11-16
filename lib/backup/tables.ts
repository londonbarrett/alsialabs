import { sql } from "drizzle-orm"

import { throwActionError } from "@/lib/action-result"
import { db } from "@/lib/drizzle/client"

export async function listPublicTables(): Promise<string[]> {
  const rows = await db.execute(
    sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name`
  )
  return rows.map((row) => (row as { table_name: string }).table_name)
}

export async function listDependentViews(
  tableNames: string[]
): Promise<string[]> {
  if (tableNames.length === 0) return []
  const rows = await db.execute(sql`
    WITH RECURSIVE dependent AS (
      SELECT DISTINCT d.oid, d.relname
      FROM pg_depend dep
      JOIN pg_rewrite rw ON dep.objid = rw.oid
      JOIN pg_class d ON rw.ev_class = d.oid
      JOIN pg_class s ON dep.refobjid = s.oid
      JOIN pg_namespace n ON s.relnamespace = n.oid
      WHERE n.nspname = 'public'
        AND dep.deptype = 'n'
        AND s.relname = ANY(${sql.param(tableNames)})
        AND d.relname <> ALL(${sql.param(tableNames)})
      UNION
      SELECT DISTINCT d.oid, d.relname
      FROM dependent p
      JOIN pg_depend dep ON dep.refobjid = p.oid
      JOIN pg_rewrite rw ON dep.objid = rw.oid
      JOIN pg_class d ON rw.ev_class = d.oid
      WHERE dep.deptype = 'n'
        AND d.relkind = 'v'
        AND d.relname <> ALL(${sql.param(tableNames)})
    )
    SELECT DISTINCT relname AS view_name FROM dependent
  `)
  return rows.map((row) => (row as { view_name: string }).view_name)
}

export function validateTableSelection(
  selected: string[],
  available: string[]
): void {
  if (selected.length === 0) throwActionError("INVALID_TABLE_SELECTION")
  const allowed = new Set(available)
  for (const name of selected) {
    if (!allowed.has(name)) throwActionError("INVALID_TABLE_SELECTION")
  }
}
