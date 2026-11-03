import { createReadStream, existsSync } from "node:fs"
import { Readable } from "node:stream"

import { resolveBackupSqlPath } from "@/lib/backup/files"
import { auth, isSuperUser } from "@/lib/auth"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ filename: string }> }
) {
  const session = await auth()
  if (!session?.user || !isSuperUser(session)) {
    return new Response(null, { status: 403 })
  }

  const { filename } = await params

  let path: string
  try {
    path = resolveBackupSqlPath(filename)
  } catch {
    return new Response(null, { status: 404 })
  }

  if (!existsSync(path)) {
    return new Response(null, { status: 404 })
  }

  const stream = Readable.toWeb(createReadStream(path))
  return new Response(stream as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/sql",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  })
}
