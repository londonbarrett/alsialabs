import { pgTable, text, timestamp, integer, primaryKey, boolean, uniqueIndex, decimal, date } from 'drizzle-orm/pg-core'

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
export type Provider = typeof providersTable.$inferSelect
export type Product = typeof productsTable.$inferSelect
export type Invoice = typeof invoicesTable.$inferSelect
export type InvoiceItem = typeof invoiceItemsTable.$inferSelect

export const providersTable = pgTable("provider", {
  id: text()
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text().notNull(),
  contact_name: text(),
  email: text(),
  phone: text(),
})

export const productsTable = pgTable("product", {
  id: text()
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text().notNull(),
  description: text(),
  provider_id: text("provider_id")
    .notNull()
    .references(() => providersTable.id),
  sku: text().unique(),
  unit: text(),
})

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

export const invoicesTable = pgTable("invoice", {
  id: text()
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  type: text().notNull().$type<"product" | "service">(),
  invoiceNumber: text("invoice_number").notNull().unique(),
  clientId: text("client_id")
    .notNull()
    .references(() => clientsTable.id),
  status: text().notNull().default("paid"),
  issueDate: date("issue_date").notNull(),
  notes: text(),
  subtotal: decimal("subtotal", { precision: 12, scale: 2 }).notNull(),
  discountTotal: decimal("discount_total", { precision: 12, scale: 2 }).notNull().default("0"),
  taxTotal: decimal("tax_total", { precision: 12, scale: 2 }).notNull().default("0"),
  grandTotal: decimal("grand_total", { precision: 12, scale: 2 }).notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow().$onUpdate(() => new Date()),
})

export const invoiceItemsTable = pgTable("invoice_item", {
  id: text()
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  invoiceId: text("invoice_id")
    .notNull()
    .references(() => invoicesTable.id, { onDelete: "cascade" }),
  description: text().notNull(),
  quantity: decimal("quantity", { precision: 12, scale: 2 }).notNull(),
  unitPrice: decimal("unit_price", { precision: 12, scale: 2 }).notNull(),
  discountPercent: decimal("discount_percent", { precision: 5, scale: 2 }).notNull().default("0"),
  taxPercent: decimal("tax_percent", { precision: 5, scale: 2 }).notNull().default("0"),
  total: decimal("total", { precision: 12, scale: 2 }).notNull(),
  productId: text("product_id").references(() => productsTable.id),
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
