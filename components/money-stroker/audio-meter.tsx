"use client"

import { useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"

interface AudioMeterProps {
  stream: MediaStream | null
  label?: string
  className?: string
}

export function AudioMeter({ stream, label, className }: AudioMeterProps) {
  const [level, setLevel] = useState(0)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const animationFrameRef = useRef<number | null>(null)

  useEffect(() => {
    if (!stream) {
      setLevel(0)
      return
    }

    // Check if stream has audio tracks
    const audioTracks = stream.getAudioTracks()
    if (audioTracks.length === 0) {
      setLevel(0)
      return
    }

    // Create audio context and analyser
    const audioContext = new AudioContext()
    audioContextRef.current = audioContext

    const analyser = audioContext.createAnalyser()
    analyser.fftSize = 256
    analyser.smoothingTimeConstant = 0.8
    analyserRef.current = analyser

    // Connect stream to analyser
    try {
      const source = audioContext.createMediaStreamSource(stream)
      source.connect(analyser)
      // Don't connect to destination - we don't want to hear the input
    } catch (err) {
      console.warn("[AudioMeter] Failed to create media stream source:", err)
      return
    }

    // Animation loop to read levels
    const dataArray = new Uint8Array(analyser.frequencyBinCount)

    const updateLevel = () => {
      if (!analyserRef.current) return

      analyserRef.current.getByteFrequencyData(dataArray)

      // Calculate RMS (root mean square) for more accurate level
      let sum = 0
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i] * dataArray[i]
      }
      const rms = Math.sqrt(sum / dataArray.length)

      // Normalize to 0-100 range
      const normalized = Math.min(100, (rms / 128) * 100)
      setLevel(normalized)

      animationFrameRef.current = requestAnimationFrame(updateLevel)
    }

    updateLevel()

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
      if (audioContextRef.current) {
        audioContextRef.current.close()
      }
      analyserRef.current = null
      audioContextRef.current = null
    }
  }, [stream])

  // Color based on level
  const getBarColor = (barIndex: number, totalBars: number) => {
    const threshold = (barIndex / totalBars) * 100
    if (threshold < 60) return level >= threshold ? "bg-green-500" : "bg-white/10"
    if (threshold < 80) return level >= threshold ? "bg-yellow-500" : "bg-white/10"
    return level >= threshold ? "bg-red-500" : "bg-white/10"
  }

  const bars = 10

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {label && <span className="text-xs text-white/50 w-16 truncate">{label}</span>}
      <div className="flex gap-0.5 items-end h-4">
        {Array.from({ length: bars }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "w-1.5 rounded-sm transition-colors",
              getBarColor(i, bars)
            )}
            style={{ height: `${((i + 1) / bars) * 100}%` }}
          />
        ))}
      </div>
    </div>
  )
}

// Simpler horizontal bar version
export function AudioMeterBar({ stream, label, className }: AudioMeterProps) {
  const [level, setLevel] = useState(0)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const animationFrameRef = useRef<number | null>(null)

  useEffect(() => {
    if (!stream) {
      setLevel(0)
      return
    }

    const audioTracks = stream.getAudioTracks()
    if (audioTracks.length === 0) {
      setLevel(0)
      return
    }

    const audioContext = new AudioContext()
    audioContextRef.current = audioContext

    const analyser = audioContext.createAnalyser()
    analyser.fftSize = 256
    analyser.smoothingTimeConstant = 0.8
    analyserRef.current = analyser

    try {
      const source = audioContext.createMediaStreamSource(stream)
      source.connect(analyser)
    } catch (err) {
      console.warn("[AudioMeterBar] Failed to create media stream source:", err)
      return
    }

    const dataArray = new Uint8Array(analyser.frequencyBinCount)

    const updateLevel = () => {
      if (!analyserRef.current) return

      analyserRef.current.getByteFrequencyData(dataArray)

      let sum = 0
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i] * dataArray[i]
      }
      const rms = Math.sqrt(sum / dataArray.length)
      const normalized = Math.min(100, (rms / 128) * 100)
      setLevel(normalized)

      animationFrameRef.current = requestAnimationFrame(updateLevel)
    }

    updateLevel()

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
      if (audioContextRef.current) {
        audioContextRef.current.close()
      }
    }
  }, [stream])

  // Gradient from green to yellow to red
  const getGradient = () => {
    if (level < 60) return "bg-green-500"
    if (level < 80) return "bg-yellow-500"
    return "bg-red-500"
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {label && <span className="text-xs text-white/50 min-w-[4rem]">{label}</span>}
      <div className="w-24 h-2 bg-white/10 rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all duration-75", getGradient())}
          style={{ width: `${level}%` }}
        />
      </div>
    </div>
  )
}
