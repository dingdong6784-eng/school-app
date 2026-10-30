import 'server-only'
import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { loungeRoomMembers, loungeRooms } from '@/lib/db/schema'
import { requireAuthUser } from '@/lib/auth/guard'
import type { PlayerSeat } from '@/lib/arcade-types'

const roomIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function requireRoomMembership(roomId: string) {
  if (!roomIdPattern.test(roomId)) throw new Error('That room could not be found.')
  const { userId } = await requireAuthUser()
  const [membership] = await db
    .select({
      seat: loungeRoomMembers.seat,
      createdByUserId: loungeRooms.createdByUserId,
      createdBySeat: loungeRooms.createdBySeat,
    })
    .from(loungeRoomMembers)
    .innerJoin(loungeRooms, eq(loungeRooms.id, loungeRoomMembers.roomId))
    .where(and(eq(loungeRoomMembers.roomId, roomId), eq(loungeRoomMembers.userId, userId)))
    .limit(1)

  if (!membership) throw new Error('You are not a member of this room.')
  return {
    userId,
    seat: membership.seat as PlayerSeat,
    createdByUserId: membership.createdByUserId,
    createdBySeat: membership.createdBySeat as PlayerSeat,
    isOwner: membership.createdByUserId === userId,
  }
}
