import crypto from "crypto"
import { eq } from "drizzle-orm"
import { db } from "./client"
import {
  categoryTable,
  permissionsTable,
  storesTable,
  rolePermissionsTable,
  rolesTable,
  taxonomyTable,
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
    description: "Can manage global data and settings",
  },
  {
    name: "retailer",
    description: "Owns and manages their own store data",
  },
  { name: "user", description: "Limited access, own data only" },
]

const defaultModules = [
  {
    module: "clients",
    actions: ["view", "create", "edit", "delete", "invite"],
  },
  { module: "products", actions: ["view", "create", "edit", "delete"] },
  { module: "sales",         actions: ["view", "create", "edit", "delete", "record-payment"] },
  { module: "permissions", actions: ["manage"] },
  { module: "users", actions: ["manage"] },
  { module: "activity", actions: ["view"] },
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
  const retailerRole = seededRoles.find((r) => r.name === "retailer")!
  const userRole = seededRoles.find((r) => r.name === "user")!

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
        perm.module === "activity" ||
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

  const retailModules = [
    "clients",
    "products",
    "sales",
    "client-activity",
  ]
  for (const perm of allPermissions) {
    const isRetailerModule = retailModules.includes(perm.module)
    if (
      (isRetailerModule && perm.action !== "invite") ||
      (perm.module === "activity" && perm.action === "view")
    ) {
      await db
        .insert(rolePermissionsTable)
        .values({ roleId: retailerRole.id, permissionId: perm.id })
        .onConflictDoNothing()
    }
  }

  const userPermissions = allPermissions.filter(
    (p) => p.module === "client-activity" && p.action === "view"
  )
  for (const perm of userPermissions) {
    await db
      .insert(rolePermissionsTable)
      .values({ roleId: userRole.id, permissionId: perm.id })
      .onConflictDoNothing()
  }

  const userProjectPerms = allPermissions.filter(
    (p) =>
      p.module === "projects" &&
      ["view", "create", "edit", "delete"].includes(p.action)
  )
  for (const perm of userProjectPerms) {
    await db
      .insert(rolePermissionsTable)
      .values({ roleId: userRole.id, permissionId: perm.id })
      .onConflictDoNothing()
  }

  const userExpensePerms = allPermissions.filter(
    (p) =>
      p.module === "expenses" &&
      ["view", "create", "edit", "delete"].includes(p.action)
  )
  for (const perm of userExpensePerms) {
    await db
      .insert(rolePermissionsTable)
      .values({ roleId: userRole.id, permissionId: perm.id })
      .onConflictDoNothing()
  }

  console.log(
    "Role-permissions seeded: super gets all, admin gets view/create/edit, users get projects and expenses"
  )

  const defaultTaxonomies = [
    { slug: "project", name: "Project Categories" },
    { slug: "expense", name: "Expense Categories" },
  ]
  for (const tax of defaultTaxonomies) {
    await db
      .insert(taxonomyTable)
      .values(tax)
      .onConflictDoNothing({ target: taxonomyTable.slug })
  }
  console.log("Taxonomies seeded")

  const seededTaxonomies = await db.select().from(taxonomyTable)
  const projectTaxonomy = seededTaxonomies.find(
    (t) => t.slug === "project"
  )!
  const expenseTaxonomy = seededTaxonomies.find(
    (t) => t.slug === "expense"
  )!

  const defaultProjectCategories = [
    { slug: "crop", name: "Crop" },
    { slug: "infrastructure", name: "Infrastructure" },
  ]
  for (const cat of defaultProjectCategories) {
    await db
      .insert(categoryTable)
      .values({ ...cat, taxonomyId: projectTaxonomy.id })
      .onConflictDoNothing({
        target: [categoryTable.taxonomyId, categoryTable.slug],
      })
  }
  console.log("Project categories seeded")

  const defaultExpenseCategories = [
    { slug: "supplies", name: "Supplies" },
    { slug: "labor", name: "Labor" },
    { slug: "equipment", name: "Equipment" },
    { slug: "services", name: "Services" },
    { slug: "transport", name: "Transport" },
    { slug: "other", name: "Other" },
  ]
  for (const cat of defaultExpenseCategories) {
    await db
      .insert(categoryTable)
      .values({ ...cat, taxonomyId: expenseTaxonomy.id })
      .onConflictDoNothing({
        target: [categoryTable.taxonomyId, categoryTable.slug],
      })
  }
  console.log("Expense categories seeded")

  const adminEmail = process.env.ALSIA_STORE_EMAIL
  let superUserId: string | undefined

  if (adminEmail && superRole) {
    const existing = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.email, adminEmail))
      .then((rows) => rows[0])

    if (!existing) {
      superUserId = crypto.randomUUID()
      await db.insert(usersTable).values({
        id: superUserId,
        email: adminEmail,
      })
      await db.insert(userRolesTable).values({
        userId: superUserId,
        roleId: superRole.id,
      })
      console.log(`Super user created: ${adminEmail}`)
    } else {
      superUserId = existing.id
      console.log(`User ${adminEmail} already exists, skipping`)
    }
  }

  const companyName = process.env.COMPANY_NAME || "Alsia Labs"
  const existingStore = await db
    .select({ id: storesTable.id })
    .from(storesTable)
    .where(eq(storesTable.name, companyName))
    .then((rows) => rows[0])
  if (!existingStore && superUserId) {
    await db.insert(storesTable).values({
      name: companyName,
      owner_id: superUserId,
    })
    console.log(`Company store "${companyName}" seeded`)
  } else if (existingStore) {
    console.log(
      `Company store "${companyName}" already exists, skipping`
    )
  } else {
    console.log("Skipping store seed: no super user available")
  }

  process.exit(0)
}

seed()
