"use client"

import { useRef, useEffect, useCallback } from "react"
import type { FunscriptAction } from "@/lib/funscript-utils"

interface FunscriptWaveformCanvasProps {
  actions: FunscriptAction[]
  currentTimeMs: number
  videoDurationMs: number
  width?: number
  height?: number
  windowSizeMs?: number
  lineColor?: string
  playheadColor?: string
  dotColor?: string
  backgroundColor?: string
}

export function FunscriptWaveformCanvas({
  actions,
  currentTimeMs,
  videoDurationMs,
  width = 280,
  height = 80,
  windowSizeMs = 15000, // 15 seconds window
  lineColor = "#ec4899", // pink-500
  playheadColor = "#ffffff",
  dotColor = "#ec4899",
  backgroundColor = "#18181b", // zinc-900
}: FunscriptWaveformCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Get interpolated position at a given time
  const getPositionAtTime = useCallback(
    (timeMs: number): number => {
      if (!actions || actions.length === 0) return 50

      if (timeMs <= actions[0].at) return actions[0].pos
      if (timeMs >= actions[actions.length - 1].at) {
        return actions[actions.length - 1].pos
      }

      // Binary search for surrounding actions
      let low = 0
      let high = actions.length - 1

      while (low < high - 1) {
        const mid = Math.floor((low + high) / 2)
        if (actions[mid].at <= timeMs) {
          low = mid
        } else {
          high = mid
        }
      }

      const before = actions[low]
      const after = actions[high]

      if (after.at === before.at) return before.pos

      const progress = (timeMs - before.at) / (after.at - before.at)
      return before.pos + (after.pos - before.pos) * progress
    },
    [actions]
  )

  // Draw the waveform
  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const displayWidth = width
    const displayHeight = height

    // Set canvas size accounting for device pixel ratio
    canvas.width = displayWidth * dpr
    canvas.height = displayHeight * dpr
    canvas.style.width = `${displayWidth}px`
    canvas.style.height = `${displayHeight}px`
    ctx.scale(dpr, dpr)

    // Calculate window bounds
    const halfWindow = windowSizeMs / 2
    const windowStart = currentTimeMs - halfWindow
    const windowEnd = currentTimeMs + halfWindow

    // Clear and draw background
    ctx.fillStyle = backgroundColor
    ctx.fillRect(0, 0, displayWidth, displayHeight)

    // Draw subtle grid lines
    ctx.strokeStyle = "rgba(255, 255, 255, 0.05)"
    ctx.lineWidth = 1

    // Horizontal grid lines (25%, 50%, 75%)
    for (let i = 1; i <= 3; i++) {
      const y = (i / 4) * displayHeight
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(displayWidth, y)
      ctx.stroke()
    }

    // Vertical grid lines (every 5 seconds)
    const gridIntervalMs = 5000
    const gridStartTime =
      Math.ceil(windowStart / gridIntervalMs) * gridIntervalMs
    for (let t = gridStartTime; t <= windowEnd; t += gridIntervalMs) {
      const x = ((t - windowStart) / windowSizeMs) * displayWidth
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, displayHeight)
      ctx.stroke()
    }

    // Filter actions within the visible window (with padding for smooth edges)
    const paddingMs = 1000
    const visibleActions = actions.filter(
      (a) => a.at >= windowStart - paddingMs && a.at <= windowEnd + paddingMs
    )

    if (visibleActions.length > 0) {
      // Draw waveform path
      ctx.beginPath()
      ctx.strokeStyle = lineColor
      ctx.lineWidth = 2
      ctx.lineCap = "round"
      ctx.lineJoin = "round"

      visibleActions.forEach((action, i) => {
        const x = ((action.at - windowStart) / windowSizeMs) * displayWidth
        const y = ((100 - action.pos) / 100) * displayHeight

        if (i === 0) {
          ctx.moveTo(x, y)
        } else {
          ctx.lineTo(x, y)
        }
      })
      ctx.stroke()

      // Draw gradient fill under the line
      const gradient = ctx.createLinearGradient(0, 0, 0, displayHeight)
      gradient.addColorStop(0, "rgba(236, 72, 153, 0.3)")
      gradient.addColorStop(1, "rgba(236, 72, 153, 0)")

      ctx.beginPath()
      ctx.fillStyle = gradient

      // Start from bottom left of first point
      const firstX =
        ((visibleActions[0].at - windowStart) / windowSizeMs) * displayWidth
      ctx.moveTo(firstX, displayHeight)

      // Draw line path
      visibleActions.forEach((action) => {
        const x = ((action.at - windowStart) / windowSizeMs) * displayWidth
        const y = ((100 - action.pos) / 100) * displayHeight
        ctx.lineTo(x, y)
      })

      // Close path to bottom right
      const lastX =
        ((visibleActions[visibleActions.length - 1].at - windowStart) /
          windowSizeMs) *
        displayWidth
      ctx.lineTo(lastX, displayHeight)
      ctx.closePath()
      ctx.fill()
    }

    // Draw playhead (vertical line at center)
    const centerX = displayWidth / 2
    ctx.strokeStyle = playheadColor
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(centerX, 0)
    ctx.lineTo(centerX, displayHeight)
    ctx.stroke()

    // Draw current position dot on the playhead
    const currentPos = getPositionAtTime(currentTimeMs)
    const dotY = ((100 - currentPos) / 100) * displayHeight

    // Outer glow
    ctx.beginPath()
    ctx.arc(centerX, dotY, 8, 0, Math.PI * 2)
    ctx.fillStyle = "rgba(236, 72, 153, 0.3)"
    ctx.fill()

    // Inner dot
    ctx.beginPath()
    ctx.arc(centerX, dotY, 5, 0, Math.PI * 2)
    ctx.fillStyle = dotColor
    ctx.fill()

    // White center
    ctx.beginPath()
    ctx.arc(centerX, dotY, 2, 0, Math.PI * 2)
    ctx.fillStyle = "#ffffff"
    ctx.fill()
  }, [
    actions,
    currentTimeMs,
    width,
    height,
    windowSizeMs,
    lineColor,
    playheadColor,
    dotColor,
    backgroundColor,
    getPositionAtTime,
  ])

  // Redraw on changes
  useEffect(() => {
    draw()
  }, [draw])

  // Handle resize
  useEffect(() => {
    const handleResize = () => draw()
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [draw])

  return (
    <canvas
      ref={canvasRef}
      className="rounded-lg"
      style={{ width, height }}
    />
  )
}
