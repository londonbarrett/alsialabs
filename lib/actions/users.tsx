"use server"

import { isSuperUser } from "@/lib/auth"
import { db } from "@/lib/drizzle/client"
import {
  clientActivitiesTable,
  clientRemindersTable,
  projectsTable,
  rolesTable,
  storesTable,
  userRolesTable,
  usersTable,
} from "@/lib/drizzle/schema"
import { returnActionError, sessionAction } from "@/lib/safe-action"
import {
  createUserSchema,
  deleteUserSchema,
  getUserByIdSchema,
  searchUsersSchema,
  updateUserSchema,
} from "@/lib/schemas/user"
import { eq, ilike, or } from "drizzle-orm"
import { revalidatePath, updateTag } from "next/cache"

export type UserWithRole = {
  id: string
  name: string | null
  email: string | null
  roleId: string
  roleName: string
}

export type UserOption = {
  id: string
  name: string | null
  email: string | null
  image: string | null
}

// ---------- Query actions ----------

export const getAssignableUsers = sessionAction
  .metadata({})
  .action(async () => {
    const users = await db
      .select({
        id: usersTable.id,
        name: usersTable.name,
        email: usersTable.email,
        image: usersTable.image,
      })
      .from(usersTable)

    return users
  })

export const searchUsers = sessionAction
  .metadata({ permission: { module: "projects", action: "view" } })
  .inputSchema(searchUsersSchema)
  .action(async ({ parsedInput }) => {
    const { query } = parsedInput

    if (!query.trim()) return [] as UserOption[]

    // excludedIds filtering is handled client-side in UserInviteInput
    // to avoid NOT IN edge cases; kept in schema for backward compat
    // Search across all users (any role) so super/admin can be invited to projects
    return db
      .select({
        id: usersTable.id,
        name: usersTable.name,
        email: usersTable.email,
        image: usersTable.image,
      })
      .from(usersTable)
      .where(
        or(
          ilike(usersTable.name, `%${query}%`),
          ilike(usersTable.email, `%${query}%`)
        )
      )
      .limit(20)
  })

export const getUserById = sessionAction
  .metadata({})
  .inputSchema(getUserByIdSchema)
  .action(async ({ parsedInput }) => {
    const user = await db
      .select({
        id: usersTable.id,
        name: usersTable.name,
        email: usersTable.email,
        image: usersTable.image,
      })
      .from(usersTable)
      .where(eq(usersTable.id, parsedInput.userId))
      .then((rows) => rows[0] ?? null)

    return user as UserOption | null
  })

export const getUsers = sessionAction
  .metadata({ permission: { module: "users", action: "manage" } })
  .action(async ({ ctx }) => {
    if (!isSuperUser(ctx.session)) {
      returnActionError("FORBIDDEN")
    }
    const users = await db
      .select({
        id: usersTable.id,
        name: usersTable.name,
        email: usersTable.email,
        image: usersTable.image,
        roleId: userRolesTable.roleId,
        roleName: rolesTable.name,
      })
      .from(usersTable)
      .innerJoin(
        userRolesTable,
        eq(usersTable.id, userRolesTable.userId)
      )
      .innerJoin(rolesTable, eq(userRolesTable.roleId, rolesTable.id))

    return users as UserWithRole[]
  })

// ---------- Mutation actions ----------

export const createUser = sessionAction
  .metadata({ permission: { module: "users", action: "manage" } })
  .inputSchema(createUserSchema)
  .action(async ({ parsedInput, ctx }) => {
    if (!isSuperUser(ctx.session)) {
      returnActionError("FORBIDDEN")
    }
    const { email, roleId } = parsedInput

    const existingUser = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.email, email))
      .then((rows) => rows[0])

    if (existingUser) {
      returnActionError("EMAIL_ALREADY_EXISTS")
    }

    const userId = crypto.randomUUID()

    await db.insert(usersTable).values({
      id: userId,
      email,
    })

    await db.insert(userRolesTable).values({
      userId,
      roleId,
    })

    const createdRole = await db
      .select({ name: rolesTable.name })
      .from(rolesTable)
      .where(eq(rolesTable.id, roleId))
      .then((rows) => rows[0])

    if (createdRole?.name === "retailer") {
      await db.insert(storesTable).values({
        name: `${email.split("@")[0]}'s Store`,
        owner_id: userId,
      })
    }

    const apiKey = process.env.RESEND_API_KEY
    if (apiKey) {
      const { Resend } = await import("resend")
      const resend = new Resend(apiKey)
      const { InvitationEmail } = await import("@/emails/invitation")
      const appUrl =
        process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"

      await resend.emails.send({
        from: "Alsia <onboarding@resend.dev>",
        to: email,
        subject: "You've been invited to Alsia",
        react: <InvitationEmail loginUrl={`${appUrl}/login`} />,
      })
    }

    revalidatePath("/dashboard/users")
    updateTag("permissions")
    return { id: userId }
  })

export const updateUser = sessionAction
  .metadata({ permission: { module: "users", action: "manage" } })
  .inputSchema(updateUserSchema)
  .action(async ({ parsedInput, ctx }) => {
    if (!isSuperUser(ctx.session)) {
      returnActionError("FORBIDDEN")
    }
    const { userId, email, roleId } = parsedInput

    const currentUserRole = await db
      .select({ roleName: rolesTable.name, roleId: rolesTable.id })
      .from(userRolesTable)
      .where(eq(userRolesTable.userId, userId))
      .innerJoin(rolesTable, eq(userRolesTable.roleId, rolesTable.id))
      .then((rows) => rows[0])

    if (!currentUserRole) {
      returnActionError("USER_NOT_FOUND")
    }

    const session = ctx.session
    const isChangingSelf = session.user.id === userId
    if (isChangingSelf && currentUserRole.roleName === "super") {
      const newRole = await db
        .select({ name: rolesTable.name })
        .from(rolesTable)
        .where(eq(rolesTable.id, roleId))
        .then((rows) => rows[0])

      if (newRole?.name !== "super") {
        returnActionError("CANNOT_DEMOTE_SELF")
      }
    }

    await db
      .update(usersTable)
      .set({ email })
      .where(eq(usersTable.id, userId))
    await db
      .update(userRolesTable)
      .set({ roleId })
      .where(eq(userRolesTable.userId, userId))

    const updatedRole = await db
      .select({ name: rolesTable.name })
      .from(rolesTable)
      .where(eq(rolesTable.id, roleId))
      .then((rows) => rows[0])

    if (updatedRole?.name === "retailer") {
      const existingStore = await db
        .select({ id: storesTable.id })
        .from(storesTable)
        .where(eq(storesTable.owner_id, userId))
        .limit(1)
        .then((rows) => rows[0])

      if (!existingStore) {
        await db.insert(storesTable).values({
          name: `${email.split("@")[0]}'s Store`,
          owner_id: userId,
        })
      }
    }

    revalidatePath("/dashboard/users")
    updateTag("permissions")
    return { id: userId }
  })

export const deleteUser = sessionAction
  .metadata({ permission: { module: "users", action: "manage" } })
  .inputSchema(deleteUserSchema)
  .action(async ({ parsedInput, ctx }) => {
    if (!isSuperUser(ctx.session)) {
      returnActionError("FORBIDDEN")
    }
    const { userId } = parsedInput

    const session = ctx.session
    if (session.user.id === userId) {
      returnActionError("CANNOT_DELETE_SELF")
    }

    const superRole = await db
      .select({ id: rolesTable.id })
      .from(rolesTable)
      .where(eq(rolesTable.name, "super"))
      .then((rows) => rows[0])

    if (!superRole) {
      returnActionError("SUPER_ROLE_NOT_FOUND")
    }

    const targetUser = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .then((rows) => rows[0])

    if (!targetUser) {
      returnActionError("USER_NOT_FOUND")
    }

    const targetRole = await db
      .select({ roleId: userRolesTable.roleId })
      .from(userRolesTable)
      .where(eq(userRolesTable.userId, userId))
      .then((rows) => rows[0])

    if (targetRole?.roleId === superRole.id) {
      const superCount = await db
        .select({ count: userRolesTable.userId })
        .from(userRolesTable)
        .where(eq(userRolesTable.roleId, superRole.id))
        .then((rows) => rows.length)

      if (superCount <= 1) {
        returnActionError("CANNOT_DELETE_LAST_SUPER")
      }
    }

    // Prevent FK violation: check if user owns projects, stores, or has activities/reminders
    const [ownedProjects, ownedStores, hasActivity, hasReminder] =
      await Promise.all([
        db
          .select({ id: projectsTable.id })
          .from(projectsTable)
          .where(eq(projectsTable.primaryOwnerId, userId))
          .limit(1),
        db
          .select({ id: storesTable.id })
          .from(storesTable)
          .where(eq(storesTable.owner_id, userId))
          .limit(1),
        db
          .select({ id: clientActivitiesTable.id })
          .from(clientActivitiesTable)
          .where(eq(clientActivitiesTable.performedBy, userId))
          .limit(1),
        db
          .select({ id: clientRemindersTable.id })
          .from(clientRemindersTable)
          .where(eq(clientRemindersTable.createdBy, userId))
          .limit(1),
      ])

    if (
      ownedProjects.length > 0 ||
      ownedStores.length > 0 ||
      hasActivity.length > 0 ||
      hasReminder.length > 0
    ) {
      returnActionError("REFERENCE_EXISTS")
    }

    try {
      await db.transaction(async (tx) => {
        await tx
          .delete(userRolesTable)
          .where(eq(userRolesTable.userId, userId))
        await tx.delete(usersTable).where(eq(usersTable.id, userId))
      })
    } catch (e) {
      console.error("[deleteUser] FK violation", e)
      returnActionError("REFERENCE_EXISTS")
    }

    revalidatePath("/dashboard/users")
    updateTag("permissions")
    return { id: userId }
  })
