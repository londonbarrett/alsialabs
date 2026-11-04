"use server"

import { getProjectCategories } from "@/actions/categories"
import { SuccessSchema } from "@/actions/schemas/common"
import { getUserPermissions } from "@/lib/auth"
import { throwActionError } from "@/lib/action-result"
import {
  canManageAdmins,
  canManageCollaborators,
  canManageProject,
  canViewProject,
} from "@/lib/util/project-roles"
import {
  projectAction,
  returnActionError,
  sessionAction,
} from "@/lib/safe-action"
import { unwrapResponse } from "@/lib/util/unwrap"
import { z } from "zod"
import queries from "./queries"
import {
  CreateProjectSchema,
  MemberInputSchema,
  ProjectContextSchema,
  ProjectDetailSchema,
  ProjectMemberRowSchema,
  ProjectMembershipSchema,
  ProjectOptionSchema,
  ProjectPrimaryOwnerSchema,
  ProjectRecordSchema,
  ProjectSummarySchema,
  SetMemberRoleSchema,
  TransferPrimaryOwnerSchema,
  UpdateProjectSchema,
} from "./schemas"

const MEMBER_METADATA = {
  revalidate: ["/app/proyectos/:projectId"],
}

export const getProjects = sessionAction
  .metadata({})
  .outputSchema(z.array(ProjectOptionSchema))
  .action(async ({ ctx }) => {
    return queries.getProjectOptions(ctx.session.user.id)
  })

export const getProjectsWithDetails = sessionAction
  .metadata({})
  .outputSchema(z.array(ProjectSummarySchema))
  .action(async ({ ctx }) => {
    return queries.getProjectSummaries(ctx.session.user.id)
  })

export const getProjectById = projectAction(
  z.object({ projectId: z.uuid() })
)
  .metadata({})
  .outputSchema(ProjectDetailSchema)
  .action(async ({ parsedInput }) => {
    const project = await queries.getProjectById(parsedInput.projectId)
    if (!project) returnActionError("NOT_FOUND")
    return project
  })

export const createProject = sessionAction
  .metadata({ revalidate: ["/app/proyectos"] })
  .inputSchema(CreateProjectSchema)
  .outputSchema(ProjectRecordSchema)
  .action(async ({ parsedInput, ctx }) => {
    return queries.createProject(parsedInput, ctx.session.user.id)
  })

export const updateProject = projectAction(UpdateProjectSchema)
  .metadata({
    // :projectId interpolated from input AFTER the action commits
    revalidate: ["/app/proyectos", "/app/proyectos/:projectId"],
  })
  .outputSchema(ProjectRecordSchema)
  .action(async ({ parsedInput, ctx }) => {
    if (!canManageProject(ctx.projectRole))
      returnActionError("FORBIDDEN")
    const updated = await queries.updateProject(parsedInput)
    if (!updated) returnActionError("NOT_FOUND")
    return updated
  })

export const getProjectForEdit = projectAction(
  z.object({ projectId: z.uuid() })
)
  .metadata({})
  .outputSchema(ProjectRecordSchema)
  .action(async ({ parsedInput }) => {
    const project = await queries.getProjectById(parsedInput.projectId)
    if (!project) returnActionError("NOT_FOUND")
    return project
  })

export const deleteProject = projectAction(
  z.object({ projectId: z.uuid() })
)
  .metadata({ revalidate: ["/app/proyectos"] })
  .outputSchema(SuccessSchema)
  .action(async ({ parsedInput, ctx }) => {
    const { projectId } = parsedInput
    const ownerId = await queries.getProjectPrimaryOwnerId(projectId)
    if (ownerId === null) returnActionError("NOT_FOUND")
    if (!canManageProject(ctx.projectRole)) {
      returnActionError("FORBIDDEN")
    }
    await queries.deleteProject(projectId)
    return { success: true }
  })

export const getProjectContext = projectAction(
  z.object({ projectId: z.uuid() })
)
  .metadata({})
  .outputSchema(ProjectContextSchema)
  .action(async ({ parsedInput, ctx }) => {
    const { projectId } = parsedInput
    const session = ctx.session
    if (!canViewProject(ctx.projectRole)) {
      returnActionError("FORBIDDEN")
    }

    const project = await queries.getProjectById(projectId)
    if (!project) returnActionError("NOT_FOUND")

    const [members, permissions, categoriesResult] = await Promise.all([
      queries.getProjectMembers(projectId),
      getUserPermissions(session.user.id),
      getProjectCategories(),
    ])
    if (!members) returnActionError("NOT_FOUND")
    return {
      project,
      members,
      permissions,
      session,
      currentRole: ctx.projectRole!,
      currentUserId: session.user.id,
      categories: unwrapResponse(categoriesResult),
    }
  })

export const getProjectMembers = projectAction(
  MemberInputSchema.pick({ projectId: true })
)
  .metadata({})
  .outputSchema(ProjectMemberRowSchema.array())
  .action(async ({ parsedInput, ctx }) => {
    if (!canViewProject(ctx.projectRole)) {
      returnActionError("FORBIDDEN")
    }

    const members = await queries.getProjectMembers(parsedInput.projectId)
    if (members === null) throwActionError("NOT_FOUND")
    return members
  })

export const addProjectAdmin = projectAction(MemberInputSchema)
  .metadata(MEMBER_METADATA)
  .outputSchema(ProjectMembershipSchema)
  .action(async ({ parsedInput, ctx }) => {
    if (!canManageAdmins(ctx.projectRole)) {
      returnActionError("FORBIDDEN")
    }

    const { projectId, userId } = parsedInput
    const primaryOwnerId = await queries.getProjectPrimaryOwnerId(projectId)
    if (primaryOwnerId === null) throwActionError("NOT_FOUND")
    if (userId === primaryOwnerId) returnActionError("ALREADY_OWNER")

    const existingRole = await queries.getProjectMembershipRole(
      projectId,
      userId
    )
    if (existingRole) {
      if (existingRole === "admin") returnActionError("ALREADY_OWNER")
      returnActionError("ALREADY_COLLABORATOR")
    }

    const row = await queries.createProjectMembership(
      projectId,
      userId,
      "admin"
    )
    if (!row) returnActionError("NOT_FOUND")

    return { projectId, userId, role: row.role }
  })

export const removeProjectAdmin = projectAction(MemberInputSchema)
  .metadata(MEMBER_METADATA)
  .outputSchema(ProjectMembershipSchema)
  .action(async ({ parsedInput, ctx }) => {
    if (!canManageAdmins(ctx.projectRole)) {
      returnActionError("FORBIDDEN")
    }

    const { projectId, userId } = parsedInput
    const removed = await queries.deleteProjectMembership(
      projectId,
      userId,
      "admin"
    )
    if (!removed) returnActionError("NOT_FOUND")

    return { projectId, userId, role: "admin" as const }
  })

export const addProjectCollaborator = projectAction(MemberInputSchema)
  .metadata(MEMBER_METADATA)
  .outputSchema(ProjectMembershipSchema)
  .action(async ({ parsedInput, ctx }) => {
    if (!canManageCollaborators(ctx.projectRole)) {
      returnActionError("FORBIDDEN")
    }

    const { projectId, userId } = parsedInput
    const primaryOwnerId = await queries.getProjectPrimaryOwnerId(projectId)
    if (primaryOwnerId === null) throwActionError("NOT_FOUND")
    if (userId === primaryOwnerId) returnActionError("ALREADY_OWNER")

    if (await queries.getProjectMembershipRole(projectId, userId)) {
      returnActionError("ALREADY_COLLABORATOR")
    }

    const row = await queries.createProjectMembership(
      projectId,
      userId,
      "collaborator"
    )
    if (!row) returnActionError("NOT_FOUND")

    return { projectId, userId, role: row.role }
  })

export const removeProjectCollaborator = projectAction(
  MemberInputSchema
)
  .metadata(MEMBER_METADATA)
  .outputSchema(ProjectMembershipSchema)
  .action(async ({ parsedInput, ctx }) => {
    if (!canManageCollaborators(ctx.projectRole)) {
      returnActionError("FORBIDDEN")
    }

    const { projectId, userId } = parsedInput
    const removed = await queries.deleteProjectMembership(
      projectId,
      userId,
      "collaborator"
    )
    if (!removed) returnActionError("NOT_FOUND")

    return { projectId, userId, role: "collaborator" as const }
  })

export const setProjectMemberRole = projectAction(SetMemberRoleSchema)
  .metadata(MEMBER_METADATA)
  .outputSchema(ProjectMembershipSchema)
  .action(async ({ parsedInput, ctx }) => {
    if (!canManageAdmins(ctx.projectRole)) {
      returnActionError("FORBIDDEN")
    }

    const { projectId, userId, role } = parsedInput
    const primaryOwnerId = await queries.getProjectPrimaryOwnerId(projectId)
    if (primaryOwnerId === null) throwActionError("NOT_FOUND")
    if (userId === primaryOwnerId) returnActionError("ALREADY_OWNER")

    const row = await queries.updateProjectMembershipRole(projectId, userId, role)
    if (!row) returnActionError("NOT_FOUND")

    return { projectId, userId, role: row.role }
  })

export const transferProjectPrimaryOwner = projectAction(
  TransferPrimaryOwnerSchema
)
  .metadata(MEMBER_METADATA)
  .outputSchema(ProjectPrimaryOwnerSchema)
  .action(async ({ parsedInput, ctx }) => {
    if (!canManageProject(ctx.projectRole)) {
      returnActionError("FORBIDDEN")
    }

    const { projectId, newOwnerId } = parsedInput
    const primaryOwnerId = await queries.getProjectPrimaryOwnerId(projectId)
    if (primaryOwnerId === null) throwActionError("NOT_FOUND")
    if (newOwnerId === primaryOwnerId) {
      returnActionError("MUST_BE_OWNER")
    }

    if (!(await queries.getProjectMembershipRole(projectId, newOwnerId))) {
      returnActionError("MUST_BE_OWNER")
    }

    await queries.transferProjectOwnership(
      projectId,
      primaryOwnerId,
      newOwnerId
    )

    return { primaryOwnerId: newOwnerId }
  })
