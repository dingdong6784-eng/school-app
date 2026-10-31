export type MovieMediaType = 'movie' | 'tv'

export type CatalogMovie = {
  id: number
  mediaType: MovieMediaType
  title: string
  year: string
  overview: string
  genres: string[]
  posterUrl: string | null
  backdropUrl: string | null
  voteAverage: number | null
  certification: string | null
}

export type SyncPing = { seconds: number; at: string; byUserId: string }

export type LoungeMediaState = {
  selected: CatalogMovie | null
  streamUrl: string
  embedServer: number
  season: number
  episode: number
  currentTime: number
  isPlaying: boolean
  syncEnabled: boolean
  ping: SyncPing | null
  updatedByUserId: string | null
  version: number
  updatedAt: string | null
}

export const embedServerCount = 3

export const defaultLoungeMediaState: LoungeMediaState = {
  selected: null,
  streamUrl: '',
  embedServer: 0,
  season: 1,
  episode: 1,
  currentTime: 0,
  isPlaying: false,
  syncEnabled: true,
  ping: null,
  updatedByUserId: null,
  version: 0,
  updatedAt: null,
}
