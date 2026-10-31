'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Heart, KeyRound, LoaderCircle, LockKeyhole, Sparkles } from 'lucide-react'
import { unlockLounge } from '@/app/actions/access'

export function PasscodeGate({ invitationPending }: { invitationPending: boolean }) {
  const router = useRouter()
  const [passcode, setPasscode] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [shake, setShake] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setNotice('')
    try {
      const result = await unlockLounge(passcode)
      if (!result.ok) {
        setNotice(result.message)
        setShake(true)
        window.setTimeout(() => setShake(false), 380)
        return
      }
      setPasscode('')
      router.refresh()
    } catch {
      setNotice('The lounge could not be unlocked. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="lounge-app">
      <div className="gate-backdrop">
        <section className={`gate-card passcode-card ${shake ? 'passcode-shake' : ''}`} aria-labelledby="passcode-title">
          <span className="gate-mark"><Heart fill="currentColor" /></span>
          <p className="eyebrow"><Sparkles size={12} /> Z &amp; A · PRIVATE SPACE</p>
          <h1 id="passcode-title">A little corner, just for two.</h1>
          <p className="gate-copy">Enter your lounge passcode to unlock your shared movie nights, games, and chat.</p>
          {invitationPending ? <p className="passcode-invite-note">Your invitation will still be waiting after you unlock the lounge.</p> : null}
          <form className="passcode-form" onSubmit={handleSubmit}>
            <label className="passcode-label" htmlFor="lounge-passcode">Four-digit passcode</label>
            <div className="passcode-input-wrap">
              <KeyRound size={15} aria-hidden="true" />
              <input
                autoComplete="one-time-code"
                autoFocus
                id="lounge-passcode"
                inputMode="numeric"
                maxLength={4}
                name="passcode"
                onChange={(event) => setPasscode(event.currentTarget.value.replace(/\D/g, '').slice(0, 4))}
                pattern="[0-9]{4}"
                required
                type="password"
                value={passcode}
              />
            </div>
            {notice ? <p className="passcode-error" role="alert">{notice}</p> : null}
            <button className="passcode-submit" type="submit" disabled={busy || passcode.length !== 4}>
              {busy ? <LoaderCircle size={15} className="spin" /> : <LockKeyhole size={15} />}
              <span>{busy ? 'Unlocking…' : 'Unlock the lounge'}</span>
            </button>
          </form>
          <p className="passcode-footnote"><LockKeyhole size={12} /> Two private passcode seats. No account sign-up.</p>
        </section>
      </div>
    </main>
  )
}
