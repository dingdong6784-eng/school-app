'use client'

import { useEffect, useState } from 'react'
import { Check, ChevronDown, Film, Gamepad2, Heart, LockKeyhole, MessageCircle, Sparkles } from 'lucide-react'
import { AccessGate } from '@/components/access-gate'
import { GamesArcade } from '@/components/games-arcade'
import { LiveChatDrawer } from '@/components/live-chat'
import { MoviesSection } from '@/components/movies-section'
import { checkLoungeSession, lockLounge, unlockLounge, type LoungeAuthor } from '@/app/actions/lounge'

type HubTab = 'movies' | 'games'
const AUTH_KEY = 'zk-lounge-authenticated'

export function LoungeApp() {
  const [unlocked, setUnlocked] = useState(false)
  const [checking, setChecking] = useState(true)
  const [tab, setTab] = useState<HubTab>('movies')
  const [chatOpen, setChatOpen] = useState(false)
  const [profile, setProfile] = useState<LoungeAuthor>('Him')
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)

  useEffect(() => {
    let mounted = true
    if (window.localStorage.getItem(AUTH_KEY) !== 'true') {
      setChecking(false)
      return () => { mounted = false }
    }

    checkLoungeSession()
      .then((hasAccess) => {
        if (!mounted) return
        if (hasAccess) setUnlocked(true)
        else window.localStorage.removeItem(AUTH_KEY)
      })
      .catch(() => {
        if (mounted) window.localStorage.removeItem(AUTH_KEY)
      })
      .finally(() => {
        if (mounted) setChecking(false)
      })

    return () => { mounted = false }
  }, [])

  async function handleUnlock(passcode: string) {
    const success = await unlockLounge(passcode)
    if (success) {
      window.localStorage.setItem(AUTH_KEY, 'true')
      setUnlocked(true)
    }
    return success
  }

  async function handleLock() {
    await lockLounge()
    window.localStorage.removeItem(AUTH_KEY)
    setUnlocked(false)
    setChatOpen(false)
  }

  return (
    <main className="lounge-app">
      {!unlocked ? <AccessGate onUnlock={handleUnlock} checking={checking} /> : null}
      <div className={`lounge-shell ${unlocked ? 'lounge-shell-ready' : 'lounge-shell-locked'}`} aria-hidden={!unlocked}>
        <header className="topbar">
          <a className="brand-lockup" href="#home" aria-label="Z and K Lounge home" onClick={(event) => { event.preventDefault(); setTab('movies') }}>
            <span className="brand-emblem"><Heart fill="currentColor" /></span>
            <span className="brand-copy"><strong>Z <i>&amp;</i> K</strong><small>THE LOUNGE</small></span>
          </a>

          <nav className="main-nav" aria-label="Main navigation">
            <button className={`nav-tab ${tab === 'movies' ? 'nav-tab-active' : ''}`} onClick={() => setTab('movies')}>
              <Film size={15} /><span>Movies &amp; Shows</span>
            </button>
            <button className={`nav-tab ${tab === 'games' ? 'nav-tab-active' : ''}`} onClick={() => setTab('games')}>
              <Gamepad2 size={15} /><span>Games Arcade</span>
            </button>
          </nav>

          <div className="topbar-actions">
            <div className="profile-switcher-wrap">
              <button className="profile-switcher" onClick={() => setProfileMenuOpen((open) => !open)} aria-expanded={profileMenuOpen}>
                <span className={`mini-avatar ${profile === 'Her' ? 'avatar-her' : ''}`}>{profile === 'Him' ? 'Z' : 'K'}</span>
                <span className="profile-name">Playing as {profile}</span>
                <ChevronDown size={13} />
              </button>
              {profileMenuOpen ? (
                <div className="profile-menu" role="menu">
                  {(['Him', 'Her'] as LoungeAuthor[]).map((person) => (
                    <button key={person} role="menuitem" onClick={() => { setProfile(person); setProfileMenuOpen(false) }}>
                      <span className={`mini-avatar ${person === 'Her' ? 'avatar-her' : ''}`}>{person === 'Him' ? 'Z' : 'K'}</span>
                      <span>{person}</span>{profile === person ? <Check size={14} /> : null}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <button className={`chat-trigger ${chatOpen ? 'chat-trigger-active' : ''}`} onClick={() => setChatOpen((open) => !open)} aria-expanded={chatOpen} aria-controls="live-chat-drawer">
              <MessageCircle size={16} /><span>Live chat</span><span className="online-dot" aria-label="Chat is live" />
            </button>
            <button className="lock-button" onClick={handleLock} aria-label="Lock the lounge" title="Lock the lounge"><LockKeyhole size={15} /></button>
          </div>
        </header>

        <div className="mobile-nav" aria-label="Main navigation">
          <button className={tab === 'movies' ? 'mobile-nav-active' : ''} onClick={() => setTab('movies')}><Film size={15} /> Movies</button>
          <button className={tab === 'games' ? 'mobile-nav-active' : ''} onClick={() => setTab('games')}><Gamepad2 size={15} /> Arcade</button>
          <button onClick={() => setChatOpen((open) => !open)}><MessageCircle size={15} /> Chat</button>
        </div>

        <div className="page-frame">
          {tab === 'movies' ? <MoviesSection /> : <GamesArcade />}
          <footer className="site-footer">
            <span><Sparkles size={13} /> A little corner of the internet, made for two.</span>
            <span>Made with love <Heart size={12} fill="currentColor" /></span>
          </footer>
        </div>
        <LiveChatDrawer open={chatOpen} onClose={() => setChatOpen(false)} defaultAuthor={profile} />
      </div>
    </main>
  )
}
