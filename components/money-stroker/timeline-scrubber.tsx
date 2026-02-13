"use client"

import { useRef, useState, useCallback, useEffect } from "react"
import { Play, Pause, SkipBack, SkipForward } from "lucide-react"
import { cn } from "@/lib/utils"

interface TimelineScrubberProps {
  videoUrl: string
  duration: number // Total video duration in seconds
  clipDuration?: number // Clip length in seconds (default 5)
  onClipSelect: (startTime: number, endTime: number) => void
  className?: string
}

export function TimelineScrubber({
  videoUrl,
  duration,
  clipDuration = 5,
  onClipSelect,
  className,
}: TimelineScrubberProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [clipStart, setClipStart] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [dragType, setDragType] = useState<"start" | "region" | null>(null)
  const [dragOffset, setDragOffset] = useState(0)

  const clipEnd = Math.min(clipStart + clipDuration, duration)

  // Format time as M:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  // Update current time during playback
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime)
    }

    const handleEnded = () => {
      setIsPlaying(false)
    }

    video.addEventListener("timeupdate", handleTimeUpdate)
    video.addEventListener("ended", handleEnded)

    return () => {
      video.removeEventListener("timeupdate", handleTimeUpdate)
      video.removeEventListener("ended", handleEnded)
    }
  }, [])

  // Notify parent of clip selection changes
  useEffect(() => {
    onClipSelect(clipStart, clipEnd)
  }, [clipStart, clipEnd, onClipSelect])

  // Toggle play/pause
  const togglePlay = useCallback(() => {
    const video = videoRef.current
    if (!video) return

    if (isPlaying) {
      video.pause()
      setIsPlaying(false)
    } else {
      video.play()
      setIsPlaying(true)
    }
  }, [isPlaying])

  // Seek to clip start
  const seekToClipStart = useCallback(() => {
    const video = videoRef.current
    if (!video) return

    video.currentTime = clipStart
    setCurrentTime(clipStart)
  }, [clipStart])

  // Convert pixel position to time
  const pixelToTime = useCallback((pixelX: number): number => {
    const track = trackRef.current
    if (!track) return 0

    const rect = track.getBoundingClientRect()
    const relativeX = Math.max(0, Math.min(pixelX - rect.left, rect.width))
    return (relativeX / rect.width) * duration
  }, [duration])

  // Convert time to percentage
  const timeToPercent = useCallback((time: number): number => {
    return (time / duration) * 100
  }, [duration])

  // Handle track click (move clip start to click position)
  const handleTrackClick = useCallback((e: React.MouseEvent) => {
    if (isDragging) return

    const newStart = pixelToTime(e.clientX)
    // Ensure clip doesn't extend past video end
    const maxStart = duration - clipDuration
    setClipStart(Math.max(0, Math.min(newStart, maxStart)))

    // Seek video to new position
    if (videoRef.current) {
      videoRef.current.currentTime = newStart
    }
  }, [isDragging, pixelToTime, duration, clipDuration])

  // Handle drag start on clip region
  const handleDragStart = useCallback((e: React.MouseEvent, type: "start" | "region") => {
    e.stopPropagation()
    setIsDragging(true)
    setDragType(type)

    if (type === "region") {
      // Calculate offset from clip start to mouse position
      const mouseTime = pixelToTime(e.clientX)
      setDragOffset(mouseTime - clipStart)
    }
  }, [pixelToTime, clipStart])

  // Handle drag move
  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      const mouseTime = pixelToTime(e.clientX)

      if (dragType === "start") {
        // Move just the start marker
        const maxStart = duration - clipDuration
        setClipStart(Math.max(0, Math.min(mouseTime, maxStart)))
      } else if (dragType === "region") {
        // Move entire region
        const newStart = mouseTime - dragOffset
        const maxStart = duration - clipDuration
        setClipStart(Math.max(0, Math.min(newStart, maxStart)))
      }
    }

    const handleMouseUp = () => {
      setIsDragging(false)
      setDragType(null)
    }

    document.addEventListener("mousemove", handleMouseMove)
    document.addEventListener("mouseup", handleMouseUp)

    return () => {
      document.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("mouseup", handleMouseUp)
    }
  }, [isDragging, dragType, dragOffset, pixelToTime, duration, clipDuration])

  // Move clip by 1 second
  const nudgeClip = useCallback((direction: -1 | 1) => {
    const newStart = clipStart + direction
    const maxStart = duration - clipDuration
    setClipStart(Math.max(0, Math.min(newStart, maxStart)))
  }, [clipStart, duration, clipDuration])

  return (
    <div className={cn("space-y-4", className)}>
      {/* Hidden video element for playback control */}
      <video
        ref={videoRef}
        src={videoUrl}
        className="hidden"
        preload="metadata"
      />

      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => nudgeClip(-1)}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            title="Move clip back 1 second"
          >
            <SkipBack className="w-4 h-4 text-white/70" />
          </button>
          <button
            onClick={togglePlay}
            className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
          >
            {isPlaying ? (
              <Pause className="w-5 h-5 text-white" />
            ) : (
              <Play className="w-5 h-5 text-white ml-0.5" />
            )}
          </button>
          <button
            onClick={() => nudgeClip(1)}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            title="Move clip forward 1 second"
          >
            <SkipForward className="w-4 h-4 text-white/70" />
          </button>
          <button
            onClick={seekToClipStart}
            className="px-3 py-1.5 text-xs bg-white/10 hover:bg-white/20 rounded-lg transition-colors text-white/70"
          >
            Go to clip
          </button>
        </div>

        <div className="text-sm text-white/60">
          Selected: <span className="text-green-400 font-mono">{formatTime(clipStart)}</span>
          {" "}&ndash;{" "}
          <span className="text-green-400 font-mono">{formatTime(clipEnd)}</span>
          <span className="text-white/40 ml-2">({clipDuration}s)</span>
        </div>
      </div>

      {/* Timeline Track */}
      <div
        ref={trackRef}
        className="relative h-12 bg-white/5 rounded-lg cursor-pointer overflow-hidden"
        onClick={handleTrackClick}
      >
        {/* Selected clip region */}
        <div
          className={cn(
            "absolute top-0 bottom-0 bg-green-500/30 border-x-2 border-green-500 cursor-move transition-colors",
            isDragging && dragType === "region" && "bg-green-500/40"
          )}
          style={{
            left: `${timeToPercent(clipStart)}%`,
            width: `${timeToPercent(clipDuration)}%`,
          }}
          onMouseDown={(e) => handleDragStart(e, "region")}
        >
          {/* Start handle */}
          <div
            className="absolute left-0 top-0 bottom-0 w-3 bg-green-500 cursor-ew-resize flex items-center justify-center"
            onMouseDown={(e) => handleDragStart(e, "start")}
          >
            <div className="w-0.5 h-6 bg-white/50 rounded-full" />
          </div>

          {/* Clip label */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="text-xs text-green-400 font-medium bg-black/50 px-2 py-0.5 rounded">
              {clipDuration}s clip
            </span>
          </div>
        </div>

        {/* Current playhead */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-white pointer-events-none"
          style={{ left: `${timeToPercent(currentTime)}%` }}
        >
          <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-white rounded-full" />
        </div>

        {/* Time markers */}
        <div className="absolute bottom-0 left-0 right-0 h-4 flex items-end pointer-events-none">
          {Array.from({ length: Math.ceil(duration / 10) + 1 }).map((_, i) => {
            const time = i * 10
            if (time > duration) return null
            return (
              <div
                key={time}
                className="absolute text-[10px] text-white/40 -translate-x-1/2"
                style={{ left: `${timeToPercent(time)}%` }}
              >
                {formatTime(time)}
              </div>
            )
          })}
        </div>
      </div>

      {/* Time display */}
      <div className="flex justify-between text-xs text-white/40">
        <span>{formatTime(0)}</span>
        <span>Current: {formatTime(currentTime)}</span>
        <span>{formatTime(duration)}</span>
      </div>
    </div>
  )
}
