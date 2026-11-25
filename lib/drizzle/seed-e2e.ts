import crypto from "crypto"
import { spawnSync } from "child_process"
import { count, eq, inArray, like, or } from "drizzle-orm"
import { db } from "./client"
import {
  categoryTable,
  projectMembershipTable,
  projectsTable,
  rolesTable,
  taxonomyTable,
  taskAssigneesTable,
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

/**
 * A pristine project owned by user1 with no tasks: task-filter.spec pins the
 * Finished filter's empty state here, because the Roles project accumulates
 * finished work from specs running in parallel.
 */
const EMPTY_TASKS_PROJECT = {
  id: "10000000-0000-4000-8000-000000000006",
} as const

/**
 * A Bogotá-owned project dedicated to the time-zone e2e check. Its deadline is
 * an explicit UTC instant — 2026-12-25T02:00Z = 21:00 on 24 Dec in
 * America/Bogota, but 11:00 on 25 Dec in Asia/Tokyo — so the same stored
 * instant can be asserted under two different project zones.
 */
const ZONED_PROJECT = {
  id: "10000000-0000-4000-8000-000000000007",
  task: "10000000-0000-4000-8000-000000000008",
  assignment: "10000000-0000-4000-8000-000000000009",
  timeZone: "America/Bogota",
  start: new Date("2026-12-25T01:00:00.000Z"),
  end: new Date("2026-12-25T02:00:00.000Z"),
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

  // Tasks the wizard specs create accumulate run over run; clear them so
  // name-based locators stay unambiguous (the fixtures below are untouched).
  await db
    .delete(tasksTable)
    .where(
      or(
        like(tasksTable.name, "E2E wizard gate%"),
        like(tasksTable.name, "E2E repeat gate%"),
        like(tasksTable.name, "E2E multi%"),
        like(tasksTable.name, "E2E filter%")
      )
    )

  // Idempotent delete-by-id: roster, assignments, tasks, membership, then the project.
  await db
    .delete(taskAssigneesTable)
    .where(
      inArray(taskAssigneesTable.taskId, [
        ROLES_PROJECT.openTask,
        ROLES_PROJECT.repeatTask,
      ])
    )
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
    country: "CO",
    timeZone: "America/Bogota",
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

  await db.insert(taskAssigneesTable).values([
    {
      taskId: ROLES_PROJECT.openTask,
      userId: userId("user2@test.local"),
    },
    {
      taskId: ROLES_PROJECT.repeatTask,
      userId: userId("user2@test.local"),
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

/**
 * Recreated every run (delete-by-id, tasks cascade with the project) so
 * task-filter.spec's empty-Finished assertion always sees a project no other
 * spec can put finished work into.
 */
async function seedEmptyTasksProject(): Promise<void> {
  const [owner] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.email, "user1@test.local"))
    .limit(1)
  if (!owner) {
    console.error("Missing seeded user user1@test.local")
    process.exit(1)
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

  await db
    .delete(tasksTable)
    .where(eq(tasksTable.projectId, EMPTY_TASKS_PROJECT.id))
  await db
    .delete(projectMembershipTable)
    .where(eq(projectMembershipTable.projectId, EMPTY_TASKS_PROJECT.id))
  await db
    .delete(projectsTable)
    .where(eq(projectsTable.id, EMPTY_TASKS_PROJECT.id))

  // No membership row: the primary owner resolves to the owner role.
  await db.insert(projectsTable).values({
    id: EMPTY_TASKS_PROJECT.id,
    primaryOwnerId: owner.id,
    categoryId: category.id,
    name: "E2E Empty Tasks Project",
    startDate: "2026-01-01",
    country: "CO",
    timeZone: "America/Bogota",
    color: "#b45309",
  })

  console.log("E2E seed: empty tasks project fixture ready")
}

/** Recreated every run (delete-by-id) so the time-zone spec can edit this
 *  project's zone without affecting any other spec. */
async function seedZonedProject(): Promise<void> {
  const [owner] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.email, "user1@test.local"))
    .limit(1)
  if (!owner) {
    console.error("Missing seeded user user1@test.local")
    process.exit(1)
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

  await db
    .delete(taskAssigneesTable)
    .where(eq(taskAssigneesTable.taskId, ZONED_PROJECT.task))
  await db
    .delete(taskAssignmentsTable)
    .where(eq(taskAssignmentsTable.taskId, ZONED_PROJECT.task))
  await db.delete(tasksTable).where(eq(tasksTable.projectId, ZONED_PROJECT.id))
  await db
    .delete(projectMembershipTable)
    .where(eq(projectMembershipTable.projectId, ZONED_PROJECT.id))
  await db.delete(projectsTable).where(eq(projectsTable.id, ZONED_PROJECT.id))

  await db.insert(projectsTable).values({
    id: ZONED_PROJECT.id,
    primaryOwnerId: owner.id,
    categoryId: category.id,
    name: "E2E Time Zone Project",
    startDate: "2026-01-01",
    location: "Bogotá, Colombia",
    country: "CO",
    timeZone: ZONED_PROJECT.timeZone,
    color: "#f97316", // a PROJECT_COLORS value so the edit form can resubmit it
  })

  await db.insert(projectMembershipTable).values({
    projectId: ZONED_PROJECT.id,
    userId: owner.id,
    role: "admin",
  })

  // A late-evening Bogotá deadline: the same instant is already the next day
  // in Tokyo, so a browser-local conversion would display 25 Dec / 11:00.
  await db.insert(tasksTable).values({
    id: ZONED_PROJECT.task,
    projectId: ZONED_PROJECT.id,
    name: "E2E zoned deadline",
    startDate: ZONED_PROJECT.start,
    endDate: ZONED_PROJECT.end,
    startTime: "20:00",
    endTime: "21:00",
  })

  await db.insert(taskAssigneesTable).values({
    taskId: ZONED_PROJECT.task,
    userId: owner.id,
  })

  await db.insert(taskAssignmentsTable).values({
    id: ZONED_PROJECT.assignment,
    taskId: ZONED_PROJECT.task,
    userId: owner.id,
    status: "todo",
    startDate: ZONED_PROJECT.start,
    endDate: ZONED_PROJECT.end,
  })

  console.log("E2E seed: time-zone project fixture ready")
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

  await db
    .update(usersTable)
    .set({ name: "E2E Collaborator" })
    .where(eq(usersTable.email, "user2@test.local"))

  await seedRolesProject()
  await seedEmptyTasksProject()
  await seedZonedProject()

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
