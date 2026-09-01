"use server"

import { db } from "@/lib/drizzle/client"
import {
  clientsTable,
  userRolesTable,
  usersTable,
} from "@/lib/drizzle/schema"
import { returnActionError, storeAction } from "@/lib/safe-action"
import {
  createClientSchema,
  inviteSchema,
  phoneSchema,
  updateClientSchema,
} from "@/lib/schemas/client"
import { getRoleIdByName } from "@/lib/util/query-helpers"
import crypto from "crypto"
import { and, eq, ilike, or } from "drizzle-orm"
import { z } from "zod"
export type ClientOption = {
  id: string
  name: string
  phone: string
}

export const getClientByClientId = storeAction
  .metadata({ permission: { module: "clients", action: "view" } })
  .inputSchema(z.object({ id: z.uuid() }))
  .action(async ({ parsedInput, ctx }) => {
    return db
      .select()
      .from(clientsTable)
      .where(
        and(
          eq(clientsTable.id, parsedInput.id),
          eq(clientsTable.store_id, ctx.storeId)
        )
      )
      .then((rows) => rows[0] ?? null)
  })

export const getClientByUserId = storeAction
  .metadata({ permission: { module: "clients", action: "view" } })
  .inputSchema(z.object({ userId: z.uuid() }))
  .action(async ({ parsedInput, ctx }) => {
    return db
      .select()
      .from(clientsTable)
      .where(
        and(
          eq(clientsTable.userId, parsedInput.userId),
          eq(clientsTable.store_id, ctx.storeId)
        )
      )
      .then((rows) => rows[0] ?? null)
  })

export const getClients = storeAction
  .metadata({ permission: { module: "clients", action: "view" } })
  .action(async ({ ctx }) => {
    return db
      .select({
        id: clientsTable.id,
        name: clientsTable.name,
        phone: clientsTable.phone,
        location: clientsTable.location,
        comments: clientsTable.comments,
        email: clientsTable.email,
        userId: clientsTable.userId,
        store_id: clientsTable.store_id,
      })
      .from(clientsTable)
      .where(eq(clientsTable.store_id, ctx.storeId))
  })

export const searchClients = storeAction
  .metadata({ permission: { module: "clients", action: "view" } })
  .inputSchema(z.object({ query: z.string() }))
  .action(async ({ parsedInput, ctx }) => {
    const query = parsedInput.query
    if (!query.trim()) return []
    return db
      .select({
        id: clientsTable.id,
        name: clientsTable.name,
        phone: clientsTable.phone,
      })
      .from(clientsTable)
      .where(
        and(
          or(
            ilike(clientsTable.name, `%${query}%`),
            ilike(clientsTable.phone, `%${query}%`)
          ),
          eq(clientsTable.store_id, ctx.storeId)
        )
      )
      .limit(20)
  })

export const checkPhoneExists = storeAction
  .metadata({ permission: { module: "clients", action: "view" } })
  .inputSchema(
    z.object({ phone: z.string(), excludeId: z.string().optional() })
  )
  .action(async ({ parsedInput, ctx }) => {
    const phoneResult = phoneSchema.safeParse(parsedInput.phone)
    if (!phoneResult.success) return { exists: false }
    const existing = await db
      .select({ id: clientsTable.id })
      .from(clientsTable)
      .where(
        and(
          eq(clientsTable.phone, parsedInput.phone),
          eq(clientsTable.store_id, ctx.storeId)
        )
      )
    if (existing.length === 0) return { exists: false }
    if (parsedInput.excludeId)
      return { exists: existing[0].id !== parsedInput.excludeId }
    return { exists: true }
  })

export const createClient = storeAction
  .metadata({
    permission: { module: "clients", action: "create" },
    revalidate: ["/dashboard/clients"],
  })
  .inputSchema(createClientSchema)
  .action(async ({ parsedInput, ctx }) => {
    const { name, phone, location, comments, email } = parsedInput
    const existing = await db
      .select({ id: clientsTable.id })
      .from(clientsTable)
      .where(
        and(
          eq(clientsTable.phone, phone),
          eq(clientsTable.store_id, ctx.storeId)
        )
      )
      .then((rows) => rows[0])
    if (existing) returnActionError("PHONE_ALREADY_EXISTS")
    await db.insert(clientsTable).values({
      name,
      phone,
      location: location || null,
      comments: comments || null,
      email: email || null,
      store_id: ctx.storeId,
    })
    return { success: true as const }
  })

export const updateClient = storeAction
  .metadata({
    permission: { module: "clients", action: "edit" },
    revalidate: ["/dashboard/clients"],
  })
  .inputSchema(updateClientSchema)
  .action(async ({ parsedInput, ctx }) => {
    const { id, name, phone, location, comments, email } = parsedInput
    const [existing, existingClient] = await Promise.all([
      db
        .select({ id: clientsTable.id })
        .from(clientsTable)
        .where(
          and(
            eq(clientsTable.phone, phone),
            eq(clientsTable.store_id, ctx.storeId)
          )
        )
        .then((rows) => rows[0] ?? null),
      db
        .select({ userId: clientsTable.userId })
        .from(clientsTable)
        .where(
          and(
            eq(clientsTable.id, id),
            eq(clientsTable.store_id, ctx.storeId)
          )
        )
        .then((rows) => rows[0] ?? null),
    ])
    if (existing && existing.id !== id)
      returnActionError("PHONE_ALREADY_EXISTS")
    await db
      .update(clientsTable)
      .set({
        name,
        phone,
        location: location || null,
        comments: comments || null,
        email: email || null,
        store_id: ctx.storeId,
      })
      .where(
        and(
          eq(clientsTable.id, id),
          eq(clientsTable.store_id, ctx.storeId)
        )
      )
    if (existingClient?.userId && email) {
      await db
        .update(usersTable)
        .set({ email })
        .where(eq(usersTable.id, existingClient.userId))
    }
    return { success: true as const }
  })

export const deleteClient = storeAction
  .metadata({
    permission: { module: "clients", action: "delete" },
    revalidate: ["/dashboard/clients"],
  })
  .inputSchema(z.object({ id: z.uuid() }))
  .action(async ({ parsedInput, ctx }) => {
    await db
      .delete(clientsTable)
      .where(
        and(
          eq(clientsTable.id, parsedInput.id),
          eq(clientsTable.store_id, ctx.storeId)
        )
      )
    return { success: true as const }
  })

export const inviteClient = storeAction
  .metadata({
    permission: { module: "clients", action: "invite" },
    revalidate: ["/dashboard/clients"],
  })
  .inputSchema(inviteSchema)
  .action(async ({ parsedInput, ctx }) => {
    const { clientId, email: providedEmail } = parsedInput
    const client = await db
      .select()
      .from(clientsTable)
      .where(
        and(
          eq(clientsTable.id, clientId),
          eq(clientsTable.store_id, ctx.storeId)
        )
      )
      .then((rows) => rows[0])
    if (!client) returnActionError("CLIENT_NOT_FOUND")
    const email = providedEmail ?? client.email
    if (!email) returnActionError("VALIDATION_FAILED")
    const [userRoleId, existingUser] = await Promise.all([
      getRoleIdByName("user"),
      client.userId
        ? db
            .select({ email: usersTable.email })
            .from(usersTable)
            .where(eq(usersTable.id, client.userId))
            .then((rows) => rows[0] ?? null)
        : Promise.resolve(null),
    ])
    if (!userRoleId) returnActionError("NOT_FOUND")
    if (client.userId) {
      if (!existingUser) returnActionError("NOT_FOUND")
      if (existingUser!.email !== email) {
        await db
          .update(usersTable)
          .set({ email })
          .where(eq(usersTable.id, client.userId))
      }
      if (providedEmail && client.email !== providedEmail) {
        await db
          .update(clientsTable)
          .set({ email })
          .where(eq(clientsTable.id, clientId))
      }
      await sendClientInvitationEmail({
        email: email!,
        name: client.name,
      })
      return { success: true as const }
    }
    const userId = crypto.randomUUID()
    await db
      .insert(usersTable)
      .values({ id: userId, name: client.name, email: email! })
    await db
      .insert(userRolesTable)
      .values({ userId, roleId: userRoleId! })
    await db
      .update(clientsTable)
      .set({ userId, email: email! })
      .where(eq(clientsTable.id, clientId))
    await sendClientInvitationEmail({
      email: email!,
      name: client.name,
    })
    return { success: true as const }
  })

async function sendClientInvitationEmail({
  email,
  name,
}: {
  email: string
  name: string
}) {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return
  const { Resend } = await import("resend")
  const resend = new Resend(apiKey)
  const { ClientInvitationEmail } =
    await import("@/emails/client-invitation")
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
  await resend.emails.send({
    from: "Alsia <onboarding@resend.dev>",
    to: email,
    subject: "Has sido invitado a Alsia",
    react: (
      <ClientInvitationEmail name={name} loginUrl={`${appUrl}/login`} />
    ),
  })
}
