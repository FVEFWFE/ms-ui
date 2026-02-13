"use client"

import { useState, useCallback } from "react"

export type CompanionAction = "idle" | "talk_dirty" | "encourage" | "tease"

export function useCompanionOverlay() {
  const [isVisible, setIsVisible] = useState(false)
  const [currentAction, setCurrentAction] = useState<CompanionAction>("idle")
  const [volume, setVolume] = useState(0.7)

  const triggerAction = useCallback((action: CompanionAction) => {
    setCurrentAction(action)
    // Future: API call to get companion response based on action type
  }, [])

  const toggleVisibility = useCallback(() => {
    setIsVisible((prev) => !prev)
  }, [])

  const adjustVolume = useCallback((delta: number) => {
    setVolume((prev) => Math.max(0, Math.min(1, prev + delta)))
  }, [])

  return {
    isVisible,
    toggleVisibility,
    currentAction,
    triggerAction,
    volume,
    adjustVolume,
  }
}
