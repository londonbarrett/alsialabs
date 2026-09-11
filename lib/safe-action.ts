import {
  createSafeActionClient,
  returnServerError,
} from "next-safe-action"
import { z } from "zod"
import { auth, isSuperUser, hasPermission } from "@/lib/auth"
import { getEffectiveStoreId } from "@/lib/actions/stores"
import { verifyProjectAccess } from "@/lib/actions/project-access"
import { revalidatePath, updateTag } from "next/cache"
import type { ActionErrorCode } from "@/lib/actions/error-codes"

// ---------- Helpers ----------

type ServerError = { code: ActionErrorCode }

export const returnActionError = (code: ActionErrorCode): never =>
  returnServerError({ code })

// ---------- Base client ----------

export const actionClient = createSafeActionClient({
  defineMetadataSchema() {
    return z.object({
      permission: z
        .object({ module: z.string(), action: z.string() })
        .optional(),
      revalidate: z.array(z.string()).optional(),
      tag: z.string().optional(),
    })
  },
  handleServerError(e): ServerError {
    console.error("[safe-action]", e)
    return { code: "FORBIDDEN" }
  },
}).use(async ({ next, metadata }) => {
  const start = Date.now()
  const result = await next()
  const ms = Date.now() - start
  if (ms > 100) {
    console.log(
      `[action] ${metadata.permission ? `${metadata.permission.module}:${metadata.permission.action}` : "unknown"} ${ms}ms`
    )
  }
  return result
})

function resolveRevalidatePaths(
  paths: string[],
  input: unknown
): string[] {
  if (!input || typeof input !== "object") return paths
  const record = input as Record<string, unknown>
  return paths.map((p) =>
    p.replace(/:([a-zA-Z0-9_]+)/g, (_, key) =>
      record[key] != null ? String(record[key]) : `:${key}`
    )
  )
}

// ---------- sessionAction ----------
// Authenticates the session, optionally checks permission, and handles
// revalidation (supports templates like "/app/proyectos/:projectId" interpolated
// from input/data AFTER the action commits). Ownership is domain-specific
// and enforced separately (e.g. projectAction via verifyProjectAccess,
// storeAction via store scoping).

export const sessionAction = actionClient.use(async ({ next, metadata }) => {
  const session = await auth()
  if (!session?.user) {
    returnActionError("UNAUTHORIZED")
  }
  if (metadata.permission) {
    const permitted = await hasPermission(
      session!.user.id,
      metadata.permission.module,
      metadata.permission.action
    )
    if (!permitted) {
      returnActionError("FORBIDDEN")
    }
  }

  const result = await next({ ctx: { session: session! } })

  if (!result.validationErrors && !result.serverError) {
    if (metadata.revalidate) {
      let paths = metadata.revalidate
      const input =
        (result as { parsedInput?: unknown })?.parsedInput ??
        (result as { clientInput?: unknown })?.clientInput
      if (input) paths = resolveRevalidatePaths(paths, input)
      const data = (result as { data?: unknown })?.data
      if (data) paths = resolveRevalidatePaths(paths, data)
      for (const path of paths) {
        revalidatePath(path)
      }
    }
    if (metadata.tag) {
      updateTag(metadata.tag)
    }
  }

  return result
})

// ---------- storeAction ----------

export const storeAction = sessionAction.use(async ({ next }) => {
  const storeId = await getEffectiveStoreId()
  if (!storeId) {
    returnActionError("UNAUTHORIZED")
  }
  return next({ ctx: { storeId: storeId! } })
})

// ---------- projectAction ----------

export const projectAction = sessionAction
  .inputSchema(
    z.object({
      projectId: z.uuid(),
    })
  )
  .useValidated(async ({ parsedInput, ctx, next }) => {
    const access = await verifyProjectAccess(
      parsedInput.projectId,
      ctx.session.user.id,
      ctx.session.user.role
    )
    if (!access.hasAccess) {
      returnActionError("FORBIDDEN")
    }
    return next({ ctx: { ...ctx, isProjectOwner: access.isOwner } })
  })

// ---------- projectScopedAction ----------
// Factory for project-scoped actions. Callers provide their own input schema,
// which must include a `projectId` field; this verifies project ownership via
// verifyProjectAccess and injects `isProjectOwner` into context.

export function projectScopedAction<Schema extends z.ZodTypeAny>(
  schema: Schema
) {
  return sessionAction
    .inputSchema(schema)
    .use(async ({ clientInput, ctx, next }) => {
      const access = await verifyProjectAccess(
        (clientInput as { projectId: string }).projectId,
        ctx.session.user.id,
        ctx.session.user.role
      )
      if (!access.hasAccess) {
        returnActionError("FORBIDDEN")
      }
      return next({ ctx: { ...ctx, isProjectOwner: access.isOwner } })
    })
}

// ---------- adminAction ----------

export const adminAction = actionClient.use(async ({ next }) => {
  const session = await auth()
  if (!session?.user || !isSuperUser(session)) {
    returnActionError("FORBIDDEN")
  }
  return next({ ctx: { session: session! } })
})
