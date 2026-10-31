import { useEffect, useState } from 'react'
import { LoungeApp } from '@/components/lounge-app'
import { PasscodeGate } from '@/components/passcode-gate'
import { clearSessionToken, getStoredSessionToken, storeSessionToken } from '@/lib/lounge-api'
import { restoreLoungeSession, type LoungeUser } from '@/lib/lounge-actions'

export function App() {
  const [user, setUser] = useState<LoungeUser | null>(null)
  const [checking, setChecking] = useState(() => Boolean(getStoredSessionToken()))
  const invitationToken = new URLSearchParams(window.location.search).get('invite') ?? ''

  useEffect(() => {
    if (!getStoredSessionToken()) return
    let active = true
    restoreLoungeSession().then((restored) => {
      if (!active) return
      if (!restored) clearSessionToken()
      setUser(restored)
      setChecking(false)
    })
    return () => {
      active = false
    }
  }, [])

  function handleUnlocked(unlocked: LoungeUser, token: string) {
    storeSessionToken(token)
    setUser(unlocked)
  }

  function handleLocked() {
    clearSessionToken()
    setUser(null)
  }

  if (checking) {
    return (
      <main className="lounge-app">
        <div className="gate-backdrop">
          <div className="gate-card gate-checking"><p className="eyebrow">Z &amp; A · PRIVATE SPACE</p><h1>Opening your room…</h1></div>
        </div>
      </main>
    )
  }

  if (!user) {
    return <PasscodeGate invitationPending={Boolean(invitationToken)} onUnlocked={handleUnlocked} />
  }

  return <LoungeApp user={user} invitationToken={invitationToken} onLocked={handleLocked} />
}
