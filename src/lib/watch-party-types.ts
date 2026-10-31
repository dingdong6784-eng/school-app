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

export type LoungeMediaState = {
  selected: CatalogMovie | null
  streamUrl: string
  currentTime: number
  isPlaying: boolean
  syncEnabled: boolean
  updatedByUserId: string | null
  version: number
  updatedAt: string | null
}

export const defaultLoungeMediaState: LoungeMediaState = {
  selected: null,
  streamUrl: '',
  currentTime: 0,
  isPlaying: false,
  syncEnabled: true,
  updatedByUserId: null,
  version: 0,
  updatedAt: null,
}
