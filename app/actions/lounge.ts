'use server'

import { and, asc, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { coupleMessages } from '@/lib/db/schema'
import { clearLoungeAccess, hasLoungeAccess, unlockWithPasscode } from '@/lib/lounge-access'

const ROOM_ID = 'z-k-lounge'
const QUICK_REACTIONS = ['❤️', '🍿', '🎮', '😮', '😂'] as const
export type LoungeAuthor = 'Him' | 'Her'
export type LoungeReaction = (typeof QUICK_REACTIONS)[number]

async function requireAccess() {
  if (!(await hasLoungeAccess())) throw new Error('Unlock the lounge to continue.')
}

export async function unlockLounge(passcode: string) {
  return unlockWithPasscode(passcode)
}

export async function checkLoungeSession() {
  return hasLoungeAccess()
}

export async function lockLounge() {
  await clearLoungeAccess()
  return true
}

export async function listLoungeMessages() {
  await requireAccess()

  const rows = await db
    .select({
      id: coupleMessages.id,
      author: coupleMessages.author,
      body: coupleMessages.body,
      reaction: coupleMessages.reaction,
      createdAt: coupleMessages.createdAt,
    })
    .from(coupleMessages)
    .where(eq(coupleMessages.roomId, ROOM_ID))
    .orderBy(asc(coupleMessages.createdAt))
    .limit(100)

  return rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() }))
}

export async function sendLoungeMessage(author: LoungeAuthor, text: string) {
  await requireAccess()
  if (author !== 'Him' && author !== 'Her') throw new Error('Choose a valid chat profile.')
  const body = text.trim()
  if (!body || body.length > 1000) throw new Error('Messages must be between 1 and 1000 characters.')

  const [message] = await db
    .insert(coupleMessages)
    .values({ roomId: ROOM_ID, author, body })
    .returning({
      id: coupleMessages.id,
      author: coupleMessages.author,
      body: coupleMessages.body,
      reaction: coupleMessages.reaction,
      createdAt: coupleMessages.createdAt,
    })

  return { ...message, createdAt: message.createdAt.toISOString() }
}

export async function reactToLoungeMessage(id: string, reaction: LoungeReaction) {
  await requireAccess()
  if (!/^[0-9a-f-]{36}$/i.test(id) || !QUICK_REACTIONS.includes(reaction)) {
    throw new Error('That reaction is not available.')
  }

  const [updated] = await db
    .update(coupleMessages)
    .set({ reaction })
    .where(and(eq(coupleMessages.id, id), eq(coupleMessages.roomId, ROOM_ID)))
    .returning({ id: coupleMessages.id, reaction: coupleMessages.reaction })

  return updated ?? null
}
