import 'server-only'

import { createHash } from 'node:crypto'
import { and, eq, gt, lt } from 'drizzle-orm'
import { cookies } from 'next/headers'
import { db } from '@/lib/db'
import { loungeAccessSessions } from '@/lib/db/schema'

export type LoungeRole = 'host' | 'partner'

const sessionCookieName = 'lounge_session'
const sessionLifetimeMs = 30 * 24 * 60 * 60 * 1000

export function hashSessionToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

export async function getLoungeSession() {
  const token = (await cookies()).get(sessionCookieName)?.value
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return null

  const tokenHash = hashSessionToken(token)
  const now = new Date()
  const [session] = await db
    .select({ role: loungeAccessSessions.role, expiresAt: loungeAccessSessions.expiresAt, lastSeenAt: loungeAccessSessions.lastSeenAt })
    .from(loungeAccessSessions)
    .where(and(eq(loungeAccessSessions.tokenHash, tokenHash), gt(loungeAccessSessions.expiresAt, now)))
    .limit(1)

  if (!session || (session.role !== 'host' && session.role !== 'partner')) return null

  const heartbeatThreshold = new Date(now.getTime() - 15_000)
  if (session.lastSeenAt < heartbeatThreshold) {
    await db
      .update(loungeAccessSessions)
      .set({ lastSeenAt: now })
      .where(and(eq(loungeAccessSessions.tokenHash, tokenHash), lt(loungeAccessSessions.lastSeenAt, heartbeatThreshold)))
  }

  return {
    role: session.role as LoungeRole,
    userId: `lounge-${session.role}`,
    name: session.role === 'host' ? 'Host' : 'Partner',
  }
}

export const loungeSessionLifetime = sessionLifetimeMs
export const loungeSessionCookieName = sessionCookieName
