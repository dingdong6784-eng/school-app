export const gameIds = ['uno', 'chess', 'speed', 'crazy', 'connect', 'tic', 'memory', 'battleship'] as const

export type GameId = (typeof gameIds)[number]
export type PlayerSeat = 'Z' | 'A'
export type Winner = PlayerSeat | 'draw' | null
export type UnoColor = 'red' | 'blue' | 'green' | 'yellow'
export type CardSuit = 'hearts' | 'diamonds' | 'clubs' | 'spades'

export type UnoCard = { id: number; color: UnoColor | 'wild'; value: string }
export type ClassicCard = { id: number; suit: CardSuit; rank: string }
export type SpeedCard = { id: number; suit: CardSuit; rank: number }

export type UnoView = {
  hand: UnoCard[]
  opponentCount: number
  drawCount: number
  topCard: UnoCard
  color: UnoColor
  turn: PlayerSeat
  winner: Winner
  lastAction: string
}

export type CrazyView = {
  hand: ClassicCard[]
  opponentCount: number
  drawCount: number
  topCard: ClassicCard
  activeSuit: CardSuit
  turn: PlayerSeat
  winner: Winner
  lastAction: string
}

export type SpeedView = {
  hand: SpeedCard[]
  opponentCount: number
  drawCount: number
  center: SpeedCard[]
  turn: PlayerSeat
  winner: Winner
  lastAction: string
}

export type ChessView = {
  fen: string
  whiteSeat: PlayerSeat
  turn: PlayerSeat
  winner: Winner
  lastAction: string
}

export type ConnectView = {
  board: Array<PlayerSeat | null>
  turn: PlayerSeat
  winner: Winner
  lastAction: string
}

export type TicView = {
  board: Array<'X' | 'O' | null>
  marks: Record<PlayerSeat, 'X' | 'O'>
  turn: PlayerSeat
  winner: Winner
  lastAction: string
}

export type MemoryView = {
  cards: Array<{ id: number; face: string | null }>
  matched: number[]
  revealed: number[]
  scores: Record<PlayerSeat, number>
  turn: PlayerSeat
  winner: Winner
  lastAction: string
}

export type BattleshipView = {
  ownShips: number[]
  incomingShots: number[]
  shots: number[]
  hits: number[]
  turn: PlayerSeat
  winner: Winner
  lastAction: string
}

export type GameViewState = UnoView | ChessView | SpeedView | CrazyView | ConnectView | TicView | MemoryView | BattleshipView

export type GameAction =
  | { type: 'play-card'; cardId: number; color?: UnoColor; suit?: CardSuit }
  | { type: 'draw' }
  | { type: 'move'; from: string; to: string }
  | { type: 'drop'; column: number }
  | { type: 'place'; index: number }
  | { type: 'flip'; cardId: number }
  | { type: 'finish-mismatch' }
  | { type: 'fire'; cell: number }

export function otherSeat(seat: PlayerSeat): PlayerSeat {
  return seat === 'Z' ? 'A' : 'Z'
}

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
