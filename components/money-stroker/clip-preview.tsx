"use client"

import { useRef, useState, useEffect, useCallback } from "react"
import { Play, Pause, RotateCcw } from "lucide-react"
import { cn } from "@/lib/utils"

interface ClipPreviewProps {
  videoUrl: string
  startTime: number
  endTime: number
  autoPlay?: boolean
  loop?: boolean
  className?: string
}

export function ClipPreview({
  videoUrl,
  startTime,
  endTime,
  autoPlay = false,
  loop = true,
  className,
}: ClipPreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isPlaying, setIsPlaying] = useState(autoPlay)
  const [currentTime, setCurrentTime] = useState(startTime)
  const [isReady, setIsReady] = useState(false)

  const clipDuration = endTime - startTime

  // Format time as M:SS.s
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = (seconds % 60).toFixed(1)
    return `${mins}:${secs.padStart(4, "0")}`
  }

  // Initialize video when clip bounds change
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    video.currentTime = startTime
    setCurrentTime(startTime)
    setIsReady(false)
  }, [startTime, endTime, videoUrl])

  // Handle video events
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const handleTimeUpdate = () => {
      const time = video.currentTime
      setCurrentTime(time)

      // Loop or stop at clip end
      if (time >= endTime) {
        if (loop) {
          video.currentTime = startTime
        } else {
          video.pause()
          setIsPlaying(false)
        }
      }
    }

    const handleCanPlay = () => {
      setIsReady(true)
      if (autoPlay) {
        video.play()
        setIsPlaying(true)
      }
    }

    const handlePause = () => {
      setIsPlaying(false)
    }

    const handlePlay = () => {
      setIsPlaying(true)
    }

    video.addEventListener("timeupdate", handleTimeUpdate)
    video.addEventListener("canplay", handleCanPlay)
    video.addEventListener("pause", handlePause)
    video.addEventListener("play", handlePlay)

    return () => {
      video.removeEventListener("timeupdate", handleTimeUpdate)
      video.removeEventListener("canplay", handleCanPlay)
      video.removeEventListener("pause", handlePause)
      video.removeEventListener("play", handlePlay)
    }
  }, [startTime, endTime, autoPlay, loop])

  // Toggle play/pause
  const togglePlay = useCallback(() => {
    const video = videoRef.current
    if (!video) return

    if (isPlaying) {
      video.pause()
    } else {
      // Ensure we're within clip bounds
      if (video.currentTime < startTime || video.currentTime >= endTime) {
        video.currentTime = startTime
      }
      video.play()
    }
  }, [isPlaying, startTime, endTime])

  // Restart clip
  const restart = useCallback(() => {
    const video = videoRef.current
    if (!video) return

    video.currentTime = startTime
    video.play()
    setIsPlaying(true)
  }, [startTime])

  // Calculate progress within clip
  const progress = Math.max(0, Math.min(1, (currentTime - startTime) / clipDuration))

  return (
    <div className={cn("space-y-3", className)}>
      {/* Video preview */}
      <div className="relative bg-black rounded-lg overflow-hidden">
        <video
          ref={videoRef}
          src={videoUrl}
          className="w-full aspect-video object-contain"
          playsInline
          preload="auto"
        />

        {/* Loading overlay */}
        {!isReady && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80">
            <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* Play overlay (when paused) */}
        {isReady && !isPlaying && (
          <button
            onClick={togglePlay}
            className="absolute inset-0 flex items-center justify-center bg-black/40 hover:bg-black/50 transition-colors group"
          >
            <div className="w-16 h-16 bg-white/20 group-hover:bg-white/30 rounded-full flex items-center justify-center transition-colors">
              <Play className="w-8 h-8 text-white ml-1" />
            </div>
          </button>
        )}

        {/* Clip time badge */}
        <div className="absolute top-3 left-3 px-2 py-1 bg-black/60 rounded text-xs text-white/80 font-mono">
          {formatTime(currentTime - startTime)} / {formatTime(clipDuration)}
        </div>

        {/* Loop indicator */}
        {loop && (
          <div className="absolute top-3 right-3 px-2 py-1 bg-green-500/20 rounded text-xs text-green-400">
            Loop
          </div>
        )}
      </div>

      {/* Progress bar */}
      <div className="relative h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div
          className="absolute top-0 left-0 h-full bg-green-500 transition-all duration-100"
          style={{ width: `${progress * 100}%` }}
        />
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={togglePlay}
            disabled={!isReady}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
              isReady
                ? "bg-white/10 hover:bg-white/20 text-white"
                : "bg-white/5 text-white/30 cursor-not-allowed"
            )}
          >
            {isPlaying ? (
              <>
                <Pause className="w-4 h-4" />
                Pause
              </>
            ) : (
              <>
                <Play className="w-4 h-4 ml-0.5" />
                Play
              </>
            )}
          </button>
          <button
            onClick={restart}
            disabled={!isReady}
            className={cn(
              "p-1.5 rounded-lg transition-colors",
              isReady
                ? "hover:bg-white/10 text-white/70"
                : "text-white/30 cursor-not-allowed"
            )}
            title="Restart clip"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>

        <div className="text-xs text-white/50">
          Clip: {formatTime(startTime)} &ndash; {formatTime(endTime)}
        </div>
      </div>
    </div>
  )
}
