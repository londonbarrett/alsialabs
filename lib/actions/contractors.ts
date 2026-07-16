"use server"

import { auth, isSuperUser, requirePermission } from "@/lib/auth"
import { db } from "@/lib/drizzle/client"
import {
  contractorProfilesTable,
  usersTable,
} from "@/lib/drizzle/schema"
import { getActionT } from "@/lib/i18n-actions"
import { eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { z } from "zod"

const contractorSchema = z.object({
  bio: z
    .string()
    .transform((v) => v.trim())
    .optional()
    .default(""),
  hourlyRate: z.string().optional().default(""),
  portfolioLinks: z
    .string()
    .transform((v) => v.trim())
    .optional()
    .default(""),
})

export type ContractorFormData = z.infer<typeof contractorSchema>

export async function getContractors() {
  const t = await getActionT("actions.contractors")
  try {
    await requirePermission("contractors", "view")
  } catch {
    throw new Error(t("forbidden"))
  }

  return db
    .select({
      id: contractorProfilesTable.id,
      userId: contractorProfilesTable.userId,
      bio: contractorProfilesTable.bio,
      hourlyRate: contractorProfilesTable.hourlyRate,
      portfolioLinks: contractorProfilesTable.portfolioLinks,
      createdAt: contractorProfilesTable.createdAt,
      updatedAt: contractorProfilesTable.updatedAt,
      userName: usersTable.name,
      userEmail: usersTable.email,
      userImage: usersTable.image,
    })
    .from(contractorProfilesTable)
    .innerJoin(
      usersTable,
      eq(contractorProfilesTable.userId, usersTable.id)
    )
}

export async function getContractorByUserId(userId: string) {
  const t = await getActionT("actions.contractors")
  try {
    await requirePermission("contractors", "view")
  } catch {
    throw new Error(t("forbidden"))
  }

  return db
    .select({
      id: contractorProfilesTable.id,
      userId: contractorProfilesTable.userId,
      bio: contractorProfilesTable.bio,
      hourlyRate: contractorProfilesTable.hourlyRate,
      portfolioLinks: contractorProfilesTable.portfolioLinks,
      createdAt: contractorProfilesTable.createdAt,
      updatedAt: contractorProfilesTable.updatedAt,
      userName: usersTable.name,
      userEmail: usersTable.email,
      userImage: usersTable.image,
    })
    .from(contractorProfilesTable)
    .innerJoin(
      usersTable,
      eq(contractorProfilesTable.userId, usersTable.id)
    )
    .where(eq(contractorProfilesTable.userId, userId))
    .then((rows) => rows[0] ?? null)
}

export async function upsertContractorProfile(
  data: ContractorFormData,
  targetUserId?: string
) {
  const t = await getActionT("actions.contractors")
  try {
    await requirePermission(
      "contractors",
      targetUserId ? "edit" : "create"
    )
  } catch {
    return { success: false as const, error: t("forbidden") }
  }

  const session = await auth()
  if (!session?.user)
    return { success: false as const, error: t("unauthorized") }

  const userId = targetUserId ?? session.user.id
  const isAdmin = isSuperUser(session)

  if (targetUserId && targetUserId !== session.user.id && !isAdmin) {
    return { success: false as const, error: t("forbidden") }
  }

  const parsed = contractorSchema.safeParse(data)
  if (!parsed.success) {
    return {
      success: false as const,
      error: t("validationFailed"),
      fieldErrors: parsed.error.flatten().fieldErrors,
    }
  }

  const { bio, hourlyRate, portfolioLinks } = parsed.data

  const existing = await db
    .select({ id: contractorProfilesTable.id })
    .from(contractorProfilesTable)
    .where(eq(contractorProfilesTable.userId, userId))
    .then((rows) => rows[0])

  if (existing) {
    await db
      .update(contractorProfilesTable)
      .set({
        bio: bio || null,
        hourlyRate: hourlyRate || null,
        portfolioLinks: portfolioLinks || null,
      })
      .where(eq(contractorProfilesTable.userId, userId))
  } else {
    await db.insert(contractorProfilesTable).values({
      userId,
      bio: bio || null,
      hourlyRate: hourlyRate || null,
      portfolioLinks: portfolioLinks || null,
    })
  }

  revalidatePath("/dashboard/contractors")
  return { success: true as const }
}

export async function deleteContractorProfile(targetUserId: string) {
  const t = await getActionT("actions.contractors")
  try {
    await requirePermission("contractors", "delete")
  } catch {
    return { success: false as const, error: t("forbidden") }
  }

  const session = await auth()
  if (!session?.user)
    return { success: false as const, error: t("unauthorized") }

  const isAdmin = isSuperUser(session)
  if (targetUserId !== session.user.id && !isAdmin) {
    return { success: false as const, error: t("forbidden") }
  }

  await db
    .delete(contractorProfilesTable)
    .where(eq(contractorProfilesTable.userId, targetUserId))

  revalidatePath("/dashboard/contractors")
  return { success: true as const }
}
