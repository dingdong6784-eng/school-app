'use server'

import { and, eq, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { loungeGameStates } from '@/lib/db/schema'
import { requireRoomMembership } from '@/lib/room-auth'
import { defaultLoungeMediaState, type CatalogMovie, type LoungeMediaState } from '@/lib/watch-party-types'

const mediaStateId = 'watch-party-media'
const roomIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function normalizeStreamUrl(value: unknown) {
  if (typeof value !== 'string' || value.length > 2048) return null
  try {
    const url = new URL(value.trim())
    if (url.protocol !== 'https:') return null
    const hostname = url.hostname.toLowerCase()
    const videoFile = /\.(mp4|webm|ogg)$/i.test(url.pathname)
    if (videoFile) return url.toString()

    if (hostname === 'youtu.be') {
      const videoId = url.pathname.split('/').filter(Boolean)[0]
      return videoId && /^[A-Za-z0-9_-]{11}$/.test(videoId) ? `https://www.youtube-nocookie.com/embed/${videoId}` : null
    }
    if (hostname === 'youtube.com' || hostname === 'www.youtube.com' || hostname === 'youtube-nocookie.com' || hostname === 'www.youtube-nocookie.com') {
      const videoId = url.searchParams.get('v') || url.pathname.match(/^\/(?:embed|shorts)\/([A-Za-z0-9_-]{11})/)?.[1]
      return videoId && /^[A-Za-z0-9_-]{11}$/.test(videoId) ? `https://www.youtube-nocookie.com/embed/${videoId}` : null
    }
    if (hostname === 'player.vimeo.com' && /^\/video\/\d+/.test(url.pathname)) return url.toString()
    return null
  } catch {
    return null
  }
}

function normalizeSelectedMovie(value: unknown): CatalogMovie | null | undefined {
  if (value === null) return null
  if (!value || typeof value !== 'object') return undefined
  const movie = value as Partial<CatalogMovie>
  if (!Number.isSafeInteger(movie.id) || (movie.mediaType !== 'movie' && movie.mediaType !== 'tv')) return undefined
  if (typeof movie.title !== 'string' || movie.title.trim().length < 1 || movie.title.length > 180) return undefined
  if (typeof movie.year !== 'string' || movie.year.length > 8) return undefined
  if (typeof movie.overview !== 'string' || movie.overview.length > 1000) return undefined
  if (!Array.isArray(movie.genres) || movie.genres.length > 12 || movie.genres.some((genre) => typeof genre !== 'string' || genre.length > 50)) return undefined
  const isImageUrl = (url: unknown) => url === null || (typeof url === 'string' && url.startsWith('https://image.tmdb.org/t/p/') && url.length < 300)
  if (!isImageUrl(movie.posterUrl) || !isImageUrl(movie.backdropUrl)) return undefined
  if (movie.voteAverage !== null && (typeof movie.voteAverage !== 'number' || !Number.isFinite(movie.voteAverage))) return undefined
  if (movie.certification !== null && (typeof movie.certification !== 'string' || movie.certification.length > 20)) return undefined
  return {
    id: movie.id as number,
    mediaType: movie.mediaType,
    title: movie.title.trim(),
    year: movie.year,
    overview: movie.overview,
    genres: movie.genres,
    posterUrl: movie.posterUrl ?? null,
    backdropUrl: movie.backdropUrl ?? null,
    voteAverage: movie.voteAverage ?? null,
    certification: movie.certification ?? null,
  }
}

function validatePatch(patch: unknown): Partial<LoungeMediaState> {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) throw new Error('That player update is not valid.')
  const input = patch as Record<string, unknown>
  const result: Partial<LoungeMediaState> = {}

  if ('selected' in input) {
    const selected = normalizeSelectedMovie(input.selected)
    if (selected === undefined) throw new Error('Choose a valid catalog title.')
    result.selected = selected
  }
  if ('streamUrl' in input) {
    if (input.streamUrl === '') result.streamUrl = ''
    else {
      const normalized = normalizeStreamUrl(input.streamUrl)
      if (!normalized) throw new Error('Use a secure YouTube, Vimeo, or direct video link that you can access.')
      result.streamUrl = normalized
    }
  }
  if ('currentTime' in input) {
    if (typeof input.currentTime !== 'number' || !Number.isFinite(input.currentTime) || input.currentTime < 0 || input.currentTime > 86_400) {
      throw new Error('That playback position is not valid.')
    }
    result.currentTime = input.currentTime
  }
  if ('isPlaying' in input) {
    if (typeof input.isPlaying !== 'boolean') throw new Error('That playback state is not valid.')
    result.isPlaying = input.isPlaying
  }
  if ('syncEnabled' in input) {
    if (typeof input.syncEnabled !== 'boolean') throw new Error('That sync setting is not valid.')
    result.syncEnabled = input.syncEnabled
  }
  if (Object.keys(result).length === 0) throw new Error('That player update is empty.')
  return result
}

function fromStoredState(value: unknown, version: number, updatedAt: Date | null): LoungeMediaState {
  const stored = value && typeof value === 'object' ? value as Partial<LoungeMediaState> : {}
  const selected = normalizeSelectedMovie(stored.selected)
  return {
    ...defaultLoungeMediaState,
    selected: selected === undefined ? null : selected,
    streamUrl: typeof stored.streamUrl === 'string' ? normalizeStreamUrl(stored.streamUrl) ?? '' : '',
    currentTime: typeof stored.currentTime === 'number' && Number.isFinite(stored.currentTime) ? Math.max(0, Math.min(86_400, stored.currentTime)) : 0,
    isPlaying: stored.isPlaying === true,
    syncEnabled: stored.syncEnabled !== false,
    updatedByUserId: typeof stored.updatedByUserId === 'string' ? stored.updatedByUserId : null,
    version,
    updatedAt: updatedAt?.toISOString() ?? null,
  }
}

export async function getLoungeMediaState(roomId: string) {
  if (!roomIdPattern.test(roomId)) throw new Error('That room could not be found.')
  await requireRoomMembership(roomId)
  const [row] = await db
    .select({ state: loungeGameStates.state, version: loungeGameStates.version, updatedAt: loungeGameStates.updatedAt })
    .from(loungeGameStates)
    .where(and(eq(loungeGameStates.roomId, roomId), eq(loungeGameStates.gameId, mediaStateId)))
    .limit(1)
  return row ? fromStoredState(row.state, row.version, row.updatedAt) : defaultLoungeMediaState
}

export async function updateLoungeMediaState(roomId: string, patch: unknown) {
  if (!roomIdPattern.test(roomId)) throw new Error('That room could not be found.')
  const membership = await requireRoomMembership(roomId)
  const safePatch = { ...validatePatch(patch), updatedByUserId: membership.userId }
  const now = new Date()
  const [row] = await db
    .insert(loungeGameStates)
    .values({ roomId, gameId: mediaStateId, state: { ...defaultLoungeMediaState, ...safePatch }, version: 1, updatedAt: now })
    .onConflictDoUpdate({
      target: [loungeGameStates.roomId, loungeGameStates.gameId],
      set: {
        state: sql`${loungeGameStates.state} || ${JSON.stringify(safePatch)}::jsonb`,
        version: sql`${loungeGameStates.version} + 1`,
        updatedAt: now,
      },
    })
    .returning({ state: loungeGameStates.state, version: loungeGameStates.version, updatedAt: loungeGameStates.updatedAt })

  return fromStoredState(row.state, row.version, row.updatedAt)
}
