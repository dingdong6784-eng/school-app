'use server'

import { createHash, randomBytes } from 'node:crypto'
import { and, desc, eq, lt } from 'drizzle-orm'
import { db } from '@/lib/db'
import { loungeGameStates, loungeRoomMembers, loungeRooms } from '@/lib/db/schema'
import { requireAuthUser } from '@/lib/auth/guard'
import { requireRoomMembership } from '@/lib/room-auth'
import { applyGameAction, createInitialGameState, projectGameState } from '@/lib/arcade-engine'
import { gameIds, otherSeat, type GameAction, type GameId, type GameViewState, type PlayerSeat } from '@/lib/arcade-types'

const inviteLifetimeMs = 7 * 24 * 60 * 60 * 1000
const inviteTokenPattern = /^[A-Za-z0-9_-]{43}$/
const roomIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function hashInviteToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

function createInviteToken() {
  return randomBytes(32).toString('base64url')
}

function isSeat(value: string): value is PlayerSeat {
  return value === 'Z' || value === 'A'
}

function isGameId(value: string): value is GameId {
  return gameIds.includes(value as GameId)
}

export async function createRoom(seat: PlayerSeat) {
  if (!isSeat(seat)) throw new Error('Choose a valid seat.')
  const { userId } = await requireAuthUser()
  const token = createInviteToken()
  const now = new Date()
  const [room] = await db.transaction(async (tx) => {
    const [createdRoom] = await tx
      .insert(loungeRooms)
      .values({
        createdByUserId: userId,
        createdBySeat: seat,
        inviteTokenHash: hashInviteToken(token),
        inviteExpiresAt: new Date(now.getTime() + inviteLifetimeMs),
      })
      .returning({ id: loungeRooms.id })
    await tx.insert(loungeRoomMembers).values({ roomId: createdRoom.id, userId, seat })
    return [createdRoom]
  })
  return { roomId: room.id, inviteToken: token }
}

export async function joinRoom(token: string) {
  if (typeof token !== 'string' || !inviteTokenPattern.test(token)) throw new Error('That invitation link is not valid.')
  const { userId } = await requireAuthUser()
  const tokenHash = hashInviteToken(token)

  return db.transaction(async (tx) => {
    const [room] = await tx
      .select()
      .from(loungeRooms)
      .where(eq(loungeRooms.inviteTokenHash, tokenHash))
      .for('update')
      .limit(1)

    if (!room || room.inviteExpiresAt.getTime() <= Date.now()) throw new Error('That invitation has expired or is no longer available.')
    if (room.createdByUserId === userId) throw new Error('Unlock with the other passcode to join your invitation.')

    const [existingMember] = await tx
      .select({ roomId: loungeRoomMembers.roomId })
      .from(loungeRoomMembers)
      .where(and(eq(loungeRoomMembers.roomId, room.id), eq(loungeRoomMembers.userId, userId)))
      .limit(1)
    if (existingMember) return { roomId: room.id }

    const members = await tx
      .select({ userId: loungeRoomMembers.userId })
      .from(loungeRoomMembers)
      .where(eq(loungeRoomMembers.roomId, room.id))
      .limit(2)
    if (members.length >= 2) throw new Error('Both seats in this room are already claimed.')

    await tx.insert(loungeRoomMembers).values({
      roomId: room.id,
      userId,
      seat: otherSeat(room.createdBySeat as PlayerSeat),
    })
    return { roomId: room.id }
  })
}

export async function getMyRoom() {
  const { userId } = await requireAuthUser()
  const [membership] = await db
    .select({ roomId: loungeRoomMembers.roomId, seat: loungeRoomMembers.seat, joinedAt: loungeRoomMembers.joinedAt })
    .from(loungeRoomMembers)
    .where(eq(loungeRoomMembers.userId, userId))
    .orderBy(desc(loungeRoomMembers.joinedAt))
    .limit(1)

  if (!membership) return null

  const heartbeatThreshold = new Date(Date.now() - 15_000)
  await db
    .update(loungeRoomMembers)
    .set({ lastSeenAt: new Date() })
    .where(and(
      eq(loungeRoomMembers.roomId, membership.roomId),
      eq(loungeRoomMembers.userId, userId),
      lt(loungeRoomMembers.lastSeenAt, heartbeatThreshold),
    ))

  const [room] = await db.select().from(loungeRooms).where(eq(loungeRooms.id, membership.roomId)).limit(1)
  if (!room) return null

  const members = await db.select().from(loungeRoomMembers).where(eq(loungeRoomMembers.roomId, room.id))
  const now = Date.now()
  return {
    id: room.id,
    currentSeat: membership.seat as PlayerSeat,
    createdBySeat: room.createdBySeat as PlayerSeat,
    isOwner: room.createdByUserId === userId,
    createdAt: room.createdAt.toISOString(),
    inviteExpiresAt: room.inviteExpiresAt.toISOString(),
    members: members.map((member) => ({
      seat: member.seat as PlayerSeat,
      joinedAt: member.joinedAt.toISOString(),
      online: now - member.lastSeenAt.getTime() < 40_000,
      isYou: member.userId === userId,
    })),
  }
}

export async function rotateRoomInvite(roomId: string) {
  if (!roomIdPattern.test(roomId)) throw new Error('That room could not be found.')
  const membership = await requireRoomMembership(roomId)
  if (!membership.isOwner) throw new Error('Only the person who created this room can make an invitation.')

  const token = createInviteToken()
  const [room] = await db
    .update(loungeRooms)
    .set({ inviteTokenHash: hashInviteToken(token), inviteExpiresAt: new Date(Date.now() + inviteLifetimeMs) })
    .where(and(eq(loungeRooms.id, roomId), eq(loungeRooms.createdByUserId, membership.userId)))
    .returning({ id: loungeRooms.id })

  if (!room) throw new Error('That room could not be found.')
  return { inviteToken: token }
}

async function getRoomGameRow(roomId: string, gameId: GameId, creatorSeat: PlayerSeat) {
  return db.transaction(async (tx) => {
    let [row] = await tx
      .select()
      .from(loungeGameStates)
      .where(and(eq(loungeGameStates.roomId, roomId), eq(loungeGameStates.gameId, gameId)))
      .for('update')
      .limit(1)

    if (!row) {
      await tx.insert(loungeGameStates).values({
        roomId,
        gameId,
        state: createInitialGameState(gameId, creatorSeat),
      }).onConflictDoNothing()
      ;[row] = await tx
        .select()
        .from(loungeGameStates)
        .where(and(eq(loungeGameStates.roomId, roomId), eq(loungeGameStates.gameId, gameId)))
        .for('update')
        .limit(1)
    }

    if (!row) throw new Error('This game could not be opened.')
    return row
  })
}

export async function getGameView(roomId: string, gameId: GameId) {
  if (!isGameId(gameId)) throw new Error('Choose a valid game.')
  const membership = await requireRoomMembership(roomId)
  const row = await getRoomGameRow(roomId, gameId, membership.createdBySeat)
  return {
    gameId,
    version: row.version,
    playerSeat: membership.seat,
    state: projectGameState(gameId, row.state as never, membership.seat),
  }
}

export async function makeGameMove(roomId: string, gameId: GameId, action: GameAction) {
  if (!isGameId(gameId)) throw new Error('Choose a valid game.')
  const membership = await requireRoomMembership(roomId)
  const result = await db.transaction(async (tx) => {
    let [row] = await tx
      .select()
      .from(loungeGameStates)
      .where(and(eq(loungeGameStates.roomId, roomId), eq(loungeGameStates.gameId, gameId)))
      .for('update')
      .limit(1)

    if (!row) {
      await tx.insert(loungeGameStates).values({
        roomId,
        gameId,
        state: createInitialGameState(gameId, membership.createdBySeat),
      }).onConflictDoNothing()
      ;[row] = await tx
        .select()
        .from(loungeGameStates)
        .where(and(eq(loungeGameStates.roomId, roomId), eq(loungeGameStates.gameId, gameId)))
        .for('update')
        .limit(1)
    }

    if (!row) throw new Error('This game could not be opened.')
    const nextState = applyGameAction(gameId, row.state as never, membership.seat, action)
    const [updated] = await tx
      .update(loungeGameStates)
      .set({ state: nextState, version: row.version + 1, updatedAt: new Date() })
      .where(and(eq(loungeGameStates.roomId, roomId), eq(loungeGameStates.gameId, gameId)))
      .returning({ state: loungeGameStates.state, version: loungeGameStates.version })
    return updated
  })

  return {
    gameId,
    version: result.version,
    playerSeat: membership.seat,
    state: projectGameState(gameId, result.state as never, membership.seat),
  }
}

export async function resetGame(roomId: string, gameId: GameId) {
  if (!roomIdPattern.test(roomId) || !isGameId(gameId)) throw new Error('Choose a valid game room.')
  const membership = await requireRoomMembership(roomId)
  const state = createInitialGameState(gameId, membership.createdBySeat)
  const [updated] = await db
    .insert(loungeGameStates)
    .values({ roomId, gameId, state })
    .onConflictDoUpdate({
      target: [loungeGameStates.roomId, loungeGameStates.gameId],
      set: { state, version: 1, updatedAt: new Date() },
    })
    .returning({ state: loungeGameStates.state, version: loungeGameStates.version })

  return {
    gameId,
    version: updated.version,
    playerSeat: membership.seat,
    state: projectGameState(gameId, updated.state as never, membership.seat),
  }
}
