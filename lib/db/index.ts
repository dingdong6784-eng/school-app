import 'server-only'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from './schema'

const globalForPool = globalThis as typeof globalThis & { loungePool?: Pool }

export const pool =
  globalForPool.loungePool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 4,
    idleTimeoutMillis: 20_000,
    connectionTimeoutMillis: 5_000,
  })

if (process.env.NODE_ENV !== 'production') globalForPool.loungePool = pool

export const db = drizzle(pool, { schema })
