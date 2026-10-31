'use client'

import { useEffect, useRef } from 'react'
import type { LoungeMediaState } from '@/lib/watch-party-types'

type YouTubePlayerInstance = {
  destroy: () => void
  getCurrentTime: () => number
  getPlayerState: () => number
  pauseVideo: () => void
  playVideo: () => void
  seekTo: (seconds: number, allowSeekAhead: boolean) => void
  mute: () => void
  unMute: () => void
}

type YouTubePlayerEvent = { data: number; target: YouTubePlayerInstance }
type YouTubeApi = {
  Player: new (element: HTMLElement, options: {
    videoId: string
    playerVars: Record<string, string | number>
    events: {
      onReady: (event: { target: YouTubePlayerInstance }) => void
      onStateChange: (event: YouTubePlayerEvent) => void
    }
  }) => YouTubePlayerInstance
  PlayerState: { PLAYING: number; PAUSED: number; ENDED: number }
}

declare global {
  interface Window {
    YT?: YouTubeApi
    onYouTubeIframeAPIReady?: () => void
  }
}

let apiReady: Promise<void> | null = null

function loadYouTubeApi() {
  if (window.YT?.Player) return Promise.resolve()
  if (apiReady) return apiReady

  apiReady = new Promise((resolve, reject) => {
    const previousReady = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      previousReady?.()
      resolve()
    }
    let script = document.querySelector<HTMLScriptElement>('script[src="https://www.youtube.com/iframe_api"]')
    if (!script) {
      script = document.createElement('script')
      script.src = 'https://www.youtube.com/iframe_api'
      script.async = true
      script.onerror = () => reject(new Error('YouTube player could not be loaded.'))
      document.head.appendChild(script)
    }
  })
  return apiReady
}

export function YouTubePlayer({
  videoId,
  state,
  syncEnabled,
  userId,
  muted,
  onPlayback,
}: {
  videoId: string
  state: LoungeMediaState
  syncEnabled: boolean
  userId: string
  muted: boolean
  onPlayback: (patch: Partial<Pick<LoungeMediaState, 'isPlaying' | 'currentTime'>>) => void
}) {
  const targetRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<YouTubePlayerInstance | null>(null)
  const remoteCommandUntil = useRef(0)
  const stateRef = useRef(state)
  const onPlaybackRef = useRef(onPlayback)
  const syncEnabledRef = useRef(syncEnabled)
  const mutedRef = useRef(muted)
  stateRef.current = state
  onPlaybackRef.current = onPlayback
  syncEnabledRef.current = syncEnabled
  mutedRef.current = muted

  useEffect(() => {
    let cancelled = false
    const ready = () => {
      if (cancelled || !targetRef.current || !window.YT?.Player) return
      playerRef.current = new window.YT.Player(targetRef.current, {
        videoId,
        playerVars: { autoplay: 0, controls: 1, playsinline: 1, rel: 0, origin: window.location.origin },
        events: {
          onReady: (event) => {
            if (mutedRef.current) event.target.mute()
            else event.target.unMute()
            applyCurrentState()
          },
          onStateChange: (event) => {
            if (!syncEnabledRef.current || Date.now() < remoteCommandUntil.current) return
            const playerState = event.data
            if (playerState === window.YT?.PlayerState.PLAYING) {
              onPlaybackRef.current({ isPlaying: true, currentTime: event.target.getCurrentTime() })
            } else if (playerState === window.YT?.PlayerState.PAUSED || playerState === window.YT?.PlayerState.ENDED) {
              onPlaybackRef.current({ isPlaying: false, currentTime: event.target.getCurrentTime() })
            }
          },
        },
      })
    }
    const applyCurrentState = () => {
      const currentState = stateRef.current
      const player = playerRef.current
      if (!player || !syncEnabledRef.current || currentState.version < 1 || currentState.updatedByUserId === userId) return
      remoteCommandUntil.current = Date.now() + 1500
      try {
        if (Math.abs(player.getCurrentTime() - currentState.currentTime) > 2) player.seekTo(currentState.currentTime, true)
        const playerState = player.getPlayerState()
        if (currentState.isPlaying && playerState !== window.YT?.PlayerState.PLAYING) player.playVideo()
        if (!currentState.isPlaying && playerState === window.YT?.PlayerState.PLAYING) player.pauseVideo()
      } catch {
        // The player may not have completed its first load yet.
      }
    }

    loadYouTubeApi().then(ready).catch(() => undefined)
    return () => {
      cancelled = true
      playerRef.current?.destroy()
      playerRef.current = null
    }
  }, [videoId, userId])

  useEffect(() => {
    const player = playerRef.current
    if (!player) return
    if (muted) player.mute()
    else player.unMute()
  }, [muted, videoId])

  useEffect(() => {
    const player = playerRef.current
    if (!player || !syncEnabled || state.version < 1 || state.updatedByUserId === userId) return
    remoteCommandUntil.current = Date.now() + 1500
    try {
      if (Math.abs(player.getCurrentTime() - state.currentTime) > 2) player.seekTo(state.currentTime, true)
      const playerState = player.getPlayerState()
      if (state.isPlaying && playerState !== window.YT?.PlayerState.PLAYING) player.playVideo()
      if (!state.isPlaying && playerState === window.YT?.PlayerState.PLAYING) player.pauseVideo()
    } catch {
      // Player state can be unavailable while the iframe is initializing.
    }
  }, [state.version, state.currentTime, state.isPlaying, state.updatedByUserId, syncEnabled, userId])

  useEffect(() => {
    const interval = window.setInterval(() => {
      const player = playerRef.current
      const currentState = stateRef.current
      if (!player || !syncEnabledRef.current || currentState.updatedByUserId !== userId || player.getPlayerState() !== window.YT?.PlayerState.PLAYING) return
      onPlaybackRef.current({ currentTime: player.getCurrentTime() })
    }, 4000)
    return () => window.clearInterval(interval)
  }, [userId])

  return <div className="youtube-player-mount" ref={targetRef} aria-label="YouTube watch party player" />
}
