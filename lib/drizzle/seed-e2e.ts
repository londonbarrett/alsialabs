import crypto from "crypto"
import { spawnSync } from "child_process"
import { count, inArray } from "drizzle-orm"
import { db } from "./client"
import { rolesTable, userRolesTable, usersTable } from "./schema"

const TEST_URL =
  "postgresql://alsia:alsia_test@localhost:55432/alsia_test"

const e2eUsers = [
  { email: "admin@test.local", role: "admin" },
  { email: "retailer@test.local", role: "retailer" },
  { email: "user1@test.local", role: "user" },
  { email: "user2@test.local", role: "user" },
  { email: "user3@test.local", role: "user" },
  { email: "user4@test.local", role: "user" },
]

function runBaseSeed(): void {
  const result = spawnSync(
    "pnpm",
    ["exec", "tsx", "lib/drizzle/seed.ts"],
    {
      stdio: "inherit",
      env: {
        ...process.env,
        DATABASE_URL: TEST_URL,
        DATABASE_SSL: "disable",
        ALSIA_STORE_EMAIL: "super@test.local",
      },
    }
  )
  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

async function seedE2E(): Promise<void> {
  runBaseSeed()

  for (const { email } of e2eUsers) {
    await db
      .insert(usersTable)
      .values({ id: crypto.randomUUID(), email })
      .onConflictDoNothing({ target: usersTable.email })
  }

  const userIds = await db
    .select({ id: usersTable.id, email: usersTable.email })
    .from(usersTable)
    .where(
      inArray(
        usersTable.email,
        e2eUsers.map((u) => u.email)
      )
    )

  const roleIds = await db
    .select({ id: rolesTable.id, name: rolesTable.name })
    .from(rolesTable)
    .where(
      inArray(rolesTable.name, [
        ...new Set(e2eUsers.map((u) => u.role)),
      ])
    )

  for (const { email, role } of e2eUsers) {
    const user = userIds.find((u) => u.email === email)
    const roleRow = roleIds.find((r) => r.name === role)
    if (!user || !roleRow) {
      console.error(
        `Missing ${!user ? "user" : "role"} for ${email} (${role})`
      )
      process.exit(1)
    }
    await db
      .insert(userRolesTable)
      .values({ userId: user.id, roleId: roleRow.id })
      .onConflictDoNothing()
  }

  const [{ total }] = await db
    .select({ total: count() })
    .from(usersTable)

  console.log(`E2E seed complete: ${total} users total`)
  for (const { email, role } of e2eUsers) {
    console.log(`  ${email} -> ${role}`)
  }

  process.exit(0)
}

seedE2E().catch((error) => {
  console.error(error)
  process.exit(1)
})
