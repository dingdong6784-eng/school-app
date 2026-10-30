'use client'

import { ChangeEvent, FormEvent, KeyboardEvent, useEffect, useRef, useState } from 'react'
import { useSWRConfig } from 'swr'
import useSWR from 'swr'
import { Check, Heart, ImagePlus, LoaderCircle, MessageCircle, Paperclip, Send, ShieldCheck, X } from 'lucide-react'
import { listLoungeMessages, reactToLoungeMessage, sendLoungeMessage, type LoungeAuthor, type LoungeReaction } from '@/app/actions/lounge'

type ChatMessage = Awaited<ReturnType<typeof listLoungeMessages>>[number]
const reactions: LoungeReaction[] = ['❤️', '🍿', '🎮', '😮', '😂']
const sampleMessages: ChatMessage[] = [
  { id: 'sample-1', author: 'Her', body: 'I saved the coziest spot for us. Movie or games first?', reaction: '❤️', createdAt: new Date(Date.now() - 1000 * 60 * 18).toISOString() },
  { id: 'sample-2', author: 'Him', body: 'Movie first. Popcorn is already on the way.', reaction: '🍿', createdAt: new Date(Date.now() - 1000 * 60 * 15).toISOString() },
  { id: 'sample-3', author: 'Her', body: 'Perfect. I’ll pick the first game after.', reaction: null, createdAt: new Date(Date.now() - 1000 * 60 * 12).toISOString() },
]

export function LiveChatDrawer({ open, onClose, defaultAuthor }: { open: boolean; onClose: () => void; defaultAuthor: LoungeAuthor }) {
  const { mutate } = useSWRConfig()
  const { data, error, isLoading } = useSWR(open ? 'zk-lounge-chat' : null, listLoungeMessages, {
    refreshInterval: 2500,
    revalidateOnFocus: true,
    shouldRetryOnError: false,
  })
  const [author, setAuthor] = useState<LoungeAuthor>(defaultAuthor)
  const [draft, setDraft] = useState('')
  const [attachmentName, setAttachmentName] = useState('')
  const [sending, setSending] = useState(false)
  const [notice, setNotice] = useState('')
  const transcriptRef = useRef<HTMLDivElement>(null)
  const messages = data?.length ? data : sampleMessages

  useEffect(() => {
    setAuthor(defaultAuthor)
  }, [defaultAuthor])

  useEffect(() => {
    if (!open) return
    const frame = window.requestAnimationFrame(() => {
      if (transcriptRef.current) transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight
    })
    return () => window.cancelAnimationFrame(frame)
  }, [open, data?.length])

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const body = draft.trim()
    if (!body || sending) return
    setSending(true)
    setNotice('')
    try {
      await sendLoungeMessage(author, body)
      setDraft('')
      setAttachmentName('')
      await mutate('zk-lounge-chat')
    } catch {
      setNotice('Couldn’t send that just now. Check your connection and try again.')
    } finally {
      setSending(false)
    }
  }

  function handleComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== 'Enter' || event.shiftKey) return
    if (event.nativeEvent.isComposing || event.keyCode === 229) return
    event.preventDefault()
    event.currentTarget.form?.requestSubmit()
  }

  async function addReaction(message: ChatMessage, reaction: LoungeReaction) {
    if (message.id.startsWith('sample-')) {
      setNotice('Send your first message to start the shared chat history.')
      return
    }
    try {
      await reactToLoungeMessage(message.id, reaction)
      await mutate('zk-lounge-chat')
    } catch {
      setNotice('That reaction couldn’t be saved. Try again in a moment.')
    }
  }

  function handleAttachment(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (file) {
      setAttachmentName(file.name)
      setNotice('Attachment preview only — files are not uploaded to the chat.')
    }
    event.target.value = ''
  }

  if (!open) return null

  return (
    <div className="chat-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <aside className="chat-drawer" id="live-chat-drawer" role="dialog" aria-modal="true" aria-labelledby="chat-title">
        <header className="chat-header">
          <div className="chat-header-title"><span className="chat-header-icon"><MessageCircle size={16} /></span><div><p className="eyebrow">OUR PRIVATE ROOM</p><h2 id="chat-title">Little live chat</h2></div></div>
          <div className="chat-header-actions"><span className="chat-online"><i /> Here together</span><button className="chat-close" onClick={onClose} aria-label="Close live chat"><X size={17} /></button></div>
        </header>
        <div className="chat-safety-note"><ShieldCheck size={13} /><span>Just the two of us, on our own little channel.</span><span className="chat-refresh-indicator"><i /> LIVE</span></div>
        <div className="chat-date-marker"><span /> TODAY, IN OUR LITTLE WORLD <span /></div>
        <div className="chat-transcript" ref={transcriptRef} aria-live="polite" aria-relevant="additions text">
          {isLoading && !data ? <div className="chat-loading"><LoaderCircle size={16} /> Opening our chat…</div> : null}
          {messages.map((message) => {
            const own = message.author === author
            return (
              <article className={`chat-message ${own ? 'chat-message-own' : ''}`} key={message.id}>
                <span className={`chat-avatar ${message.author === 'Her' ? 'chat-avatar-her' : ''}`}>{message.author === 'Her' ? 'K' : 'Z'}</span>
                <div className="chat-message-column">
                  <div className="chat-message-meta"><strong>{message.author}</strong><time dateTime={message.createdAt}>{new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(message.createdAt))}</time></div>
                  <p className={`chat-bubble ${message.author === 'Her' ? 'bubble-her' : 'bubble-him'}`}>{message.body}</p>
                  <div className="chat-reactions" aria-label={`React to ${message.author}’s message`}>
                    {reactions.map((reaction) => <button key={reaction} className={message.reaction === reaction ? 'reaction-picked' : ''} onClick={() => addReaction(message, reaction)} aria-label={`React with ${reaction}`} aria-pressed={message.reaction === reaction}>{reaction}</button>)}
                    {message.reaction ? <span className="reaction-current">{message.reaction}</span> : null}
                  </div>
                </div>
              </article>
            )
          })}
          {error ? <div className="chat-empty-state"><Heart size={17} /><p>Sample messages are here while the chat reconnects.</p></div> : null}
          {data?.length === 0 && !error ? <div className="chat-first-note"><Heart size={13} /> Our conversation starts here.</div> : null}
        </div>
        <div className="chat-composer-area">
          <div className="chat-profile-row"><span>Send as</span>{(['Him', 'Her'] as LoungeAuthor[]).map((person) => <button key={person} className={author === person ? `chat-profile-active ${person === 'Her' ? 'chat-profile-her' : ''}` : ''} onClick={() => setAuthor(person)}><i className={person === 'Her' ? 'chat-avatar-her' : ''}>{person === 'Him' ? 'Z' : 'K'}</i>{person}</button>)}</div>
          {notice ? <p className="chat-notice" role="status">{notice}<button onClick={() => setNotice('')} aria-label="Dismiss notice"><X size={12} /></button></p> : null}
          {attachmentName ? <div className="attachment-preview"><ImagePlus size={13} /><span>{attachmentName}</span><small>preview only</small><button onClick={() => setAttachmentName('')} aria-label="Remove attachment preview"><X size={12} /></button></div> : null}
          <form className="chat-composer" onSubmit={sendMessage}>
            <textarea value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={handleComposerKeyDown} placeholder="Send a little something…" aria-label="Write a chat message" rows={1} maxLength={1000} />
            <div className="chat-composer-actions">
              <label className="chat-attachment-button" title="Attachment preview only"><Paperclip size={15} /><span className="sr-only">Preview an attachment</span><input type="file" accept="image/*,.pdf,.txt" onChange={handleAttachment} /></label>
              <span className="chat-enter-hint">↵ to send</span>
              <button className="chat-send-button" type="submit" disabled={!draft.trim() || sending} aria-label="Send message">{sending ? <LoaderCircle size={15} className="spin" /> : <Send size={15} />}</button>
            </div>
          </form>
          <p className="chat-endnote"><Check size={11} /> Messages refresh live between your devices.</p>
        </div>
      </aside>
    </div>
  )
}
