import { defineConfig } from "drizzle-kit"
import { config } from "dotenv"

config({ path: ".env.local" })

export default defineConfig({
  schema: "./lib/drizzle/schema.ts",
  out: "./lib/drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DB_DIRECT_URL!,
  },
  migrations: {
    schema: "drizzle",
    table: "__drizzle_migrations",
  },
})
