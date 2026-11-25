import { defineConfig } from "drizzle-kit"
import { config } from "dotenv"

config({ path: ".env.local" })

// Migration 0033 converts legacy `timestamp` columns to `timestamptz` by
// interpreting their wall clocks as UTC. Pin that assumption on the migration
// connection itself so a server/session default in another zone cannot shift
// historical instants. The option value is URL-encoded (space and `=`).
const directUrl = process.env.DB_DIRECT_URL!
const separator = directUrl.includes("?") ? "&" : "?"
const migrationUrl = `${directUrl}${separator}options=${encodeURIComponent(
  "-c timezone=UTC"
)}`

export default defineConfig({
  schema: "./lib/drizzle/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  migrations: {
    table: "__drizzle_migrations", // Ensure this isn't overridden unexpectedly
    schema: "drizzle", // Explicitly assign the tracking schema
  },
  dbCredentials: {
    url: migrationUrl,
  },
})
