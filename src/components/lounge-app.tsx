import { useState } from 'react'
import useSWR from 'swr'
import { Check, Copy, Film, Gamepad2, Heart, LoaderCircle, LockKeyhole, MessageCircle, Sparkles, Users } from 'lucide-react'
import { GamesArcade } from '@/components/games-arcade'
import { LiveChatDrawer } from '@/components/live-chat'
import { MoviesSection } from '@/components/movies-section'
import { createRoom, getMyRoom, getPartnerPresence, joinRoom, lockLounge, rotateRoomInvite, type LoungeUser, type RoomSnapshot } from '@/lib/lounge-actions'
import { otherSeat, type PlayerSeat } from '@/lib/arcade-types'

type HubTab = 'movies' | 'games'

export function LoungeApp({ user, invitationToken, onLocked }: { user: LoungeUser; invitationToken: string; onLocked: () => void }) {
  const { data: room, error, isLoading, mutate } = useSWR<RoomSnapshot | null>(
    ['zk-lounge-room', user.id],
    () => getMyRoom(),
    { refreshInterval: 3000, revalidateOnFocus: true, shouldRetryOnError: false },
  )
  const { data: presence } = useSWR(['lounge-presence', user.id], getPartnerPresence, {
    refreshInterval: 5000,
    revalidateOnFocus: true,
    shouldRetryOnError: false,
  })
  const [tab, setTab] = useState<HubTab>('movies')
  const [selectedSeat, setSelectedSeat] = useState<PlayerSeat>('Z')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [activeInviteToken, setActiveInviteToken] = useState('')
  const [inviteUrl, setInviteUrl] = useState('')
  const [chatOpen, setChatOpen] = useState(false)

  async function handleCreateRoom() {
    setBusy(true)
    setNotice('')
    try {
      const created = await createRoom(selectedSeat)
      setActiveInviteToken(created.inviteToken)
      await mutate()
    } catch {
      setNotice('The private room could not be created. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  async function handleJoinRoom() {
    if (!invitationToken) return
    setBusy(true)
    setNotice('')
    try {
      await joinRoom(invitationToken)
      window.history.replaceState(null, '', window.location.pathname)
      setNotice('You joined the private room. Your games and chat are ready.')
      await mutate()
    } catch (joinError) {
      setNotice(joinError instanceof Error ? joinError.message : 'That invitation could not be accepted.')
    } finally {
      setBusy(false)
    }
  }

  async function handleShareInvite() {
    if (!room || !room.isOwner) return
    setBusy(true)
    setNotice('')
    try {
      const token = activeInviteToken || (await rotateRoomInvite(room.id)).inviteToken
      setActiveInviteToken(token)
      const url = new URL(window.location.pathname, window.location.origin)
      url.searchParams.set('invite', token)
      setInviteUrl(url.toString())
      try {
        await navigator.clipboard.writeText(url.toString())
        setNotice('Invitation link copied. It expires in seven days.')
      } catch {
        setNotice('Copy the private invitation link from the field below.')
      }
    } catch {
      setNotice('A new invitation link could not be created.')
    } finally {
      setBusy(false)
    }
  }

  async function handleSignOut() {
    setBusy(true)
    try {
      await lockLounge()
      onLocked()
    } finally {
      setBusy(false)
    }
  }

  const currentSeat = room?.currentSeat ?? selectedSeat
  const currentAuthor = currentSeat === 'Z' ? 'Him' : 'Her'
  const partnerSeat = otherSeat(currentSeat)
  const partner = room?.members.find((member) => !member.isYou)
  const partnerStatus = partner
    ? `${partner.seat} ${partner.online ? 'is here now' : 'has joined the room'}`
    : `Waiting for ${partnerSeat} to join`

  if (isLoading || (room === undefined && !error)) {
    return <main className="lounge-app"><div className="gate-backdrop"><div className="gate-card gate-checking"><span className="gate-mark"><Heart fill="currentColor" /></span><p className="eyebrow">Z &amp; A · PRIVATE SPACE</p><h1>Opening your room…</h1><LoaderCircle className="spin" size={18} /></div></div></main>
  }

  if (error && room === undefined) {
    return <main className="lounge-app"><div className="gate-backdrop"><section className="gate-card room-load-error"><span className="gate-mark"><Heart fill="currentColor" /></span><p className="eyebrow">YOUR PRIVATE SPACE</p><h1>We couldn&apos;t open your room.</h1><p className="gate-copy">Check your connection and try loading it again.</p><button className="room-create-button" onClick={() => window.location.reload()}>Reload the lounge</button></section></div></main>
  }

  return (
    <main className="lounge-app">
      <div className="lounge-shell lounge-shell-ready">
        <header className="topbar">
          <a className="brand-lockup" href="#home" aria-label="Z and K Lounge home" onClick={(event) => { event.preventDefault(); setTab('movies') }}>
            <span className="brand-emblem"><Heart fill="currentColor" /></span>
            <span className="brand-copy"><strong>Z <i>&amp;</i> A</strong><small>THE LOUNGE</small></span>
          </a>
          {room ? <nav className="main-nav" aria-label="Main navigation">
            <button className={`nav-tab ${tab === 'movies' ? 'nav-tab-active' : ''}`} onClick={() => setTab('movies')}><Film size={15} /><span>Movies &amp; Shows</span></button>
            <button className={`nav-tab ${tab === 'games' ? 'nav-tab-active' : ''}`} onClick={() => setTab('games')}><Gamepad2 size={15} /><span>Games Arcade</span></button>
          </nav> : <div className="private-space-label"><Users size={14} /> Your private space</div>}
          <div className="topbar-actions">
            <span className="partner-presence-chip" aria-live="polite"><i className={presence?.partnerOnline ? 'presence-dot presence-dot-online' : 'presence-dot'} />{presence?.partnerOnline ? 'Partner online' : 'Partner offline'}</span>
            {room ? <span className="account-seat-chip"><i className={currentSeat === 'A' ? 'avatar-her' : ''}>{currentSeat}</i><span>Seat {currentSeat}</span></span> : null}
            <button className="sign-out-button" onClick={handleSignOut} disabled={busy} aria-label="Lock the lounge"><LockKeyhole size={15} /><span>Lock lounge</span></button>
          </div>
        </header>

        {room ? <>
          <div className="mobile-nav" aria-label="Main navigation">
            <button className={tab === 'movies' ? 'mobile-nav-active' : ''} onClick={() => setTab('movies')}><Film size={15} /> Movies</button>
            <button className={tab === 'games' ? 'mobile-nav-active' : ''} onClick={() => setTab('games')}><Gamepad2 size={15} /> Arcade</button>
            <button onClick={() => setChatOpen((open) => !open)}><MessageCircle size={15} /> Chat</button>
          </div>
          <div className="page-frame">
            <section className="room-presence-card" aria-label="Private room status">
              <div className="room-presence-copy"><p className="eyebrow"><Heart size={12} /> YOUR PRIVATE ROOM</p><h1>A little corner, just for two.</h1><p><span className={`presence-dot ${partner?.online ? 'presence-dot-online' : ''}`} />{partnerStatus}</p></div>
              <div className="room-member-pills"><span className="room-member-pill"><i>{currentSeat}</i> You</span><span className={`room-member-pill ${partner ? '' : 'room-member-waiting'}`}><i className={partnerSeat === 'A' ? 'avatar-her' : ''}>{partnerSeat}</i>{partner ? 'Together' : 'Invite pending'}</span></div>
              {room.isOwner && room.members.length < 2 ? <div className="room-invite-actions"><button className="room-invite-button" onClick={handleShareInvite} disabled={busy}><Copy size={14} />{busy ? 'Preparing…' : 'Share invite'}</button>{inviteUrl ? <input className="room-invite-url" value={inviteUrl} readOnly aria-label="Private room invitation link" onFocus={(event) => event.currentTarget.select()} /> : null}</div> : null}
            </section>
            {notice ? <p className="room-notice" role="status">{notice}{inviteUrl ? <Check size={13} /> : null}</p> : null}
            <div className="page-content">{tab === 'movies' ? <MoviesSection roomId={room.id} userId={user.id} /> : <GamesArcade roomId={room.id} userId={user.id} playerSeat={room.currentSeat} />}</div>
            <footer className="site-footer"><span><Sparkles size={13} /> A little corner of the internet, made for two.</span><span>Made with love <Heart size={12} fill="currentColor" /></span></footer>
          </div>
          <button className={`chat-trigger lounge-chat-trigger ${chatOpen ? 'chat-trigger-active' : ''}`} onClick={() => setChatOpen((open) => !open)} aria-expanded={chatOpen} aria-controls="live-chat-drawer"><MessageCircle size={16} /><span>Live chat</span><span className="online-dot" aria-label="Chat is live" /></button>
          <LiveChatDrawer open={chatOpen} onClose={() => setChatOpen(false)} roomId={room.id} userId={user.id} currentAuthor={currentAuthor} />
        </> : <div className="page-frame room-entry-frame">
          <section className="room-entry-card">
            <span className="room-entry-icon"><Heart fill="currentColor" /></span>
            <p className="eyebrow">A TWO-SEAT ROOM</p>
            <h1>{invitationToken ? 'You have a little invitation.' : 'Make this space yours.'}</h1>
            <p className="room-entry-copy">{invitationToken ? 'Unlock with the other passcode, then claim the open seat.' : 'Create a private room, choose your seat, and invite the other person with a one-use link.'}</p>
            {invitationToken ? <button className="gate-submit room-join-button" onClick={handleJoinRoom} disabled={busy}><span>{busy ? 'Joining…' : 'Accept invitation'}</span><Users size={15} /></button> : null}
            <div className="seat-picker" role="group" aria-label="Choose your room seat">
              <button className={selectedSeat === 'Z' ? 'seat-picker-selected' : ''} onClick={() => setSelectedSeat('Z')}><i>Z</i><span>Seat Z</span>{selectedSeat === 'Z' ? <Check size={14} /> : null}</button>
              <button className={selectedSeat === 'A' ? 'seat-picker-selected' : ''} onClick={() => setSelectedSeat('A')}><i className="avatar-her">A</i><span>Seat A</span>{selectedSeat === 'A' ? <Check size={14} /> : null}</button>
            </div>
            <button className="room-create-button" onClick={handleCreateRoom} disabled={busy}><span>{busy ? 'Setting things up…' : 'Create a private room'}</span><Copy size={15} /></button>
            {notice ? <p className="account-error" role="alert">{notice}</p> : null}
            <p className="room-entry-footnote"><LockKeyhole size={12} /> One passcode per person. Two seats, maximum.</p>
          </section>
          {error ? <p className="room-notice" role="alert">Your room could not be loaded. Refresh the page to try again.</p> : null}
          <footer className="site-footer"><span><Sparkles size={13} /> A little corner of the internet, made for two.</span><span>Made with love <Heart size={12} fill="currentColor" /></span></footer>
        </div>}
      </div>
    </main>
  )
}
