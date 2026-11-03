import { describe, expect, it } from "vitest"

import { rewriteLoopbackHost, sanitizeDbUrl } from "./db-url"

describe("lib/backup/db-url", () => {
  it("keeps whitelisted params and drops the real supa param", () => {
    const out = sanitizeDbUrl(
      "postgres://u:p@host:5432/db?sslmode=require&supa=base-pooler.x"
    )
    expect(out).toBe("postgres://u:p@host:5432/db?sslmode=require")
  })
  it("preserves whitelisted param bytes exactly (no + encoding of spaces)", () => {
    const out = sanitizeDbUrl(
      "postgres://u:p@h:5432/db?sslmode=require&options=-c%20search_path&supa=x"
    )
    expect(out).toBe(
      "postgres://u:p@h:5432/db?sslmode=require&options=-c%20search_path"
    )
  })
  it("keeps credentials, port, and path untouched", () => {
    const out = sanitizeDbUrl(
      "postgres://user:secret@aws-1.pooler.supabase.com:6543/postgres?sslmode=require&options=-c%20search_path"
    )
    expect(out).toContain(
      "user:secret@aws-1.pooler.supabase.com:6543/postgres"
    )
    expect(out).toContain("sslmode=require")
    expect(out).toContain("options=")
  })
  it("rewrites only loopback hosts", () => {
    expect(
      rewriteLoopbackHost(
        "postgres://alsia:alsia_test@localhost:55432/db"
      )
    ).toBe("postgres://alsia:alsia_test@host.docker.internal:55432/db")
    expect(
      rewriteLoopbackHost(
        "postgres://u:p@aws-1.pooler.supabase.com:5432/db"
      )
    ).not.toContain("host.docker.internal")
  })
})
