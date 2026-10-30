import 'server-only'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { cookies } from 'next/headers'

const PASSCODE = '101910191019'
const COOKIE_NAME = 'zk-lounge-access'
const SESSION_MAX_AGE = 60 * 60 * 24 * 30

function expectedSessionToken() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) throw new Error('The lounge database is not configured.')

  return createHmac('sha256', databaseUrl).update(`zk-lounge:${PASSCODE}`).digest('hex')
}

function tokenMatches(candidate?: string) {
  if (!candidate) return false
  const expected = Buffer.from(expectedSessionToken())
  const received = Buffer.from(candidate)
  return received.length === expected.length && timingSafeEqual(received, expected)
}

export async function unlockWithPasscode(passcode: string) {
  if (passcode !== PASSCODE) return false

  const cookieStore = await cookies()
  cookieStore.set(COOKIE_NAME, expectedSessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'development',
    sameSite: process.env.NODE_ENV === 'development' ? 'none' : 'strict',
    path: '/',
    maxAge: SESSION_MAX_AGE,
  })

  return true
}

export async function hasLoungeAccess() {
  const cookieStore = await cookies()
  return tokenMatches(cookieStore.get(COOKIE_NAME)?.value)
}

export async function clearLoungeAccess() {
  const cookieStore = await cookies()
  cookieStore.delete(COOKIE_NAME)
}
