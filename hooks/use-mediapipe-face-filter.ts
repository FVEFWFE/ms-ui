'use client'

import { useEffect, useRef } from 'react'
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision'

interface UseMediaPipeFaceFilterOptions {
  enabled: boolean
  blurAmount: number
  webcamVideoRef: React.RefObject<HTMLVideoElement | null>
  outputCanvasRef: React.RefObject<HTMLCanvasElement | null>
}

/**
 * MediaPipe-based face filter providing blur effects
 *
 * Detects face landmarks in real-time and applies Gaussian blur to face region.
 * Renders filtered output to outputCanvas, which serves as the webcam source for recording.
 * This ensures blur filters are baked into the final recorded video.
 *
 * Blur amounts:
 * - Light: 15px Gaussian blur
 * - Heavy: 40px Gaussian blur
 * - Disabled: 0 (passthrough)
 */
export function useMediaPipeFaceFilter({
  enabled,
  blurAmount,
  webcamVideoRef,
  outputCanvasRef,
}: UseMediaPipeFaceFilterOptions) {
  const faceLandmarkerRef = useRef<FaceLandmarker | null>(null)
  const animationFrameRef = useRef<number>()
  const isInitializedRef = useRef(false)

  useEffect(() => {
    // Cleanup previous state when dependencies change
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
      if (faceLandmarkerRef.current) {
        faceLandmarkerRef.current.close()
        faceLandmarkerRef.current = null
      }
      isInitializedRef.current = false
    }
  }, [])

  useEffect(() => {
    if (!enabled || !outputCanvasRef.current) {
      // Stop rendering
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
        animationFrameRef.current = undefined
      }
      return
    }

    // If no blur, passthrough raw video to canvas
    if (blurAmount === 0) {
      if (!webcamVideoRef.current) return
      const canvas = outputCanvasRef.current
      const video = webcamVideoRef.current
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      const passthrough = () => {
        if (video.videoWidth > 0 && video.videoHeight > 0) {
          if (canvas.width !== video.videoWidth) canvas.width = video.videoWidth
          if (canvas.height !== video.videoHeight) canvas.height = video.videoHeight
          ctx.drawImage(video, 0, 0)
        }
        animationFrameRef.current = requestAnimationFrame(passthrough)
      }

      passthrough()
      return
    }

    if (!webcamVideoRef.current || !outputCanvasRef.current) return

    const initMediaPipe = async () => {
      // Skip if already initializing
      if (isInitializedRef.current) {
        console.log('[MediaPipeFaceFilter] Already initialized, skipping')
        return
      }

      isInitializedRef.current = true

      try {
        console.log('[MediaPipeFaceFilter] Initializing with blur amount:', blurAmount)

        const video = webcamVideoRef.current
        const canvas = outputCanvasRef.current
        if (!video || !canvas) {
          console.warn('[MediaPipeFaceFilter] Video or canvas ref missing during init')
          isInitializedRef.current = false
          return
        }

        // Initialize FilesetResolver for MediaPipe WASM
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
        )

        // Create FaceLandmarker for real-time face detection
        const faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          numFaces: 1,
        })

        faceLandmarkerRef.current = faceLandmarker

        const ctx = canvas.getContext('2d')
        if (!ctx) {
          console.error('[MediaPipeFaceFilter] Failed to get 2D context')
          isInitializedRef.current = false
          return
        }

        console.log('[MediaPipeFaceFilter] Starting render loop with blur...')

        // Render loop: detect face -> apply blur -> output to canvas
        const renderLoop = () => {
          if (!enabled || blurAmount === 0) return

          const video = webcamVideoRef.current
          const canvas = outputCanvasRef.current
          if (!video || !canvas || video.videoWidth === 0) return

          // Adjust canvas dimensions to match video
          if (canvas.width !== video.videoWidth) canvas.width = video.videoWidth
          if (canvas.height !== video.videoHeight) canvas.height = video.videoHeight

          // Draw original frame to canvas
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

          // Detect face landmarks
          try {
            const results = faceLandmarker?.detectForVideo(video, performance.now())

            if (results?.faceLandmarks && results.faceLandmarks.length > 0) {
              const landmarks = results.faceLandmarks[0]

              // Calculate bounding box from all landmarks
              const xs = landmarks.map(l => l.x * canvas.width)
              const ys = landmarks.map(l => l.y * canvas.height)
              const minX = Math.max(0, Math.floor(Math.min(...xs)) - 10)
              const maxX = Math.min(canvas.width, Math.ceil(Math.max(...xs)) + 10)
              const minY = Math.max(0, Math.floor(Math.min(...ys)) - 10)
              const maxY = Math.min(canvas.height, Math.ceil(Math.max(...ys)) + 10)

              const width = maxX - minX
              const height = maxY - minY

              if (width > 0 && height > 0) {
                // Extract face region from canvas
                const faceImageData = ctx.getImageData(minX, minY, width, height)

                // Apply blur effect via filter API
                // Save current state
                ctx.save()

                // Create temporary canvas for blurred face
                const tempCanvas = document.createElement('canvas')
                tempCanvas.width = width
                tempCanvas.height = height
                const tempCtx = tempCanvas.getContext('2d')
                if (!tempCtx) {
                  ctx.restore()
                  animationFrameRef.current = requestAnimationFrame(renderLoop)
                  return
                }

                // Put face data on temp canvas
                tempCtx.putImageData(faceImageData, 0, 0)

                // Apply blur filter
                tempCtx.filter = `blur(${blurAmount}px)`
                tempCtx.drawImage(tempCanvas, 0, 0)

                // Draw blurred face back to main canvas
                ctx.drawImage(tempCanvas, minX, minY)
                ctx.restore()
              }
            }
          } catch (err) {
            console.error('[MediaPipeFaceFilter] Detection error:', err)
          }

          animationFrameRef.current = requestAnimationFrame(renderLoop)
        }

        renderLoop()
        isInitializedRef.current = true
      } catch (err) {
        console.error('[MediaPipeFaceFilter] Initialization failed:', err)
        isInitializedRef.current = false
        // Passthrough on error - render raw webcam
        if (outputCanvasRef.current && webcamVideoRef.current) {
          const canvas = outputCanvasRef.current
          const video = webcamVideoRef.current
          const ctx = canvas.getContext('2d')
          if (!ctx) return

          const passthrough = () => {
            if (video.videoWidth > 0 && video.videoHeight > 0) {
              if (canvas.width !== video.videoWidth) canvas.width = video.videoWidth
              if (canvas.height !== video.videoHeight) canvas.height = video.videoHeight
              ctx.drawImage(video, 0, 0)
            }
            animationFrameRef.current = requestAnimationFrame(passthrough)
          }

          passthrough()
        }
      }
    }

    initMediaPipe()
  }, [enabled, blurAmount, webcamVideoRef, outputCanvasRef])
}
