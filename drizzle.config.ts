import { defineConfig } from "drizzle-kit"
import { config } from "dotenv"

config({ path: ".env.local" })

export default defineConfig({
  schema: "./lib/drizzle/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  migrations: {
    table: "__drizzle_migrations", // Ensure this isn't overridden unexpectedly
    schema: "drizzle", // Explicitly assign the tracking schema
  },
  dbCredentials: {
    url: process.env.DB_DIRECT_URL!,
  },
})
