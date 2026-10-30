import 'server-only'
import { Chess } from 'chess.js'
import type {
  CardSuit,
  ChessView,
  ClassicCard,
  ConnectView,
  CrazyView,
  GameAction,
  GameId,
  GameViewState,
  MemoryView,
  PlayerSeat,
  SpeedCard,
  SpeedView,
  TicView,
  UnoCard,
  UnoColor,
  UnoView,
  Winner,
} from '@/lib/arcade-types'
import { otherSeat } from '@/lib/arcade-types'

type CommonState = { turn: PlayerSeat; winner: Winner; lastAction: string }
type UnoState = CommonState & { hands: Record<PlayerSeat, UnoCard[]>; deck: UnoCard[]; discard: UnoCard[]; color: UnoColor }
type CrazyState = CommonState & { hands: Record<PlayerSeat, ClassicCard[]>; deck: ClassicCard[]; discard: ClassicCard[]; activeSuit: CardSuit }
type SpeedState = CommonState & { hands: Record<PlayerSeat, SpeedCard[]>; deck: SpeedCard[]; center: SpeedCard[] }
type ChessState = CommonState & { fen: string; whiteSeat: PlayerSeat }
type ConnectState = CommonState & { board: Array<PlayerSeat | null> }
type TicState = CommonState & { board: Array<'X' | 'O' | null>; marks: Record<PlayerSeat, 'X' | 'O'> }
type MemoryCard = { id: number; face: string }
type MemoryState = CommonState & {
  cards: MemoryCard[]
  matched: number[]
  revealed: number[]
  scores: Record<PlayerSeat, number>
  mismatchAt: number | null
}
type GameState = UnoState | CrazyState | SpeedState | ChessState | ConnectState | TicState | MemoryState

const cardSuits: CardSuit[] = ['hearts', 'diamonds', 'clubs', 'spades']
const unoColors: UnoColor[] = ['red', 'blue', 'green', 'yellow']
const memoryFaces = ['✦', '♡', '☾', '♧', '✿', '◇', '♬', '☼']
const unoColorPattern = /^(red|blue|green|yellow)$/
const cardSuitPattern = /^(hearts|diamonds|clubs|spades)$/

function shuffled<T>(items: T[]): T[] {
  const result = [...items]
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1))
    ;[result[index], result[swap]] = [result[swap], result[index]]
  }
  return result
}

function createUno(firstSeat: PlayerSeat): UnoState {
  let id = 0
  const deck: UnoCard[] = []
  for (const color of unoColors) {
    deck.push({ id: id++, color, value: '0' })
    for (let copy = 0; copy < 2; copy += 1) {
      for (let number = 1; number <= 9; number += 1) deck.push({ id: id++, color, value: String(number) })
      for (const value of ['skip', 'reverse', 'draw2']) deck.push({ id: id++, color, value })
    }
  }
  for (let copy = 0; copy < 4; copy += 1) {
    deck.push({ id: id++, color: 'wild', value: 'wild' }, { id: id++, color: 'wild', value: 'draw4' })
  }
  const pile = shuffled(deck)
  const hands = { Z: pile.splice(0, 7), A: pile.splice(0, 7) }
  let first = pile.pop()!
  while (first.color === 'wild' || !/^\d+$/.test(first.value)) {
    pile.unshift(first)
    first = pile.pop()!
  }
  return { hands, deck: pile, discard: [first], color: first.color as UnoColor, turn: firstSeat, winner: null, lastAction: `${firstSeat} starts. Match the color or number.` }
}

function createClassicDeck(): ClassicCard[] {
  let id = 0
  return cardSuits.flatMap((suit) => ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'].map((rank) => ({ id: id++, suit, rank })))
}

function createCrazy(firstSeat: PlayerSeat): CrazyState {
  const pile = shuffled(createClassicDeck())
  const hands = { Z: pile.splice(0, 5), A: pile.splice(0, 5) }
  const topCard = pile.pop()!
  return { hands, deck: pile, discard: [topCard], activeSuit: topCard.suit, turn: firstSeat, winner: null, lastAction: `${firstSeat} starts. Match the suit or rank.` }
}

function createSpeed(firstSeat: PlayerSeat): SpeedState {
  let id = 0
  const deck = shuffled(cardSuits.flatMap((suit) => Array.from({ length: 13 }, (_, index) => ({ id: id++, suit, rank: index + 1 }))))
  const hands = { Z: deck.splice(0, 5), A: deck.splice(0, 5) }
  const center = [deck.pop()!, deck.pop()!]
  return { hands, deck, center, turn: firstSeat, winner: null, lastAction: 'Play one rank above or below either center card.' }
}

function createMemory(firstSeat: PlayerSeat): MemoryState {
  const cards = shuffled(memoryFaces.flatMap((face) => [{ face }, { face }])).map((card, id) => ({ id, face: card.face }))
  return { cards, matched: [], revealed: [], mismatchAt: null, scores: { Z: 0, A: 0 }, turn: firstSeat, winner: null, lastAction: `${firstSeat} turns over two cards first.` }
}

export function createInitialGameState(gameId: GameId, firstSeat: PlayerSeat): GameState {
  switch (gameId) {
    case 'uno': return createUno(firstSeat)
    case 'crazy': return createCrazy(firstSeat)
    case 'speed': return createSpeed(firstSeat)
    case 'chess': return { fen: new Chess().fen(), whiteSeat: firstSeat, turn: firstSeat, winner: null, lastAction: `${firstSeat} plays White and moves first.` }
    case 'connect': return { board: Array(42).fill(null), turn: firstSeat, winner: null, lastAction: `${firstSeat} drops first.` }
    case 'tic': {
      const marks: Record<PlayerSeat, 'X' | 'O'> = firstSeat === 'Z' ? { Z: 'X', A: 'O' } : { Z: 'O', A: 'X' }
      return { board: Array(9).fill(null), marks, turn: firstSeat, winner: null, lastAction: `${firstSeat} plays X and starts.` }
    }
    case 'memory': return createMemory(firstSeat)
  }
}

function requireTurn(state: CommonState, seat: PlayerSeat) {
  if (state.winner) throw new Error('This game is already finished.')
  if (state.turn !== seat) throw new Error('It is the other player’s turn.')
}

function drawFromDeck<T>(deck: T[], discard: T[], amount: number) {
  let nextDeck = [...deck]
  let nextDiscard = [...discard]
  const drawn: T[] = []
  while (drawn.length < amount) {
    if (nextDeck.length === 0 && nextDiscard.length > 1) {
      const top = nextDiscard.pop()!
      nextDeck = shuffled(nextDiscard)
      nextDiscard = [top]
    }
    if (nextDeck.length === 0) break
    drawn.push(nextDeck.shift()!)
  }
  return { deck: nextDeck, discard: nextDiscard, drawn }
}

function canPlayUno(card: UnoCard, state: UnoState) {
  const top = state.discard[state.discard.length - 1]
  return card.color === 'wild' || card.color === state.color || card.value === top.value
}

function applyUno(state: UnoState, seat: PlayerSeat, action: GameAction): UnoState {
  if (action.type === 'draw') {
    requireTurn(state, seat)
    if (state.hands[seat].some((card) => canPlayUno(card, state))) throw new Error('Play a matching card before drawing.')
    const result = drawFromDeck(state.deck, state.discard, 1)
    if (!result.drawn.length) throw new Error('There are no cards left to draw.')
    return { ...state, deck: result.deck, discard: result.discard, hands: { ...state.hands, [seat]: [...state.hands[seat], ...result.drawn] }, turn: otherSeat(seat), lastAction: `${seat} drew a card. Turn passes.` }
  }
  if (action.type !== 'play-card' || !Number.isSafeInteger(action.cardId)) throw new Error('That is not a valid UNO move.')
  requireTurn(state, seat)
  const card = state.hands[seat].find((item) => item.id === action.cardId)
  if (!card || !canPlayUno(card, state)) throw new Error('That card cannot be played here.')
  const hand = state.hands[seat].filter((item) => item.id !== card.id)
  const hands = { ...state.hands, [seat]: hand }
  const discard = [...state.discard, card]
  const selectedColor = card.color === 'wild'
    ? (typeof action.color === 'string' && unoColorPattern.test(action.color) ? action.color as UnoColor : unoColors[Math.floor(Math.random() * unoColors.length)])
    : card.color
  if (hand.length === 0) return { ...state, hands, discard, color: selectedColor, winner: seat, lastAction: `${seat} wins this round.` }
  if (card.value === 'draw2' || card.value === 'draw4') {
    const target = otherSeat(seat)
    const amount = card.value === 'draw2' ? 2 : 4
    const result = drawFromDeck(state.deck, discard, amount)
    return { ...state, hands: { ...hands, [target]: [...hands[target], ...result.drawn] }, deck: result.deck, discard: result.discard, color: selectedColor, turn: seat, lastAction: `${seat} played ${card.value === 'draw2' ? 'Draw Two' : 'Wild Draw Four'}; ${target} draws ${result.drawn.length}.` }
  }
  const skip = card.value === 'skip' || card.value === 'reverse'
  return { ...state, hands, discard, color: selectedColor, turn: skip ? seat : otherSeat(seat), lastAction: `${seat} played ${card.value}.${skip ? ` ${otherSeat(seat)} is skipped.` : ''}` }
}

function isCrazyPlayable(card: ClassicCard, state: CrazyState) {
  const top = state.discard[state.discard.length - 1]
  return card.rank === '8' || card.suit === state.activeSuit || card.rank === top.rank
}

function applyCrazy(state: CrazyState, seat: PlayerSeat, action: GameAction): CrazyState {
  if (action.type === 'draw') {
    requireTurn(state, seat)
    if (state.hands[seat].some((card) => isCrazyPlayable(card, state))) throw new Error('Play a matching card before drawing.')
    const result = drawFromDeck(state.deck, state.discard, 1)
    if (!result.drawn.length) throw new Error('There are no cards left to draw.')
    return { ...state, deck: result.deck, discard: result.discard, hands: { ...state.hands, [seat]: [...state.hands[seat], ...result.drawn] }, turn: otherSeat(seat), lastAction: `${seat} drew a card. Turn passes.` }
  }
  if (action.type !== 'play-card' || !Number.isSafeInteger(action.cardId)) throw new Error('That is not a valid Crazy Eights move.')
  requireTurn(state, seat)
  const card = state.hands[seat].find((item) => item.id === action.cardId)
  if (!card || !isCrazyPlayable(card, state)) throw new Error('That card cannot be played here.')
  const hand = state.hands[seat].filter((item) => item.id !== card.id)
  const activeSuit = card.rank === '8'
    ? (typeof action.suit === 'string' && cardSuitPattern.test(action.suit) ? action.suit as CardSuit : cardSuits[Math.floor(Math.random() * cardSuits.length)])
    : card.suit
  return { ...state, hands: { ...state.hands, [seat]: hand }, discard: [...state.discard, card], activeSuit, turn: otherSeat(seat), winner: hand.length === 0 ? seat : null, lastAction: hand.length === 0 ? `${seat} wins this round.` : `${seat} played ${card.rank === '8' ? 'an Eight' : `${card.rank} of ${card.suit}`}.` }
}

function isAdjacentRank(first: number, second: number) {
  return Math.abs(first - second) === 1 || Math.abs(first - second) === 12
}

function applySpeed(state: SpeedState, seat: PlayerSeat, action: GameAction): SpeedState {
  if (action.type !== 'play-card' || !Number.isSafeInteger(action.cardId)) throw new Error('Play one of your own cards.')
  if (state.winner) throw new Error('This game is already finished.')
  const card = state.hands[seat].find((item) => item.id === action.cardId)
  if (!card || !state.center.some((top) => isAdjacentRank(card.rank, top.rank))) throw new Error('That card does not match either center pile.')
  const centerIndex = state.center.findIndex((top) => isAdjacentRank(card.rank, top.rank))
  const center = [...state.center]
  center[centerIndex] = card
  const hand = state.hands[seat].filter((item) => item.id !== card.id)
  const refill = state.deck.slice(0, Math.min(5 - hand.length, state.deck.length))
  const deck = state.deck.slice(refill.length)
  const hands = { ...state.hands, [seat]: [...hand, ...refill] }
  const winner = hands[seat].length === 0 && deck.length === 0 ? seat : null
  return { ...state, hands, deck, center, turn: seat, winner, lastAction: winner ? `${seat} clears their hand and wins.` : `${seat} played a ${card.rank} of ${card.suit}.` }
}

function applyChess(state: ChessState, seat: PlayerSeat, action: GameAction): ChessState {
  if (action.type !== 'move' || !/^[a-h][1-8]$/.test(action.from) || !/^[a-h][1-8]$/.test(action.to)) throw new Error('Choose a valid chess move.')
  requireTurn(state, seat)
  const chess = new Chess(state.fen)
  const isWhiteTurn = chess.turn() === 'w'
  const expectedSeat = isWhiteTurn ? state.whiteSeat : otherSeat(state.whiteSeat)
  if (seat !== expectedSeat) throw new Error('It is the other player’s turn.')
  try {
    const move = chess.move({ from: action.from, to: action.to, promotion: 'q' })
    const winner: Winner = chess.isCheckmate() ? seat : chess.isDraw() ? 'draw' : null
    const turn = chess.turn() === 'w' ? state.whiteSeat : otherSeat(state.whiteSeat)
    const lastAction = winner === seat ? `${seat} wins by checkmate.` : winner === 'draw' ? 'A draw. Good game.' : chess.isCheck() ? `${turn} is in check.` : `${seat} moved ${move.san}.`
    return { ...state, fen: chess.fen(), turn, winner, lastAction }
  } catch {
    throw new Error('That chess move is not legal.')
  }
}

function hasConnectFour(board: Array<PlayerSeat | null>, index: number, seat: PlayerSeat) {
  const row = Math.floor(index / 7)
  const column = index % 7
  for (const [rowStep, columnStep] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
    let count = 1
    for (const direction of [-1, 1]) {
      let nextRow = row + rowStep * direction
      let nextColumn = column + columnStep * direction
      while (nextRow >= 0 && nextRow < 6 && nextColumn >= 0 && nextColumn < 7 && board[nextRow * 7 + nextColumn] === seat) {
        count += 1
        nextRow += rowStep * direction
        nextColumn += columnStep * direction
      }
    }
    if (count >= 4) return true
  }
  return false
}

function applyConnect(state: ConnectState, seat: PlayerSeat, action: GameAction): ConnectState {
  if (action.type !== 'drop' || !Number.isInteger(action.column) || action.column < 0 || action.column > 6) throw new Error('Choose one of the seven columns.')
  requireTurn(state, seat)
  let index = -1
  for (let row = 5; row >= 0; row -= 1) {
    const candidate = row * 7 + action.column
    if (state.board[candidate] === null) { index = candidate; break }
  }
  if (index < 0) throw new Error('That column is full.')
  const board = [...state.board]
  board[index] = seat
  const winner: Winner = hasConnectFour(board, index, seat) ? seat : board.every(Boolean) ? 'draw' : null
  return { ...state, board, turn: otherSeat(seat), winner, lastAction: winner === seat ? `${seat} connects four and wins.` : winner === 'draw' ? 'The board is full. It is a draw.' : `${seat} dropped a disc.` }
}

const ticLines = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]]

function applyTic(state: TicState, seat: PlayerSeat, action: GameAction): TicState {
  if (action.type !== 'place' || !Number.isInteger(action.index) || action.index < 0 || action.index > 8) throw new Error('Choose an open square.')
  requireTurn(state, seat)
  if (state.board[action.index] !== null) throw new Error('That square is already taken.')
  const board = [...state.board]
  board[action.index] = state.marks[seat]
  const won = ticLines.some((line) => line.every((index) => board[index] === state.marks[seat]))
  const winner: Winner = won ? seat : board.every(Boolean) ? 'draw' : null
  return { ...state, board, turn: otherSeat(seat), winner, lastAction: winner === seat ? `${seat} connects three and wins.` : winner === 'draw' ? 'A full board. It is a draw.' : `${seat} placed ${state.marks[seat]}.` }
}

function applyMemory(state: MemoryState, seat: PlayerSeat, action: GameAction): MemoryState {
  if (action.type === 'finish-mismatch') {
    if (state.revealed.length !== 2 || state.mismatchAt === null || Date.now() - state.mismatchAt < 500) throw new Error('Those cards are not ready to turn over.')
    return { ...state, revealed: [], mismatchAt: null, turn: otherSeat(state.turn), lastAction: `${otherSeat(state.turn)} takes the next turn.` }
  }
  if (action.type !== 'flip' || !Number.isInteger(action.cardId)) throw new Error('Choose one of the face-down cards.')
  requireTurn(state, seat)
  if (state.mismatchAt !== null) throw new Error('Wait for the mismatched cards to turn back over.')
  if (state.revealed.includes(action.cardId) || state.matched.includes(action.cardId)) throw new Error('That card is already face-up.')
  const card = state.cards.find((item) => item.id === action.cardId)
  if (!card) throw new Error('That card is not on the board.')
  const revealed = [...state.revealed, card.id]
  if (revealed.length === 1) return { ...state, revealed, lastAction: `${seat} turned over a card.` }
  const first = state.cards.find((item) => item.id === revealed[0])!
  if (first.face === card.face) {
    const matched = [...state.matched, ...revealed]
    const scores = { ...state.scores, [seat]: state.scores[seat] + 1 }
    const winner: Winner = matched.length === state.cards.length ? (scores.Z === scores.A ? 'draw' : scores.Z > scores.A ? 'Z' : 'A') : null
    return { ...state, matched, revealed: [], scores, winner, lastAction: winner ? winner === 'draw' ? 'The match ends even. It is a draw.' : `${winner} wins with the most pairs.` : `${seat} found a match and plays again.` }
  }
  return { ...state, revealed, mismatchAt: Date.now(), lastAction: `${seat} found no match. The cards will turn back over.` }
}

export function applyGameAction(gameId: GameId, state: GameState, seat: PlayerSeat, action: GameAction): GameState {
  switch (gameId) {
    case 'uno': return applyUno(state as UnoState, seat, action)
    case 'crazy': return applyCrazy(state as CrazyState, seat, action)
    case 'speed': return applySpeed(state as SpeedState, seat, action)
    case 'chess': return applyChess(state as ChessState, seat, action)
    case 'connect': return applyConnect(state as ConnectState, seat, action)
    case 'tic': return applyTic(state as TicState, seat, action)
    case 'memory': return applyMemory(state as MemoryState, seat, action)
  }
}

export function projectGameState(gameId: GameId, state: GameState, seat: PlayerSeat): GameViewState {
  switch (gameId) {
    case 'uno': {
      const current = state as UnoState
      const { hands, deck, discard, ...publicState } = current
      return { ...publicState, hand: hands[seat], opponentCount: hands[otherSeat(seat)].length, drawCount: deck.length, topCard: discard[discard.length - 1] } as UnoView
    }
    case 'crazy': {
      const current = state as CrazyState
      const { hands, deck, discard, ...publicState } = current
      return { ...publicState, hand: hands[seat], opponentCount: hands[otherSeat(seat)].length, drawCount: deck.length, topCard: discard[discard.length - 1] } as CrazyView
    }
    case 'speed': {
      const current = state as SpeedState
      const { hands, deck, ...publicState } = current
      return { ...publicState, hand: hands[seat], opponentCount: hands[otherSeat(seat)].length, drawCount: deck.length } as SpeedView
    }
    case 'chess': return state as ChessView
    case 'connect': return state as ConnectView
    case 'tic': return state as TicView
    case 'memory': {
      const current = state as MemoryState
      const visibleIds = new Set([...current.matched, ...current.revealed])
      const cards = current.cards.map((card) => ({ id: card.id, face: visibleIds.has(card.id) ? card.face : null }))
      const { mismatchAt: _mismatchAt, ...publicState } = current
      return { ...publicState, cards } as MemoryView
    }
  }
}
