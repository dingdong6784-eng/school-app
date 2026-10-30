'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Chess, type Square } from 'chess.js'
import { ArrowDown, ArrowLeftRight, ArrowRight, BookOpen, Check, ChevronDown, CircleHelp, Clock3, Coins, Crown, Dices, Gamepad2, Heart, Layers, Lightbulb, RotateCcw, Sparkles, Trophy, Users, X } from 'lucide-react'

type GameId = 'uno' | 'chess' | 'speed' | 'crazy' | 'connect' | 'tic' | 'memory'
const gameOptions: { id: GameId; name: string; kicker: string; icon: string }[] = [
  { id: 'uno', name: 'UNO', kicker: 'A little chaos', icon: 'U' },
  { id: 'chess', name: 'Chess', kicker: 'Make your move', icon: '♞' },
  { id: 'speed', name: 'Speed', kicker: 'Fast hands', icon: '↯' },
  { id: 'crazy', name: 'Crazy Eights', kicker: 'Classic cards', icon: '8' },
  { id: 'connect', name: 'Connect Four', kicker: 'Four in a row', icon: '●' },
  { id: 'tic', name: 'Tic-Tac-Toe', kicker: 'Glow edition', icon: '×' },
  { id: 'memory', name: 'Memory Match', kicker: 'Made for two', icon: '✦' },
]

const rules: Record<GameId, { intro: string; steps: string[]; controls: string }> = {
  uno: { intro: 'A familiar card game, played face-to-face on one screen.', steps: ['Each player starts with seven cards. Match the discard pile by color or number.', 'Tap Draw if you have no match, or choose a matching card from your hand.', 'Skip and Reverse skip the other player in this two-player version. Draw Two and Wild Draw Four make them draw before your next turn.', 'The first person to empty their hand wins. Keep an eye on that last card!'], controls: 'Tap a card to play it, or use Draw a card. The active turn is shown above the table.' },
  chess: { intro: 'A quiet, classic game of tactics. Checkmate wins.', steps: ['White moves first. Players alternate moving one piece at a time.', 'Tap a piece to see its legal destinations, then tap a highlighted square.', 'The king may not move into check. Captured pieces are shown beside the board.', 'Checkmate wins. Stalemate and other drawn positions end in a draw.'], controls: 'Select a piece, then a highlighted square. Pawns automatically promote to a queen.' },
  speed: { intro: 'A quick two-player card race. Both players can play whenever they spot a move.', steps: ['Each player has a five-card hand and their own center stack.', 'Play a card one rank higher, one rank lower, or the same rank as either center card.', 'Draw back up to five cards after each play. Aces wrap around from King to Two.', 'The first person to clear their hand wins. If neither can move, use the reset piles button.'], controls: 'Tap any playable card in either hand. This is a pass-and-play table, so take turns at the same screen.' },
  crazy: { intro: 'A low-stakes classic: shed your cards before the other player does.', steps: ['Each player receives five cards. Match the top card by suit or rank.', 'An Eight can be played on anything. Choose the suit you want next.', 'If you cannot play, draw one card. The turn passes to the other player.', 'First to empty their hand wins.'], controls: 'Tap a playable card. Choose a suit after playing an Eight, or Draw a card to pass.' },
  connect: { intro: 'Take turns dropping discs. Four connected discs wins.', steps: ['Players alternate dropping a disc into one of seven columns.', 'Discs fall to the lowest open space in a column.', 'Connect four horizontally, vertically, or diagonally to win.', 'If all 42 spaces fill with no four in a row, it is a draw.'], controls: 'Choose a column by tapping its arrow above the board.' },
  tic: { intro: 'A tiny classic with a little glow around the edges.', steps: ['Players take turns claiming one of the nine squares.', 'Connect three symbols horizontally, vertically, or diagonally to win.', 'If all squares are filled before someone connects three, it is a draw.', 'New round resets the board. The starting player alternates.'], controls: 'Tap an empty square to place your symbol.' },
  memory: { intro: 'Turn over two cards at a time and remember where each pair lives.', steps: ['Take turns revealing two cards.', 'A matching pair stays face-up and earns a point.', 'If they do not match, both cards turn back over and the other person goes.', 'The person with the most pairs when the board is clear wins.'], controls: 'Tap two cards on your turn. Matches stay visible.' },
}

function HowToPlay({ game }: { game: GameId }) {
  const [open, setOpen] = useState(false)
  const details = rules[game]
  return (
    <>
      <button className="howto-trigger" onClick={() => setOpen(true)}><BookOpen size={14} /> How to play</button>
      {open ? <div className="rules-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false) }}>
        <section className="rules-dialog" role="dialog" aria-modal="true" aria-labelledby={`rules-${game}`}>
          <button className="rules-close" onClick={() => setOpen(false)} aria-label="Close rules"><X size={16} /></button>
          <span className="rules-icon"><CircleHelp size={17} /></span>
          <p className="eyebrow">THE HOUSE RULES</p>
          <h2 id={`rules-${game}`}>How to play <em>{gameOptions.find((item) => item.id === game)?.name}</em></h2>
          <p className="rules-intro">{details.intro}</p>
          <ol className="rules-list">{details.steps.map((step, index) => <li key={step}><span>{String(index + 1).padStart(2, '0')}</span><p>{step}</p></li>)}</ol>
          <div className="rules-controls"><Lightbulb size={14} /><p><strong>Controls</strong>{details.controls}</p></div>
          <button className="rules-done" onClick={() => setOpen(false)}>Got it <Check size={14} /></button>
        </section>
      </div> : null}
    </>
  )
}

export function GamesArcade() {
  const [activeGame, setActiveGame] = useState<GameId>('uno')
  return (
    <section className="arcade-page">
      <div className="section-heading-row arcade-heading">
        <div><p className="eyebrow"><Sparkles size={13} /> THE ARCADE</p><h1>Play a little <span>longer.</span></h1><p className="muted-copy">A tiny tournament. Winner gets to pick the next movie.</p></div>
        <div className="arcade-score"><Trophy size={15} /><div><strong>Just us, playing</strong><span>2 players · 7 games</span></div></div>
      </div>
      <div className="game-picker" role="tablist" aria-label="Choose a game">
        {gameOptions.map((game) => <button key={game.id} role="tab" aria-selected={activeGame === game.id} className={activeGame === game.id ? 'game-picker-active' : ''} onClick={() => setActiveGame(game.id)}><span className={`game-picker-icon game-icon-${game.id}`}>{game.icon}</span><span className="game-picker-label"><strong>{game.name}</strong><small>{game.kicker}</small></span></button>)}
      </div>
      <div className="arcade-table">
        {activeGame === 'uno' ? <UnoGame /> : null}
        {activeGame === 'chess' ? <ChessGame /> : null}
        {activeGame === 'speed' || activeGame === 'crazy' ? <ClassicCards game={activeGame} onChange={setActiveGame} /> : null}
        {activeGame === 'connect' ? <ConnectFour /> : null}
        {activeGame === 'tic' ? <TicTacToe /> : null}
        {activeGame === 'memory' ? <MemoryMatch /> : null}
      </div>
      <div className="arcade-footer-note"><Heart size={13} /> No leaderboard. No pressure. Just a rematch.</div>
    </section>
  )
}

type UnoColor = 'red' | 'blue' | 'green' | 'yellow'
type UnoPlayer = 'Him' | 'Her'
type UnoCard = { id: number; color: UnoColor | 'wild'; value: string }
type UnoState = { hands: Record<UnoPlayer, UnoCard[]>; deck: UnoCard[]; discard: UnoCard[]; color: UnoColor; turn: UnoPlayer; winner: UnoPlayer | null; lastAction: string }
const unoColors: UnoColor[] = ['red', 'blue', 'green', 'yellow']
const colorHex: Record<UnoColor, string> = { red: '#d86c74', blue: '#668dac', green: '#6caa88', yellow: '#d9b768' }

function shuffled<T>(cards: T[]) {
  const copy = [...cards]
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1))
    ;[copy[index], copy[swap]] = [copy[swap], copy[index]]
  }
  return copy
}

function createUno(): UnoState {
  let nextId = 0
  const deck: UnoCard[] = []
  for (const color of unoColors) {
    deck.push({ id: nextId++, color, value: '0' })
    for (let count = 0; count < 2; count += 1) {
      for (let number = 1; number <= 9; number += 1) deck.push({ id: nextId++, color, value: String(number) })
      for (const value of ['skip', 'reverse', 'draw2']) deck.push({ id: nextId++, color, value })
    }
  }
  for (let count = 0; count < 4; count += 1) {
    deck.push({ id: nextId++, color: 'wild', value: 'wild' }, { id: nextId++, color: 'wild', value: 'draw4' })
  }
  const pile = shuffled(deck)
  const hands = { Him: pile.splice(0, 7), Her: pile.splice(0, 7) }
  let first = pile.pop()!
  while (first.color === 'wild') { pile.unshift(first); first = pile.pop()! }
  return { hands, deck: pile, discard: [first], color: first.color as UnoColor, turn: 'Him', winner: null, lastAction: 'Him starts. Match the color or number.' }
}

function UnoCardFace({ card, onClick, disabled }: { card: UnoCard; onClick?: () => void; disabled?: boolean }) {
  return <button type="button" className={`uno-card ${card.color === 'wild' ? 'uno-card-wild' : ''} ${card.color !== 'wild' ? `uno-${card.color}` : ''}`} onClick={onClick} disabled={disabled} aria-label={`${card.color} ${card.value}`}>
    {card.color === 'wild' ? <span className="uno-wild-mark"><i /><i /><i /><i /></span> : null}
    <span className="uno-card-value">{card.value === 'skip' ? '⊘' : card.value === 'reverse' ? '↻' : card.value === 'draw2' ? '+2' : card.value === 'draw4' ? '+4' : card.value === 'wild' ? '✦' : card.value}</span>
    <small>{card.value === 'draw2' ? 'DRAW TWO' : card.value === 'draw4' ? 'WILD +4' : card.value.toUpperCase()}</small>
  </button>
}

function UnoGame() {
  const [state, setState] = useState<UnoState>(() => createUno())
  const activePlayer = state.turn
  const otherPlayer: UnoPlayer = activePlayer === 'Him' ? 'Her' : 'Him'
  const topCard = state.discard[state.discard.length - 1]

  function playCard(player: UnoPlayer, card: UnoCard) {
    setState((current) => {
      if (current.winner || current.turn !== player) return current
      const top = current.discard[current.discard.length - 1]
      if (card.color !== 'wild' && card.color !== current.color && card.value !== top.value) return { ...current, lastAction: 'That card does not match. Try the current color or number.' }
      const hand = current.hands[player].filter((item) => item.id !== card.id)
      const hands = { ...current.hands, [player]: hand }
      if (!hand.length) return { ...current, hands, discard: [...current.discard, card], color: card.color === 'wild' ? current.color : card.color, winner: player, lastAction: `${player} wins this round!` }
      const next: UnoPlayer = player === 'Him' ? 'Her' : 'Him'
      let nextHands = hands
      let turn: UnoPlayer = next
      let action = `${player} played ${card.value === 'skip' ? 'Skip' : card.value === 'draw2' ? 'Draw Two' : card.value === 'draw4' ? 'Wild Draw Four' : card.value}.`
      if (card.value === 'skip' || card.value === 'reverse') { turn = player; action += ` ${next} is skipped.` }
      if (card.value === 'draw2' || card.value === 'draw4') {
        const amount = card.value === 'draw2' ? 2 : 4
        const deck = [...current.deck]
        const penaltyCards = deck.splice(0, amount)
        nextHands = { ...hands, [next]: [...hands[next], ...penaltyCards] }
        turn = player
        action += ` ${next} draws ${amount}.`
        return { ...current, hands: nextHands, deck, discard: [...current.discard, card], color: card.color === 'wild' ? current.color : card.color, turn, lastAction: action }
      }
      const newColor = card.color === 'wild' ? unoColors[Math.floor(Math.random() * unoColors.length)] : card.color
      if (card.color === 'wild') action += ` Color is ${newColor}.`
      return { ...current, hands: nextHands, discard: [...current.discard, card], color: newColor, turn, lastAction: action }
    })
  }

  function drawCard() {
    setState((current) => {
      if (current.winner) return current
      const deck = [...current.deck]
      const drawn = deck.shift()
      if (!drawn) return { ...current, lastAction: 'The draw pile is empty. Play a card to continue.' }
      return { ...current, deck, hands: { ...current.hands, [current.turn]: [...current.hands[current.turn], drawn] }, turn: current.turn === 'Him' ? 'Her' : 'Him', lastAction: `${current.turn} drew a card. Turn passes.` }
    })
  }

  return <div className="game-content">
    <GameTitle title="UNO" subtitle="A little color, a little chaos." game="uno" onReset={() => setState(createUno())} />
    <div className="uno-scoreline"><span><span className="player-chip him-chip">Z</span> Him <strong>{state.hands.Him.length}</strong></span><span className="uno-current-color"><i style={{ background: colorHex[state.color] }} /> Current color: <b>{state.color}</b></span><span><span className="player-chip her-chip">K</span> Her <strong>{state.hands.Her.length}</strong></span></div>
    <div className="uno-table">
      <div className={`uno-player-row ${state.turn === 'Her' && !state.winner ? 'active-player-row' : ''}`}><div className="game-player-label"><span className="player-chip her-chip">K</span><div><strong>Her</strong><small>{state.turn === 'Her' && !state.winner ? 'Her turn' : `${state.hands.Her.length} cards`}</small></div></div><div className="uno-hand uno-hand-opponent">{state.hands.Her.map((card) => <UnoCardFace key={card.id} card={card} onClick={() => playCard('Her', card)} disabled={state.turn !== 'Her' || !!state.winner} />)}</div></div>
      <div className="uno-center-row"><div className="draw-stack"><span className="draw-stack-count">{state.deck.length}</span><button className="uno-back-card" onClick={drawCard} disabled={!!state.winner}><span>DRAW<br />ONE</span><Heart size={15} fill="currentColor" /></button><button className="draw-one-button" onClick={drawCard} disabled={!!state.winner}><ArrowDown size={12} /> Draw a card</button></div><div className="uno-discard"><span className="pile-label">DISCARD</span><UnoCardFace card={topCard} /><span className="active-color-chip" style={{ background: colorHex[state.color] }} title={`Current color: ${state.color}`} /></div><div className="uno-center-note"><span className="turn-pip" /><strong>{state.winner ? `${state.winner} wins!` : `${state.turn}’s turn`}</strong><small>{state.lastAction}</small></div></div>
      <div className={`uno-player-row ${state.turn === 'Him' && !state.winner ? 'active-player-row' : ''}`}><div className="game-player-label"><span className="player-chip him-chip">Z</span><div><strong>Him</strong><small>{state.turn === 'Him' && !state.winner ? 'Your turn' : `${state.hands.Him.length} cards`}</small></div></div><div className="uno-hand">{state.hands.Him.map((card) => <UnoCardFace key={card.id} card={card} onClick={() => playCard('Him', card)} disabled={state.turn !== 'Him' || !!state.winner} />)}</div></div>
    </div>
    <div className="game-status"><span className="status-live-dot" />{state.winner ? `${state.winner} takes this one.` : 'Pass the screen when the turn changes.'}<span className="status-spacer" /><HowToPlay game="uno" /></div>
  </div>
}

function GameTitle({ title, subtitle, game, onReset, actions }: { title: string; subtitle: string; game: GameId; onReset: () => void; actions?: React.ReactNode }) {
  return <div className="game-title-row"><div><p className="eyebrow"><Gamepad2 size={12} /> TWO-PLAYER TABLE</p><h2>{title}</h2><p className="game-subtitle">{subtitle}</p></div><div className="game-title-actions">{actions}<button className="reset-game-button" onClick={onReset} aria-label={`Reset ${title}`}><RotateCcw size={14} /> New game</button><HowToPlay game={game} /></div></div>
}

function ChessGame() {
  const chessRef = useRef(new Chess())
  const game = chessRef.current
  const [position, setPosition] = useState(game.fen())
  const [selected, setSelected] = useState<Square | null>(null)
  const [history, setHistory] = useState<string[]>([])
  const [captured, setCaptured] = useState({ w: [] as string[], b: [] as string[] })
  const [seconds, setSeconds] = useState(0)
  const [message, setMessage] = useState('White moves first.')
  const board = game.board()
  const legalTargets = selected ? game.moves({ square: selected, verbose: true }).map((move) => move.to) : []

  useEffect(() => {
    const timer = window.setInterval(() => setSeconds((value) => value + 1), 1000)
    return () => window.clearInterval(timer)
  }, [])

  function resetChess() {
    game.reset()
    setPosition(game.fen())
    setSelected(null)
    setHistory([])
    setCaptured({ w: [], b: [] })
    setSeconds(0)
    setMessage('White moves first.')
  }

  function chooseSquare(square: Square) {
    const piece = game.get(square)
    if (selected && legalTargets.includes(square)) {
      try {
        const move = game.move({ from: selected, to: square, promotion: 'q' })
        setPosition(game.fen())
        setSelected(null)
        setHistory(game.history())
        if (move.captured) setCaptured((current) => ({ ...current, [move.color]: [...current[move.color], move.captured!] }))
        setMessage(game.isCheckmate() ? `${move.color === 'w' ? 'White' : 'Black'} wins by checkmate.` : game.isDraw() ? 'A draw. Good game.' : game.isCheck() ? `${game.turn() === 'w' ? 'White' : 'Black'} is in check.` : `${game.turn() === 'w' ? 'White' : 'Black'} to move.`)
      } catch { setSelected(null) }
      return
    }
    if (piece && piece.color === game.turn() && !game.isGameOver()) setSelected(square)
    else setSelected(null)
  }

  const fileLetters = 'abcdefgh'
  const clock = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
  const symbols: Record<string, string> = { wk: '♔', wq: '♕', wr: '♖', wb: '♗', wn: '♘', wp: '♙', bk: '♚', bq: '♛', br: '♜', bb: '♝', bn: '♞', bp: '♟' }

  return <div className="game-content">
    <GameTitle title="Chess" subtitle="Make your move. Take your time." game="chess" onReset={resetChess} />
    <div className="chess-layout">
      <div className="chess-board-wrap"><div className="chess-player-bar"><span className="player-chip her-chip">K</span><span>Her <small>Black</small></span><strong className={game.turn() === 'b' ? 'chess-active-clock' : ''}>{clock}</strong></div>
        <div className="chess-board" aria-label="Chess board">
          {board.map((row, rowIndex) => row.map((piece, colIndex) => {
            const square = `${fileLetters[colIndex]}${8 - rowIndex}` as Square
            const light = (rowIndex + colIndex) % 2 === 0
            const isSelected = selected === square
            const target = legalTargets.includes(square)
            return <button key={square} className={`chess-square ${light ? 'square-light' : 'square-dark'} ${isSelected ? 'square-selected' : ''} ${target ? 'square-target' : ''}`} onClick={() => chooseSquare(square)} aria-label={`${square}${piece ? ` ${piece.color === 'w' ? 'white' : 'black'} ${piece.type}` : ''}`}>
              {piece ? <span className={`chess-piece chess-${piece.color}`}>{symbols[`${piece.color}${piece.type}`]}</span> : null}
              {target && !piece ? <i className="legal-dot" /> : null}{target && piece ? <i className="legal-ring" /> : null}
              {colIndex === 0 ? <small className="rank-label">{8 - rowIndex}</small> : null}{rowIndex === 7 ? <small className="file-label">{fileLetters[colIndex]}</small> : null}
            </button>
          }))}
        </div>
        <div className="chess-player-bar"><span className="player-chip him-chip">Z</span><span>Him <small>White</small></span><strong className={game.turn() === 'w' ? 'chess-active-clock' : ''}>{clock}</strong></div>
      </div>
      <aside className="chess-side-panel"><div className="chess-turn-card"><span className="turn-indicator"><span /></span><div><small>NOW MOVING</small><strong>{game.turn() === 'w' ? 'Him · White' : 'Her · Black'}</strong></div></div><p className="chess-message">{message}</p><div className="captured-strip"><span>Captured</span><p><i>{captured.w.map((piece, index) => <b key={`${piece}-${index}`}>{symbols[`b${piece}`]}</b>)}</i><i>{captured.b.map((piece, index) => <b key={`${piece}-${index}`}>{symbols[`w${piece}`]}</b>)}</i></p></div><div className="move-history"><div className="move-history-header"><span>MOVE HISTORY</span><span>{history.length} ply</span></div><div className="move-list">{history.length ? history.map((move, index) => <span key={`${move}-${index}`}><small>{Math.floor(index / 2) + 1}{index % 2 === 0 ? '.' : '…'}</small>{move}</span>) : <p>Moves will appear here.</p>}</div></div><div className="chess-turn-note"><Clock3 size={13} /> Casual clock · {clock}</div></aside>
    </div>
    <div className="game-status"><span className="status-live-dot" />{message}<span className="status-spacer" /><HowToPlay game="chess" /></div>
  </div>
}

type Suit = '♠' | '♥' | '♦' | '♣'
type PlayingCard = { rank: string; suit: Suit; key: string }
const suits: Suit[] = ['♠', '♥', '♦', '♣']
const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']
function createDeck(): PlayingCard[] { return shuffled(suits.flatMap((suit) => ranks.map((rank) => ({ rank, suit, key: `${rank}${suit}` })))) }
function cardIsRed(suit: Suit) { return suit === '♥' || suit === '♦' }
function CardFace({ card, onClick, disabled, compact = false }: { card: PlayingCard; onClick?: () => void; disabled?: boolean; compact?: boolean }) {
  return <button className={`playing-card ${cardIsRed(card.suit) ? 'card-red' : ''} ${compact ? 'playing-card-compact' : ''}`} onClick={onClick} disabled={disabled} aria-label={`${card.rank} of ${card.suit}`}><span>{card.rank}<i>{card.suit}</i></span><strong>{card.suit}</strong><span>{card.rank}<i>{card.suit}</i></span></button>
}

function ClassicCards({ game, onChange }: { game: 'speed' | 'crazy'; onChange: (game: GameId) => void }) {
  const [speed, setSpeed] = useState(() => newSpeedGame())
  const [crazy, setCrazy] = useState(() => newCrazyGame())
  const [pendingEight, setPendingEight] = useState<PlayingCard | null>(null)
  const current = game === 'speed' ? speed : crazy

  function resetClassic() {
    if (game === 'speed') setSpeed(newSpeedGame())
    else { setCrazy(newCrazyGame()); setPendingEight(null) }
  }

  function playCrazy(player: UnoPlayer, card: PlayingCard, suit?: Suit) {
    if (crazy.turn !== player || crazy.winner) return
    const top = crazy.discard[crazy.discard.length - 1]
    if (card.rank !== '8' && card.suit !== crazy.activeSuit && card.rank !== top.rank) return
    if (card.rank === '8' && !suit) { setPendingEight(card); return }
    const hands = { ...crazy.hands, [player]: crazy.hands[player].filter((item) => item.key !== card.key) }
    setCrazy({ ...crazy, hands, discard: [...crazy.discard, card], activeSuit: suit ?? card.suit, turn: player === 'Him' ? 'Her' : 'Him', winner: hands[player].length === 0 ? player : null })
    setPendingEight(null)
  }

  function drawCrazy() {
    if (crazy.winner) return
    const deck = [...crazy.deck]
    const card = deck.pop()
    if (!card) return
    const player = crazy.turn
    setCrazy({ ...crazy, deck, hands: { ...crazy.hands, [player]: [...crazy.hands[player], card] }, turn: player === 'Him' ? 'Her' : 'Him' })
    setPendingEight(null)
  }

  function playSpeed(player: UnoPlayer, card: PlayingCard, pileIndex: 0 | 1) {
    if (speed.winner || !isSpeedPlayable(card, speed.piles[pileIndex])) return
    const hands = { ...speed.hands, [player]: speed.hands[player].filter((item) => item.key !== card.key) }
    const deck = [...speed.deck]
    while (hands[player].length < 5 && deck.length) hands[player].push(deck.pop()!)
    const piles: [PlayingCard, PlayingCard] = [...speed.piles]
    piles[pileIndex] = card
    const winner = hands[player].length === 0 && deck.length === 0 ? player : null
    setSpeed({ ...speed, hands, deck, piles, winner })
  }

  function resetSpeedStacks() {
    const discard = speed.piles
    if (speed.deck.length < 2) return
    setSpeed({ ...speed, piles: [speed.deck.pop()!, speed.deck.pop()!], deck: [...speed.deck, ...discard] })
  }

  return <div className="game-content">
    <GameTitle title={game === 'speed' ? 'Speed' : 'Crazy Eights'} subtitle={game === 'speed' ? 'Fast hands. No turn waiting.' : 'The classic, with a little extra charm.'} game={game} onReset={resetClassic} actions={<div className="classic-toggle"><button className={game === 'speed' ? 'classic-toggle-active' : ''} onClick={() => onChange('speed')}>Speed</button><button className={game === 'crazy' ? 'classic-toggle-active' : ''} onClick={() => onChange('crazy')}>Crazy 8s</button></div>} />
    {game === 'speed' ? <>
      <div className="speed-score-strip"><span><i className="player-chip him-chip">Z</i> Him <b>{speed.hands.Him.length}</b></span><span className="speed-deck-count"><Layers size={13} /> {speed.deck.length} draw cards</span><span><i className="player-chip her-chip">K</i> Her <b>{speed.hands.Her.length}</b></span></div>
      <div className="speed-table"><div className="speed-piles"><div className="speed-stack"><small>PLAY ON EITHER</small><CardFace card={speed.piles[0]} compact /><ArrowLeftRight size={15} /><CardFace card={speed.piles[1]} compact /></div><button className="reset-piles-button" onClick={resetSpeedStacks}><RotateCcw size={12} /> Stuck? Refill center</button></div>
        {(['Her', 'Him'] as UnoPlayer[]).map((player) => <div className={`speed-player ${player === 'Her' ? 'speed-player-top' : ''}`} key={player}><div className="speed-player-label"><span className={`player-chip ${player === 'Her' ? 'her-chip' : 'him-chip'}`}>{player === 'Her' ? 'K' : 'Z'}</span><strong>{player}</strong><small>{player === 'Her' ? 'Top hand' : 'Your hand'}</small></div><div className="speed-hand">{speed.hands[player].map((card) => <div className="speed-card-wrap" key={card.key}><CardFace card={card} compact disabled={!!speed.winner} onClick={() => { const pileIndex = isSpeedPlayable(card, speed.piles[0]) ? 0 : 1; if (isSpeedPlayable(card, speed.piles[pileIndex])) playSpeed(player, card, pileIndex) }} />{speed.piles.some((pile) => isSpeedPlayable(card, pile)) ? <span className="playable-tag">PLAY</span> : null}</div>)}</div></div>)}
      </div><div className="game-status"><span className="status-live-dot" />{speed.winner ? `${speed.winner} wins the race!` : 'Play one rank up, one down, or the same rank.'}<span className="status-spacer" /><HowToPlay game="speed" /></div>
    </> : <>
      <div className="crazy-status-row"><span><i className="player-chip her-chip">K</i> Her <b>{crazy.hands.Her.length}</b></span><span className="crazy-turn-pill"><span /> {crazy.winner ? `${crazy.winner} wins!` : `${crazy.turn}’s turn`}</span><span><i className="player-chip him-chip">Z</i> Him <b>{crazy.hands.Him.length}</b></span></div>
      <div className="crazy-table"><div className={`crazy-hand-row ${crazy.turn === 'Her' ? 'active-player-row' : ''}`}><div className="game-player-label"><span className="player-chip her-chip">K</span><div><strong>Her</strong><small>{crazy.turn === 'Her' ? 'Her turn' : `${crazy.hands.Her.length} cards`}</small></div></div><div className="crazy-hand">{crazy.hands.Her.map((card) => <CardFace key={card.key} card={card} disabled={crazy.turn !== 'Her' || !!crazy.winner} onClick={() => playCrazy('Her', card)} />)}</div></div>
        <div className="crazy-center"><div className="crazy-deck"><Layers size={16} /><span>{crazy.deck.length}</span><small>DRAW PILE</small></div><div className="crazy-discard"><small>TOP CARD</small><CardFace card={crazy.discard[crazy.discard.length - 1]} /><span className="active-suit-note">Current suit <strong className={cardIsRed(crazy.activeSuit) ? 'card-red-text' : ''}>{crazy.activeSuit}</strong></span></div><button className="draw-one-button" onClick={drawCrazy} disabled={!!crazy.winner}><ArrowDown size={12} /> Draw a card</button></div>
        <div className={`crazy-hand-row ${crazy.turn === 'Him' ? 'active-player-row' : ''}`}><div className="game-player-label"><span className="player-chip him-chip">Z</span><div><strong>Him</strong><small>{crazy.turn === 'Him' ? 'Your turn' : `${crazy.hands.Him.length} cards`}</small></div></div><div className="crazy-hand">{crazy.hands.Him.map((card) => <CardFace key={card.key} card={card} disabled={crazy.turn !== 'Him' || !!crazy.winner} onClick={() => playCrazy('Him', card)} />)}</div></div>
      </div>
      {pendingEight ? <div className="suit-picker"><span>Choose the next suit</span>{suits.map((suit) => <button key={suit} className={cardIsRed(suit) ? 'card-red-text' : ''} onClick={() => playCrazy(crazy.turn, pendingEight, suit)}>{suit}</button>)}</div> : null}
      <div className="game-status"><span className="status-live-dot" />{crazy.winner ? `${crazy.winner} wins!` : 'Match the suit or rank. Eights are wild.'}<span className="status-spacer" /><HowToPlay game="crazy" /></div>
    </>}
  </div>
}

function newSpeedGame() {
  const deck = createDeck()
  const Him = deck.splice(0, 5)
  const Her = deck.splice(0, 5)
  const piles: [PlayingCard, PlayingCard] = [deck.pop()!, deck.pop()!]
  return { deck, hands: { Him, Her }, piles, winner: null as UnoPlayer | null }
}
function rankValue(rank: string) { return rank === 'A' ? 1 : rank === 'J' ? 11 : rank === 'Q' ? 12 : rank === 'K' ? 13 : Number(rank) }
function isSpeedPlayable(card: PlayingCard, top: PlayingCard) { const difference = Math.abs(rankValue(card.rank) - rankValue(top.rank)); return difference === 0 || difference === 1 || difference === 12 }
function newCrazyGame() {
  const deck = createDeck()
  const Him = deck.splice(0, 5)
  const Her = deck.splice(0, 5)
  let first = deck.pop()!
  while (first.rank === '8') { deck.unshift(first); first = deck.pop()! }
  return { deck, hands: { Him, Her }, discard: [first], activeSuit: first.suit, turn: 'Him' as UnoPlayer, winner: null as UnoPlayer | null }
}

function TicTacToe() {
  const [board, setBoard] = useState<Array<'X' | 'O' | null>>(() => Array(9).fill(null))
  const [turn, setTurn] = useState<'X' | 'O'>('X')
  const [round, setRound] = useState(1)
  const [scores, setScores] = useState({ X: 0, O: 0 })
  const winner = useMemo(() => {
    const lines = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]]
    const line = lines.find(([a,b,c]) => board[a] && board[a] === board[b] && board[a] === board[c])
    return line ? board[line[0]] : null
  }, [board])
  const draw = !winner && board.every(Boolean)

  function makeMove(index: number) {
    if (board[index] || winner || draw) return
    const next = [...board]
    next[index] = turn
    setBoard(next)
    const lines = [[0,1,2],[0,3,6],[0,4,8],[1,4,7],[2,5,8],[2,4,6],[3,4,5],[6,7,8]]
    if (lines.some(([a,b,c]) => next[a] && next[a] === next[b] && next[a] === next[c])) setScores((current) => ({ ...current, [turn]: current[turn] + 1 }))
    setTurn(turn === 'X' ? 'O' : 'X')
  }

  function resetRound() { setBoard(Array(9).fill(null)); setTurn(round % 2 ? 'X' : 'O'); setRound((value) => value + 1) }
  function resetMatch() { setBoard(Array(9).fill(null)); setTurn('X'); setRound(1); setScores({ X: 0, O: 0 }) }
  const status = winner ? `${winner === 'X' ? 'Him' : 'Her'} takes this round.` : draw ? 'A perfect little draw.' : `${turn === 'X' ? 'Him' : 'Her'} to play`

  return <div className="game-content">
    <GameTitle title="Tic-Tac-Toe" subtitle="Nine squares. One more reason to rematch." game="tic" onReset={resetMatch} />
    <div className="tic-scorebar"><span className="tic-player"><i className="player-chip him-chip">Z</i><span>Him <b>{scores.X}</b></span></span><div className="tic-round-label"><span className="turn-pip" />{status}</div><span className="tic-player"><i className="player-chip her-chip">K</i><span>Her <b>{scores.O}</b></span></span></div>
    <div className="tic-board" role="grid" aria-label="Tic tac toe board">{board.map((value, index) => <button key={index} role="gridcell" className={`tic-cell ${value === 'X' ? 'tic-x' : value === 'O' ? 'tic-o' : ''}`} onClick={() => makeMove(index)} disabled={!!winner || draw || !!value} aria-label={`Cell ${index + 1}${value ? `, ${value}` : ', empty'}`}>{value}</button>)}</div>
    <div className="tic-footer"><span><Sparkles size={12} /> Glow edition</span>{winner || draw ? <button onClick={resetRound}><RotateCcw size={12} /> Next round</button> : <HowToPlay game="tic" />}</div>
    {(winner || draw) ? <div className="game-status"><span className="status-live-dot" />{status}<span className="status-spacer" /><HowToPlay game="tic" /></div> : null}
  </div>
}

function ConnectFour() {
  const [board, setBoard] = useState<Array<'R' | 'Y' | null>>(() => Array(42).fill(null))
  const [turn, setTurn] = useState<'R' | 'Y'>('R')
  const [winner, setWinner] = useState<'R' | 'Y' | 'draw' | null>(null)
  const [scores, setScores] = useState({ R: 0, Y: 0 })
  const [round, setRound] = useState(1)
  function drop(column: number) {
    if (winner) return
    const next = [...board]
    let row = 5
    while (row >= 0 && next[row * 7 + column]) row -= 1
    if (row < 0) return
    next[row * 7 + column] = turn
    setBoard(next)
    let won = false
    for (let r = 0; r < 6; r += 1) for (let c = 0; c < 7; c += 1) {
      const cell = next[r * 7 + c]
      if (!cell) continue
      for (const [dr, dc] of [[0,1],[1,0],[1,1],[1,-1]]) {
        const nr = r + dr * 3, nc = c + dc * 3
        if (nr < 0 || nr >= 6 || nc < 0 || nc >= 7) continue
        if ([1,2,3].every((step) => next[(r + dr * step) * 7 + c + dc * step] === cell)) won = true
      }
    }
    if (won) { setWinner(turn); setScores((current) => ({ ...current, [turn]: current[turn] + 1 })) }
    else if (next.every(Boolean)) setWinner('draw')
    else setTurn(turn === 'R' ? 'Y' : 'R')
  }
  function resetBoard() { setBoard(Array(42).fill(null)); setWinner(null); setTurn(round % 2 ? 'R' : 'Y'); setRound((value) => value + 1) }
  function resetMatch() { setBoard(Array(42).fill(null)); setWinner(null); setTurn('R'); setRound(1); setScores({ R: 0, Y: 0 }) }
  const status = winner === 'draw' ? 'The board is full. It’s a draw.' : winner ? `${winner === 'R' ? 'Him' : 'Her'} got four in a row!` : `${turn === 'R' ? 'Him' : 'Her'} to drop`
  return <div className="game-content">
    <GameTitle title="Connect Four" subtitle="A little strategy, one disc at a time." game="connect" onReset={resetMatch} />
    <div className="connect-scorebar"><span><i className="player-chip him-chip">Z</i> Him <b>{scores.R}</b></span><span className="connect-turn">{status}</span><span><i className="player-chip her-chip">K</i> Her <b>{scores.Y}</b></span></div>
    <div className="connect-board-wrap"><div className="connect-columns">{Array.from({ length: 7 }, (_, column) => <button key={column} onClick={() => drop(column)} disabled={!!winner || board[column] !== null} aria-label={`Drop in column ${column + 1}`}><ChevronDown size={14} /></button>)}</div><div className="connect-board" role="grid" aria-label="Connect four board">{board.map((cell, index) => <button key={index} role="gridcell" className={`connect-cell ${cell === 'R' ? 'disc-him' : cell === 'Y' ? 'disc-her' : ''}`} onClick={() => drop(index % 7)} disabled={!!winner || !!cell} aria-label={`Row ${Math.floor(index / 7) + 1}, column ${index % 7 + 1}${cell ? ', occupied' : ', empty'}`}><span /></button>)}</div></div>
    <div className="tic-footer"><span><ArrowDown size={12} /> Discs fall to the lowest open space</span>{winner ? <button onClick={resetBoard}><RotateCcw size={12} /> Next round</button> : <HowToPlay game="connect" />}</div>
  </div>
}

function MemoryMatch() {
  const iconSet = ['✦','♡','☾','♧','✿','◇','♬','☼']
  const [cards, setCards] = useState(() => shuffled([...iconSet, ...iconSet].map((icon, index) => ({ id: index, icon }))))
  const [revealed, setRevealed] = useState<number[]>([])
  const [matched, setMatched] = useState<number[]>([])
  const [turn, setTurn] = useState<'Him' | 'Her'>('Him')
  const [scores, setScores] = useState({ Him: 0, Her: 0 })
  const [moves, setMoves] = useState(0)
  const [locked, setLocked] = useState(false)
  const finished = matched.length === cards.length
  const timerRef = useRef<number | null>(null)

  function resetMemory() {
    setCards(shuffled([...iconSet, ...iconSet].map((icon, index) => ({ id: index, icon }))))
    setRevealed([]); setMatched([]); setTurn('Him'); setScores({ Him: 0, Her: 0 }); setMoves(0); setLocked(false)
    if (timerRef.current) window.clearTimeout(timerRef.current)
  }

  function flip(id: number) {
    if (locked || finished || revealed.includes(id) || matched.includes(id)) return
    const next = [...revealed, id]
    setRevealed(next)
    if (next.length < 2) return
    setMoves((count) => count + 1)
    const first = cards.find((card) => card.id === next[0])!
    const second = cards.find((card) => card.id === next[1])!
    if (first.icon === second.icon) {
      setMatched((current) => [...current, ...next])
      setScores((current) => ({ ...current, [turn]: current[turn] + 1 }))
      setRevealed([])
    } else {
      setLocked(true)
      timerRef.current = window.setTimeout(() => { setRevealed([]); setTurn((current) => current === 'Him' ? 'Her' : 'Him'); setLocked(false) }, 800)
    }
  }

  return <div className="game-content">
    <GameTitle title="Memory Match" subtitle="A little memory goes a long way." game="memory" onReset={resetMemory} />
    <div className="memory-scorebar"><span><i className="player-chip him-chip">Z</i> Him <b>{scores.Him}</b></span><span className="memory-moves"><Dices size={13} /> {moves} turns</span><span><i className="player-chip her-chip">K</i> Her <b>{scores.Her}</b></span></div>
    <div className="memory-board" role="grid" aria-label="Memory match cards">{cards.map((card) => { const faceUp = revealed.includes(card.id) || matched.includes(card.id); return <button key={card.id} role="gridcell" className={`memory-card ${faceUp ? 'memory-card-face-up' : ''} ${matched.includes(card.id) ? 'memory-card-matched' : ''}`} onClick={() => flip(card.id)} aria-label={faceUp ? `Card ${card.icon}` : 'Face-down card'} aria-pressed={faceUp}>{faceUp ? card.icon : <span>✦</span>}</button> })}</div>
    <div className="game-status"><span className="status-live-dot" />{finished ? (scores.Him === scores.Her ? 'A perfect tie. Rematch?' : `${scores.Him > scores.Her ? 'Him' : 'Her'} wins memory night!`) : `${turn} picks the next pair.`}<span className="status-spacer" /><HowToPlay game="memory" /></div>
  </div>
}
