'use client'

import { useState, useRef, useEffect, useCallback } from 'react'

const STORAGE_KEY = 'money_stroker_greek_god_job'
const POLL_INTERVAL_MS = 5000

export interface JobStatus {
  jobId: string
  status: 'pending' | 'transform_processing' | 'animate_processing' | 'completed' | 'failed'
  progress: number
  stage: string
  isVideo: boolean
  animateVideo: boolean
  loraStrength: number
  creditsUsed: number
  hasDinoMask: boolean
  transformOutputUrl: string | null
  animateOutputUrl: string | null
  finalOutputUrl: string | null
  errorMessage: string | null
  createdAt: string
  completedAt: string | null
}

export function useGreekGodJob() {
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isComplete, setIsComplete] = useState(false)
  const [isFailed, setIsFailed] = useState(false)
  const [resultUrl, setResultUrl] = useState<string | null>(null)
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const clearPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current)
      pollIntervalRef.current = null
    }
  }, [])

  const pollJobStatus = useCallback(async (jobId: string) => {
    try {
      const response = await fetch(`/api/greek-god-transform/status/${jobId}`)
      if (!response.ok) {
        console.error('[GreekGodJob] Poll failed:', response.status)
        return
      }

      const status: JobStatus = await response.json()
      setJobStatus(status)

      if (status.status === 'completed') {
        setIsProcessing(false)
        setIsComplete(true)
        setIsFailed(false)
        setResultUrl(status.finalOutputUrl || status.transformOutputUrl)
        clearPolling()
        localStorage.removeItem(STORAGE_KEY)
      } else if (status.status === 'failed') {
        setIsProcessing(false)
        setIsComplete(false)
        setIsFailed(true)
        clearPolling()
        localStorage.removeItem(STORAGE_KEY)
      }
    } catch (err) {
      console.error('[GreekGodJob] Poll error:', err)
    }
  }, [clearPolling])

  const startPolling = useCallback((jobId: string) => {
    clearPolling()
    setIsProcessing(true)
    setIsComplete(false)
    setIsFailed(false)

    // Poll immediately
    pollJobStatus(jobId)

    // Then poll on interval
    pollIntervalRef.current = setInterval(() => {
      pollJobStatus(jobId)
    }, POLL_INTERVAL_MS)
  }, [clearPolling, pollJobStatus])

  const submitJob = useCallback(async (formData: FormData) => {
    setIsProcessing(true)
    setIsComplete(false)
    setIsFailed(false)
    setResultUrl(null)
    setJobStatus(null)

    try {
      const response = await fetch('/api/greek-god-transform', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const errData = await response.json().catch(() => ({ error: 'Request failed' }))
        throw new Error(errData.error || `HTTP ${response.status}`)
      }

      const data = await response.json()
      const jobId = data.jobId as string

      // Persist to localStorage for resume on page remount
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        jobId,
        startedAt: Date.now(),
      }))

      startPolling(jobId)
    } catch (err) {
      setIsProcessing(false)
      setIsFailed(true)
      setJobStatus({
        jobId: '',
        status: 'failed',
        progress: 0,
        stage: 'Submission failed',
        isVideo: false,
        animateVideo: false,
        loraStrength: 0,
        creditsUsed: 0,
        hasDinoMask: false,
        transformOutputUrl: null,
        animateOutputUrl: null,
        finalOutputUrl: null,
        errorMessage: err instanceof Error ? err.message : 'Failed to submit job',
        createdAt: new Date().toISOString(),
        completedAt: null,
      })
    }
  }, [startPolling])

  const cancelPolling = useCallback(() => {
    clearPolling()
    setIsProcessing(false)
  }, [clearPolling])

  const reset = useCallback(() => {
    clearPolling()
    localStorage.removeItem(STORAGE_KEY)
    setJobStatus(null)
    setIsProcessing(false)
    setIsComplete(false)
    setIsFailed(false)
    setResultUrl(null)
  }, [clearPolling])

  // Resume polling on mount if there's an active job in localStorage
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return

    try {
      const { jobId, startedAt } = JSON.parse(stored)
      // Only resume if job was started within the last 30 minutes
      const elapsed = Date.now() - startedAt
      if (elapsed > 30 * 60 * 1000) {
        localStorage.removeItem(STORAGE_KEY)
        return
      }
      startPolling(jobId)
    } catch {
      localStorage.removeItem(STORAGE_KEY)
    }

    return () => clearPolling()
  }, [startPolling, clearPolling])

  return {
    jobStatus,
    isProcessing,
    isComplete,
    isFailed,
    resultUrl,
    submitJob,
    cancelPolling,
    reset,
  }
}
