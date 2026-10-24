import { randomBytes } from "crypto"
import { eq } from "drizzle-orm"
import { test as base, expect } from "@playwright/test"
import { db } from "@/lib/drizzle/client"
import { sessionsTable, usersTable } from "@/lib/drizzle/schema"

export const TEST_USERS = {
  super: "super@test.local",
  admin: "admin@test.local",
  retailer: "retailer@test.local",
  user1: "user1@test.local",
  user2: "user2@test.local",
  user3: "user3@test.local",
  user4: "user4@test.local",
} as const

export type TestRole = keyof typeof TEST_USERS

export const test = base.extend<{
  signInAs: (role: TestRole) => Promise<void>
}>({
  signInAs: async ({ context }, provide) => {
    await provide(async (role: TestRole) => {
      const email = TEST_USERS[role]
      const [user] = await db
        .select({ id: usersTable.id })
        .from(usersTable)
        .where(eq(usersTable.email, email))
        .limit(1)

      if (!user) {
        throw new Error(
          `Seeded user ${email} not found — run "pnpm test:db:setup"`
        )
      }

      const sessionToken = randomBytes(32).toString("hex")

      await db.insert(sessionsTable).values({
        sessionToken,
        userId: user.id,
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000),
      })

      await context.addCookies([
        {
          name: "authjs.session-token",
          value: sessionToken,
          domain: "localhost",
          path: "/",
        },
      ])
    })
  },
})

export { expect }
