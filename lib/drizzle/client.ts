import { config } from 'dotenv'
config({ path: '.env.local' })

import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'

const connectionString = process.env.DATABASE_URL!

const client = postgres(connectionString, { prepare: false, ssl: 'require' })
export const db = drizzle(client)
