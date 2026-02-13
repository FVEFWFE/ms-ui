"use client"

import { useRef, useState, useCallback, useEffect } from "react"
import { saveRawRecording } from "@/lib/recording-session-storage"

// Source types for recording
export type RecordingSource = "screen" | "video" | "webcam-only" | "custom"

// Layout modes for recording
export type RecordingLayoutMode = "pip" | "side-by-side" | "stacked"

// Webcam position in split layouts (for side-by-side/stacked) and PiP modes (4 corners)
// "left-center" / "right-center" = full-height webcam strip alongside the video
export type WebcamPosition = "left" | "right" | "left-center" | "right-center" | "top-left" | "top-right" | "bottom-left" | "bottom-right"

// Canvas orientation
export type CanvasOrientation = "horizontal" | "vertical"

export interface RecordingLayoutConfig {
  mode: RecordingLayoutMode
  label: string
  description: string
  icon: string
}

export const RECORDING_LAYOUTS: RecordingLayoutConfig[] = [
  { mode: "side-by-side", label: "Side by Side", description: "50/50 horizontal split", icon: "◧" },
  { mode: "stacked", label: "Stacked", description: "Vertical split", icon: "⬒" },
  { mode: "pip", label: "PiP", description: "Webcam overlay on video", icon: "◳" },
]

// Watermark position as percentage
export interface WatermarkPosition {
  x: number // percentage from left (0-100)
  y: number // percentage from top (0-100)
}

// Custom PiP position as percentages
export interface CustomPipPosition {
  x: number // percentage from left (0-100)
  y: number // percentage from top (0-100)
  width: number // percentage of canvas width (0-100)
  height: number // percentage of canvas height (0-100)
}

// Watermark size options
export type WatermarkSize = "small" | "medium" | "large" | "custom"

// Webcam orientation (for mobile users holding phone vertically)
export type WebcamOrientation = "landscape" | "portrait"

interface UseMoneyStrokerRecorderOptions {
  // Video source (can be HTMLVideoElement for video playback or MediaStream for screen capture)
  videoRef?: React.RefObject<HTMLVideoElement | null>
  screenStream?: MediaStream | null
  // Recording source mode
  source?: RecordingSource
  // Webcam
  webcamStream?: MediaStream | null
  webcamPosition?: WebcamPosition
  webcamOrientation?: WebcamOrientation
  // Face filters
  faceFilterEnabled?: boolean
  faceFilterCanvasRef?: React.RefObject<HTMLCanvasElement | null>
  // Layout
  layoutMode?: RecordingLayoutMode
  orientation?: CanvasOrientation
  // Custom PiP position (overrides webcamPosition when provided)
  customPipPosition?: CustomPipPosition | null
  // Audio
  includeVideoAudio?: boolean
  includeMicAudio?: boolean
  // Volume controls (0.0 to 1.0)
  screenVolume?: number
  micVolume?: number
  // Watermark
  watermarkText?: string
  watermarkPosition?: WatermarkPosition
  watermarkSize?: WatermarkSize
  watermarkCustomSize?: number
  watermarkFont?: string // font family id: "default" | "monospace" | "bold-condensed" | "handwritten" | "neon"
  watermarkColor?: string // hex color for text
  watermarkShadow?: string // shadow style: "none" | "subtle" | "strong" | "neon-glow"
  watermarkBackground?: string // bg style: "none" | "solid" | "gradient" | "blur"
  watermarkAlignment?: "left" | "center" | "right" // text alignment
  showWatermarkOnCanvas?: boolean // Set to false when showing draggable overlay instead
  // Callbacks
  onRecordingComplete?: (blob: Blob) => void
  onError?: (error: string) => void
}

interface UseMoneyStrokerRecorderReturn {
  // Recording controls
  startRecording: () => Promise<void>
  stopRecording: () => void
  isRecording: boolean
  recordingDuration: number
  canRecord: boolean
  // Layout controls
  layoutMode: RecordingLayoutMode
  setLayoutMode: (mode: RecordingLayoutMode) => void
  webcamPosition: WebcamPosition
  setWebcamPosition: (position: WebcamPosition) => void
  orientation: CanvasOrientation
  setOrientation: (orientation: CanvasOrientation) => void
  // Preview canvas
  previewCanvasRef: React.RefObject<HTMLCanvasElement | null>
  // Screen capture
  startScreenCapture: () => Promise<MediaStream | null>
  stopScreenCapture: () => void
  screenStream: MediaStream | null
  // Dual recording support (raw unfiltered webcam for Greek God)
  sessionId: string | null
  rawRecordingAvailable: boolean
  webcamVideoRef: React.RefObject<HTMLVideoElement | null>
}

// Find supported MIME type with codec fallback
function getSupportedMimeType(): string {
  const codecs = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm;codecs=vp8',
    'video/webm',
    'video/mp4',
  ]

  for (const codec of codecs) {
    if (MediaRecorder.isTypeSupported(codec)) {
      return codec
    }
  }

  return 'video/webm'
}

// Font sizes for each watermark size
const WATERMARK_FONT_SIZES: Record<Exclude<WatermarkSize, "custom">, number> = {
  small: 20,
  medium: 28,
  large: 38,
}

export function useMoneyStrokerRecorder({
  videoRef,
  screenStream: externalScreenStream,
  source = "screen",
  webcamStream,
  webcamPosition: initialWebcamPosition = "left",
  webcamOrientation = "landscape",
  layoutMode: initialLayoutMode = "pip",
  orientation: initialOrientation = "horizontal",
  customPipPosition = null,
  faceFilterEnabled = false,
  faceFilterCanvasRef = null,
  includeVideoAudio = true,
  includeMicAudio = true,
  screenVolume = 1.0,
  micVolume = 1.0,
  watermarkText,
  watermarkPosition = { x: 50, y: 92 }, // Bottom center by default
  watermarkSize = "medium",
  watermarkCustomSize = 18,
  watermarkFont = "default",
  watermarkColor = "#ffffff",
  watermarkShadow = "subtle",
  watermarkBackground = "solid",
  watermarkAlignment = "center",
  showWatermarkOnCanvas = true,
  onRecordingComplete,
  onError,
}: UseMoneyStrokerRecorderOptions = {}): UseMoneyStrokerRecorderReturn {
  const [isRecording, setIsRecording] = useState(false)
  const [recordingDuration, setRecordingDuration] = useState(0)
  const [canRecord, setCanRecord] = useState(false)
  const [layoutMode, setLayoutMode] = useState<RecordingLayoutMode>(initialLayoutMode)
  const [webcamPosition, setWebcamPosition] = useState<WebcamPosition>(initialWebcamPosition)
  const [orientation, setOrientation] = useState<CanvasOrientation>(initialOrientation)
  const [internalScreenStream, setInternalScreenStream] = useState<MediaStream | null>(null)
  const [sideBySideSplit, setSideBySideSplit] = useState(50)
  const [stackedSplit, setStackedSplit] = useState(50)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [rawRecordingAvailable, setRawRecordingAvailable] = useState(false)

  const screenStream = externalScreenStream ?? internalScreenStream

  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const recordingCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const animationFrameRef = useRef<number | null>(null)
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const startTimeRef = useRef<number>(0)
  const webcamVideoRef = useRef<HTMLVideoElement | null>(null)
  const screenVideoRef = useRef<HTMLVideoElement | null>(null)
  const rawMediaRecorderRef = useRef<MediaRecorder | null>(null)
  const rawChunksRef = useRef<Blob[]>([])

  // Check if recording is supported
  useEffect(() => {
    const supported = typeof MediaRecorder !== 'undefined' &&
      typeof HTMLCanvasElement !== 'undefined'
    setCanRecord(supported)
  }, [])

  // Create webcam video element when stream changes
  useEffect(() => {
    if (webcamStream) {
      const video = document.createElement('video')
      video.srcObject = webcamStream
      video.muted = true
      video.playsInline = true
      video.autoplay = true
      video.play().catch(() => {})
      webcamVideoRef.current = video
    } else {
      webcamVideoRef.current = null
    }

    return () => {
      webcamVideoRef.current = null
    }
  }, [webcamStream])

  // Create screen video element when stream changes
  useEffect(() => {
    if (screenStream) {
      const video = document.createElement('video')
      video.srcObject = screenStream
      video.muted = true
      video.playsInline = true
      video.autoplay = true
      video.play().catch(() => {})
      screenVideoRef.current = video
    } else {
      screenVideoRef.current = null
    }

    return () => {
      screenVideoRef.current = null
    }
  }, [screenStream])

  // Start screen capture
  const startScreenCapture = useCallback(async (): Promise<MediaStream | null> => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: "browser",
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: true,
      })

      // Handle stream end (user clicks "Stop sharing")
      stream.getVideoTracks()[0].addEventListener('ended', () => {
        setInternalScreenStream(null)
      })

      setInternalScreenStream(stream)
      return stream
    } catch (err) {
      console.error('[MoneyStrokerRecorder] Screen capture error:', err)
      onError?.('Screen capture cancelled or denied')
      return null
    }
  }, [onError])

  // Stop screen capture
  const stopScreenCapture = useCallback(() => {
    if (internalScreenStream) {
      internalScreenStream.getTracks().forEach(track => track.stop())
      setInternalScreenStream(null)
    }
  }, [internalScreenStream])

  // Get canvas dimensions based on orientation
  const getCanvasDimensions = useCallback(() => {
    if (orientation === "vertical") {
      return { width: 1080, height: 1920 }
    }
    return { width: 1920, height: 1080 }
  }, [orientation])

  // Canvas compositing loop
  const drawFrame = useCallback((canvas: HTMLCanvasElement) => {
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const { width, height } = getCanvasDimensions()
    // Only reset dimensions when changed (avoids clearing canvas + GPU cache invalidation every frame)
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width
      canvas.height = height
    }

    // Clear canvas
    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Get video sources
    const mainVideo = videoRef?.current || screenVideoRef.current

    // CRITICAL: Use filtered canvas as webcam source when filter is enabled
    // This bakes the filter into the recording
    const filteredCanvasAvailable = faceFilterEnabled && faceFilterCanvasRef?.current
    const webcamSource = filteredCanvasAvailable
      ? faceFilterCanvasRef.current  // Draw from Needle Engine filtered canvas
      : webcamVideoRef.current        // Draw from raw webcam video

    const hasMainVideo = mainVideo && (mainVideo.videoWidth > 0 || mainVideo.readyState >= 2)

    // Check if webcam source is ready (handle both video element and canvas)
    let hasWebcam = false
    if (webcamSource instanceof HTMLVideoElement) {
      hasWebcam = webcamSource && webcamSource.videoWidth > 0
    } else if (webcamSource instanceof HTMLCanvasElement) {
      hasWebcam = webcamSource && (webcamSource.width > 0 && webcamSource.height > 0)
    }

    // WEBCAM-ONLY MODE: Draw webcam fullscreen
    if (source === "webcam-only") {
      if (hasWebcam && webcamSource) {
        let videoWidth = 0, videoHeight = 0
        if (webcamSource instanceof HTMLVideoElement) {
          videoWidth = webcamSource.videoWidth
          videoHeight = webcamSource.videoHeight
        } else if (webcamSource instanceof HTMLCanvasElement) {
          videoWidth = webcamSource.width
          videoHeight = webcamSource.height
        }

        const videoAspect = videoWidth / videoHeight
        const canvasAspect = canvas.width / canvas.height

        let drawWidth = canvas.width
        let drawHeight = canvas.height
        let drawX = 0
        let drawY = 0

        // Maintain aspect ratio while covering the canvas (letterboxing)
        if (videoAspect > canvasAspect) {
          // Video is wider than canvas - fit to height, center horizontally
          drawWidth = canvas.height * videoAspect
          drawX = (canvas.width - drawWidth) / 2
        } else {
          // Video is taller than canvas - fit to width, center vertically
          drawHeight = canvas.width / videoAspect
          drawY = (canvas.height - drawHeight) / 2
        }

        ctx.drawImage(webcamSource as CanvasImageSource, drawX, drawY, drawWidth, drawHeight)
      }
      // Skip to watermark/REC indicator
    } else {
      // Determine which is "left" and which is "right" based on webcamPosition
      const isLeftPos = webcamPosition === "left" || webcamPosition === "left-center"
      const leftSource = isLeftPos ? webcamSource : mainVideo
      const rightSource = isLeftPos ? mainVideo : webcamSource
      const hasLeft = isLeftPos ? hasWebcam : hasMainVideo
      const hasRight = isLeftPos ? hasMainVideo : hasWebcam

    // Helper to get dimensions from either video or canvas
    const getSourceDimensions = (source: HTMLVideoElement | HTMLCanvasElement | null) => {
      if (!source) return { width: 0, height: 0 }
      if (source instanceof HTMLVideoElement) {
        return { width: source.videoWidth, height: source.videoHeight }
      } else if (source instanceof HTMLCanvasElement) {
        return { width: source.width, height: source.height }
      }
      return { width: 0, height: 0 }
    }

    // Layout-specific drawing logic
    if ((webcamPosition === "left-center" || webcamPosition === "right-center") && (layoutMode === "side-by-side" || layoutMode === "stacked")) {
      // Full-height webcam strip: webcam takes aspect-preserved width, video fills remaining space
      const webcamOnLeft = webcamPosition === "left-center"

      if (hasWebcam && webcamSource) {
        // Calculate webcam strip width based on aspect ratio to fill full height
        const { width: wcWidth, height: wcHeight } = getSourceDimensions(webcamSource as any)
        const wcAspect = wcWidth / wcHeight
        const stripWidth = canvas.height * wcAspect
        const clampedStripWidth = Math.min(stripWidth, canvas.width * 0.4) // Max 40% of canvas

        const stripX = webcamOnLeft ? 0 : canvas.width - clampedStripWidth
        const videoX = webcamOnLeft ? clampedStripWidth : 0
        const videoAreaWidth = canvas.width - clampedStripWidth

        // Draw webcam at full height, centered in strip
        const actualDrawWidth = canvas.height * wcAspect
        const wcDrawX = stripX + (clampedStripWidth - actualDrawWidth) / 2
        ctx.drawImage(webcamSource as CanvasImageSource, wcDrawX, 0, actualDrawWidth, canvas.height)

        // Draw main video in remaining space, aspect-preserved
        if (hasMainVideo && mainVideo) {
          const vidAspect = mainVideo.videoWidth / mainVideo.videoHeight
          let vw = videoAreaWidth
          let vh = videoAreaWidth / vidAspect
          if (vh > canvas.height) {
            vh = canvas.height
            vw = canvas.height * vidAspect
          }
          const vx = videoX + (videoAreaWidth - vw) / 2
          const vy = (canvas.height - vh) / 2
          ctx.drawImage(mainVideo, vx, vy, vw, vh)
        }

        // Draw divider line
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)'
        ctx.lineWidth = 2
        ctx.beginPath()
        const divX = webcamOnLeft ? clampedStripWidth : canvas.width - clampedStripWidth
        ctx.moveTo(divX, 0)
        ctx.lineTo(divX, canvas.height)
        ctx.stroke()
      } else if (hasMainVideo && mainVideo) {
        // No webcam, draw video fullscreen
        const vidAspect = mainVideo.videoWidth / mainVideo.videoHeight
        const canvasAspect = canvas.width / canvas.height
        let dw = canvas.width, dh = canvas.height, dx = 0, dy = 0
        if (vidAspect > canvasAspect) {
          dh = canvas.width / vidAspect
          dy = (canvas.height - dh) / 2
        } else {
          dw = canvas.height * vidAspect
          dx = (canvas.width - dw) / 2
        }
        ctx.drawImage(mainVideo, dx, dy, dw, dh)
      }

    } else if (layoutMode === "side-by-side") {
      // Side by side: dynamic split
      const leftWidth = (canvas.width * sideBySideSplit) / 100
      const rightWidth = canvas.width - leftWidth

      // Draw left side
      if (hasLeft && leftSource) {
        const { width: lw, height: lh } = getSourceDimensions(leftSource as any)
        if (lw > 0 && lh > 0) {
          const aspect = lw / lh
          let drawWidth = leftWidth
          let drawHeight = leftWidth / aspect
          if (drawHeight > canvas.height) {
            drawHeight = canvas.height
            drawWidth = canvas.height * aspect
          }
          const drawX = (leftWidth - drawWidth) / 2
          const drawY = (canvas.height - drawHeight) / 2
          ctx.drawImage(leftSource as CanvasImageSource, drawX, drawY, drawWidth, drawHeight)
        }
      }

      // Draw right side
      if (hasRight && rightSource) {
        const { width: rw, height: rh } = getSourceDimensions(rightSource as any)
        if (rw > 0 && rh > 0) {
          const aspect = rw / rh
          let drawWidth = rightWidth
          let drawHeight = rightWidth / aspect
          if (drawHeight > canvas.height) {
            drawHeight = canvas.height
            drawWidth = canvas.height * aspect
          }
          const drawX = leftWidth + (rightWidth - drawWidth) / 2
          const drawY = (canvas.height - drawHeight) / 2
          ctx.drawImage(rightSource as CanvasImageSource, drawX, drawY, drawWidth, drawHeight)
        }
      }

      // Draw divider line
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(leftWidth, 0)
      ctx.lineTo(leftWidth, canvas.height)
      ctx.stroke()

    } else if (layoutMode === "stacked") {
      // Stacked: dynamic vertical split (top/bottom)
      const topHeight = (canvas.height * stackedSplit) / 100
      const bottomHeight = canvas.height - topHeight

      // Draw top (webcam if position is "left", video if "right")
      const topSource = webcamPosition === "left" ? webcamSource : mainVideo
      const bottomSource = webcamPosition === "left" ? mainVideo : webcamSource
      const hasTop = webcamPosition === "left" ? hasWebcam : hasMainVideo
      const hasBottom = webcamPosition === "left" ? hasMainVideo : hasWebcam

      if (hasTop && topSource) {
        const { width: topW, height: topH } = getSourceDimensions(topSource as any)
        const aspect = topW / topH
        let drawWidth = canvas.width
        let drawHeight = canvas.width / aspect
        if (drawHeight > topHeight) {
          drawHeight = topHeight
          drawWidth = topHeight * aspect
        }
        const drawX = (canvas.width - drawWidth) / 2
        const drawY = (topHeight - drawHeight) / 2
        ctx.drawImage(topSource as CanvasImageSource, drawX, drawY, drawWidth, drawHeight)
      }

      if (hasBottom && bottomSource) {
        const { width: bottomW, height: bottomH } = getSourceDimensions(bottomSource as any)
        const aspect = bottomW / bottomH
        let drawWidth = canvas.width
        let drawHeight = canvas.width / aspect
        if (drawHeight > bottomHeight) {
          drawHeight = bottomHeight
          drawWidth = bottomHeight * aspect
        }
        const drawX = (canvas.width - drawWidth) / 2
        const drawY = topHeight + (bottomHeight - drawHeight) / 2
        ctx.drawImage(bottomSource as CanvasImageSource, drawX, drawY, drawWidth, drawHeight)
      }

      // Draw divider line
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(0, topHeight)
      ctx.lineTo(canvas.width, topHeight)
      ctx.stroke()

    } else {
      // PiP mode
      // Draw main video fullscreen (aspect-ratio preserved)
      if (hasMainVideo && mainVideo) {
        const videoAspect = mainVideo.videoWidth / mainVideo.videoHeight
        const canvasAspect = canvas.width / canvas.height

        let drawWidth = canvas.width
        let drawHeight = canvas.height
        let drawX = 0
        let drawY = 0

        if (videoAspect > canvasAspect) {
          drawHeight = canvas.width / videoAspect
          drawY = (canvas.height - drawHeight) / 2
        } else {
          drawWidth = canvas.height * videoAspect
          drawX = (canvas.width - drawWidth) / 2
        }

        ctx.drawImage(mainVideo, drawX, drawY, drawWidth, drawHeight)
      }

      // Draw webcam PIP if available
      if (hasWebcam && webcamSource) {
        let pipWidth: number
        let pipHeight: number
        let pipX: number
        let pipY: number

        // Use custom PiP position if provided, otherwise use preset positions
        if (customPipPosition) {
          // Custom position: convert percentages to pixels
          pipX = (customPipPosition.x / 100) * canvas.width
          pipY = (customPipPosition.y / 100) * canvas.height
          pipWidth = (customPipPosition.width / 100) * canvas.width
          pipHeight = (customPipPosition.height / 100) * canvas.height
        } else {
          // BUG 4 FIX: Use height for portrait mode to make PiP proportionally appropriate
          const isPortrait = orientation === "vertical"
          const pipBaseSize = isPortrait ? canvas.height : canvas.width

          const { width: wcW, height: wcH } = getSourceDimensions(webcamSource as any)
          pipWidth = pipBaseSize * 0.25
          pipHeight = pipWidth * (wcH / wcW)

          // Position based on webcamPosition (4 corners for PiP modes)
          const margin = 20

          // Map old left/right to bottom corners for backwards compatibility
          const effectivePosition = webcamPosition === "left" ? "bottom-left"
            : webcamPosition === "right" ? "bottom-right"
            : webcamPosition

          switch (effectivePosition) {
            case "top-left":
              pipX = margin
              pipY = margin
              break
            case "top-right":
              pipX = canvas.width - pipWidth - margin
              pipY = margin
              break
            case "bottom-left":
              pipX = margin
              pipY = canvas.height - pipHeight - margin
              break
            case "bottom-right":
            default:
              pipX = canvas.width - pipWidth - margin
              pipY = canvas.height - pipHeight - margin
              break
          }
        }

        // Draw rounded rectangle border
        ctx.save()
        ctx.beginPath()
        const radius = 8
        ctx.moveTo(pipX + radius, pipY)
        ctx.lineTo(pipX + pipWidth - radius, pipY)
        ctx.quadraticCurveTo(pipX + pipWidth, pipY, pipX + pipWidth, pipY + radius)
        ctx.lineTo(pipX + pipWidth, pipY + pipHeight - radius)
        ctx.quadraticCurveTo(pipX + pipWidth, pipY + pipHeight, pipX + pipWidth - radius, pipY + pipHeight)
        ctx.lineTo(pipX + radius, pipY + pipHeight)
        ctx.quadraticCurveTo(pipX, pipY + pipHeight, pipX, pipY + pipHeight - radius)
        ctx.lineTo(pipX, pipY + radius)
        ctx.quadraticCurveTo(pipX, pipY, pipX + radius, pipY)
        ctx.closePath()
        ctx.clip()

        ctx.drawImage(webcamSource as CanvasImageSource, pipX, pipY, pipWidth, pipHeight)
        ctx.restore()

        // Draw border
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)'
        ctx.lineWidth = 2
        ctx.stroke()
      }
    }
    } // End of else block for non-webcam-only modes

    // Draw REC indicator when recording
    if (isRecording) {
      const indicatorX = 20
      const indicatorY = 30

      // Red dot
      ctx.beginPath()
      ctx.arc(indicatorX, indicatorY, 8, 0, Math.PI * 2)
      ctx.fillStyle = '#ef4444'
      ctx.fill()

      // Blinking effect
      const pulse = Math.sin(Date.now() / 300) * 0.3 + 0.7
      ctx.globalAlpha = pulse

      ctx.beginPath()
      ctx.arc(indicatorX, indicatorY, 12, 0, Math.PI * 2)
      ctx.strokeStyle = '#ef4444'
      ctx.lineWidth = 2
      ctx.stroke()
      ctx.globalAlpha = 1

      // Duration text
      const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000)
      const mins = Math.floor(elapsed / 60)
      const secs = elapsed % 60
      const timeText = `${mins}:${secs.toString().padStart(2, '0')}`

      ctx.font = 'bold 20px system-ui, sans-serif'
      ctx.fillStyle = '#fff'
      ctx.textBaseline = 'middle'
      ctx.fillText(timeText, indicatorX + 20, indicatorY)
    }

    // Draw watermark at dynamic position (skip when overlay is shown for dragging)
    if (watermarkText && showWatermarkOnCanvas) {
      ctx.save()

      // Determine font size based on watermark size setting
      const fontSize = watermarkSize === "custom"
        ? watermarkCustomSize
        : WATERMARK_FONT_SIZES[watermarkSize]

      // Resolve font family
      const fontFamilies: Record<string, string> = {
        "default": "system-ui, sans-serif",
        "monospace": "ui-monospace, monospace",
        "bold-condensed": "Impact, Haettenschweiler, sans-serif",
        "handwritten": "Comic Sans MS, cursive",
        "neon": "system-ui, sans-serif",
      }
      const fontFamily = fontFamilies[watermarkFont] || fontFamilies["default"]
      ctx.font = `bold ${fontSize}px ${fontFamily}`

      // Calculate position from percentage
      const posX = (watermarkPosition.x / 100) * canvas.width
      const posY = (watermarkPosition.y / 100) * canvas.height

      // Measure text for pill background
      const textMetrics = ctx.measureText(watermarkText)
      const paddingH = fontSize * 0.8
      const paddingV = fontSize * 0.4
      const pillWidth = textMetrics.width + paddingH * 2
      const pillHeight = fontSize + paddingV * 2
      const pillX = posX - pillWidth / 2
      const pillY = posY - pillHeight / 2

      // Draw background based on style
      if (watermarkBackground !== "none") {
        ctx.beginPath()
        ctx.roundRect(pillX, pillY, pillWidth, pillHeight, pillHeight / 2)

        if (watermarkBackground === "gradient") {
          const grad = ctx.createLinearGradient(pillX, pillY, pillX + pillWidth, pillY)
          grad.addColorStop(0, 'rgba(0, 0, 0, 0.8)')
          grad.addColorStop(1, 'rgba(30, 30, 30, 0.6)')
          ctx.fillStyle = grad
        } else if (watermarkBackground === "blur") {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.1)'
        } else {
          // solid
          ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'
        }
        ctx.fill()

        // Draw border (tinted to match text color)
        const borderColor = watermarkColor === "#ffffff" ? 'rgba(236, 72, 153, 0.5)'
          : `${watermarkColor}66`
        ctx.strokeStyle = borderColor
        ctx.lineWidth = 1
        ctx.stroke()
      }

      // Apply shadow
      if (watermarkShadow === "subtle") {
        ctx.shadowColor = 'rgba(0, 0, 0, 0.5)'
        ctx.shadowBlur = 4
        ctx.shadowOffsetX = 1
        ctx.shadowOffsetY = 1
      } else if (watermarkShadow === "strong") {
        ctx.shadowColor = 'rgba(0, 0, 0, 0.8)'
        ctx.shadowBlur = 8
        ctx.shadowOffsetX = 2
        ctx.shadowOffsetY = 2
      } else if (watermarkShadow === "neon-glow") {
        ctx.shadowColor = watermarkColor
        ctx.shadowBlur = 15
        ctx.shadowOffsetX = 0
        ctx.shadowOffsetY = 0
      }

      // Draw text with configured color
      ctx.fillStyle = watermarkFont === "neon"
        ? watermarkColor
        : `${watermarkColor}f2` // slight transparency
      ctx.textAlign = watermarkAlignment
      ctx.textBaseline = 'middle'
      ctx.fillText(watermarkText, posX, posY)

      // Double draw for neon glow effect
      if (watermarkFont === "neon") {
        ctx.shadowBlur = 20
        ctx.shadowColor = watermarkColor
        ctx.fillText(watermarkText, posX, posY)
      }

      ctx.restore()
    }
  }, [videoRef, webcamPosition, layoutMode, orientation, source, watermarkText, watermarkPosition, watermarkSize, watermarkCustomSize, watermarkFont, watermarkColor, watermarkShadow, watermarkBackground, watermarkAlignment, showWatermarkOnCanvas, isRecording, getCanvasDimensions, sideBySideSplit, stackedSplit, customPipPosition])

  // Preview animation loop
  useEffect(() => {
    let running = true
    let frameCount = 0

    const animate = () => {
      if (!running) return

      // Draw to preview canvas every frame
      if (previewCanvasRef.current) {
        drawFrame(previewCanvasRef.current)
      }

      // Draw to recording canvas only every 8th frame (~30fps on 240Hz displays)
      // Recording captures at 30fps so extra draws are wasted
      if (isRecording && recordingCanvasRef.current) {
        frameCount++
        if (frameCount >= 8) {
          drawFrame(recordingCanvasRef.current)
          frameCount = 0
        }
      }

      animationFrameRef.current = requestAnimationFrame(animate)
    }

    animate()

    return () => {
      running = false
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [drawFrame, isRecording])

  const startRecording = useCallback(async () => {
    try {
      // Generate sessionId for this recording
      const newSessionId = crypto.randomUUID()
      setSessionId(newSessionId)

      const { width, height } = getCanvasDimensions()

      // Create recording canvas
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      recordingCanvasRef.current = canvas

      // Get canvas stream at 30fps
      const canvasStream = canvas.captureStream(30)

      // Start raw webcam recording in parallel
      if (webcamStream) {
        try {
          const rawRecorder = new MediaRecorder(webcamStream, {
            mimeType: getSupportedMimeType(),
            videoBitsPerSecond: 5000000,
          })

          rawRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) rawChunksRef.current.push(e.data)
          }

          rawRecorder.onstop = async () => {
            try {
              const rawBlob = new Blob(rawChunksRef.current, {
                type: getSupportedMimeType(),
              })

              // Compute webcam crop region for Greek God extraction
              const { computeWebcamCropRegion } = await import('@/lib/clip-extractor')
              const cropRegion = computeWebcamCropRegion(
                width,
                height,
                source,
                layoutMode,
                webcamPosition,
                orientation
              )

              // Save to IndexedDB
              await saveRawRecording({
                sessionId: newSessionId,
                userId: 'current-user', // TODO: Get from auth context
                blob: rawBlob,
                createdAt: Date.now(),
                layoutMode,
                webcamPosition,
                orientation,
                source,
                cropRegion,
              })

              setRawRecordingAvailable(true)
            } catch (err) {
              console.error('[Recorder] Failed to save raw recording:', err)
            }
          }

          rawMediaRecorderRef.current = rawRecorder
          rawChunksRef.current = []
          rawRecorder.start(1000)
        } catch (err) {
          console.warn('[Recorder] Could not start raw recording:', err)
        }
      }

      // Set up audio mixing
      const audioContext = new AudioContext()
      audioContextRef.current = audioContext
      const destination = audioContext.createMediaStreamDestination()

      // Add video/screen audio if enabled (with volume control via GainNode)
      if (includeVideoAudio && screenVolume > 0) {
        // Try screen stream audio first
        if (screenStream && screenStream.getAudioTracks().length > 0) {
          try {
            const screenSource = audioContext.createMediaStreamSource(
              new MediaStream(screenStream.getAudioTracks())
            )
            // Add GainNode for screen volume control
            const screenGain = audioContext.createGain()
            screenGain.gain.value = screenVolume
            screenSource.connect(screenGain)
            screenGain.connect(destination)
          } catch (err) {
            console.warn('[Recorder] Could not capture screen audio:', err)
          }
        }

        // Try video element audio
        if (videoRef?.current) {
          try {
            const video = videoRef.current
            const videoStream = (video as any).captureStream?.() ||
              (video as any).mozCaptureStream?.()

            if (videoStream && videoStream.getAudioTracks().length > 0) {
              const videoSource = audioContext.createMediaStreamSource(
                new MediaStream(videoStream.getAudioTracks())
              )
              // Add GainNode for video audio volume control
              const videoGain = audioContext.createGain()
              videoGain.gain.value = screenVolume
              videoSource.connect(videoGain)
              videoGain.connect(destination)
            }
          } catch (err) {
            console.warn('[Recorder] Could not capture video audio:', err)
          }
        }
      }

      // Add microphone if enabled (with volume control via GainNode)
      if (includeMicAudio && micVolume > 0) {
        try {
          const micStream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
            }
          })
          const micSource = audioContext.createMediaStreamSource(micStream)
          // Add GainNode for mic volume control
          const micGain = audioContext.createGain()
          micGain.gain.value = micVolume
          micSource.connect(micGain)
          micGain.connect(destination)
        } catch (err) {
          console.warn('[Recorder] Could not capture microphone:', err)
        }
      }

      // Warn if no audio tracks were captured
      if (destination.stream.getAudioTracks().length === 0) {
        console.warn('[Recorder] No audio tracks captured. Recording will have no audio.')
        onError?.('No audio sources available. Recording will have no sound.')
      }

      // Combine video and audio streams
      const combinedStream = new MediaStream([
        ...canvasStream.getVideoTracks(),
        ...destination.stream.getAudioTracks(),
      ])

      // Create MediaRecorder with codec fallback
      const mimeType = getSupportedMimeType()
      const recorder = new MediaRecorder(combinedStream, {
        mimeType,
        videoBitsPerSecond: 5000000, // 5 Mbps
      })
      mediaRecorderRef.current = recorder
      chunksRef.current = []

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data)
        }
      }

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType })
        onRecordingComplete?.(blob)

        // Cleanup
        if (audioContextRef.current) {
          audioContextRef.current.close()
        }
        recordingCanvasRef.current = null
      }

      // Start recording
      recorder.start(1000)
      startTimeRef.current = Date.now()
      setIsRecording(true)
      setRecordingDuration(0)

      // Start duration timer (clear any existing interval first to prevent race condition)
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current)
      }
      durationIntervalRef.current = setInterval(() => {
        setRecordingDuration(Math.floor((Date.now() - startTimeRef.current) / 1000))
      }, 1000)

    } catch (err) {
      console.error('[Recorder] Start error:', err)
      onError?.('Failed to start recording: ' + (err instanceof Error ? err.message : 'Unknown error'))
    }
  }, [getCanvasDimensions, includeVideoAudio, includeMicAudio, screenVolume, micVolume, screenStream, videoRef, onRecordingComplete, onError])

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }

    // Stop raw webcam recording
    if (rawMediaRecorderRef.current && rawMediaRecorderRef.current.state !== 'inactive') {
      rawMediaRecorderRef.current.stop()
    }

    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current)
      durationIntervalRef.current = null
    }

    setIsRecording(false)
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopRecording()
      stopScreenCapture()
      if (audioContextRef.current) {
        audioContextRef.current.close()
      }
    }
  }, [stopRecording, stopScreenCapture])

  return {
    startRecording,
    stopRecording,
    isRecording,
    recordingDuration,
    canRecord,
    layoutMode,
    setLayoutMode,
    webcamPosition,
    setWebcamPosition,
    orientation,
    setOrientation,
    previewCanvasRef,
    startScreenCapture,
    stopScreenCapture,
    screenStream,
    sideBySideSplit,
    setSideBySideSplit,
    stackedSplit,
    setStackedSplit,
    sessionId,
    rawRecordingAvailable,
    webcamVideoRef,
  }
}
