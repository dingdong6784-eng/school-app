import { callLounge } from './lounge-api'
import type { GameAction, GameId, GameViewState, PlayerSeat } from './arcade-types'
import type { CatalogMovie, LoungeMediaState } from './watch-party-types'

export type LoungeAuthor = 'Him' | 'Her'
export type LoungeReaction = '❤️' | '🍿' | '🎮' | '😮' | '😂'
export type LoungeMessage = { id: string; author: LoungeAuthor; body: string; reaction: LoungeReaction | null; createdAt: string }
export type LoungeUser = { id: string; role: 'host' | 'partner'; name: string }
export type RoomSnapshot = {
  id: string
  currentSeat: PlayerSeat
  createdBySeat: PlayerSeat
  isOwner: boolean
  createdAt: string
  inviteExpiresAt: string
  members: Array<{ seat: PlayerSeat; joinedAt: string; online: boolean; isYou: boolean }>
}
export type GameSnapshot = { gameId: GameId; version: number; playerSeat: PlayerSeat; state: GameViewState }
export type CatalogResponse = { items: CatalogMovie[]; safeMode: boolean }

export type UnlockResult = { ok: true; token: string; user: LoungeUser } | { ok: false; message: string }

export function unlockLounge(passcode: string) {
  return callLounge<UnlockResult>('unlock', { passcode })
}

export async function restoreLoungeSession(): Promise<LoungeUser | null> {
  try {
    const result = await callLounge<{ user: LoungeUser }>('session')
    return result.user
  } catch {
    return null
  }
}

export function lockLounge() {
  return callLounge<{ ok: true }>('lock')
}

export function getPartnerPresence() {
  return callLounge<{ partnerOnline: boolean }>('presence')
}

export function getMyRoom() {
  return callLounge<RoomSnapshot | null>('myRoom')
}

export function createRoom(seat: PlayerSeat) {
  return callLounge<{ roomId: string; inviteToken: string }>('createRoom', { seat })
}

export function joinRoom(inviteToken: string) {
  return callLounge<{ roomId: string }>('joinRoom', { inviteToken })
}

export function rotateRoomInvite(roomId: string) {
  return callLounge<{ inviteToken: string }>('rotateInvite', { roomId })
}

export function getGameView(roomId: string, gameId: GameId) {
  return callLounge<GameSnapshot>('getGame', { roomId, gameId })
}

export function makeGameMove(roomId: string, gameId: GameId, move: GameAction) {
  return callLounge<GameSnapshot>('makeMove', { roomId, gameId, move })
}

export function resetGame(roomId: string, gameId: GameId) {
  return callLounge<GameSnapshot>('resetGame', { roomId, gameId })
}

export function listLoungeMessages(roomId: string) {
  return callLounge<LoungeMessage[]>('listMessages', { roomId })
}

export function sendLoungeMessage(roomId: string, text: string) {
  return callLounge<LoungeMessage>('sendMessage', { roomId, text })
}

export function reactToLoungeMessage(roomId: string, id: string, reaction: LoungeReaction) {
  return callLounge<{ id: string; reaction: LoungeReaction } | null>('reactMessage', { roomId, id, reaction })
}

export function getLoungeMediaState(roomId: string) {
  return callLounge<LoungeMediaState>('getMedia', { roomId })
}

export function updateLoungeMediaState(roomId: string, patch: Partial<LoungeMediaState>) {
  return callLounge<LoungeMediaState>('updateMedia', { roomId, patch })
}

export function getCatalog(category: string, query: string, safe: boolean) {
  return callLounge<CatalogResponse>('catalog', { category, query, safe })
}
