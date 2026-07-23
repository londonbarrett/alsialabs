import {
  boolean,
  date,
  decimal,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core"

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

export const permissionsTable = pgTable(
  "permission",
  {
    id: text()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    module: text().notNull(),
    action: text().notNull(),
  },
  (table) => [
    uniqueIndex("permission_module_action_idx").on(
      table.module,
      table.action
    ),
  ]
)

export const rolePermissionsTable = pgTable(
  "role_permission",
  {
    roleId: text("role_id")
      .notNull()
      .references(() => rolesTable.id, { onDelete: "cascade" }),
    permissionId: text("permission_id")
      .notNull()
      .references(() => permissionsTable.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.roleId, table.permissionId] }),
  ]
)

export const accountsTable = pgTable(
  "account",
  {
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
  },
  (account) => [
    primaryKey({
      columns: [account.provider, account.providerAccountId],
    }),
  ]
)

export const sessionsTable = pgTable("session", {
  sessionToken: text().primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  expires: timestamp({ mode: "date" }).notNull(),
})

export const verificationTokensTable = pgTable(
  "verificationToken",
  {
    identifier: text().notNull(),
    token: text().notNull(),
    expires: timestamp({ mode: "date" }).notNull(),
  },
  (verificationToken) => [
    primaryKey({
      columns: [verificationToken.identifier, verificationToken.token],
    }),
  ]
)

export type ClientActivity = typeof clientActivitiesTable.$inferSelect
export type ClientReminder = typeof clientRemindersTable.$inferSelect
export type Client = typeof clientsTable.$inferSelect
export type Role = typeof rolesTable.$inferSelect
export type UserRole = typeof userRolesTable.$inferSelect
export type Provider = typeof providersTable.$inferSelect
export type Product = typeof productsTable.$inferSelect
export type Invoice = typeof invoicesTable.$inferSelect
export type InvoiceItem = typeof invoiceItemsTable.$inferSelect
export type ProjectCategory = typeof projectCategoriesTable.$inferSelect
export type ExpenseCategory = typeof expenseCategoriesTable.$inferSelect
export type Project = typeof projectsTable.$inferSelect
export type ProjectTask = typeof projectTasksTable.$inferSelect
export type TaskComment = typeof taskCommentsTable.$inferSelect
export type Expense = typeof expensesTable.$inferSelect
export type ProjectOwner = typeof projectOwnersTable.$inferSelect
export type ProjectCollaborator =
  typeof projectCollaboratorsTable.$inferSelect

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
  userId: text("user_id").references(() => usersTable.id, {
    onDelete: "set null",
  }),
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
  userId: text("user_id").references(() => usersTable.id, {
    onDelete: "set null",
  }),
  status: text().notNull().default("paid"),
  issueDate: date("issue_date").notNull(),
  notes: text(),
  subtotal: decimal("subtotal", { precision: 12, scale: 2 }).notNull(),
  discountTotal: decimal("discount_total", { precision: 12, scale: 2 })
    .notNull()
    .default("0"),
  taxTotal: decimal("tax_total", { precision: 12, scale: 2 })
    .notNull()
    .default("0"),
  grandTotal: decimal("grand_total", {
    precision: 12,
    scale: 2,
  }).notNull(),
  projectId: text("project_id").references(() => projectsTable.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { mode: "date" })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
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
  unitPrice: decimal("unit_price", {
    precision: 12,
    scale: 2,
  }).notNull(),
  discountPercent: decimal("discount_percent", {
    precision: 5,
    scale: 2,
  })
    .notNull()
    .default("0"),
  taxPercent: decimal("tax_percent", { precision: 5, scale: 2 })
    .notNull()
    .default("0"),
  total: decimal("total", { precision: 12, scale: 2 }).notNull(),
  productId: text("product_id").references(() => productsTable.id),
})

export const clientActivitiesTable = pgTable("client_activity", {
  id: text()
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  clientId: text("client_id")
    .notNull()
    .references(() => clientsTable.id, { onDelete: "cascade" }),
  type: text().notNull().$type<"call" | "email" | "meeting" | "note">(),
  subject: text().notNull(),
  description: text(),
  activityDate: date("activity_date").notNull(),
  performedBy: text("performed_by")
    .notNull()
    .references(() => usersTable.id),
  createdAt: timestamp("created_at", { mode: "date" })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
})

export const clientRemindersTable = pgTable("client_reminder", {
  id: text()
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  clientId: text("client_id")
    .notNull()
    .references(() => clientsTable.id, { onDelete: "cascade" }),
  description: text().notNull(),
  remindAt: date("remind_at").notNull(),
  completed: boolean().notNull().default(false),
  completedAt: timestamp("completed_at", { mode: "date" }),
  createdBy: text("created_by")
    .notNull()
    .references(() => usersTable.id),
  createdAt: timestamp("created_at", { mode: "date" })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
})

export const authenticatorsTable = pgTable(
  "authenticator",
  {
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
  },
  (authenticator) => [
    primaryKey({
      columns: [authenticator.userId, authenticator.credentialID],
    }),
  ]
)

export const projectCategoriesTable = pgTable("project_category", {
  id: text()
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  slug: text().notNull().unique(),
  description: text(),
})

export const expenseCategoriesTable = pgTable("expense_category", {
  id: text()
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  slug: text().notNull().unique(),
  description: text(),
})

export const projectsTable = pgTable("project", {
  id: text()
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  primaryOwnerId: text("primary_owner_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "restrict" }),
  categoryId: text("category_id")
    .notNull()
    .references(() => projectCategoriesTable.id),
  name: text().notNull(),
  description: text(),
  status: text()
    .notNull()
    .default("active")
    .$type<"active" | "completed" | "cancelled" | "archived">(),
  startDate: date("start_date").notNull(),
  endDate: date("end_date"),
  location: text(),
  budget: decimal("budget", { precision: 12, scale: 2 }),
  createdAt: timestamp("created_at", { mode: "date" })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
})

export const projectTasksTable = pgTable("project_task", {
  id: text()
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  projectId: text("project_id")
    .notNull()
    .references(() => projectsTable.id, { onDelete: "cascade" }),
  name: text().notNull(),
  description: text(),
  cost: decimal("cost", { precision: 10, scale: 2 }),
  status: text()
    .notNull()
    .default("todo")
    .$type<"todo" | "in_progress" | "in_review" | "blocked" | "done">(),
  assigneeId: text("assignee_id").references(() => usersTable.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { mode: "date" })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
})

export const taskCommentsTable = pgTable("task_comment", {
  id: text()
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  taskId: text("task_id")
    .notNull()
    .references(() => projectTasksTable.id, { onDelete: "cascade" }),
  authorId: text("author_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  content: text().notNull(),
  createdAt: timestamp("created_at", { mode: "date" })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
})

export const expensesTable = pgTable("expense", {
  id: text()
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  projectId: text("project_id")
    .notNull()
    .references(() => projectsTable.id, { onDelete: "cascade" }),
  categoryId: text("category_id")
    .notNull()
    .references(() => expenseCategoriesTable.id),
  description: text().notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  expenseDate: date("expense_date").notNull(),
  createdAt: timestamp("created_at", { mode: "date" })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
})

export const projectOwnersTable = pgTable(
  "project_owner",
  {
    projectId: text("project_id")
      .notNull()
      .references(() => projectsTable.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.projectId, table.userId] })]
)

export const projectCollaboratorsTable = pgTable(
  "project_collaborator",
  {
    projectId: text("project_id")
      .notNull()
      .references(() => projectsTable.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.projectId, table.userId] })]
)
