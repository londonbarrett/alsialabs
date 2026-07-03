"use server"

import { revalidatePath } from "next/cache"
import { db } from "@/lib/drizzle/client"
import {
  clientsTable,
  usersTable,
  userRolesTable,
  rolesTable,
} from "@/lib/drizzle/schema"
import { eq } from "drizzle-orm"
import { requirePermission } from "@/lib/auth"
import { z } from "zod"
import crypto from "crypto"

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
const idSchema = z.string().uuid()

const inviteSchema = z.object({
  clientId: z.string().uuid("Invalid client ID"),
  email: z
    .string()
    .email("Invalid email")
    .transform((v) => v.trim().toLowerCase())
    .optional(),
})

export type ClientFormData = z.infer<typeof clientSchema>

export async function getClients() {
  try {
    await requirePermission("clients", "view")
  } catch {
    throw new Error("Forbidden")
  }

  return db
    .select({
      id: clientsTable.id,
      name: clientsTable.name,
    })
    .from(clientsTable)
}

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
  const excludeIdParsed = excludeId
    ? idSchema.safeParse(excludeId)
    : null
  if (excludeIdParsed && !excludeIdParsed.success)
    return { exists: false }

  const existing = await db
    .select({ id: clientsTable.id })
    .from(clientsTable)
    .where(eq(clientsTable.phone, phone))

  if (existing.length === 0) return { exists: false }
  if (excludeIdParsed)
    return { exists: existing[0].id !== excludeIdParsed.data }
  return { exists: true }
}

export async function upsertClient(
  data: ClientFormData,
  clientId?: string
) {
  try {
    await requirePermission("clients", clientId ? "edit" : "create")
  } catch {
    return { success: false, error: "Forbidden" }
  }

  const parsed = clientSchema.safeParse(data)
  if (!parsed.success) {
    return {
      success: false,
      error: "Validation failed",
      fieldErrors: parsed.error.flatten().fieldErrors,
    }
  }

  const fields = parsed.data

  const clientIdParsed = clientId ? idSchema.safeParse(clientId) : null
  if (clientIdParsed && !clientIdParsed.success) {
    return { success: false, error: "Invalid client ID" }
  }

  const phoneCheck = await checkPhoneExists(
    fields.phone,
    clientIdParsed?.data
  )
  if (phoneCheck.exists) {
    return {
      success: false,
      error: "A client with this phone number already exists",
      fieldErrors: { phone: ["Phone number already in use"] },
    }
  }

  const sanitized = {
    name: fields.name,
    phone: fields.phone,
    location: fields.location || null,
    comments: fields.comments || null,
    email: fields.email || null,
  }

  if (clientIdParsed) {
    const existing = await db
      .select({ userId: clientsTable.userId })
      .from(clientsTable)
      .where(eq(clientsTable.id, clientIdParsed.data))
      .then((rows) => rows[0])

    await db
      .update(clientsTable)
      .set(sanitized)
      .where(eq(clientsTable.id, clientIdParsed.data))

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
  try {
    await requirePermission("clients", "delete")
  } catch {
    return { success: false as const, error: "Forbidden" }
  }

  const idParsed = idSchema.safeParse(clientId)
  if (!idParsed.success)
    return { success: false as const, error: "Invalid client ID" }

  await db
    .delete(clientsTable)
    .where(eq(clientsTable.id, idParsed.data))
  revalidatePath("/dashboard/clients")
  return { success: true as const }
}

export async function inviteClient(data: {
  clientId: string
  email?: string
}) {
  try {
    await requirePermission("clients", "invite")
  } catch {
    return { success: false, error: "Forbidden" }
  }

  const parsed = inviteSchema.safeParse(data)
  if (!parsed.success) {
    return {
      success: false,
      error: "Validation failed",
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
    return { success: false, error: "Client not found" }
  }

  const email = providedEmail ?? client.email

  if (!email) {
    return {
      success: false,
      error: "Client has no email. Provide an email to invite.",
    }
  }

  const clientRole = await db
    .select({ id: rolesTable.id })
    .from(rolesTable)
    .where(eq(rolesTable.name, "client"))
    .then((rows) => rows[0])

  if (!clientRole) {
    return { success: false, error: "Client role not found" }
  }

  if (client.userId) {
    const existingUser = await db
      .select({ email: usersTable.email })
      .from(usersTable)
      .where(eq(usersTable.id, client.userId))
      .then((rows) => rows[0])

    if (!existingUser) {
      return { success: false, error: "Linked user not found" }
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
    roleId: clientRole.id,
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
