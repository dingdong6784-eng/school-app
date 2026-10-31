import { useState } from 'react'
import useSWR from 'swr'
import { Chess, type Square } from 'chess.js'
import { CircleHelp, Gamepad2, LoaderCircle, RotateCcw, Sparkles, Users } from 'lucide-react'
import { getGameView, makeGameMove, resetGame } from '@/lib/lounge-actions'
import type { CardSuit, GameAction, GameId, GameViewState, PlayerSeat, UnoCard, UnoColor } from '@/lib/arcade-types'
import { otherSeat } from '@/lib/arcade-types'

type GameOption = { id: GameId; name: string; kicker: string; icon: string; rules: string }
const gameOptions: GameOption[] = [
  { id: 'uno', name: 'UNO', kicker: 'A little chaos', icon: 'U', rules: 'Match color or number. Special cards skip, reverse, or make the other seat draw. First to empty a hand wins.' },
  { id: 'chess', name: 'Chess', kicker: 'Make your move', icon: '♞', rules: 'White moves first. Select a piece, then a highlighted square. Checkmate wins; drawn positions end in a draw.' },
  { id: 'speed', name: 'Speed', kicker: 'Fast hands', icon: '↯', rules: 'Both players can play on either center pile. Play one rank above or below the top card; Aces wrap around.' },
  { id: 'crazy', name: 'Crazy Eights', kicker: 'Classic cards', icon: '8', rules: 'Match suit or rank. Eights are wild and choose a new suit. First to empty a hand wins.' },
  { id: 'connect', name: 'Connect Four', kicker: 'Four in a row', icon: '●', rules: 'Take turns dropping a disc into a column. Connect four horizontally, vertically, or diagonally to win.' },
  { id: 'tic', name: 'Tic-Tac-Toe', kicker: 'Glow edition', icon: '×', rules: 'Take turns marking a square. Connect three in a row, column, or diagonal to win.' },
  { id: 'memory', name: 'Memory Match', kicker: 'Made for two', icon: '✦', rules: 'Reveal two cards on your turn. Matching pairs score and let you play again; most pairs wins.' },
  { id: 'battleship', name: 'Battleship', kicker: 'Find the fleet', icon: '▦', rules: 'Take turns calling a coordinate. First to find all 17 hidden ship spaces wins; each player sees only their own fleet.' },
]
const suitGlyph: Record<CardSuit, string> = { hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠' }
const chessSymbols: Record<string, string> = { wk: '♔', wq: '♕', wr: '♖', wb: '♗', wn: '♘', wp: '♙', bk: '♚', bq: '♛', br: '♜', bb: '♝', bn: '♞', bp: '♟' }
const chessFiles = 'abcdefgh'

function seatName(seat: PlayerSeat) {
  return seat === 'Z' ? 'Z' : 'A'
}

function displayWinner(winner: GameViewState['winner']) {
  return winner === 'draw' ? 'A draw. Nice game.' : winner ? `${seatName(winner)} wins this round.` : ''
}

function unoCardLabel(card: UnoCard) {
  if (card.color === 'wild') return card.value === 'draw4' ? '+4' : 'WILD'
  if (card.value === 'skip') return 'SKIP'
  if (card.value === 'reverse') return 'REV'
  if (card.value === 'draw2') return '+2'
  return card.value
}

function unoCardClass(color: UnoColor | 'wild') {
  return color === 'wild' ? '' : `${color}-suit`
}

function cardRankLabel(rank: number) {
  if (rank === 1) return 'A'
  if (rank === 11) return 'J'
  if (rank === 12) return 'Q'
  if (rank === 13) return 'K'
  return String(rank)
}

function classicRankLabel(rank: string) {
  return rank === '8' ? '8' : rank
}

export function GamesArcade({ roomId, userId, playerSeat }: { roomId: string; userId: string; playerSeat: PlayerSeat }) {
  const [activeGame, setActiveGame] = useState<GameId>('uno')
  const partner = otherSeat(playerSeat)
  return (
    <section className="live-game-shell">
      <div className="live-game-heading">
        <div><p className="eyebrow"><Sparkles size={13} /> THE ARCADE</p><h1>Play a little <span>longer.</span></h1><p className="muted-copy">Your games stay in sync across both accounts.</p></div>
        <div className="live-game-presence"><Users size={14} /><span>You&apos;re {playerSeat}; your partner is {partner}.</span></div>
      </div>
      <div className="live-game-picker" role="tablist" aria-label="Choose a game">
        {gameOptions.map((game) => <button key={game.id} type="button" role="tab" aria-selected={activeGame === game.id} onClick={() => setActiveGame(game.id)}><span aria-hidden="true">{game.icon}</span><span><strong>{game.name}</strong><small>{game.kicker}</small></span></button>)}
      </div>
      <GamePanel key={activeGame} gameId={activeGame} roomId={roomId} userId={userId} playerSeat={playerSeat} />
      <div className="arcade-footer-note"><Gamepad2 size={13} /> No leaderboard. No pressure. Just a rematch.</div>
    </section>
  )
}

function GamePanel({ gameId, roomId, userId, playerSeat }: { gameId: GameId; roomId: string; userId: string; playerSeat: PlayerSeat }) {
  const option = gameOptions.find((game) => game.id === gameId)!
  const key = ['room-game', userId, roomId, gameId]
  const { data, error, isLoading, mutate } = useSWR(
    key,
    () => getGameView(roomId, gameId),
    { refreshInterval: 1400, revalidateOnFocus: true, shouldRetryOnError: false },
  )
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null)

  async function perform(action: GameAction) {
    setNotice('')
    setBusy(true)
    try {
      const next = await makeGameMove(roomId, gameId, action)
      await mutate(next, false)
      if (gameId === 'memory' && action.type === 'flip' && (next.state as Extract<GameViewState, { cards: unknown[] }>).revealed.length === 2) {
        window.setTimeout(async () => {
          try {
            const after = await makeGameMove(roomId, 'memory', { type: 'finish-mismatch' })
            await mutate(after, false)
          } catch {
            await mutate()
          }
        }, 900)
      }
    } catch {
      setNotice('That move could not be saved. Refreshing the shared table…')
      await mutate()
    } finally {
      setBusy(false)
    }
  }

  async function newGame() {
    setBusy(true)
    setNotice('')
    try {
      await mutate(await resetGame(roomId, gameId), false)
      setSelectedSquare(null)
    } catch {
      setNotice('A new round could not be started. Try again.')
    } finally {
      setBusy(false)
    }
  }

  if (isLoading || !data) return <div className="live-game-card live-game-loading"><LoaderCircle className="spin" size={16} /> Opening the shared table…</div>
  if (error) return <div className="live-game-card live-game-loading" role="alert">This room&apos;s game table could not be loaded.</div>

  const state = data.state
  const myTurn = state.turn === playerSeat
  const status = state.winner ? displayWinner(state.winner) : gameId === 'speed' ? 'Both players can play a legal card at any time.' : myTurn ? 'Your move.' : `${seatName(state.turn)} to move.`

  return (
    <section className="live-game-card" aria-label={`${option.name} shared game`}>
      <div className="live-game-toolbar">
        <div><h2>{option.name}</h2><p>{option.rules}</p></div>
        <div className="live-game-toolbar-actions"><button type="button" onClick={() => setNotice(notice ? '' : option.rules)} aria-label={`How to play ${option.name}`}><CircleHelp size={13} /> Rules</button><button type="button" onClick={newGame} disabled={busy}><RotateCcw size={13} /> New game</button></div>
      </div>
      <div className="live-game-status"><span><i />{status}</span><small>{state.lastAction}</small></div>
      {notice ? <p className="live-game-notice" role="status">{notice}</p> : null}
      {gameId === 'uno' ? <UnoTable state={state as Extract<GameViewState, { hand: UnoCard[]; color: UnoColor }>} playerSeat={playerSeat} busy={busy} onAction={perform} /> : null}
      {gameId === 'crazy' ? <CrazyTable state={state as Extract<GameViewState, { activeSuit: CardSuit }>} playerSeat={playerSeat} busy={busy} onAction={perform} /> : null}
      {gameId === 'speed' ? <SpeedTable state={state as Extract<GameViewState, { center: unknown[] }>} playerSeat={playerSeat} busy={busy} onAction={perform} /> : null}
      {gameId === 'chess' ? <ChessTable state={state as Extract<GameViewState, { fen: string }>} playerSeat={playerSeat} selected={selectedSquare} setSelected={setSelectedSquare} busy={busy} onAction={perform} /> : null}
      {gameId === 'connect' ? <ConnectTable state={state as Extract<GameViewState, { board: Array<PlayerSeat | null> }>} playerSeat={playerSeat} busy={busy} onAction={perform} /> : null}
      {gameId === 'tic' ? <TicTable state={state as Extract<GameViewState, { marks: Record<PlayerSeat, 'X' | 'O'> }>} playerSeat={playerSeat} busy={busy} onAction={perform} /> : null}
      {gameId === 'memory' ? <MemoryTable state={state as Extract<GameViewState, { cards: unknown[] }>} playerSeat={playerSeat} busy={busy} onAction={perform} /> : null}
      {gameId === 'battleship' ? <BattleshipTable state={state as Extract<GameViewState, { ownShips: number[] }>} playerSeat={playerSeat} busy={busy} onAction={perform} /> : null}
    </section>
  )
}

function UnoTable({ state, playerSeat, busy, onAction }: { state: Extract<GameViewState, { hand: UnoCard[]; color: UnoColor }>; playerSeat: PlayerSeat; busy: boolean; onAction: (action: GameAction) => void }) {
  const [pendingWildCardId, setPendingWildCardId] = useState<number | null>(null)
  const canPlay = (card: UnoCard) => card.color === 'wild' || card.color === state.color || card.value === state.topCard.value
  return <div className="live-game-table">
    <div className="live-game-opponent"><strong>Seat {otherSeat(playerSeat)}</strong><span>{state.opponentCount} cards in hand</span><span className="live-card-back">{state.opponentCount}</span></div>
    <div className="live-game-center"><span className="live-game-center-label">Discard</span><div className={`live-playing-card ${unoCardClass(state.topCard.color)}`}><strong>{unoCardLabel(state.topCard)}</strong><small>{state.color} is active</small></div><button className="room-invite-button" type="button" disabled={busy || state.winner !== null || state.turn !== playerSeat || state.hand.some(canPlay)} onClick={() => onAction({ type: 'draw' })}>Draw one · {state.drawCount} left</button></div>
    <div><p className="live-game-hand-label">Your hand · seat {playerSeat}</p><div className="live-card-hand">{state.hand.map((card) => <button key={card.id} type="button" className={`live-playing-card ${unoCardClass(card.color)}`} disabled={busy || state.turn !== playerSeat || Boolean(state.winner) || !canPlay(card)} onClick={() => card.color === 'wild' ? setPendingWildCardId(card.id) : onAction({ type: 'play-card', cardId: card.id })} aria-label={`Play ${card.color} ${card.value}`}><strong>{unoCardLabel(card)}</strong><small>{card.color}</small></button>)}</div></div>
    {pendingWildCardId !== null ? <div className="live-suit-chooser" role="group" aria-label="Choose the next UNO color">{(['red', 'blue', 'green', 'yellow'] as UnoColor[]).map((color) => <button key={color} type="button" className={`suit-choice suit-${color}`} disabled={busy} onClick={() => { onAction({ type: 'play-card', cardId: pendingWildCardId, color }); setPendingWildCardId(null) }}>{color}</button>)}</div> : null}
  </div>
}

function CrazyTable({ state, playerSeat, busy, onAction }: { state: Extract<GameViewState, { activeSuit: CardSuit }>; playerSeat: PlayerSeat; busy: boolean; onAction: (action: GameAction) => void }) {
  const [pendingEightId, setPendingEightId] = useState<number | null>(null)
  const canPlay = (card: { rank: string; suit: CardSuit }) => card.rank === '8' || card.suit === state.activeSuit || card.rank === state.topCard.rank
  return <div className="live-game-table">
    <div className="live-game-opponent"><strong>Seat {otherSeat(playerSeat)}</strong><span>{state.opponentCount} cards in hand</span><span className="live-card-back">{state.opponentCount}</span></div>
    <div className="live-game-center"><span className="live-game-center-label">Discard</span><div className={`live-playing-card ${state.topCard.suit === 'hearts' || state.topCard.suit === 'diamonds' ? 'red-suit' : ''}`}><strong>{state.topCard.rank}{suitGlyph[state.topCard.suit]}</strong><small>{state.activeSuit} active</small></div><button className="room-invite-button" type="button" disabled={busy || state.turn !== playerSeat || Boolean(state.winner) || state.hand.some(canPlay)} onClick={() => onAction({ type: 'draw' })}>Draw one · {state.drawCount} left</button></div>
    <div><p className="live-game-hand-label">Your hand · seat {playerSeat}</p><div className="live-card-hand">{state.hand.map((card) => <button key={card.id} type="button" className={`live-playing-card ${card.suit === 'hearts' || card.suit === 'diamonds' ? 'red-suit' : ''}`} disabled={busy || state.turn !== playerSeat || Boolean(state.winner) || !canPlay(card)} onClick={() => card.rank === '8' ? setPendingEightId(card.id) : onAction({ type: 'play-card', cardId: card.id })} aria-label={`Play ${card.rank} of ${card.suit}`}><strong>{card.rank}{suitGlyph[card.suit]}</strong><small>{card.suit}</small></button>)}</div></div>
    {pendingEightId !== null ? <div className="live-suit-chooser" role="group" aria-label="Choose the next suit">{(['hearts', 'diamonds', 'clubs', 'spades'] as CardSuit[]).map((suit) => <button key={suit} type="button" className={`suit-choice ${suit === 'hearts' || suit === 'diamonds' ? 'red-suit' : ''}`} disabled={busy} onClick={() => { onAction({ type: 'play-card', cardId: pendingEightId, suit }); setPendingEightId(null) }}>{suitGlyph[suit]} {suit}</button>)}</div> : null}
  </div>
}

function SpeedTable({ state, playerSeat, busy, onAction }: { state: Extract<GameViewState, { center: unknown[] }>; playerSeat: PlayerSeat; busy: boolean; onAction: (action: GameAction) => void }) {
  const speed = state as Extract<GameViewState, { center: Array<{ id: number; suit: CardSuit; rank: number }> }>
  const canPlay = (rank: number) => speed.center.some((top) => Math.abs(rank - top.rank) === 1 || Math.abs(rank - top.rank) === 12)
  return <div className="live-game-table">
    <div className="live-game-opponent"><strong>Seat {otherSeat(playerSeat)}</strong><span>{speed.opponentCount} cards in hand</span><span className="live-card-back">{speed.opponentCount}</span></div>
    <div className="live-game-center"><span className="live-game-center-label">Center piles</span>{speed.center.map((card, index) => <div key={index} className={`live-playing-card ${card.suit === 'hearts' || card.suit === 'diamonds' ? 'red-suit' : ''}`}><strong>{cardRankLabel(card.rank)}{suitGlyph[card.suit]}</strong><small>Pile {index + 1}</small></div>)}<small className="live-game-center-label">{speed.drawCount} draw cards</small></div>
    <div><p className="live-game-hand-label">Your hand · cards can be played at any time</p><div className="live-card-hand">{speed.hand.map((card) => <button key={card.id} type="button" className={`live-playing-card ${card.suit === 'hearts' || card.suit === 'diamonds' ? 'red-suit' : ''}`} disabled={busy || Boolean(speed.winner) || !canPlay(card.rank)} onClick={() => onAction({ type: 'play-card', cardId: card.id })} aria-label={`Play ${cardRankLabel(card.rank)} of ${card.suit}`}><strong>{cardRankLabel(card.rank)}{suitGlyph[card.suit]}</strong><small>{card.suit}</small></button>)}</div></div>
  </div>
}

function ChessTable({ state, playerSeat, selected, setSelected, busy, onAction }: { state: Extract<GameViewState, { fen: string }>; playerSeat: PlayerSeat; selected: Square | null; setSelected: (square: Square | null) => void; busy: boolean; onAction: (action: GameAction) => void }) {
  const chess = new Chess(state.fen)
  const board = chess.board()
  const myColor = state.whiteSeat === playerSeat ? 'w' : 'b'
  const legalTargets = selected ? chess.moves({ square: selected, verbose: true }).map((move) => move.to) : []

  function chooseSquare(square: Square) {
    const piece = chess.get(square)
    if (selected && legalTargets.includes(square)) {
      const from = selected
      setSelected(null)
      onAction({ type: 'move', from, to: square })
      return
    }
    if (piece?.color === myColor && state.turn === playerSeat && !state.winner) setSelected(square)
    else setSelected(null)
  }

  return <div className="live-chess-layout">
    <div className="live-chess-board" aria-label="Shared chess board">{board.map((row, rowIndex) => row.map((piece, columnIndex) => {
      const square = `${chessFiles[columnIndex]}${8 - rowIndex}` as Square
      const isLight = (rowIndex + columnIndex) % 2 === 0
      const target = legalTargets.includes(square)
      return <button key={square} type="button" className={`live-chess-square ${isLight ? 'light' : 'dark'} ${selected === square ? 'selected' : ''} ${target ? piece ? 'legal-piece' : 'legal' : ''}`} onClick={() => chooseSquare(square)} disabled={busy || Boolean(state.winner)} aria-label={`${square}${piece ? ` ${piece.color === 'w' ? 'white' : 'black'} ${piece.type}` : ''}`}>
        {piece ? chessSymbols[`${piece.color}${piece.type}`] : null}
      </button>
    }))}</div>
    <aside className="live-chess-side"><p><strong>White:</strong> seat {state.whiteSeat}</p><p><strong>Black:</strong> seat {otherSeat(state.whiteSeat)}</p><p>{state.lastAction}</p><p>Moves and check are validated on the server.</p></aside>
  </div>
}

function ConnectTable({ state, playerSeat, busy, onAction }: { state: Extract<GameViewState, { board: Array<PlayerSeat | null> }>; playerSeat: PlayerSeat; busy: boolean; onAction: (action: GameAction) => void }) {
  return <div>
    <div className="live-connect-columns">{Array.from({ length: 7 }, (_, column) => <button key={column} type="button" onClick={() => onAction({ type: 'drop', column })} disabled={busy || state.turn !== playerSeat || Boolean(state.winner)} aria-label={`Drop in column ${column + 1}`}>↓</button>)}</div>
    <div className="live-game-board live-connect-board">{state.board.map((seat, index) => <div className="live-connect-cell" key={index} aria-label={seat ? `Seat ${seat}` : 'Empty space'}><i className={seat ? seat === 'Z' ? 'seat-z' : 'seat-a' : ''} /></div>)}</div>
  </div>
}

function TicTable({ state, playerSeat, busy, onAction }: { state: Extract<GameViewState, { marks: Record<PlayerSeat, 'X' | 'O'> }>; playerSeat: PlayerSeat; busy: boolean; onAction: (action: GameAction) => void }) {
  return <div className="live-game-board live-tic-board">{state.board.map((mark, index) => <button key={index} type="button" className={`live-tic-cell ${mark === 'O' ? 'mark-o' : ''}`} onClick={() => onAction({ type: 'place', index })} disabled={busy || state.turn !== playerSeat || Boolean(state.winner) || Boolean(mark)} aria-label={mark ? `${mark} at square ${index + 1}` : `Place your mark at square ${index + 1}`}>{mark}</button>)}</div>
}

function BattleshipTable({ state, playerSeat, busy, onAction }: { state: Extract<GameViewState, { ownShips: number[] }>; playerSeat: PlayerSeat; busy: boolean; onAction: (action: GameAction) => void }) {
  const letters = 'ABCDEFGHIJ'
  const ownShips = new Set(state.ownShips)
  const incomingShots = new Set(state.incomingShots)
  const shots = new Set(state.shots)
  const hits = new Set(state.hits)

  function renderBoard(board: 'fleet' | 'target') {
    return <div className="live-battleship-board" aria-label={board === 'fleet' ? 'Your fleet and incoming shots' : 'Opponent waters and your shots'}>
      <div className="live-battleship-header"><span />{letters.split('').map((letter) => <span key={letter}>{letter}</span>)}</div>
      {Array.from({ length: 10 }, (_, row) => <div className="live-battleship-row" key={row}>
        <span className="live-battleship-coordinate">{row + 1}</span>
        <div className="live-battleship-cells">{Array.from({ length: 10 }, (_, column) => {
          const cell = row * 10 + column
          if (board === 'fleet') {
            const ship = ownShips.has(cell)
            const shot = incomingShots.has(cell)
            const hit = shot && ship
            return <span key={cell} className={`live-battleship-cell ${ship && !shot ? 'ship' : ''} ${hit ? 'hit' : ''} ${shot && !ship ? 'miss' : ''}`} aria-label={`${letters[column]}${row + 1}${hit ? ', ship hit' : shot ? ', missed' : ship ? ', ship' : ', open'}`} />
          }
          const fired = shots.has(cell)
          const hit = hits.has(cell)
          return <button key={cell} type="button" className={`live-battleship-cell ${hit ? 'hit' : fired ? 'miss' : ''}`} disabled={busy || state.turn !== playerSeat || Boolean(state.winner) || fired} onClick={() => onAction({ type: 'fire', cell })} aria-label={`Target ${letters[column]}${row + 1}${hit ? ', hit' : fired ? ', miss' : ''}`} />
        })}</div>
      </div>)}
    </div>
  }

  return <div className="live-battleship-layout">
    <div className="live-battleship-panel"><div className="live-battleship-title"><strong>Opponent waters</strong><span>{state.turn === playerSeat && !state.winner ? 'Choose a target' : 'Wait for your turn'}</span></div>{renderBoard('target')}</div>
    <div className="live-battleship-panel"><div className="live-battleship-title"><strong>Your fleet</strong><span>Ships are private to your seat</span></div>{renderBoard('fleet')}</div>
    <div className="live-battleship-legend"><span><i className="ship" /> Your ship</span><span><i className="miss" /> Miss</span><span><i className="hit" /> Hit</span></div>
  </div>
}

function MemoryTable({ state, playerSeat, busy, onAction }: { state: Extract<GameViewState, { cards: unknown[] }>; playerSeat: PlayerSeat; busy: boolean; onAction: (action: GameAction) => void }) {
  const memory = state as Extract<GameViewState, { cards: Array<{ id: number; face: string | null }> }>
  return <div>
    <div className="live-game-opponent"><strong>Pairs</strong><span>Seat Z: {memory.scores.Z} · Seat A: {memory.scores.A}</span><span>Your turn: {memory.turn === playerSeat ? 'yes' : 'no'}</span></div>
    <div className="live-game-board live-memory-board">{memory.cards.map((card) => {
      const shown = card.face !== null
      return <button key={card.id} type="button" className={`live-memory-cell ${shown ? 'face-up' : ''}`} onClick={() => onAction({ type: 'flip', cardId: card.id })} disabled={busy || memory.turn !== playerSeat || Boolean(memory.winner) || shown || memory.revealed.length >= 2} aria-label={shown ? `Revealed card ${card.face}` : 'Reveal card'}>{shown ? card.face : '·'}</button>
    })}</div>
  </div>
}
