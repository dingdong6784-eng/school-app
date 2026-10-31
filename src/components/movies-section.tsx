import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import useSWR from 'swr'
import { ArrowDown, ArrowRight, Check, Clapperboard, Clock3, ExternalLink, Heart, Info, Link2, LoaderCircle, Play, Plus, Search, ShieldCheck, Sparkles, Volume2, VolumeX } from 'lucide-react'
import { getCatalog, getLoungeMediaState, updateLoungeMediaState, type CatalogResponse } from '@/lib/lounge-actions'
import { YouTubePlayer } from '@/components/youtube-player'
import type { CatalogMovie, LoungeMediaState } from '@/lib/watch-party-types'

type CategoryFilter = 'All picks' | 'Romantic Comedies' | 'Trending Action' | 'Cozy Horror' | 'Family Favorites' | 'Custom URL Stream'
const categories: CategoryFilter[] = ['All picks', 'Romantic Comedies', 'Trending Action', 'Cozy Horror', 'Family Favorites', 'Custom URL Stream']
const categoryApiKeys: Record<Exclude<CategoryFilter, 'Custom URL Stream'>, string> = {
  'All picks': 'all',
  'Romantic Comedies': 'romcom',
  'Trending Action': 'action',
  'Cozy Horror': 'horror',
  'Family Favorites': 'family',
}

function getYouTubeVideoId(value: string) {
  try {
    const url = new URL(value)
    const host = url.hostname.toLowerCase()
    const id = host === 'youtu.be'
      ? url.pathname.split('/').filter(Boolean)[0]
      : url.searchParams.get('v') || url.pathname.match(/^\/(?:embed|shorts)\/([A-Za-z0-9_-]{11})/)?.[1]
    return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null
  } catch {
    return null
  }
}

function isDirectVideo(value: string) {
  try {
    return /\.(mp4|webm|ogg)$/i.test(new URL(value).pathname)
  } catch {
    return false
  }
}

export function MoviesSection({ roomId, userId }: { roomId: string; userId: string }) {
  const [query, setQuery] = useState('')
  const [apiQuery, setApiQuery] = useState('')
  const [category, setCategory] = useState<CategoryFilter>('All picks')
  const [watchlist, setWatchlist] = useState<string[]>([])
  const [watchlistReady, setWatchlistReady] = useState(false)
  const [streamInput, setStreamInput] = useState('')
  const [streamError, setStreamError] = useState('')
  const [muted, setMuted] = useState(true)
  const [safeMode, setSafeMode] = useState(true)
  const videoRef = useRef<HTMLVideoElement>(null)
  const remoteVideoCommand = useRef(false)
  const lastProgressWrite = useRef(0)

  const { data: mediaState, mutate: mutateMediaState } = useSWR<LoungeMediaState>(
    ['lounge-media-state', roomId],
    () => getLoungeMediaState(roomId),
    { refreshInterval: 2500, revalidateOnFocus: true, shouldRetryOnError: false },
  )

  useEffect(() => {
    const timer = window.setTimeout(() => setApiQuery(query.trim()), 300)
    return () => window.clearTimeout(timer)
  }, [query])

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(`lounge-watchlist:${roomId}`)
      const parsed: unknown = stored ? JSON.parse(stored) : []
      if (Array.isArray(parsed)) setWatchlist(parsed.filter((item): item is string => typeof item === 'string').slice(0, 100))
    } catch {
      setWatchlist([])
    } finally {
      setWatchlistReady(true)
    }
  }, [roomId])

  useEffect(() => {
    if (!watchlistReady) return
    try {
      window.localStorage.setItem(`lounge-watchlist:${roomId}`, JSON.stringify(watchlist))
    } catch {
      // The shortlist remains usable for this visit if browser storage is unavailable.
    }
  }, [roomId, watchlist, watchlistReady])

  useEffect(() => {
    function focusMovieSearch(event: KeyboardEvent) {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'k') return
      event.preventDefault()
      document.querySelector<HTMLInputElement>('[aria-label="Search movies and shows"]')?.focus()
    }
    window.addEventListener('keydown', focusMovieSearch)
    return () => window.removeEventListener('keydown', focusMovieSearch)
  }, [])

  const catalogKey = category === 'Custom URL Stream' ? null : ['lounge-catalog', categoryApiKeys[category], safeMode, apiQuery]
  const { data: catalog, error: catalogError, isLoading: catalogLoading } = useSWR<CatalogResponse>(catalogKey, () => getCatalog(categoryApiKeys[category as Exclude<CategoryFilter, 'Custom URL Stream'>], apiQuery, safeMode), {
    dedupingInterval: 60_000,
    keepPreviousData: true,
    shouldRetryOnError: false,
  })

  const movies = useMemo(() => catalog?.items ?? [], [catalog?.items])
  const selectedMovie = mediaState?.selected ?? null
  const streamUrl = mediaState?.streamUrl ?? ''
  const syncEnabled = mediaState?.syncEnabled ?? true
  const directVideo = isDirectVideo(streamUrl)
  const youtubeVideoId = getYouTubeVideoId(streamUrl)
  const supportsSync = directVideo || Boolean(youtubeVideoId)
  const savedMovieId = selectedMovie ? `${selectedMovie.mediaType}:${selectedMovie.id}` : ''

  async function updateSharedMedia(patch: Partial<LoungeMediaState>) {
    const updated = await updateLoungeMediaState(roomId, patch)
    await mutateMediaState(updated, false)
    return updated
  }

  async function selectMovie(movie: CatalogMovie) {
    try {
      await updateSharedMedia({ selected: movie })
      document.getElementById('featured-player')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    } catch {
      setStreamError('That title could not be shared. Refresh the lounge and try again.')
    }
  }

  async function submitStream(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setStreamError('')
    try {
      const updated = await updateSharedMedia({ streamUrl: streamInput.trim(), currentTime: 0, isPlaying: false })
      setStreamInput(updated.streamUrl)
    } catch (error) {
      setStreamError(error instanceof Error ? error.message : 'Use a secure YouTube, Vimeo, or direct video link you can access.')
    }
  }

  async function publishPlayback(patch: Partial<Pick<LoungeMediaState, 'isPlaying' | 'currentTime'>>) {
    if (!syncEnabled) return
    try {
      await updateSharedMedia(patch)
    } catch {
      setStreamError('Playback could not be synced. Check your connection and try again.')
    }
  }

  async function toggleSync() {
    try {
      await updateSharedMedia({ syncEnabled: !syncEnabled })
    } catch {
      setStreamError('The sync setting could not be changed.')
    }
  }

  async function toggleWatchlist(movie: CatalogMovie) {
    const key = `${movie.mediaType}:${movie.id}`
    setWatchlist((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key])
  }

  function applyRemoteVideoState(video: HTMLVideoElement) {
    if (!syncEnabled || !mediaState || mediaState.version < 1 || mediaState.updatedByUserId === userId) return
    remoteVideoCommand.current = true
    try {
      if (Math.abs(video.currentTime - mediaState.currentTime) > 2) video.currentTime = mediaState.currentTime
      if (mediaState.isPlaying && video.paused) void video.play().catch(() => undefined)
      if (!mediaState.isPlaying && !video.paused) video.pause()
    } catch {
      // Playback may not be ready until the video metadata has loaded.
    }
    window.setTimeout(() => { remoteVideoCommand.current = false }, 1000)
  }

  useEffect(() => {
    const video = videoRef.current
    if (!video || !directVideo || !mediaState) return
    applyRemoteVideoState(video)
  }, [directVideo, mediaState?.version, mediaState?.currentTime, mediaState?.isPlaying, mediaState?.updatedByUserId, syncEnabled, userId])

  function handleVideoPlay(event: React.SyntheticEvent<HTMLVideoElement>) {
    if (!remoteVideoCommand.current) void publishPlayback({ isPlaying: true, currentTime: event.currentTarget.currentTime })
  }

  function handleVideoPause(event: React.SyntheticEvent<HTMLVideoElement>) {
    if (!remoteVideoCommand.current) void publishPlayback({ isPlaying: false, currentTime: event.currentTarget.currentTime })
  }

  function handleVideoTimeUpdate(event: React.SyntheticEvent<HTMLVideoElement>) {
    const now = Date.now()
    if (remoteVideoCommand.current || !syncEnabled || mediaState?.updatedByUserId !== userId || now - lastProgressWrite.current < 4000) return
    lastProgressWrite.current = now
    void publishPlayback({ currentTime: event.currentTarget.currentTime })
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
        <div className="hero-art" style={selectedMovie?.backdropUrl ? { backgroundImage: `linear-gradient(90deg,#151216f2 0%,#19151bdc 43%,#19141928 100%),linear-gradient(0deg,#15121688,transparent 60%),url("${selectedMovie.backdropUrl}")` } : undefined} />
        <div className="hero-topline"><span className="live-pill"><span /> TONIGHT’S WATCH PARTY</span><span className="hero-private"><ShieldCheck size={13} /> Just us</span></div>
        <div className="hero-copy">
          <p className="hero-kicker">THE COUCH IS CALLING</p>
          <h2>{selectedMovie ? selectedMovie.title : <>One more episode.<br /><em>Or maybe a movie.</em></>}</h2>
          <p className="hero-description">{selectedMovie?.overview || 'Our watch party is ready when you are. Find a stream you can access and settle in together.'}</p>
          <a className="hero-cta" href="#featured-player"><Play size={14} fill="currentColor" /> Set up our movie night <ArrowDown size={14} /></a>
        </div>
        <div className="hero-bottom-note"><span className="avatar-pair"><i>Z</i><i>A</i></span><span>Two seats saved, always.</span><span className="hero-sparkle"><Sparkles size={15} /></span></div>
      </section>

      <section className="player-section" id="featured-player">
        <div className="section-label-row"><div><p className="eyebrow">FEATURED WATCH PARTY</p><h2>{selectedMovie?.title || 'Your screen, together'}</h2></div><span className="player-status"><span /> {streamUrl ? 'Shared stream ready' : 'Waiting for a link'}</span></div>
        <div className={`player-frame ${streamUrl ? 'player-frame-active' : ''}`}>
          {directVideo ? (
            <video
              className="player-content"
              onLoadedMetadata={(event) => applyRemoteVideoState(event.currentTarget)}
              onPause={handleVideoPause}
              onPlay={handleVideoPlay}
              onTimeUpdate={handleVideoTimeUpdate}
              playsInline
              ref={videoRef}
              src={streamUrl}
              controls
              muted={muted}
            />
          ) : youtubeVideoId ? (
            <YouTubePlayer
              key={youtubeVideoId}
              videoId={youtubeVideoId}
              state={mediaState ?? { selected: null, streamUrl: '', currentTime: 0, isPlaying: false, syncEnabled: true, updatedByUserId: null, version: 0, updatedAt: null }}
              syncEnabled={syncEnabled}
              userId={userId}
              muted={muted}
              onPlayback={publishPlayback}
            />
          ) : streamUrl ? (
            <iframe className="player-content" src={streamUrl} title={`Watch ${selectedMovie?.title || 'together'}`} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" sandbox="allow-scripts allow-same-origin allow-presentation allow-forms" />
          ) : (
            <div className="player-empty">
              <div className="player-play-mark"><Play size={19} fill="currentColor" /></div>
              <p className="player-empty-title">Ready when you are.</p>
              <p>Paste a link from a service you can access, and it will be shared with your room.</p>
            </div>
          )}
          <div className="player-corner-label"><Clapperboard size={13} /> OUR SCREEN</div>
        </div>
        <div className="player-controls">
          <div className="player-controls-left">
            <button className={`sync-toggle ${syncEnabled ? 'sync-toggle-on' : ''}`} onClick={toggleSync} aria-pressed={syncEnabled} disabled={!supportsSync && Boolean(streamUrl)}><span className="sync-dot" /> {syncEnabled && supportsSync ? 'Watch together sync on' : supportsSync ? 'Sync paused' : streamUrl ? 'Source shared · controls local' : 'Sync ready for YouTube or video'}</button>
            <span className="control-separator" />
            <span className="player-control-note"><Clock3 size={14} /> {mediaState?.isPlaying ? 'Playing together' : streamUrl ? 'Waiting for play' : 'Waiting for a stream'}</span>
          </div>
          <div className="player-controls-right">
            <button className="icon-control" onClick={() => setMuted((value) => !value)} aria-label={supportsSync ? muted ? 'Unmute video' : 'Mute video' : 'Volume control is unavailable for this player'} disabled={!supportsSync}>{muted ? <VolumeX size={15} /> : <Volume2 size={15} />}</button>
            <span className="player-control-note">{mediaState?.currentTime ? `${Math.floor(mediaState.currentTime / 60)}:${String(Math.floor(mediaState.currentTime % 60)).padStart(2, '0')}` : '00:00'}</span>
          </div>
        </div>
        <form className="stream-form" onSubmit={submitStream}>
          <div className="stream-input-wrap"><Link2 size={15} /><input aria-label="Video or embed URL" placeholder="Paste a YouTube, Vimeo, or authorized video URL" value={streamInput} onChange={(event) => setStreamInput(event.target.value)} /><button className="stream-submit" type="submit"><span>Share stream</span><ArrowRight size={14} /></button></div>
          {streamError ? <p className="inline-error" role="alert">{streamError}</p> : null}
          {streamUrl ? <p className="stream-note"><Info size={13} /> Shared with both seats. Use a service or video file you have permission to watch; only YouTube, Vimeo, and secure video files are supported.</p> : null}
        </form>
      </section>

      <section className="browse-section">
        <div className="browse-header">
          <div><p className="eyebrow">OUR LITTLE SHORTLIST</p><h2>What are we in the mood for?</h2></div>
          <div className="browse-controls">
            <label className="movie-search"><Search size={15} /><input aria-label="Search movies and shows" placeholder="Search TMDB…" value={query} onChange={(event) => setQuery(event.target.value)} /><kbd>⌘ K</kbd></label>
            <button className={`content-filter ${safeMode ? 'content-filter-active' : ''}`} onClick={() => setSafeMode((enabled) => !enabled)} aria-pressed={safeMode}><ShieldCheck size={13} /> {safeMode ? 'Hide 18+' : 'Show all ratings'}</button>
          </div>
        </div>
        <div className="category-tabs" role="tablist" aria-label="Movie categories">
          {categories.map((item) => <button key={item} role="tab" aria-selected={category === item} className={category === item ? 'category-active' : ''} onClick={() => setCategory(item)}>{item === 'Custom URL Stream' ? <Link2 size={13} /> : null}{item}</button>)}
        </div>
        {category === 'Custom URL Stream' ? (
          <div className="custom-stream-card"><div className="custom-stream-icon"><Link2 size={18} /></div><div><strong>Bring your own stream</strong><p>Share an authorized YouTube, Vimeo, or secure video file link with your room.</p></div><button onClick={() => document.getElementById('featured-player')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}>Add a link <ArrowRight size={14} /></button></div>
        ) : null}
        {catalogError ? <p className="catalog-error" role="alert">{catalogError.message}</p> : null}
        {catalogLoading && !catalog ? <div className="catalog-loading" role="status"><LoaderCircle size={17} className="spin" /><span>Finding tonight’s picks…</span></div> : null}
        <div className="movie-grid">
          {movies.map((movie) => {
            const saved = watchlist.includes(`${movie.mediaType}:${movie.id}`)
            const selected = savedMovieId === `${movie.mediaType}:${movie.id}`
            return (
              <article className="movie-card" key={`${movie.mediaType}:${movie.id}`}>
                <button className={`movie-art ${selected ? 'movie-art-selected' : ''}`} onClick={() => void selectMovie(movie)} aria-label={`Set ${movie.title} as tonight’s pick`}>
                  {movie.posterUrl ? <img src={movie.posterUrl} alt="" loading="lazy" decoding="async" /> : <span className="poster-fallback" aria-hidden="true"><Clapperboard size={22} /></span>}
                  <span className="poster-wordmark">{movie.mediaType === 'tv' ? 'SERIES' : 'TONIGHT’S PICK'}</span>
                  <strong>{movie.title}</strong>
                  <span className="poster-year">{movie.year}{movie.genres[0] ? <><b> · </b>{movie.genres[0]}</> : null}</span>
                  <span className="poster-play"><Play size={13} fill="currentColor" /></span>
                  {movie.certification ? <span className="poster-rating">{movie.certification}</span> : null}
                </button>
                <div className="movie-card-meta"><div><span className="movie-genre">{movie.mediaType === 'tv' ? 'Series' : movie.genres.slice(0, 2).join(' · ') || 'Film'}{movie.voteAverage ? ` · ★ ${movie.voteAverage}` : ''}</span><p>{movie.overview}</p></div><button className={`watchlist-button ${saved ? 'watchlist-saved' : ''}`} onClick={() => void toggleWatchlist(movie)} aria-label={saved ? `Remove ${movie.title} from watchlist` : `Add ${movie.title} to watchlist`} aria-pressed={saved}>{saved ? <Check size={15} /> : <Plus size={15} />}</button></div>
              </article>
            )
          })}
        </div>
        {!catalogLoading && !catalogError && movies.length === 0 && category !== 'Custom URL Stream' ? <div className="empty-search"><Search size={18} /><p>No picks match that search. Try another title or rating filter.</p></div> : null}
        <p className="catalog-note"><Info size={13} /> This product uses the TMDB API but is not endorsed or certified by TMDB. Safe mode hides titles rated above PG-13 / TV-14.</p>
      </section>
    </section>
  )
}
