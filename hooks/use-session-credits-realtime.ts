"use client"

import { useState, useEffect, useRef, useCallback } from "react"

interface SessionCredits {
  strokes: number
  edges: number
  highIntensity: number
  total: number
}

export function useSessionCreditsRealtime(
  isRecording: boolean,
  deviceConnected: boolean,
  edgeModeActive: boolean
) {
  const [sessionCredits, setSessionCredits] = useState<SessionCredits>({
    strokes: 0,
    edges: 0,
    highIntensity: 0,
    total: 0,
  })

  const edgeCountRef = useRef(0)
  const prevEdgeModeRef = useRef(false)
  const recordingStartRef = useRef<number | null>(null)

  // Track edge transitions
  useEffect(() => {
    if (edgeModeActive && !prevEdgeModeRef.current && isRecording) {
      edgeCountRef.current += 1
      setSessionCredits((prev) => {
        const newEdges = edgeCountRef.current * 5
        return {
          ...prev,
          edges: newEdges,
          total: prev.strokes + newEdges + prev.highIntensity,
        }
      })
    }
    prevEdgeModeRef.current = edgeModeActive
  }, [edgeModeActive, isRecording])

  // Accumulate credits each second while recording
  useEffect(() => {
    if (!isRecording) {
      recordingStartRef.current = null
      return
    }

    if (!recordingStartRef.current) {
      recordingStartRef.current = Date.now()
    }

    const interval = setInterval(() => {
      setSessionCredits((prev) => {
        // Base credits: 0.01 per second of recording
        const strokeIncrement = deviceConnected ? 0.02 : 0.01
        const newStrokes = prev.strokes + strokeIncrement

        // High intensity bonus: 0.05/sec when device connected and not in edge mode
        const intensityIncrement = deviceConnected && !edgeModeActive ? 0.05 : 0
        const newHighIntensity = prev.highIntensity + intensityIncrement

        return {
          strokes: newStrokes,
          edges: prev.edges,
          highIntensity: newHighIntensity,
          total: newStrokes + prev.edges + newHighIntensity,
        }
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [isRecording, deviceConnected, edgeModeActive])

  const reset = useCallback(() => {
    setSessionCredits({ strokes: 0, edges: 0, highIntensity: 0, total: 0 })
    edgeCountRef.current = 0
    recordingStartRef.current = null
  }, [])

  return { sessionCredits, reset }
}
