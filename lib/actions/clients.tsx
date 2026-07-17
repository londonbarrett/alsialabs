"use server"

import { requirePermission } from "@/lib/auth"
import { db } from "@/lib/drizzle/client"
import {
  clientsTable,
  rolesTable,
  userRolesTable,
  usersTable,
} from "@/lib/drizzle/schema"
import { getActionT } from "@/lib/i18n-actions"
import crypto from "crypto"
import { eq, ilike, or } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { z } from "zod"

const clientSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .transform((v) => v.trim()),
  phone: z
    .string()
    .min(1, "Phone is required")
    .transform((v) => v.trim()),
  location: z
    .string()
    .transform((v) => v.trim())
    .optional()
    .default(""),
  comments: z
    .string()
    .transform((v) => v.trim())
    .optional()
    .default(""),
  email: z
    .string()
    .email("Invalid email")
    .transform((v) => v.trim())
    .optional()
    .default(""),
})

const phoneSchema = z
  .string()
  .min(1, "Phone is required")
  .transform((v) => v.trim())

const inviteSchema = z.object({
  clientId: z.string().uuid("Invalid client ID"),
  email: z
    .string()
    .email("Invalid email")
    .transform((v) => v.trim().toLowerCase())
    .optional(),
})

export type ClientFormData = z.infer<typeof clientSchema>

export async function getClientByClientId(id: string) {
  return db
    .select()
    .from(clientsTable)
    .where(eq(clientsTable.id, id))
    .then((rows) => rows[0] ?? null)
}

export async function getClientByUserId(userId: string) {
  return db
    .select()
    .from(clientsTable)
    .where(eq(clientsTable.userId, userId))
    .then((rows) => rows[0] ?? null)
}

export async function getClients() {
  const t = await getActionT("actions.clients")
  try {
    await requirePermission("clients", "view")
  } catch {
    throw new Error(t("forbidden"))
  }

  return db
    .select({
      id: clientsTable.id,
      name: clientsTable.name,
      phone: clientsTable.phone,
    })
    .from(clientsTable)
}

export async function searchClients(query: string) {
  const t = await getActionT("actions.clients")
  try {
    await requirePermission("clients", "view")
  } catch {
    throw new Error(t("forbidden"))
  }

  if (!query.trim()) return []

  return db
    .select({
      id: clientsTable.id,
      name: clientsTable.name,
      phone: clientsTable.phone,
    })
    .from(clientsTable)
    .where(
      or(
        ilike(clientsTable.name, `%${query}%`),
        ilike(clientsTable.phone, `%${query}%`)
      )
    )
    .limit(20)
}

export type ClientOption = Awaited<
  ReturnType<typeof getClients>
>[number]

export async function checkPhoneExists(
  phone: string,
  excludeId?: string
) {
  const phoneResult = phoneSchema.safeParse(phone)
  if (!phoneResult.success) return { exists: false }

  try {
    await requirePermission("clients", "view")
  } catch {
    return { exists: false }
  }

  const existing = await db
    .select({ id: clientsTable.id })
    .from(clientsTable)
    .where(eq(clientsTable.phone, phone))

  if (existing.length === 0) return { exists: false }
  if (excludeId) return { exists: existing[0].id !== excludeId }
  return { exists: true }
}

export async function upsertClient(
  data: ClientFormData,
  clientId?: string
) {
  const t = await getActionT("actions.clients")
  try {
    await requirePermission("clients", clientId ? "edit" : "create")
  } catch {
    return { success: false, error: t("forbidden") }
  }

  const parsed = clientSchema.safeParse(data)
  if (!parsed.success) {
    return {
      success: false,
      error: t("validationFailed"),
      fieldErrors: parsed.error.flatten().fieldErrors,
    }
  }

  const fields = parsed.data

  const phoneCheck = await checkPhoneExists(fields.phone, clientId)
  if (phoneCheck.exists) {
    return {
      success: false,
      error: t("phoneAlreadyExists"),
      fieldErrors: { phone: [t("phoneAlreadyExistsField")] },
    }
  }

  const sanitized = {
    name: fields.name,
    phone: fields.phone,
    location: fields.location || null,
    comments: fields.comments || null,
    email: fields.email || null,
  }

  if (clientId) {
    const existing = await db
      .select({ userId: clientsTable.userId })
      .from(clientsTable)
      .where(eq(clientsTable.id, clientId))
      .then((rows) => rows[0])

    await db
      .update(clientsTable)
      .set(sanitized)
      .where(eq(clientsTable.id, clientId))

    if (existing?.userId && sanitized.email) {
      await db
        .update(usersTable)
        .set({ email: sanitized.email })
        .where(eq(usersTable.id, existing.userId))
    }
  } else {
    await db.insert(clientsTable).values(sanitized)
  }

  revalidatePath("/dashboard/clients")
  return { success: true }
}

export async function deleteClient(clientId: string) {
  const t = await getActionT("actions.clients")
  try {
    await requirePermission("clients", "delete")
  } catch {
    return { success: false as const, error: t("forbidden") }
  }

  await db.delete(clientsTable).where(eq(clientsTable.id, clientId))
  revalidatePath("/dashboard/clients")
  return { success: true as const }
}

export async function inviteClient(data: {
  clientId: string
  email?: string
}) {
  const t = await getActionT("actions.clients")
  try {
    await requirePermission("clients", "invite")
  } catch {
    return { success: false, error: t("forbidden") }
  }

  const parsed = inviteSchema.safeParse(data)
  if (!parsed.success) {
    return {
      success: false,
      error: t("validationFailed"),
      fieldErrors: parsed.error.flatten().fieldErrors,
    }
  }

  const { clientId, email: providedEmail } = parsed.data

  const client = await db
    .select()
    .from(clientsTable)
    .where(eq(clientsTable.id, clientId))
    .then((rows) => rows[0])

  if (!client) {
    return { success: false, error: t("clientNotFound") }
  }

  const email = providedEmail ?? client.email

  if (!email) {
    return {
      success: false,
      error: t("noEmailToInvite"),
    }
  }

  const userRole = await db
    .select({ id: rolesTable.id })
    .from(rolesTable)
    .where(eq(rolesTable.name, "user"))
    .then((rows) => rows[0])

  if (!userRole) {
    return { success: false, error: t("userRoleNotFound") }
  }

  if (client.userId) {
    const existingUser = await db
      .select({ email: usersTable.email })
      .from(usersTable)
      .where(eq(usersTable.id, client.userId))
      .then((rows) => rows[0])

    if (!existingUser) {
      return { success: false, error: t("linkedUserNotFound") }
    }

    if (existingUser.email !== email) {
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

    await sendClientInvitationEmail({ email, name: client.name })
    revalidatePath("/dashboard/clients")
    return { success: true }
  }

  const userId = crypto.randomUUID()

  await db.insert(usersTable).values({
    id: userId,
    name: client.name,
    email,
  })

  await db.insert(userRolesTable).values({
    userId,
    roleId: userRole.id,
  })

  await db
    .update(clientsTable)
    .set({ userId, email })
    .where(eq(clientsTable.id, clientId))

  await sendClientInvitationEmail({ email, name: client.name })
  revalidatePath("/dashboard/clients")
  return { success: true }
}

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
