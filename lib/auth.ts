import NextAuth from 'next-auth'
import Google from 'next-auth/providers/google'
import Facebook from 'next-auth/providers/facebook'
import { DrizzleAdapter } from '@auth/drizzle-adapter'
import { db } from '@/lib/drizzle/client'
import { usersTable, userRolesTable, rolesTable, permissionsTable, rolePermissionsTable } from '@/lib/drizzle/schema'
import { eq, and } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { unstable_cache } from 'next/cache'
import type { DefaultSession } from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      role: string | null
    } & DefaultSession['user']
  }
}

async function fetchUserRole(userId: string): Promise<string | null> {
  try {
    const userRole = await db
      .select({ name: rolesTable.name })
      .from(userRolesTable)
      .where(eq(userRolesTable.userId, userId))
      .innerJoin(rolesTable, eq(userRolesTable.roleId, rolesTable.id))
      .then((rows) => rows[0])
    return userRole?.name ?? null
  } catch {
    return null
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db),
  providers: [
    Google({ allowDangerousEmailAccountLinking: true }),
    Facebook({ allowDangerousEmailAccountLinking: true }),
  ],
  trustHost: true,
  pages: {
    signIn: '/login',
  },
  session: { strategy: 'database' },
  callbacks: {
    async session({ session, user }) {
      if (session?.user) {
        const uid = (user as { id?: string })?.id ?? session.user.id ?? ''
        session.user.id = uid
        session.user.role = uid ? await fetchUserRole(uid) : null
      }
      return session
    },
    async signIn({ user, profile }) {
      if (!user.email) return false

      const hasRole = await db
        .select({ id: userRolesTable.userId })
        .from(userRolesTable)
        .innerJoin(usersTable, eq(userRolesTable.userId, usersTable.id))
        .where(eq(usersTable.email, user.email))
        .then((rows) => rows.length > 0)

      if (hasRole) {
        const p = profile as Record<string, string | undefined> | undefined
        const name = user.name ?? p?.name ?? null
        const image = user.image ?? p?.picture ?? p?.image ?? null
        if (name || image) {
          await db.update(usersTable).set({ name, image }).where(eq(usersTable.email, user.email))
        }
      }

      return hasRole
    },
  },
})

export async function hasPermission(
  userId: string,
  module: string,
  action: string,
): Promise<boolean> {
  try {
    const result = await db
      .select({ id: permissionsTable.id })
      .from(rolePermissionsTable)
      .innerJoin(permissionsTable, eq(rolePermissionsTable.permissionId, permissionsTable.id))
      .innerJoin(userRolesTable, eq(rolePermissionsTable.roleId, userRolesTable.roleId))
      .where(
        and(
          eq(userRolesTable.userId, userId),
          eq(permissionsTable.module, module),
          eq(permissionsTable.action, action),
        ),
      )
      .then((rows) => rows.length > 0)
    return result
  } catch {
    return false
  }
}

export const getCachedUserPermissions = unstable_cache(
  async (userId: string) => {
    return getUserPermissions(userId)
  },
  ['user-permissions'],
  { tags: ['permissions'] },
)

export async function getUserPermissions(userId: string): Promise<string[]> {
  try {
    const rows = await db
      .select({
        module: permissionsTable.module,
        action: permissionsTable.action,
      })
      .from(rolePermissionsTable)
      .innerJoin(permissionsTable, eq(rolePermissionsTable.permissionId, permissionsTable.id))
      .innerJoin(userRolesTable, eq(rolePermissionsTable.roleId, userRolesTable.roleId))
      .where(eq(userRolesTable.userId, userId))

    return rows.map((r) => `${r.module}:${r.action}`)
  } catch {
    return []
  }
}

export async function requirePermission(module: string, action: string) {
  const session = await auth()
  if (!session?.user) throw new Error('Unauthorized')

  const permitted = await hasPermission(session.user.id, module, action)
  if (!permitted) throw new Error('Forbidden')
}

export async function requireAuth() {
  const session = await auth()
  if (!session?.user) redirect('/login')
  return session
}

export function isSuperUser(session: {
  user: { role: string | null }
}) {
  return session.user.role === 'super'
}
