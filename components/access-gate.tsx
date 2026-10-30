'use client'

import { FormEvent, useState } from 'react'
import { ArrowRight, Heart, LockKeyhole, ShieldCheck, Sparkles } from 'lucide-react'
import { authClient } from '@/lib/auth/client'

export function AccessGate({ invitationPending }: { invitationPending: boolean }) {
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    const normalizedEmail = email.trim().toLowerCase()
    if (mode === 'sign-up' && password !== confirmPassword) {
      setError('Those passwords do not match.')
      return
    }
    if (password.length < 8) {
      setError('Use a password with at least 8 characters.')
      return
    }

    setBusy(true)
    try {
      const result = mode === 'sign-up'
        ? await authClient.signUp.email({ email: normalizedEmail, password, name: 'Lounge member' })
        : await authClient.signIn.email({ email: normalizedEmail, password })
      if (result.error) {
        setError(mode === 'sign-up' ? 'That account could not be created. Check the email and try again.' : 'That email and password did not match.')
        return
      }
      window.location.reload()
    } catch {
      setError('The account service could not be reached. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="gate-backdrop">
      <section className="gate-card account-card" aria-labelledby="gate-title">
        <div className="gate-mark"><Heart fill="currentColor" /></div>
        <p className="eyebrow">A LITTLE PLACE FOR TWO</p>
        <h1 id="gate-title">Welcome to our<br /><span>private little world.</span></h1>
        <p className="gate-copy">A movie, a match, and a little time together.</p>
        {invitationPending ? <p className="account-invite-note"><Heart size={13} /> You can accept your room invitation after signing in.</p> : null}

        <div className="account-mode-tabs" role="tablist" aria-label="Account access">
          <button type="button" role="tab" aria-selected={mode === 'sign-in'} className={mode === 'sign-in' ? 'account-mode-active' : ''} onClick={() => { setMode('sign-in'); setError('') }}>Sign in</button>
          <button type="button" role="tab" aria-selected={mode === 'sign-up'} className={mode === 'sign-up' ? 'account-mode-active' : ''} onClick={() => { setMode('sign-up'); setError('') }}>Create account</button>
        </div>

        <form onSubmit={handleSubmit} className="account-form">
          <label htmlFor="account-email">Email address</label>
          <input id="account-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" required maxLength={254} />
          <label htmlFor="account-password">Password</label>
          <input id="account-password" type="password" autoComplete={mode === 'sign-up' ? 'new-password' : 'current-password'} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters" required minLength={8} maxLength={128} />
          {mode === 'sign-up' ? <>
            <label htmlFor="account-password-confirm">Confirm password</label>
            <input id="account-password-confirm" type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Type it once more" required minLength={8} maxLength={128} />
          </> : null}
          {error ? <p className="account-error" role="alert">{error}</p> : null}
          <button className="gate-submit" type="submit" disabled={busy}>
            <span>{busy ? 'One moment…' : mode === 'sign-in' ? 'Sign in to the lounge' : 'Create your account'}</span>
            {busy ? <ShieldCheck size={16} /> : <ArrowRight size={16} />}
          </button>
        </form>
        <div className="gate-footnote"><LockKeyhole size={12} /><span>Your own account. Just the two of you in the room.</span></div>
        <div className="account-sparkle" aria-hidden="true"><Sparkles size={12} /></div>
      </section>
    </div>
  )
}
