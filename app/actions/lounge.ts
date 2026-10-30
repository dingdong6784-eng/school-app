'use server'

import { and, desc, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { coupleMessages } from '@/lib/db/schema'
import { requireRoomMembership } from '@/lib/room-auth'

const QUICK_REACTIONS = ['❤️', '🍿', '🎮', '😮', '😂'] as const
export type LoungeAuthor = 'Him' | 'Her'
export type LoungeReaction = (typeof QUICK_REACTIONS)[number]

function authorForSeat(seat: 'Z' | 'A'): LoungeAuthor {
  return seat === 'Z' ? 'Him' : 'Her'
}

export async function listLoungeMessages(roomId: string) {
  await requireRoomMembership(roomId)
  const rows = await db
    .select({
      id: coupleMessages.id,
      author: coupleMessages.author,
      body: coupleMessages.body,
      reaction: coupleMessages.reaction,
      createdAt: coupleMessages.createdAt,
    })
    .from(coupleMessages)
    .where(eq(coupleMessages.roomId, roomId))
    .orderBy(desc(coupleMessages.createdAt))
    .limit(100)

  return rows.reverse().map((row) => ({ ...row, createdAt: row.createdAt.toISOString() }))
}

export async function sendLoungeMessage(roomId: string, text: string) {
  const membership = await requireRoomMembership(roomId)
  if (typeof text !== 'string') throw new Error('Messages must be plain text.')
  const body = text.trim()
  if (!body || body.length > 1000) throw new Error('Messages must be between 1 and 1000 characters.')

  const [message] = await db
    .insert(coupleMessages)
    .values({ roomId, author: authorForSeat(membership.seat), body })
    .returning({
      id: coupleMessages.id,
      author: coupleMessages.author,
      body: coupleMessages.body,
      reaction: coupleMessages.reaction,
      createdAt: coupleMessages.createdAt,
    })

  return { ...message, createdAt: message.createdAt.toISOString() }
}

export async function reactToLoungeMessage(roomId: string, id: string, reaction: LoungeReaction) {
  await requireRoomMembership(roomId)
  if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id) || !QUICK_REACTIONS.includes(reaction)) {
    throw new Error('That reaction is not available.')
  }

  const [updated] = await db
    .update(coupleMessages)
    .set({ reaction })
    .where(and(eq(coupleMessages.id, id), eq(coupleMessages.roomId, roomId)))
    .returning({ id: coupleMessages.id, reaction: coupleMessages.reaction })

  return updated ?? null
}
