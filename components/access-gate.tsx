'use client'

import { FormEvent, useState } from 'react'
import { ArrowRight, Heart, LockKeyhole, ShieldCheck, Sparkles } from 'lucide-react'

const MAX_CODE_LENGTH = 12

export function AccessGate({
  onUnlock,
  checking,
}: {
  onUnlock: (passcode: string) => Promise<boolean>
  checking: boolean
}) {
  const [passcode, setPasscode] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    if (passcode.length !== MAX_CODE_LENGTH) {
      setError('Enter all 12 digits to unlock our lounge.')
      return
    }

    setSubmitting(true)
    try {
      const unlocked = await onUnlock(passcode)
      if (!unlocked) {
        setError('That code doesn’t look right. Try again.')
        setPasscode('')
      }
    } catch {
      setError('The lounge couldn’t be reached. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  function pressDigit(digit: string) {
    setError('')
    setPasscode((current) => (current.length < MAX_CODE_LENGTH ? current + digit : current))
  }

  if (checking) {
    return (
      <div className="gate-backdrop" aria-live="polite">
        <div className="gate-card gate-checking">
          <span className="gate-mark"><Heart fill="currentColor" /></span>
          <p className="eyebrow">Z &amp; K · PRIVATE SPACE</p>
          <h1>One little moment…</h1>
          <p className="muted-copy">Making sure it’s really you.</p>
          <span className="loading-line" aria-hidden="true" />
        </div>
      </div>
    )
  }

  return (
    <div className="gate-backdrop">
      <div className="gate-card" role="dialog" aria-modal="true" aria-labelledby="gate-title">
        <div className="gate-mark"><Heart fill="currentColor" /></div>
        <p className="eyebrow">A LITTLE PLACE FOR TWO</p>
        <h1 id="gate-title">Welcome to our<br /><span>private little world.</span></h1>
        <p className="gate-copy">A movie, a match, and a little time together.</p>
        <form onSubmit={handleSubmit} className="gate-form">
          <label className="sr-only" htmlFor="lounge-passcode">12-digit lounge passcode</label>
          <div className={`passcode-display ${error ? 'passcode-error' : ''}`}>
            <LockKeyhole size={15} aria-hidden="true" />
            <input
              id="lounge-passcode"
              type="password"
              inputMode="numeric"
              autoComplete="off"
              value={passcode}
              readOnly
              aria-describedby={error ? 'passcode-error' : 'passcode-hint'}
              placeholder="Enter our passcode"
            />
            <span className="passcode-count">{passcode.length}/12</span>
          </div>
          <p id="passcode-hint" className="sr-only">Use the keypad to enter all 12 digits.</p>
          <div className="gate-keypad" aria-label="Passcode keypad">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'back'].map((key) => {
              if (key === 'clear') {
                return <button key={key} type="button" className="keypad-utility" onClick={() => { setPasscode(''); setError('') }} aria-label="Clear passcode">C</button>
              }
              if (key === 'back') {
                return <button key={key} type="button" className="keypad-utility" onClick={() => { setPasscode((current) => current.slice(0, -1)); setError('') }} aria-label="Delete last digit"><span className="backspace-symbol" aria-hidden="true">⌫</span></button>
              }
              return <button key={key} type="button" className="keypad-digit" onClick={() => pressDigit(key)} disabled={passcode.length >= MAX_CODE_LENGTH || submitting}>{key}</button>
            })}
          </div>
          {error ? <p id="passcode-error" className="gate-error" role="alert">{error}</p> : null}
          <button className="gate-submit" type="submit" disabled={submitting}>
            <span>{submitting ? 'Checking…' : 'Enter our lounge'}</span>
            {submitting ? <ShieldCheck size={16} /> : <ArrowRight size={16} />}
          </button>
        </form>
        <div className="gate-footnote"><Sparkles size={13} /><span>Just for us, always.</span></div>
      </div>
    </div>
  )
}
