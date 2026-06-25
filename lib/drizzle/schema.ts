import { pgTable, text, timestamp, integer, primaryKey, boolean, uniqueIndex } from 'drizzle-orm/pg-core'

export const usersTable = pgTable("user", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: timestamp("emailVerified", { mode: "date" }),
  image: text("image"),
})

export const rolesTable = pgTable("role", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull().unique(),
  description: text("description"),
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
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  module: text("module").notNull(),
  action: text("action").notNull(),
})

export const rolePermissionsTable = pgTable("role_permission", {
  roleId: text("role_id")
    .notNull()
    .references(() => rolesTable.id, { onDelete: "cascade" }),
  permissionId: text("permission_id")
    .notNull()
    .references(() => permissionsTable.id, { onDelete: "cascade" }),
}, (table) => ({
  compositePk: primaryKey({ columns: [table.roleId, table.permissionId] }),
}))

export const accountsTable = pgTable("account", {
  userId: text("userId")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  provider: text("provider").notNull(),
  providerAccountId: text("providerAccountId").notNull(),
  refresh_token: text("refresh_token"),
  access_token: text("access_token"),
  expires_at: integer("expires_at"),
  token_type: text("token_type"),
  scope: text("scope"),
  id_token: text("id_token"),
  session_state: text("session_state"),
}, (account) => ({
  compositePk: primaryKey({ columns: [account.provider, account.providerAccountId] }),
}))

export const sessionsTable = pgTable("session", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
})

export const verificationTokensTable = pgTable("verificationToken", {
  identifier: text("identifier").notNull(),
  token: text("token").notNull(),
  expires: timestamp("expires", { mode: "date" }).notNull(),
}, (verificationToken) => ({
  compositePk: primaryKey({ columns: [verificationToken.identifier, verificationToken.token] }),
}))

export type Client = typeof clientsTable.$inferSelect
export type Role = typeof rolesTable.$inferSelect
export type UserRole = typeof userRolesTable.$inferSelect

export const clientsTable = pgTable("client", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  phone: text("phone").notNull().unique(),
  location: text("location"),
  comments: text("comments"),
  email: text("email"),
  userId: text("user_id").references(() => usersTable.id, { onDelete: "set null" }),
})

export const authenticatorsTable = pgTable("authenticator", {
  credentialID: text("credentialID").notNull().unique(),
  userId: text("userId")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  providerAccountId: text("providerAccountId").notNull(),
  credentialPublicKey: text("credentialPublicKey").notNull(),
  counter: integer("counter").notNull(),
  credentialDeviceType: text("credentialDeviceType").notNull(),
  credentialBackedUp: boolean("credentialBackedUp").notNull(),
  transports: text("transports"),
}, (authenticator) => ({
  compositePk: primaryKey({ columns: [authenticator.userId, authenticator.credentialID] }),
}))
