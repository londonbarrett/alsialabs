import crypto from "crypto"
import { eq } from "drizzle-orm"
import { db } from "./client"
import {
  expenseCategoriesTable,
  permissionsTable,
  projectCategoriesTable,
  providersTable,
  rolePermissionsTable,
  rolesTable,
  userRolesTable,
  usersTable,
} from "./schema"

const roles = [
  {
    name: "super",
    description: "Full access to all features and settings",
  },
  {
    name: "admin",
    description: "Can manage clients and access most features",
  },
  { name: "client", description: "Limited access, own data only" },
]

const defaultModules = [
  {
    module: "clients",
    actions: ["view", "create", "edit", "delete", "invite"],
  },
  { module: "products", actions: ["view", "create", "edit", "delete"] },
  { module: "sales", actions: ["view", "create", "edit", "delete"] },
  { module: "permissions", actions: ["manage"] },
  { module: "users", actions: ["manage"] },
  { module: "reports", actions: ["view"] },
  {
    module: "client-activity",
    actions: ["view", "create", "edit", "delete"],
  },
  { module: "projects", actions: ["view", "create", "edit", "delete"] },
  {
    module: "categories",
    actions: ["view", "create", "edit", "delete"],
  },
  { module: "expenses", actions: ["view", "create", "edit", "delete"] },
]

async function seed() {
  for (const role of roles) {
    await db
      .insert(rolesTable)
      .values(role)
      .onConflictDoNothing({ target: rolesTable.name })
  }
  console.log("Roles seeded successfully")

  const seededRoles = await db.select().from(rolesTable)

  const superRole = seededRoles.find((r) => r.name === "super")!
  const adminRole = seededRoles.find((r) => r.name === "admin")!
  const clientRole = seededRoles.find((r) => r.name === "client")!

  for (const mod of defaultModules) {
    for (const action of mod.actions) {
      await db
        .insert(permissionsTable)
        .values({ module: mod.module, action })
        .onConflictDoNothing({
          target: [permissionsTable.module, permissionsTable.action],
        })
    }
  }
  console.log("Permissions seeded successfully")

  const allPermissions = await db.select().from(permissionsTable)

  for (const perm of allPermissions) {
    await db
      .insert(rolePermissionsTable)
      .values({ roleId: superRole.id, permissionId: perm.id })
      .onConflictDoNothing()

    if (
      (perm.module === "clients" ||
        perm.module === "products" ||
        perm.module === "sales" ||
        perm.module === "reports" ||
        perm.module === "client-activity") &&
      perm.action !== "delete"
    ) {
      await db
        .insert(rolePermissionsTable)
        .values({ roleId: adminRole.id, permissionId: perm.id })
        .onConflictDoNothing()
    }

    if (
      (perm.module === "projects" ||
        perm.module === "categories" ||
        perm.module === "expenses") &&
      perm.action === "view"
    ) {
      await db
        .insert(rolePermissionsTable)
        .values({ roleId: adminRole.id, permissionId: perm.id })
        .onConflictDoNothing()
    }
  }

  const clientPermissions = allPermissions.filter(
    (p) => p.module === "client-activity" && p.action === "view"
  )
  for (const perm of clientPermissions) {
    await db
      .insert(rolePermissionsTable)
      .values({ roleId: clientRole.id, permissionId: perm.id })
      .onConflictDoNothing()
  }

  const clientProjectPerms = allPermissions.filter(
    (p) =>
      p.module === "projects" &&
      ["view", "create", "edit", "delete"].includes(p.action)
  )
  for (const perm of clientProjectPerms) {
    await db
      .insert(rolePermissionsTable)
      .values({ roleId: clientRole.id, permissionId: perm.id })
      .onConflictDoNothing()
  }

  const clientExpensePerms = allPermissions.filter(
    (p) =>
      p.module === "expenses" &&
      ["view", "create", "edit", "delete"].includes(p.action)
  )
  for (const perm of clientExpensePerms) {
    await db
      .insert(rolePermissionsTable)
      .values({ roleId: clientRole.id, permissionId: perm.id })
      .onConflictDoNothing()
  }

  console.log(
    "Role-permissions seeded: super gets all, admin gets view/create/edit, clients get projects and expenses"
  )

  const defaultProjectCategories = [
    { slug: "crop" },
    { slug: "infrastructure" },
  ]
  for (const cat of defaultProjectCategories) {
    await db
      .insert(projectCategoriesTable)
      .values(cat)
      .onConflictDoNothing({ target: projectCategoriesTable.slug })
  }
  console.log("Project categories seeded")

  const defaultExpenseCategories = [
    { slug: "supplies" },
    { slug: "labor" },
    { slug: "equipment" },
    { slug: "services" },
    { slug: "transport" },
    { slug: "other" },
  ]
  for (const cat of defaultExpenseCategories) {
    await db
      .insert(expenseCategoriesTable)
      .values(cat)
      .onConflictDoNothing({ target: expenseCategoriesTable.slug })
  }
  console.log("Expense categories seeded")

  const companyName = process.env.COMPANY_NAME || "Alsia Labs"
  const existingProvider = await db
    .select({ id: providersTable.id })
    .from(providersTable)
    .where(eq(providersTable.name, companyName))
    .then((rows) => rows[0])
  if (!existingProvider) {
    await db.insert(providersTable).values({ name: companyName })
    console.log(`Company provider "${companyName}" seeded`)
  } else {
    console.log(
      `Company provider "${companyName}" already exists, skipping`
    )
  }

  const adminEmail = process.env.SUPER_USER_EMAIL
  if (adminEmail) {
    if (superRole) {
      const existing = await db
        .select({ id: usersTable.id })
        .from(usersTable)
        .where(eq(usersTable.email, adminEmail))
        .then((rows) => rows[0])

      if (!existing) {
        const userId = crypto.randomUUID()
        await db.insert(usersTable).values({
          id: userId,
          email: adminEmail,
        })
        await db.insert(userRolesTable).values({
          userId,
          roleId: superRole.id,
        })
        console.log(`Super user created: ${adminEmail}`)
      } else {
        console.log(`User ${adminEmail} already exists, skipping`)
      }
    }
  }

  process.exit(0)
}

seed()
