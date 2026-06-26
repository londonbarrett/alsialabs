import { pgTable, text, timestamp, integer, primaryKey, boolean, uniqueIndex } from 'drizzle-orm/pg-core'

export const usersTable = pgTable("user", {
  id: text()
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text(),
  email: text().unique(),
  emailVerified: timestamp({ mode: "date" }),
  image: text(),
})

export const rolesTable = pgTable("role", {
  id: text()
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text().notNull().unique(),
  description: text(),
})

export const userRolesTable = pgTable("user_role", {
  userId: text("user_id")
    .notNull()
    .unique()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  roleId: text("role_id")
    .notNull()
    .references(() => rolesTable.id, { onDelete: "cascade" }),
})

export const permissionsTable = pgTable("permission", {
  id: text()
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  module: text().notNull(),
  action: text().notNull(),
}, (table) => [
  uniqueIndex("permission_module_action_idx").on(table.module, table.action),
])

export const rolePermissionsTable = pgTable("role_permission", {
  roleId: text("role_id")
    .notNull()
    .references(() => rolesTable.id, { onDelete: "cascade" }),
  permissionId: text("permission_id")
    .notNull()
    .references(() => permissionsTable.id, { onDelete: "cascade" }),
}, (table) => [
  primaryKey({ columns: [table.roleId, table.permissionId] }),
])

export const accountsTable = pgTable("account", {
  userId: text("userId")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  type: text().notNull(),
  provider: text().notNull(),
  providerAccountId: text().notNull(),
  refresh_token: text("refresh_token"),
  access_token: text("access_token"),
  expires_at: integer("expires_at"),
  token_type: text("token_type"),
  scope: text(),
  id_token: text("id_token"),
  session_state: text("session_state"),
}, (account) => [
  primaryKey({ columns: [account.provider, account.providerAccountId] }),
])

export const sessionsTable = pgTable("session", {
  sessionToken: text().primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  expires: timestamp({ mode: "date" }).notNull(),
})

export const verificationTokensTable = pgTable("verificationToken", {
  identifier: text().notNull(),
  token: text().notNull(),
  expires: timestamp({ mode: "date" }).notNull(),
}, (verificationToken) => [
  primaryKey({ columns: [verificationToken.identifier, verificationToken.token] }),
])

export type Client = typeof clientsTable.$inferSelect
export type Role = typeof rolesTable.$inferSelect
export type UserRole = typeof userRolesTable.$inferSelect

export const clientsTable = pgTable("client", {
  id: text()
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text().notNull(),
  phone: text().notNull().unique(),
  location: text(),
  comments: text(),
  email: text(),
  userId: text("user_id").references(() => usersTable.id, { onDelete: "set null" }),
})

export const authenticatorsTable = pgTable("authenticator", {
  credentialID: text().notNull().unique(),
  userId: text("userId")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  providerAccountId: text().notNull(),
  credentialPublicKey: text().notNull(),
  counter: integer().notNull(),
  credentialDeviceType: text().notNull(),
  credentialBackedUp: boolean().notNull(),
  transports: text(),
}, (authenticator) => [
  primaryKey({ columns: [authenticator.userId, authenticator.credentialID] }),
])
