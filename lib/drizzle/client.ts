import { config } from 'dotenv'
config({ path: '.env.local' })

import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'

const connectionString = process.env.DATABASE_URL!

const globalForDb = globalThis as unknown as {
  _postgresClient?: ReturnType<typeof postgres>
}

const client =
  globalForDb._postgresClient ??
  postgres(connectionString, {
    prepare: false,
    ssl: 'require',
    max: 10,
    idle_timeout: 20,
    max_lifetime: 60 * 30,
  })

if (process.env.NODE_ENV !== 'production') {
  globalForDb._postgresClient = client
}

export const db = drizzle(client)
