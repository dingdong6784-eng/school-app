'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { ArrowDown, ArrowRight, Check, Clapperboard, Clock3, ExternalLink, Heart, Info, Link2, Play, Plus, Search, ShieldCheck, Sparkles, Volume2, VolumeX } from 'lucide-react'

type Category = 'Romantic Comedies' | 'Trending Action' | 'Cozy Horror'
type Movie = { title: string; year: string; genre: Category; runtime: string; note: string; tone: string; accent: string; kind?: 'Film' | 'Series' }

const movies: Movie[] = [
  { title: 'About Time', year: '2013', genre: 'Romantic Comedies', runtime: '2h 3m', note: 'A little time travel. A lot of heart.', tone: 'rose', accent: 'TIME WELL SPENT' },
  { title: 'Palm Springs', year: '2020', genre: 'Romantic Comedies', runtime: '1h 30m', note: 'An endless afternoon together.', tone: 'amber', accent: 'A DAY TO REMEMBER' },
  { title: 'Notting Hill', year: '1999', genre: 'Romantic Comedies', runtime: '2h 4m', note: 'A classic for a cozy night in.', tone: 'blue', accent: 'VERY NICE TO MEET YOU' },
  { title: 'The Big Sick', year: '2017', genre: 'Romantic Comedies', runtime: '2h', note: 'Funny, tender, and true.', tone: 'plum', accent: 'LOVE, UNEXPECTEDLY' },
  { title: 'Dash & Lily', year: '2020', genre: 'Romantic Comedies', runtime: '8 episodes', note: 'A festive little New York love story.', tone: 'amber', accent: 'AN ADVENTURE IN EIGHT DAYS', kind: 'Series' },
  { title: 'Dune: Part Two', year: '2024', genre: 'Trending Action', runtime: '2h 46m', note: 'Big-screen energy, sofa-sized.', tone: 'sand', accent: 'THE DESERT AWAITS' },
  { title: 'John Wick: Chapter 4', year: '2023', genre: 'Trending Action', runtime: '2h 49m', note: 'For a little late-night adrenaline.', tone: 'steel', accent: 'ONE LAST ROUND' },
  { title: 'Everything Everywhere All at Once', year: '2022', genre: 'Trending Action', runtime: '2h 19m', note: 'A multiverse of feelings.', tone: 'violet', accent: 'ALL AT ONCE' },
  { title: 'The Old Guard', year: '2020', genre: 'Trending Action', runtime: '2h 5m', note: 'One more for the action queue.', tone: 'red', accent: 'IMMORTAL, TOGETHER' },
  { title: 'The Night Agent', year: '2023', genre: 'Trending Action', runtime: '10 episodes', note: 'A twisty, one-more-episode night.', tone: 'steel', accent: 'THE LINE BETWEEN', kind: 'Series' },
  { title: 'The Others', year: '2001', genre: 'Cozy Horror', runtime: '1h 44m', note: 'A blanket-worthy kind of spooky.', tone: 'mist', accent: 'KEEP THE LIGHTS LOW' },
  { title: 'A Quiet Place', year: '2018', genre: 'Cozy Horror', runtime: '1h 30m', note: 'The best excuse to stay close.', tone: 'forest', accent: 'LISTEN CLOSELY' },
  { title: 'The Witch', year: '2015', genre: 'Cozy Horror', runtime: '1h 32m', note: 'Folklore, candlelight, and dread.', tone: 'moss', accent: 'A NEW ENGLAND FOLKTALE' },
  { title: 'Coraline', year: '2009', genre: 'Cozy Horror', runtime: '1h 40m', note: 'A curious little world after dark.', tone: 'indigo', accent: 'BE CAREFUL WHAT YOU WISH FOR' },
  { title: 'Midnight Mass', year: '2021', genre: 'Cozy Horror', runtime: '7 episodes', note: 'A quiet island with a strange new miracle.', tone: 'mist', accent: 'A MIRACLE ON CROCKETT ISLAND', kind: 'Series' },
]

const categories = ['All picks', 'Romantic Comedies', 'Trending Action', 'Cozy Horror', 'Custom URL Stream'] as const
type CategoryFilter = (typeof categories)[number]

export function MoviesSection() {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<CategoryFilter>('All picks')
  const [featuredMovie, setFeaturedMovie] = useState<Movie>(movies[0])
  const [watchlist, setWatchlist] = useState<string[]>([])
  const [streamInput, setStreamInput] = useState('')
  const [streamUrl, setStreamUrl] = useState('')
  const [streamError, setStreamError] = useState('')
  const [syncEnabled, setSyncEnabled] = useState(true)
  const [muted, setMuted] = useState(true)

  const visibleMovies = useMemo(() => movies.filter((movie) => {
    const matchesQuery = `${movie.title} ${movie.genre} ${movie.kind ?? 'Film'} ${movie.note}`.toLowerCase().includes(query.toLowerCase())
    const matchesCategory = category === 'All picks' || category === 'Custom URL Stream' || movie.genre === category
    return matchesQuery && matchesCategory
  }), [category, query])

  const isDirectVideo = /\\.(mp4|webm|ogg)(\\?.*)?$/i.test(streamUrl)

  useEffect(() => {
    function focusMovieSearch(event: KeyboardEvent) {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'k') return
      event.preventDefault()
      document.querySelector<HTMLInputElement>('[aria-label="Search movies and shows"]')?.focus()
    }

    window.addEventListener('keydown', focusMovieSearch)
    return () => window.removeEventListener('keydown', focusMovieSearch)
  }, [])

  function submitStream(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setStreamError('')
    try {
      const parsed = new URL(streamInput.trim())
      if (parsed.protocol !== 'https:') throw new Error('Use a secure HTTPS video or embed link.')
      setStreamUrl(parsed.toString())
    } catch {
      setStreamError('Paste a valid HTTPS video or embed URL from a service you can access.')
    }
  }

  function addToWatchlist(title: string) {
    setWatchlist((current) => current.includes(title) ? current.filter((item) => item !== title) : [...current, title])
  }

  return (
    <section className="movies-page">
      <div className="section-heading-row">
        <div>
          <p className="eyebrow"><Sparkles size={13} /> THE MOVIE ROOM</p>
          <h1>Tonight is <span>ours.</span></h1>
          <p className="muted-copy">Pick the story. Bring the snacks. We’ll meet right here.</p>
        </div>
        <div className="watchlist-count"><Heart size={14} /><span>{watchlist.length} in our watchlist</span></div>
      </div>

      <section className="watch-party-hero" aria-label="Featured watch party">
        <div className="hero-art" />
        <div className="hero-topline"><span className="live-pill"><span /> TONIGHT’S WATCH PARTY</span><span className="hero-private"><ShieldCheck size={13} /> Just us</span></div>
        <div className="hero-copy">
          <p className="hero-kicker">THE COUCH IS CALLING</p>
          <h2>One more episode.<br /><em>Or maybe a movie.</em></h2>
          <p className="hero-description">Our watch party is ready when you are. Find a stream you can access and settle in together.</p>
          <a className="hero-cta" href="#featured-player"><Play size={14} fill="currentColor" /> Set up our movie night <ArrowDown size={14} /></a>
        </div>
        <div className="hero-bottom-note"><span className="avatar-pair"><i>Z</i><i>K</i></span><span>Two seats saved, always.</span><span className="hero-sparkle"><Sparkles size={15} /></span></div>
      </section>

      <section className="player-section" id="featured-player">
        <div className="section-label-row"><div><p className="eyebrow">FEATURED WATCH PARTY</p><h2>{streamUrl ? featuredMovie.title : 'Your screen, together'}</h2></div><span className="player-status"><span /> {streamUrl ? 'Stream ready' : 'Waiting for a link'}</span></div>
        <div className={`player-frame ${streamUrl ? 'player-frame-active' : ''}`}>
          {streamUrl ? (
            isDirectVideo ? <video className="player-content" src={streamUrl} controls playsInline muted={muted} /> : <iframe className="player-content" src={streamUrl} title={`Watch ${featuredMovie.title} together`} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="no-referrer" sandbox="allow-scripts allow-presentation allow-forms" />
          ) : (
            <div className="player-empty">
              <div className="player-play-mark"><Play size={19} fill="currentColor" /></div>
              <p className="player-empty-title">Ready when you are.</p>
              <p>Paste a link to a video or an embed you’re allowed to watch.</p>
            </div>
          )}
          <div className="player-corner-label"><Clapperboard size={13} /> OUR SCREEN</div>
        </div>
        <div className="player-controls">
          <div className="player-controls-left">
            <button className={`sync-toggle ${syncEnabled ? 'sync-toggle-on' : ''}`} onClick={() => setSyncEnabled((on) => !on)} aria-pressed={syncEnabled}><span className="sync-dot" /> {syncEnabled ? 'Watch together sync on' : 'Sync paused'}</button>
            <span className="control-separator" />
            <span className="player-control-note"><Clock3 size={14} /> {streamUrl ? 'You’re in the same room' : 'Waiting for a stream'}</span>
          </div>
          <div className="player-controls-right">
            <button className="icon-control" onClick={() => setMuted((value) => !value)} aria-label={muted ? 'Unmute video' : 'Mute video'}>{muted ? <VolumeX size={15} /> : <Volume2 size={15} />}</button>
            <button className="icon-control" onClick={() => setSyncEnabled((on) => !on)} aria-label="Toggle watch sync"><ExternalLink size={15} /></button>
          </div>
        </div>
        <form className="stream-form" onSubmit={submitStream}>
          <div className="stream-input-wrap"><Link2 size={15} /><input aria-label="Video or embed URL" placeholder="Paste an authorized HTTPS video or embed URL" value={streamInput} onChange={(event) => setStreamInput(event.target.value)} /><button className="stream-submit" type="submit"><span>Load stream</span><ArrowRight size={14} /></button></div>
          {streamError ? <p className="inline-error" role="alert">{streamError}</p> : null}
          {streamUrl ? <p className="stream-note"><Info size={13} /> Only load streams you have permission to access. External players may have their own controls and policies.</p> : null}
        </form>
      </section>

      <section className="browse-section">
        <div className="browse-header">
          <div><p className="eyebrow">OUR LITTLE SHORTLIST</p><h2>What are we in the mood for?</h2></div>
          <label className="movie-search"><Search size={15} /><input aria-label="Search movies and shows" placeholder="Search our picks…" value={query} onChange={(event) => setQuery(event.target.value)} /><kbd>⌘ K</kbd></label>
        </div>
        <div className="category-tabs" role="tablist" aria-label="Movie categories">
          {categories.map((item) => <button key={item} role="tab" aria-selected={category === item} className={category === item ? 'category-active' : ''} onClick={() => setCategory(item)}>{item === 'Custom URL Stream' ? <Link2 size={13} /> : null}{item}</button>)}
        </div>
        {category === 'Custom URL Stream' ? (
          <div className="custom-stream-card"><div className="custom-stream-icon"><Link2 size={18} /></div><div><strong>Bring your own stream</strong><p>Paste a secure link from a video service you’re allowed to use. It’ll open in the shared player above.</p></div><button onClick={() => document.getElementById('featured-player')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}>Add a link <ArrowRight size={14} /></button></div>
        ) : null}
        <div className="movie-grid">
          {visibleMovies.map((movie) => {
            const saved = watchlist.includes(movie.title)
            return (
              <article className={`movie-card movie-tone-${movie.tone}`} key={movie.title}>
                <button className="movie-art" onClick={() => { setFeaturedMovie(movie); document.getElementById('featured-player')?.scrollIntoView({ behavior: 'smooth', block: 'center' }) }} aria-label={`Set ${movie.title} as tonight’s pick`}>
                  <span className="poster-stars" aria-hidden="true">✳ <i>✧</i></span><span className="poster-wordmark">{movie.accent}</span><strong>{movie.title}</strong><span className="poster-year">{movie.year} <b>·</b> {movie.runtime}</span>
                  <span className="poster-play"><Play size={13} fill="currentColor" /></span>
                </button>
                <div className="movie-card-meta"><div><span className="movie-genre">{movie.kind === 'Series' ? 'Series · ' : ''}{movie.genre}</span><p>{movie.note}</p></div><button className={`watchlist-button ${saved ? 'watchlist-saved' : ''}`} onClick={() => addToWatchlist(movie.title)} aria-label={saved ? `Remove ${movie.title} from watchlist` : `Add ${movie.title} to watchlist`} aria-pressed={saved}>{saved ? <Check size={15} /> : <Plus size={15} />}</button></div>
              </article>
            )
          })}
        </div>
        {visibleMovies.length === 0 ? <div className="empty-search"><Search size={18} /><p>No picks match that search. Try another title or mood.</p></div> : null}
        <p className="catalog-note"><Info size={13} /> A hand-picked sample of films and series. Search is local and doesn’t require a TMDB account.</p>
      </section>
    </section>
  )
}
