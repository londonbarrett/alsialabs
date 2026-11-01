import crypto from "crypto"
import { spawnSync } from "child_process"
import { count, eq, inArray } from "drizzle-orm"
import { db } from "./client"
import {
  categoryTable,
  projectMembershipTable,
  projectsTable,
  rolesTable,
  taxonomyTable,
  taskAssignmentsTable,
  tasksTable,
  userRolesTable,
  usersTable,
} from "./schema"

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


/**
 * Fixed-UUID fixtures for the roles/assignments/repetition specs. Deleting by
 * id first keeps every run idempotent: Playwright's specs mutate statuses and
 * membership, and the next `pnpm test:e2e` starts from this known shape.
 */
const ROLES_PROJECT = {
  id: "10000000-0000-4000-8000-000000000001",
  openTask: "10000000-0000-4000-8000-000000000002",
  repeatTask: "10000000-0000-4000-8000-000000000003",
  openAssignment: "10000000-0000-4000-8000-000000000004",
  repeatAssignment: "10000000-0000-4000-8000-000000000005",
} as const

async function seedRolesProject(): Promise<void> {
  const seedUsers = await db
    .select({ id: usersTable.id, email: usersTable.email })
    .from(usersTable)
    .where(
      inArray(usersTable.email, [
        "admin@test.local",
        "user1@test.local",
        "user2@test.local",
        "user3@test.local",
      ])
    )
  const userId = (email: string): string => {
    const user = seedUsers.find((u) => u.email === email)
    if (!user) {
      console.error(`Missing seeded user ${email}`)
      process.exit(1)
    }
    return user.id
  }

  const [category] = await db
    .select({ id: categoryTable.id })
    .from(categoryTable)
    .innerJoin(taxonomyTable, eq(categoryTable.taxonomyId, taxonomyTable.id))
    .where(eq(taxonomyTable.slug, "project"))
    .limit(1)
  if (!category) {
    console.error("No project category seeded")
    process.exit(1)
  }

  // Idempotent delete-by-id: assignments, tasks, membership, then the project.
  await db
    .delete(taskAssignmentsTable)
    .where(
      inArray(taskAssignmentsTable.taskId, [
        ROLES_PROJECT.openTask,
        ROLES_PROJECT.repeatTask,
      ])
    )
  await db
    .delete(tasksTable)
    .where(
      inArray(tasksTable.id, [ROLES_PROJECT.openTask, ROLES_PROJECT.repeatTask])
    )
  await db
    .delete(projectMembershipTable)
    .where(eq(projectMembershipTable.projectId, ROLES_PROJECT.id))
  await db.delete(projectsTable).where(eq(projectsTable.id, ROLES_PROJECT.id))

  await db.insert(projectsTable).values({
    id: ROLES_PROJECT.id,
    primaryOwnerId: userId("admin@test.local"),
    categoryId: category.id,
    name: "E2E Roles Project",
    startDate: "2026-01-01",
    color: "#b45309",
  })

  await db.insert(projectMembershipTable).values([
    {
      projectId: ROLES_PROJECT.id,
      userId: userId("user1@test.local"),
      role: "admin",
    },
    {
      projectId: ROLES_PROJECT.id,
      userId: userId("user2@test.local"),
      role: "collaborator",
    },
    {
      projectId: ROLES_PROJECT.id,
      userId: userId("user3@test.local"),
      role: "collaborator",
    },
  ])

  await db.insert(tasksTable).values([
    {
      id: ROLES_PROJECT.openTask,
      projectId: ROLES_PROJECT.id,
      name: "E2E plan the launch",
    },
    {
      id: ROLES_PROJECT.repeatTask,
      projectId: ROLES_PROJECT.id,
      name: "E2E weekly report",
      recurrence: "weekly",
      interval: 1,
      daysOfWeek: ["monday"],
      startTime: "09:00",
      endTime: "11:00",
    },
  ])

  await db.insert(taskAssignmentsTable).values([
    {
      id: ROLES_PROJECT.openAssignment,
      taskId: ROLES_PROJECT.openTask,
      userId: userId("user2@test.local"),
      status: "todo",
    },
    {
      id: ROLES_PROJECT.repeatAssignment,
      taskId: ROLES_PROJECT.repeatTask,
      userId: userId("user2@test.local"),
      status: "todo",
      // A Monday, late in the day, so the round-tripped window still ends
      // after 09:00 in any timezone and completing it spawns the NEXT
      // Monday's occurrence rather than a same-day one.
      startDate: new Date("2026-10-26T21:00:00.000Z"),
      endDate: new Date("2026-10-26T23:00:00.000Z"),
    },
  ])

  console.log("E2E seed: roles/assignments project fixtures ready")
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

  await seedRolesProject()

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
