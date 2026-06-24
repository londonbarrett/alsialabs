import NextAuth from 'next-auth'
import Google from 'next-auth/providers/google'
import Facebook from 'next-auth/providers/facebook'
import { DrizzleAdapter } from '@auth/drizzle-adapter'
import { db } from '@/lib/drizzle/client'
import { usersTable, userRolesTable, rolesTable } from '@/lib/drizzle/schema'
import { eq } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import type { DefaultSession } from 'next-auth'
import type { JWT } from 'next-auth/jwt'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      role: string | null
    } & DefaultSession['user']
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    role: string | null
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

async function fetchUserRoleByEmail(email: string): Promise<string | null> {
  try {
    const userRole = await db
      .select({ name: rolesTable.name })
      .from(userRolesTable)
      .innerJoin(usersTable, eq(userRolesTable.userId, usersTable.id))
      .innerJoin(rolesTable, eq(userRolesTable.roleId, rolesTable.id))
      .where(eq(usersTable.email, email))
      .then((rows) => rows[0])
    return userRole?.name ?? null
  } catch {
    return null
  }
}

async function fetchUserIdByEmail(email: string): Promise<string | null> {
  try {
    const user = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.email, email))
      .then((rows) => rows[0])
    return user?.id ?? null
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
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user?.id) {
        token.role = await fetchUserRole(user.id)
      } else if (trigger === 'update') {
        const sub = token.sub
        if (sub) {
          token.role = await fetchUserRole(sub)
        }
      }
      return token
    },
    async session({ session, token }) {
      if (session?.user) {
        session.user.id = token?.sub ?? ''
        if (token?.sub) {
          session.user.role = await fetchUserRole(token.sub)
        } else if (session.user.email) {
          session.user.role = await fetchUserRoleByEmail(session.user.email)
          session.user.id = (await fetchUserIdByEmail(session.user.email)) ?? ''
        } else {
          session.user.role = token?.role ?? null
        }
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
