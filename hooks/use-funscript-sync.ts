"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import { deviceService } from "@/lib/device-service"

interface FunscriptAction {
  at: number
  pos: number
}

interface Funscript {
  version: string
  inverted: boolean
  range: number
  actions: FunscriptAction[]
}

interface UseFunscriptSyncOptions {
  videoId?: string
  customFunscript?: Funscript | null
  deviceConnected: boolean
  onError?: (error: string) => void
}

interface UseFunscriptSyncReturn {
  isLoading: boolean
  isReady: boolean
  isSyncing: boolean
  hasScript: boolean
  error: string | null
  loadFunscript: () => Promise<boolean>
  startSync: (currentTimeMs: number) => Promise<boolean>
  stopSync: () => Promise<boolean>
  seekSync: (currentTimeMs: number) => Promise<boolean>
  funscript: Funscript | null
}

export function useFunscriptSync({
  videoId,
  customFunscript,
  deviceConnected,
  onError,
}: UseFunscriptSyncOptions): UseFunscriptSyncReturn {
  const [isLoading, setIsLoading] = useState(false)
  const [isReady, setIsReady] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [hasScript, setHasScript] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [funscript, setFunscript] = useState<Funscript | null>(null)

  const isUploadedRef = useRef(false)
  const currentVideoIdRef = useRef<string | null>(null)

  // Reset state when video or custom funscript changes
  useEffect(() => {
    const currentId = videoId || (customFunscript ? 'custom' : '')
    if (currentId !== currentVideoIdRef.current) {
      currentVideoIdRef.current = currentId
      isUploadedRef.current = false
      setIsReady(false)
      setIsSyncing(false)
      setHasScript(false)
      setFunscript(null)
      setError(null)
    }
  }, [videoId, customFunscript])

  // Load funscript from API or custom data
  const loadFunscript = useCallback(async (): Promise<boolean> => {
    if (!deviceConnected) {
      setError("Device not connected")
      return false
    }

    setIsLoading(true)
    setError(null)

    try {
      // If custom funscript provided, skip API fetch
      if (customFunscript) {
        setFunscript(customFunscript)
        setHasScript(true)

        console.log("[FunscriptSync] Uploading custom funscript to device...")
        const uploadSuccess = await deviceService.uploadFunscript(customFunscript)

        if (!uploadSuccess) {
          throw new Error("Failed to upload funscript to device")
        }

        isUploadedRef.current = true
        setIsReady(true)
        console.log("[FunscriptSync] Custom funscript uploaded successfully")
        return true
      }

      // Standard API fetch path
      if (!videoId) {
        setError("No video ID provided")
        return false
      }

      const response = await fetch(`/api/videos/${videoId}/funscript`)

      if (!response.ok) {
        if (response.status === 404) {
          setHasScript(false)
          setError(null) // No script is not an error
          return false
        }
        throw new Error("Failed to fetch funscript")
      }

      const data: Funscript = await response.json()
      setFunscript(data)
      setHasScript(true)

      // Upload to device
      console.log("[FunscriptSync] Uploading funscript to device...")
      const uploadSuccess = await deviceService.uploadFunscript(data)

      if (!uploadSuccess) {
        throw new Error("Failed to upload funscript to device")
      }

      isUploadedRef.current = true
      setIsReady(true)
      console.log("[FunscriptSync] Funscript uploaded successfully")
      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error"
      setError(message)
      onError?.(message)
      return false
    } finally {
      setIsLoading(false)
    }
  }, [videoId, customFunscript, deviceConnected, onError])

  // Start sync at current time
  const startSync = useCallback(async (currentTimeMs: number): Promise<boolean> => {
    if (!isReady || !isUploadedRef.current) {
      console.log("[FunscriptSync] Not ready to start sync")
      return false
    }

    try {
      console.log(`[FunscriptSync] Starting sync at ${currentTimeMs}ms`)
      const success = await deviceService.startFunscriptSync(currentTimeMs)

      if (success) {
        setIsSyncing(true)
      }
      return success
    } catch (err) {
      console.error("[FunscriptSync] Start sync error:", err)
      return false
    }
  }, [isReady])

  // Stop sync
  const stopSync = useCallback(async (): Promise<boolean> => {
    try {
      console.log("[FunscriptSync] Stopping sync")
      const success = await deviceService.stopFunscriptSync()

      if (success) {
        setIsSyncing(false)
      }
      return success
    } catch (err) {
      console.error("[FunscriptSync] Stop sync error:", err)
      return false
    }
  }, [])

  // Seek sync to new position
  const seekSync = useCallback(async (currentTimeMs: number): Promise<boolean> => {
    if (!isSyncing) {
      return false
    }

    try {
      console.log(`[FunscriptSync] Seeking to ${currentTimeMs}ms`)
      // Stop current sync
      await deviceService.stopFunscriptSync()
      // Start from new position
      const success = await deviceService.startFunscriptSync(currentTimeMs)
      return success
    } catch (err) {
      console.error("[FunscriptSync] Seek sync error:", err)
      return false
    }
  }, [isSyncing])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isSyncing) {
        deviceService.stopFunscriptSync().catch(() => {})
      }
    }
  }, [isSyncing])

  return {
    isLoading,
    isReady,
    isSyncing,
    hasScript,
    error,
    loadFunscript,
    startSync,
    stopSync,
    seekSync,
    funscript,
  }
}
