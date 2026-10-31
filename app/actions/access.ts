'use server'

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { and, eq, lte, sql } from 'drizzle-orm'
import { cookies, headers } from 'next/headers'
import { db } from '@/lib/db'
import { loungeAccessAttempts, loungeAccessSessions } from '@/lib/db/schema'
import { getLoungeSession, hashSessionToken, loungeSessionCookieName, loungeSessionLifetime } from '@/lib/auth/passcode-session'
import { requireAuthUser } from '@/lib/auth/guard'

const maxAttempts = 5
const attemptWindowMs = 15 * 60 * 1000
const lockoutMs = 15 * 60 * 1000
const presenceWindowMs = 45_000

function getServerSecret() {
  const secret = process.env.NEON_AUTH_COOKIE_SECRET
  if (!secret) throw new Error('Lounge access is not configured.')
  return secret
}

function safeEqual(value: string, expected: string) {
  const valueBuffer = Buffer.from(value)
  const expectedBuffer = Buffer.from(expected)
  return valueBuffer.length === expectedBuffer.length && timingSafeEqual(valueBuffer, expectedBuffer)
}

async function getAttemptKey() {
  const requestHeaders = await headers()
  const forwardedFor = requestHeaders.get('x-vercel-forwarded-for') ?? requestHeaders.get('x-forwarded-for')
  const clientAddress = forwardedFor?.split(',')[0]?.trim() || requestHeaders.get('x-real-ip') || 'unknown'
  return createHmac('sha256', getServerSecret()).update(clientAddress).digest('hex')
}

async function recordFailedAttempt(ipHash: string, now: Date) {
  const windowStart = new Date(now.getTime() - attemptWindowMs)
  const lockedUntil = new Date(now.getTime() + lockoutMs)

  await db
    .insert(loungeAccessAttempts)
    .values({ ipHash, attemptCount: 1, windowStartedAt: now })
    .onConflictDoUpdate({
      target: loungeAccessAttempts.ipHash,
      set: {
        attemptCount: sql`CASE WHEN ${loungeAccessAttempts.windowStartedAt} <= ${windowStart} THEN 1 ELSE ${loungeAccessAttempts.attemptCount} + 1 END`,
        windowStartedAt: sql`CASE WHEN ${loungeAccessAttempts.windowStartedAt} <= ${windowStart} THEN ${now} ELSE ${loungeAccessAttempts.windowStartedAt} END`,
        lockedUntil: sql`CASE WHEN ${loungeAccessAttempts.windowStartedAt} <= ${windowStart} THEN NULL WHEN ${loungeAccessAttempts.attemptCount} + 1 >= ${maxAttempts} THEN ${lockedUntil} ELSE ${loungeAccessAttempts.lockedUntil} END`,
      },
    })
}

async function clearFailedAttempts(ipHash: string) {
  await db.delete(loungeAccessAttempts).where(eq(loungeAccessAttempts.ipHash, ipHash))
}

export async function unlockLounge(passcode: string) {
  if (typeof passcode !== 'string' || !/^\d{4}$/.test(passcode)) {
    return { ok: false as const, message: 'Enter your four-digit passcode.' }
  }

  const ipHash = await getAttemptKey()
  const now = new Date()
  const [attempt] = await db
    .select({ lockedUntil: loungeAccessAttempts.lockedUntil })
    .from(loungeAccessAttempts)
    .where(eq(loungeAccessAttempts.ipHash, ipHash))
    .limit(1)

  if (attempt?.lockedUntil && attempt.lockedUntil > now) {
    const minutes = Math.max(1, Math.ceil((attempt.lockedUntil.getTime() - now.getTime()) / 60_000))
    return { ok: false as const, message: `Too many attempts. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.` }
  }

  const hostCode = process.env.LOUNGE_HOST_PASSCODE
  const partnerCode = process.env.LOUNGE_PARTNER_PASSCODE
  if (!hostCode || !partnerCode || !/^\d{4}$/.test(hostCode) || !/^\d{4}$/.test(partnerCode) || hostCode === partnerCode) {
    return { ok: false as const, message: 'Lounge access is not configured. Please check the passcode settings.' }
  }

  const isHost = safeEqual(passcode, hostCode)
  const isPartner = safeEqual(passcode, partnerCode)
  const role = isHost ? 'host' : isPartner ? 'partner' : null

  if (!role) {
    await recordFailedAttempt(ipHash, now)
    return { ok: false as const, message: 'That passcode didn’t match. Please try again.' }
  }

  const token = randomBytes(32).toString('base64url')
  const expiresAt = new Date(now.getTime() + loungeSessionLifetime)
  const sessionValues = {
    tokenHash: hashSessionToken(token),
    lastSeenAt: now,
    expiresAt,
  }

  const [created] = await db
    .insert(loungeAccessSessions)
    .values({ role, ...sessionValues })
    .onConflictDoNothing({ target: loungeAccessSessions.role })
    .returning({ role: loungeAccessSessions.role })

  let reserved = Boolean(created)
  if (!reserved) {
    const [replaced] = await db
      .update(loungeAccessSessions)
      .set(sessionValues)
      .where(and(eq(loungeAccessSessions.role, role), lte(loungeAccessSessions.expiresAt, now)))
      .returning({ role: loungeAccessSessions.role })
    reserved = Boolean(replaced)
  }

  if (!reserved) {
    return { ok: false as const, message: 'That passcode is already active in another browser. Lock that session first.' }
  }

  await clearFailedAttempts(ipHash)
  const cookieStore = await cookies()
  cookieStore.set(loungeSessionCookieName, token, {
    httpOnly: true,
    secure: true,
    sameSite: process.env.NODE_ENV === 'development' ? 'none' : 'lax',
    path: '/',
    expires: expiresAt,
  })

  return { ok: true as const }
}

export async function lockLounge() {
  const cookieStore = await cookies()
  const token = cookieStore.get(loungeSessionCookieName)?.value
  if (token && /^[A-Za-z0-9_-]{43}$/.test(token)) {
    await db.delete(loungeAccessSessions).where(eq(loungeAccessSessions.tokenHash, hashSessionToken(token)))
  }
  cookieStore.delete(loungeSessionCookieName)
}

export async function getPartnerPresence() {
  const { role } = await requireAuthUser()
  const partnerRole = role === 'host' ? 'partner' : 'host'
  const [partnerSession] = await db
    .select({ lastSeenAt: loungeAccessSessions.lastSeenAt, expiresAt: loungeAccessSessions.expiresAt })
    .from(loungeAccessSessions)
    .where(eq(loungeAccessSessions.role, partnerRole))
    .limit(1)

  const now = Date.now()
  return {
    partnerOnline: Boolean(partnerSession && partnerSession.expiresAt.getTime() > now && now - partnerSession.lastSeenAt.getTime() < presenceWindowMs),
  }
}
