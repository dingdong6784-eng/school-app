export const gameIds = ['uno', 'chess', 'speed', 'crazy', 'connect', 'tic', 'memory'] as const

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

export type GameViewState = UnoView | ChessView | SpeedView | CrazyView | ConnectView | TicView | MemoryView

export type GameAction =
  | { type: 'play-card'; cardId: number; color?: UnoColor; suit?: CardSuit }
  | { type: 'draw' }
  | { type: 'move'; from: string; to: string }
  | { type: 'drop'; column: number }
  | { type: 'place'; index: number }
  | { type: 'flip'; cardId: number }
  | { type: 'finish-mismatch' }

export function otherSeat(seat: PlayerSeat): PlayerSeat {
  return seat === 'Z' ? 'A' : 'Z'
}
