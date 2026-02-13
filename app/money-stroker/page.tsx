"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  ArrowLeft,
  ArrowRight,
  Film,
  Settings,
  Download,
  Share2,
  Webcam,
  Monitor,
  Video,
  Info,
  ChevronRight,
  Dumbbell,
  Scissors,
  Wand2,
  CheckCircle2,
  AlertCircle,
  Move,
  ChevronDown,
  ChevronUp,
  GripVertical,
  Zap,
  Bluetooth,
  Volume2,
  VolumeX,
  Mic,
  MicOff,
  RotateCcw,
  Maximize,
  Minimize,
  Copy,
  ExternalLink,
  Loader2,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Camera,
  Shield,
  Lock,
  Check,
  DollarSign,
  Coins,
  Award,
  Users,
  Trophy,
  User,
  Sun,
  Moon,
  ChevronsUpDown,
} from "lucide-react"
import {
  useMoneyStrokerRecorder,
  type RecordingSource,
  type RecordingLayoutMode,
  type WebcamPosition,
  type CanvasOrientation,
  type WatermarkPosition,
  type WebcamOrientation,
  type CustomPipPosition,
} from "@/hooks/use-money-stroker-recorder"
import {
  RecordingControls,
  SourceSelector,
  LayoutToggle,
  PositionToggle,
  OrientationToggle,
  TimelineScrubber,
  ClipPreview,
  VideoLibraryModal,
  AudioMeterBar,
  PipEditor,
  EdgeModeIndicator,
  ShortcutHelp,
  VideoQueue,
  WatermarkSettingsPanel,
  SplitDivider,
  InlineVideoPicker,
  EarningsPulse,
  PostRecordingSummary,
  AchievementProgressBar,
  FaceHiderSelector,
  CompanionOverlay,
  CustomVideoUploader,
  type CustomVideoSelection,
  DEFAULT_WATERMARK_SETTINGS,
  WATERMARK_FONTS,
  WATERMARK_COLORS,
  WATERMARK_ALIGNMENTS,
  getWatermarkText,
  type LibraryVideo,
  type PipPosition,
  type QueuedVideo,
  type WatermarkSettings,
} from "@/components/money-stroker"
import { deviceService } from "@/lib/device-service"
import { useRouter } from "next/navigation"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import { cn } from "@/lib/utils"
import Hls from "hls.js"
import { getVideoDuration, extractClip, extractFrame, extractFrameCropped, extractClipCropped, computeWebcamCropRegion, blobToBase64 } from "@/lib/clip-extractor"
import { getRawRecording, deleteRawRecording } from "@/lib/recording-session-storage"
import { useGreekGodJob } from "@/hooks/use-greek-god-job"
import { useMediaPipeFaceFilter } from "@/hooks/use-mediapipe-face-filter"
import { useNeedleFaceFilter } from "@/hooks/use-needle-face-filter"
import { FaceFilterSelector, is3DMask, getFilterGlbUrl, getScaleMultiplier } from "@/components/face-filter-selector"
import { processVideoPostEffects, type HeadRemovalConfig } from "@/lib/video-post-processor"
import { createBrowserSupabaseClient } from "@/lib/supabase-browser"
import { useApp } from "@/lib/app-context"
import { useFunscriptSync } from "@/hooks/use-funscript-sync"
import { useSessionCreditsRealtime } from "@/hooks/use-session-credits-realtime"
import { useCompanionOverlay } from "@/hooks/use-companion-overlay"
import { FunscriptVisualizerWidget } from "@/components/videos/funscript-visualizer-widget"

// Phases of the recording flow
type RecordingPhase = "setup" | "recording" | "review" | "clip-selection" | "processing" | "complete"

// Recording Tips Accordion
function RecordingTipsAccordion() {
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <div className="border-t border-white/5 mt-4 pt-4">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between w-full text-left group"
      >
        <span className="text-xs text-white/50 group-hover:text-white/70 transition-colors flex items-center gap-2">
          <Info className="w-3.5 h-3.5" />
          Tips for best results
        </span>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-white/40" />
        ) : (
          <ChevronDown className="w-4 h-4 text-white/40" />
        )}
      </button>
      {isExpanded && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="mt-3 space-y-2 text-xs text-white/50"
        >
          <p>• Aim your cam at the action. Viewers want to see the toy moving.</p>
          <p>• Good lighting = more views. Bright rooms perform way better.</p>
          <p>• Keep audio on. Moans and reactions drive engagement.</p>
          <p>• Horizontal works best for posting to porn sites.</p>
        </motion.div>
      )}
    </div>
  )
}

export default function MoneyStrokerPage() {
  // App context for device
  const { device } = useApp()

  // Recording state - default to video library for best UX
  const [source, setSource] = useState<RecordingSource>("video")
  const [webcamEnabled, setWebcamEnabled] = useState(true)
  const [webcamStream, setWebcamStream] = useState<MediaStream | null>(null)
  const [webcamOrientation, setWebcamOrientation] = useState<WebcamOrientation>("landscape")

  // Face filter state
  const [faceFilterEnabled, setFaceFilterEnabled] = useState(true)
  const [selectedFilterId, setSelectedFilterId] = useState('raccoon')
  const [maskScale, setMaskScale] = useState(0.45)
  const needleOutputCanvasRef = useRef<HTMLCanvasElement | null>(null) // Face filter output canvas

  // Custom PiP position state (FEATURE 1: draggable/resizable PiP)
  const [customPipPosition, setCustomPipPosition] = useState<PipPosition | null>(null)
  const [webcamAspectRatio, setWebcamAspectRatio] = useState(16 / 9) // Default until webcam loads

  // Microphone stream for audio meter visualization
  const [micStream, setMicStream] = useState<MediaStream | null>(null)

  // Permission error states
  const [webcamError, setWebcamError] = useState<string | null>(null)
  const [micError, setMicError] = useState<string | null>(null)

  // Volume controls (0.0 to 1.0)
  const [screenVolume, setScreenVolume] = useState(1.0)
  const [audioUnlocked, setAudioUnlocked] = useState(false)
  const [micVolume, setMicVolume] = useState(1.0)
  const [micMuted, setMicMuted] = useState(false)
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null)
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null)
  const [phase, setPhase] = useState<RecordingPhase>("setup")

  // Max recording duration
  const [maxRecordingDuration, setMaxRecordingDuration] = useState(60) // seconds

  // Video library state
  const [showVideoLibrary, setShowVideoLibrary] = useState(false)
  const [selectedLibraryVideo, setSelectedLibraryVideo] = useState<LibraryVideo | null>(null)
  const libraryVideoRef = useRef<HTMLVideoElement | null>(null)
  const hlsRef = useRef<Hls | null>(null)
  const [videoCurrentTime, setVideoCurrentTime] = useState(0)
  const [videoDurationMs, setVideoDurationMs] = useState(0)
  const [libraryVideoReady, setLibraryVideoReady] = useState(false)
  const [libraryVideoError, setLibraryVideoError] = useState<string | null>(null)
  const [videoPlaying, setVideoPlaying] = useState(false)

  // Custom video upload state
  const [customVideoSelection, setCustomVideoSelection] = useState<CustomVideoSelection | null>(null)
  const customVideoRef = useRef<HTMLVideoElement | null>(null)
  const [customVideoReady, setCustomVideoReady] = useState(false)
  const [customVideoPlaying, setCustomVideoPlaying] = useState(false)

  // Router for navigation
  const router = useRouter()

  // Edge Mode state
  const [edgeMode, setEdgeMode] = useState(false)
  const [edgeModeIntensity, setEdgeModeIntensity] = useState(0.2) // 20% default
  const [edgeModeTimeout, setEdgeModeTimeout] = useState(30) // seconds
  const [edgeModeTimeRemaining, setEdgeModeTimeRemaining] = useState<number | null>(null)
  const edgeModeTimerRef = useRef<NodeJS.Timeout | null>(null)
  const previousSyncStateRef = useRef<{ time: number; wasSyncing: boolean } | null>(null)
  const toggleEdgeModeRef = useRef<() => void>(() => {})

  // Video Queue state
  const [videoQueue, setVideoQueue] = useState<QueuedVideo[]>([])
  const [currentQueueIndex, setCurrentQueueIndex] = useState(0)

  // Help overlay state
  const [showHelp, setShowHelp] = useState(false)

  // Brief toast feedback state
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const toastTimerRef = useRef<NodeJS.Timeout | null>(null)
  const showToast = useCallback((msg: string) => {
    setToastMessage(msg)
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    toastTimerRef.current = setTimeout(() => setToastMessage(null), 2000)
  }, [])

  // Pre-mute volumes for Shift+M toggle
  const [preMuteVolumes, setPreMuteVolumes] = useState<{ screen: number; mic: number } | null>(null)

  // Shift+Q double-press state
  const lastShiftQRef = useRef<number>(0)

  // First-time onboarding toast
  const [showOnboardingToast, setShowOnboardingToast] = useState(false)
  const ONBOARDING_SHOWN_KEY = "money_stroker_onboarding_shown"

  // Controls bar collapsed + lights off
  const [controlsCollapsed, setControlsCollapsed] = useState(false)
  const [lightsOff, setLightsOff] = useState(false)

  // Dim the global site navbar and Featurebase widget when lights are off
  // These are outside this component's tree so we target them directly
  // Featurebase loads async so we use a MutationObserver to catch it
  useEffect(() => {
    const applyOpacity = (el: HTMLElement) => {
      el.style.transition = 'opacity 500ms'
      el.style.opacity = lightsOff ? '0.15' : '1'
    }

    const navbar = document.querySelector('header.fixed') as HTMLElement | null
    if (navbar) applyOpacity(navbar)

    // Featurebase widget — may not exist yet
    const fb = document.querySelector('.featurebase-messenger-root') as HTMLElement | null
    if (fb) {
      applyOpacity(fb)
    }

    // Watch for Featurebase widget appearing in the DOM
    const observer = new MutationObserver(() => {
      const el = document.querySelector('.featurebase-messenger-root') as HTMLElement | null
      if (el) {
        applyOpacity(el)
        observer.disconnect()
      }
    })
    if (!fb) observer.observe(document.body, { childList: true, subtree: true })

    return () => {
      observer.disconnect()
      if (navbar) { navbar.style.opacity = '1'; navbar.style.transition = '' }
      const fbEl = document.querySelector('.featurebase-messenger-root') as HTMLElement | null
      if (fbEl) { fbEl.style.opacity = '1'; fbEl.style.transition = '' }
    }
  }, [lightsOff])

  // Advanced controls and onboarding
  const [showAdvancedControls, setShowAdvancedControls] = useState(false)
  const [onboardingStep, setOnboardingStep] = useState<number | null>(null)
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState(false)

  // Funscript sync for library videos
  const {
    isLoading: isFunscriptLoading,
    isReady: isFunscriptReady,
    isSyncing: isFunscriptSyncing,
    hasScript: videoHasScript,
    loadFunscript,
    startSync,
    stopSync,
    seekSync,
    funscript,
  } = useFunscriptSync({
    videoId: source === "video" ? (selectedLibraryVideo?.id || "") : undefined,
    customFunscript: source === "custom" ? customVideoSelection?.funscript : null,
    deviceConnected: device.connected,
  })

  // Companion overlay
  const companion = useCompanionOverlay()

  // Load funscript when library video is selected
  useEffect(() => {
    if (selectedLibraryVideo && device.connected && selectedLibraryVideo.has_script) {
      loadFunscript()
    }
  }, [selectedLibraryVideo, device.connected, loadFunscript])

  // Load custom funscript when device connects
  useEffect(() => {
    if (source === "custom" && customVideoSelection?.funscript && device.connected) {
      loadFunscript()
    }
  }, [source, customVideoSelection?.funscript, device.connected, loadFunscript])

  // Create custom video element when selection changes
  useEffect(() => {
    if (!customVideoSelection || source !== "custom") {
      customVideoRef.current = null
      setCustomVideoReady(false)
      setCustomVideoPlaying(false)
      return
    }

    const video = document.createElement("video")
    video.src = customVideoSelection.videoUrl
    video.muted = false
    video.volume = screenVolume
    video.playsInline = true
    video.loop = false

    const handleLoaded = () => {
      setCustomVideoReady(true)
      setVideoDurationMs(video.duration * 1000)
      // Auto-play on load
      video.play().catch(() => {})
    }

    const handleError = () => {
      setCustomVideoReady(false)
    }

    const handleTimeUpdate = () => {
      setVideoCurrentTime(video.currentTime * 1000)
    }

    const handlePlay = () => {
      setCustomVideoPlaying(true)
      if (isFunscriptReady && !isFunscriptSyncing) {
        startSync(video.currentTime * 1000)
      }
    }

    const handlePause = () => {
      setCustomVideoPlaying(false)
      if (isFunscriptSyncing) {
        stopSync()
      }
    }

    const handleSeeked = () => {
      if (isFunscriptSyncing) {
        seekSync(video.currentTime * 1000)
      }
    }

    video.addEventListener("loadedmetadata", handleLoaded)
    video.addEventListener("error", handleError)
    video.addEventListener("timeupdate", handleTimeUpdate)
    video.addEventListener("play", handlePlay)
    video.addEventListener("pause", handlePause)
    video.addEventListener("seeked", handleSeeked)

    video.load()
    customVideoRef.current = video

    return () => {
      video.removeEventListener("loadedmetadata", handleLoaded)
      video.removeEventListener("error", handleError)
      video.removeEventListener("timeupdate", handleTimeUpdate)
      video.removeEventListener("play", handlePlay)
      video.removeEventListener("pause", handlePause)
      video.removeEventListener("seeked", handleSeeked)
      video.pause()
      video.src = ""
      customVideoRef.current = null
      setCustomVideoReady(false)
      setCustomVideoPlaying(false)
    }
  }, [customVideoSelection, source]) // eslint-disable-line react-hooks/exhaustive-deps

  // Keep custom video volume in sync
  useEffect(() => {
    if (customVideoRef.current && source === "custom") {
      customVideoRef.current.volume = screenVolume
      customVideoRef.current.muted = screenVolume === 0
    }
  }, [screenVolume, source])

  // Cleanup blob URL on unmount or selection change
  useEffect(() => {
    return () => {
      if (customVideoSelection?.videoUrl) {
        URL.revokeObjectURL(customVideoSelection.videoUrl)
      }
    }
  }, [customVideoSelection?.videoUrl])

  // Sync volume when user changes it (enables audio)
  useEffect(() => {
    if (libraryVideoRef.current && screenVolume > 0) {
      libraryVideoRef.current.muted = false
      libraryVideoRef.current.volume = screenVolume
      setAudioUnlocked(true)
    }
  }, [screenVolume])

  // Track video playback time for funscript sync
  useEffect(() => {
    const video = libraryVideoRef.current
    if (!video) return

    const handleTimeUpdate = () => {
      setVideoCurrentTime(video.currentTime * 1000) // Convert to ms
    }

    const handleLoadedMetadata = () => {
      setVideoDurationMs(video.duration * 1000)
    }

    const handlePlay = () => {
      setVideoPlaying(true)
      if (isFunscriptReady && !isFunscriptSyncing) {
        startSync(video.currentTime * 1000)
      }
    }

    const handlePause = () => {
      setVideoPlaying(false)
      if (isFunscriptSyncing) {
        stopSync()
      }
    }

    const handleSeeked = () => {
      if (isFunscriptSyncing) {
        seekSync(video.currentTime * 1000)
      }
    }

    video.addEventListener("timeupdate", handleTimeUpdate)
    video.addEventListener("loadedmetadata", handleLoadedMetadata)
    video.addEventListener("play", handlePlay)
    video.addEventListener("pause", handlePause)
    video.addEventListener("seeked", handleSeeked)

    return () => {
      video.removeEventListener("timeupdate", handleTimeUpdate)
      video.removeEventListener("loadedmetadata", handleLoadedMetadata)
      video.removeEventListener("play", handlePlay)
      video.removeEventListener("pause", handlePause)
      video.removeEventListener("seeked", handleSeeked)
    }
  }, [isFunscriptReady, isFunscriptSyncing, startSync, stopSync, seekSync])

  // Check onboarding status on mount
  useEffect(() => {
    const seen = localStorage.getItem("money_stroker_onboarding_v4") === "true"
    setHasSeenOnboarding(seen)
    if (!seen) {
      setOnboardingStep(1) // Start onboarding
    }
  }, [])

  // Show onboarding toast on first visit
  useEffect(() => {
    const hasShown = localStorage.getItem(ONBOARDING_SHOWN_KEY) === "true"
    if (!hasShown) {
      // Delay the toast slightly for better UX
      const timer = setTimeout(() => {
        setShowOnboardingToast(true)
        localStorage.setItem(ONBOARDING_SHOWN_KEY, "true")
      }, 2000)
      return () => clearTimeout(timer)
    }
  }, [])

  // Handle ?greek-god=true query param
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get("greek-god") === "true") {
      setGreekGodEnabled(true)
    }
  }, [])

  // Hide onboarding toast after 5 seconds
  useEffect(() => {
    if (showOnboardingToast) {
      const timer = setTimeout(() => {
        setShowOnboardingToast(false)
      }, 5000)
      return () => clearTimeout(timer)
    }
  }, [showOnboardingToast])

  // Edge Mode toggle handler
  const toggleEdgeMode = useCallback(async () => {
    if (edgeMode) {
      // Exit edge mode - restore previous sync state
      setEdgeMode(false)
      setEdgeModeTimeRemaining(null)

      // Clear timeout timer
      if (edgeModeTimerRef.current) {
        clearInterval(edgeModeTimerRef.current)
        edgeModeTimerRef.current = null
      }

      // Restore funscript sync if it was playing
      if (previousSyncStateRef.current?.wasSyncing && libraryVideoRef.current) {
        const currentTime = libraryVideoRef.current.currentTime * 1000
        await startSync(currentTime)
      }
      previousSyncStateRef.current = null
    } else {
      // Enter edge mode - store current state and reduce stimulation
      const currentTime = libraryVideoRef.current?.currentTime ?? 0
      previousSyncStateRef.current = {
        time: currentTime * 1000,
        wasSyncing: isFunscriptSyncing,
      }

      // Stop current funscript sync
      if (isFunscriptSyncing) {
        await stopSync()
      }

      // Set manual low speed
      if (device.connected) {
        await deviceService.setSpeed(Math.round(edgeModeIntensity * 100))
      }

      setEdgeMode(true)

      // Start countdown timer
      if (edgeModeTimeout > 0) {
        setEdgeModeTimeRemaining(edgeModeTimeout)
        edgeModeTimerRef.current = setInterval(() => {
          setEdgeModeTimeRemaining((prev) => {
            if (prev === null || prev <= 1) {
              // Auto-exit edge mode via ref to avoid stale closure
              toggleEdgeModeRef.current()
              return null
            }
            return prev - 1
          })
        }, 1000)
      }
    }
  }, [edgeMode, edgeModeIntensity, edgeModeTimeout, isFunscriptSyncing, startSync, stopSync, device.connected])

  // Keep toggleEdgeMode ref in sync
  useEffect(() => {
    toggleEdgeModeRef.current = toggleEdgeMode
  }, [toggleEdgeMode])

  // Cleanup edge mode timer on unmount
  useEffect(() => {
    return () => {
      if (edgeModeTimerRef.current) {
        clearInterval(edgeModeTimerRef.current)
      }
    }
  }, [])

  // Video Queue handlers
  const addToQueue = useCallback((video: LibraryVideo) => {
    const maxQueueSize = 10
    if (videoQueue.length >= maxQueueSize) {
      showToast("Queue full (max 10)")
      return
    }

    // Check if already in queue
    if (videoQueue.some((v) => v.id === video.id)) {
      showToast("Already in queue")
      return
    }

    const queuedVideo: QueuedVideo = {
      id: video.id,
      name: video.name,
      thumbnail: video.thumbnail_url || "",
      duration: video.duration || 0,
      has_script: video.has_script || false,
      stream_url: video.stream_url,
      stream_url_selfhosted: video.stream_url_selfhosted,
    }
    setVideoQueue((prev) => [...prev, queuedVideo])
  }, [videoQueue])

  const removeFromQueue = useCallback((id: string) => {
    setVideoQueue((prev) => {
      const index = prev.findIndex((v) => v.id === id)
      const newQueue = prev.filter((v) => v.id !== id)

      // Adjust current index if necessary
      if (index < currentQueueIndex) {
        setCurrentQueueIndex((i) => Math.max(0, i - 1))
      } else if (index === currentQueueIndex && index >= newQueue.length) {
        setCurrentQueueIndex(Math.max(0, newQueue.length - 1))
      }

      return newQueue
    })
  }, [currentQueueIndex])

  const clearQueue = useCallback(() => {
    setVideoQueue([])
    setCurrentQueueIndex(0)
  }, [])

  const reorderQueue = useCallback((newQueue: QueuedVideo[]) => {
    setVideoQueue(newQueue)
  }, [])

  // Ref to hold the latest handleLibraryVideoSelect to avoid declaration order issue
  const handleLibraryVideoSelectRef = useRef<(video: LibraryVideo) => void>(() => {})

  const playQueueIndex = useCallback((index: number) => {
    if (index < 0 || index >= videoQueue.length) return

    const video = videoQueue[index]
    setCurrentQueueIndex(index)

    // Convert QueuedVideo back to LibraryVideo with stored stream URLs
    const libraryVideo: LibraryVideo = {
      id: video.id,
      name: video.name,
      thumbnail_url: video.thumbnail,
      duration: video.duration,
      has_script: video.has_script,
      stream_url: video.stream_url || null,
      stream_url_selfhosted: video.stream_url_selfhosted || null,
      views: 0,
      tags: null,
    }

    handleLibraryVideoSelectRef.current(libraryVideo)
  }, [videoQueue])

  const playNextInQueue = useCallback(() => {
    if (currentQueueIndex < videoQueue.length - 1) {
      playQueueIndex(currentQueueIndex + 1)
    }
  }, [currentQueueIndex, videoQueue.length, playQueueIndex])

  const playPreviousInQueue = useCallback(() => {
    if (currentQueueIndex > 0) {
      playQueueIndex(currentQueueIndex - 1)
    }
  }, [currentQueueIndex, playQueueIndex])

  // Auto-advance to next video when current video ends
  useEffect(() => {
    const video = libraryVideoRef.current
    if (!video) return

    const handleEnded = () => {
      if (videoQueue.length > 0 && currentQueueIndex < videoQueue.length - 1) {
        // Auto-advance to next video in queue
        console.log("[MoneyStroker] Video ended, advancing to next in queue")
        playNextInQueue()
      }
    }

    video.addEventListener("ended", handleEnded)
    return () => video.removeEventListener("ended", handleEnded)
  }, [videoQueue.length, currentQueueIndex, playNextInQueue])

  // Clip selection state
  const [videoDuration, setVideoDuration] = useState(0)
  const [clipStart, setClipStart] = useState(0)
  const [clipEnd, setClipEnd] = useState(5)
  const [extractedClipBlob, setExtractedClipBlob] = useState<Blob | null>(null)
  const [extractedClipUrl, setExtractedClipUrl] = useState<string | null>(null)
  const [isExtracting, setIsExtracting] = useState(false)
  const [extractionProgress, setExtractionProgress] = useState(0)

  // Greek God settings
  const [greekGodEnabled, setGreekGodEnabled] = useState(false)
  const [muscleIntensity, setMuscleIntensity] = useState([1.0])
  const [headRemoval, setHeadRemoval] = useState<"none" | "crop" | "mosaic">("none")

  // Greek God job polling
  const greekGodJob = useGreekGodJob()
  const [greekGodOutputUrl, setGreekGodOutputUrl] = useState<string | null>(null)

  // Face hider state
  const [faceHiderSelected, setFaceHiderSelected] = useState<string>("none")
  const [faceHiderProcessing, setFaceHiderProcessing] = useState(false)
  const [faceHiderApplied, setFaceHiderApplied] = useState(false)
  const [faceHiderOutputUrl, setFaceHiderOutputUrl] = useState<string | null>(null)

  // Post-processing state
  const [isPostProcessing, setIsPostProcessing] = useState(false)
  const [postProcessProgress, setPostProcessProgress] = useState(0)

  // Share state
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)

  // Head removal adjustable params
  const [cropLineY, setCropLineY] = useState(20)
  const [mosaicRegionY, setMosaicRegionY] = useState(0)
  const [mosaicRegionHeight, setMosaicRegionHeight] = useState(25)
  const [mosaicBlockSize, setMosaicBlockSize] = useState(12)

  // Watermark state with localStorage persistence
  const [affiliateCode] = useState("abc123") // TODO: Get from user profile
  const [watermarkSettings, setWatermarkSettings] = useState<WatermarkSettings>(DEFAULT_WATERMARK_SETTINGS)
  const [isDraggingWatermark, setIsDraggingWatermark] = useState(false)
  const [isEditingWatermark, setIsEditingWatermark] = useState(false)
  const [editingWatermarkText, setEditingWatermarkText] = useState("")
  const [showWatermarkSettings, setShowWatermarkSettings] = useState(false)

  // Derived watermark values for the recorder hook
  const watermarkText = getWatermarkText(watermarkSettings, affiliateCode)
  const watermarkPosition = watermarkSettings.position
  const watermarkSize = watermarkSettings.size
  const watermarkCustomSize = watermarkSettings.customSize

  // Load watermark preferences from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("money_stroker_watermark_settings")
    if (saved) {
      try {
        setWatermarkSettings((prev) => ({ ...prev, ...JSON.parse(saved) }))
      } catch {}
    }
  }, [])

  // Save watermark preferences to localStorage
  const updateWatermarkSettings = useCallback((partial: Partial<WatermarkSettings>) => {
    setWatermarkSettings((prev) => {
      const next = { ...prev, ...partial }
      localStorage.setItem("money_stroker_watermark_settings", JSON.stringify(next))
      return next
    })
  }, [])

  // Convenience wrapper for position updates (used by drag handler)
  const updateWatermarkPosition = useCallback((position: { x: number; y: number }) => {
    updateWatermarkSettings({ position })
  }, [updateWatermarkSettings])

  // Preview container ref for constraining webcam drag
  const previewContainerRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)

  // Fullscreen state
  const [isFullscreen, setIsFullscreen] = useState(false)

  // Initialize recorder hook
  const {
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
  } = useMoneyStrokerRecorder({
    // Use library video ref when in video mode, custom video ref for custom, otherwise standard videoRef
    videoRef: source === "video" ? libraryVideoRef : source === "custom" ? customVideoRef : videoRef,
    webcamStream,
    source, // BUG 2 FIX: Pass source for webcam-only fullscreen mode
    webcamOrientation, // BUG 5: Webcam orientation
    // FEATURE 1: Custom PiP position (only for PiP layouts)
    customPipPosition,
    // Face filters: use native canvas-based blur filtering
    faceFilterEnabled: faceFilterEnabled,
    faceFilterCanvasRef: faceFilterEnabled ? needleOutputCanvasRef : undefined,
    screenVolume, // BUG 6: Volume controls
    micVolume: micMuted ? 0 : micVolume, // BUG 6: Mic volume with mute support
    watermarkText,
    watermarkPosition,
    watermarkSize,
    watermarkCustomSize,
    watermarkFont: watermarkSettings.font,
    watermarkColor: WATERMARK_COLORS.find((c) => c.id === watermarkSettings.color)?.color
      || (watermarkSettings.color === "custom" ? watermarkSettings.customColor : "#ffffff"),
    watermarkShadow: watermarkSettings.shadow,
    watermarkBackground: watermarkSettings.background,
    watermarkAlignment: watermarkSettings.alignment,
    // BUG 3 FIX: Hide canvas watermark during setup (when draggable overlay is shown)
    // Show watermark on canvas during recording or any other phase
    showWatermarkOnCanvas: true,
    onRecordingComplete: (blob) => {
      setRecordedBlob(blob)
      const url = URL.createObjectURL(blob)
      setRecordedUrl(url)
      setPhase("review")
    },
    onError: (error) => {
      console.error("[MoneyStroker] Recording error:", error)
    },
  })

  // Face filter hooks: 3D masks use Needle Engine, blur uses MediaPipe
  // Both render to the same output canvas, which the recorder reads from
  const selected3DMask = is3DMask(selectedFilterId)
  useNeedleFaceFilter({
    enabled: faceFilterEnabled && selected3DMask,
    outputCanvasRef: needleOutputCanvasRef,
    glbUrl: getFilterGlbUrl(selectedFilterId),
    scale: maskScale * getScaleMultiplier(selectedFilterId),
  })

  useMediaPipeFaceFilter({
    enabled: faceFilterEnabled && !selected3DMask,
    blurAmount: selectedFilterId === 'blur_light' ? 15 : selectedFilterId === 'blur_heavy' ? 40 : 0,
    webcamVideoRef,
    outputCanvasRef: needleOutputCanvasRef,
  })

  // Session credits real-time tracking (must be after useMoneyStrokerRecorder for isRecording)
  const { sessionCredits, reset: resetSessionCredits } = useSessionCreditsRealtime(
    isRecording,
    device.connected,
    edgeMode
  )

  // FEATURE 1: Get default PiP position based on layout mode
  // NOTE: Must be defined AFTER useMoneyStrokerRecorder hook since it uses layoutMode
  const getDefaultPipPosition = useCallback((): PipPosition => {
    const pipSize = 40
    // Width% is relative to canvas width, height% is relative to canvas height
    // Must account for canvas aspect ratio to maintain correct PiP aspect ratio
    const canvasAspect = orientation === "horizontal" ? 16 / 9 : 9 / 16
    const pipHeight = (pipSize * canvasAspect) / webcamAspectRatio
    const margin = 2 // 2% margin

    // Default to bottom-left corner
    return {
      x: margin,
      y: 100 - pipHeight - margin,
      width: pipSize,
      height: pipHeight,
    }
  }, [layoutMode, webcamAspectRatio, orientation])

  // Eagerly initialize customPipPosition when entering PiP mode
  // This ensures the hook always receives explicit coordinates (never null)
  // and the PipEditor overlay matches the canvas rendering exactly
  // Also resets when orientation changes (canvas aspect ratio affects position math)
  useEffect(() => {
    if (layoutMode === "pip") {
      setCustomPipPosition(getDefaultPipPosition())
    } else {
      setCustomPipPosition(null)
    }
  }, [layoutMode, orientation]) // eslint-disable-line react-hooks/exhaustive-deps

  // Move PiP to selected corner when position arrows are clicked
  useEffect(() => {
    if (layoutMode !== "pip" || !customPipPosition) return

    const canvasAspect = orientation === "horizontal" ? 16 / 9 : 9 / 16
    const pipWidth = 40
    const pipHeight = (pipWidth * canvasAspect) / webcamAspectRatio
    const margin = 2

    // Map old left/right to bottom corners
    const pos = webcamPosition === "left" ? "bottom-left"
      : webcamPosition === "right" ? "bottom-right"
      : webcamPosition

    let x = customPipPosition.x
    let y = customPipPosition.y

    switch (pos) {
      case "top-left":
        x = margin
        y = margin
        break
      case "top-right":
        x = 100 - pipWidth - margin
        y = margin
        break
      case "bottom-left":
        x = margin
        y = 100 - pipHeight - margin
        break
      case "bottom-right":
      default:
        x = 100 - pipWidth - margin
        y = 100 - pipHeight - margin
        break
    }

    setCustomPipPosition(prev => prev ? { ...prev, x, y, width: pipWidth, height: pipHeight } : prev)
  }, [webcamPosition]) // eslint-disable-line react-hooks/exhaustive-deps

  // Initialize webcam (respects webcam orientation)
  useEffect(() => {
    if (!webcamEnabled) {
      if (webcamStream) {
        webcamStream.getTracks().forEach(track => track.stop())
        setWebcamStream(null)
      }
      return
    }

    const initWebcam = async () => {
      // Stop existing stream before starting new one
      if (webcamStream) {
        webcamStream.getTracks().forEach(track => track.stop())
      }

      try {
        // BUG 5 FIX: Use webcamOrientation to determine constraints
        const isPortrait = webcamOrientation === "portrait"
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: isPortrait ? 720 : 1280 },
            height: { ideal: isPortrait ? 1280 : 720 },
            facingMode: "user",
          },
          audio: false,
        })
        setWebcamStream(stream)

        // Track webcam aspect ratio for PiP editor
        const videoTrack = stream.getVideoTracks()[0]
        if (videoTrack) {
          const settings = videoTrack.getSettings()
          if (settings.width && settings.height) {
            setWebcamAspectRatio(settings.width / settings.height)
          }
        }
      } catch (err) {
        console.error("[MoneyStroker] Webcam error:", err)
        if (err instanceof DOMException && err.name === "NotAllowedError") {
          setWebcamError("Camera access denied. Check browser permissions.")
        } else {
          setWebcamError("Webcam not available. Check your camera connection.")
        }
      }
    }

    setWebcamError(null)
    initWebcam()

    return () => {
      if (webcamStream) {
        webcamStream.getTracks().forEach(track => track.stop())
      }
    }
  }, [webcamEnabled, webcamOrientation]) // eslint-disable-line react-hooks/exhaustive-deps

  // Initialize microphone stream for audio meter visualization
  useEffect(() => {
    let stream: MediaStream | null = null

    const initMic = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
          }
        })
        setMicStream(stream)
      } catch (err) {
        console.warn("[MoneyStroker] Mic access denied:", err)
        if (err instanceof DOMException && err.name === "NotAllowedError") {
          setMicError("Microphone access denied. Check browser permissions.")
        } else {
          setMicError("Microphone not available.")
        }
      }
    }

    setMicError(null)
    initMic()

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop())
      }
    }
  }, [])

  // Handle source change
  const handleSourceChange = useCallback(async (newSource: RecordingSource) => {
    // Stop current screen capture if switching away
    if (source === "screen" && newSource !== "screen") {
      stopScreenCapture()
    }

    // Pause and mute library video when switching away from video source
    if (source === "video" && newSource !== "video" && libraryVideoRef.current) {
      libraryVideoRef.current.pause()
      libraryVideoRef.current.muted = true
    }

    // Pause custom video when switching away
    if (source === "custom" && newSource !== "custom" && customVideoRef.current) {
      customVideoRef.current.pause()
    }

    setSource(newSource)

    // Start screen capture if selecting screen
    if (newSource === "screen") {
      await startScreenCapture()
    }

    // Resume library video when switching back to video source
    if (newSource === "video") {
      if (selectedLibraryVideo && libraryVideoRef.current) {
        libraryVideoRef.current.muted = false
        libraryVideoRef.current.volume = screenVolume
        libraryVideoRef.current.play().catch(() => {})
      } else {
        setShowVideoLibrary(true)
      }
    }

    // Resume custom video when switching back
    if (newSource === "custom" && customVideoSelection && customVideoRef.current) {
      customVideoRef.current.muted = false
      customVideoRef.current.volume = screenVolume
      customVideoRef.current.play().catch(() => {})
    }
  }, [source, stopScreenCapture, startScreenCapture, selectedLibraryVideo, screenVolume, customVideoSelection])

  // Handle library video selection - BUG 1 FIX: Add video to DOM for autoplay policy
  // BUG 2 FIX: Use proxy URL for HLS streams to bypass CDN referrer restrictions
  const handleLibraryVideoSelect = useCallback((video: LibraryVideo) => {
    setSelectedLibraryVideo(video)
    setShowVideoLibrary(false)
    setLibraryVideoReady(false)
    setLibraryVideoError(null)

    // Clean up previous HLS instance
    if (hlsRef.current) {
      hlsRef.current.destroy()
      hlsRef.current = null
    }

    // Clean up previous video element
    if (libraryVideoRef.current) {
      libraryVideoRef.current.pause()
      libraryVideoRef.current.src = ""
      libraryVideoRef.current.remove()
      libraryVideoRef.current = null
    }

    // Get video URL - use proxy for HLS streams to bypass CDN referrer restrictions
    const rawUrl = video.stream_url_selfhosted || video.stream_url

    // BUG 2 FIX: Use proxy endpoint for HLS streams
    const getProxyUrl = () => {
      if (video.id && (rawUrl?.includes('.m3u8'))) {
        // Proxy through our API to bypass CDN referrer restrictions
        return `/api/videos/${video.id}/stream/playlist.m3u8`
      }
      return rawUrl || ""
    }

    const videoUrl = getProxyUrl()
    const isHls = videoUrl.includes('.m3u8') || videoUrl.includes('/api/videos/')

    if (!videoUrl) {
      console.error("[MoneyStroker] No video URL available for:", video.name)
      setLibraryVideoError("No video URL available")
      return
    }

    console.log("[MoneyStroker] Loading video:", video.name, "URL:", videoUrl, "(HLS:", isHls, ")")

    // Create video element and add to DOM (required for autoplay policy)
    const videoEl = document.createElement("video")
    videoEl.muted = !audioUnlocked // Start muted for autoplay, unmute after interaction
    videoEl.loop = true
    videoEl.playsInline = true

    // For HLS streams served through our proxy, set crossOrigin
    if (videoUrl.startsWith('/api/')) {
      videoEl.crossOrigin = "anonymous"
    }

    // Hide the video element but keep it in DOM
    videoEl.style.position = "absolute"
    videoEl.style.width = "1px"
    videoEl.style.height = "1px"
    videoEl.style.opacity = "0"
    videoEl.style.pointerEvents = "none"
    videoEl.style.zIndex = "-1000"
    document.body.appendChild(videoEl)
    libraryVideoRef.current = videoEl

    // All handlers check videoEl is still current — prevents stale events
    // from old video elements (e.g., setting src="" during cleanup fires error)
    const handleCanPlay = () => {
      if (libraryVideoRef.current !== videoEl) return
      console.log("[MoneyStroker] Video canplay event fired, attempting playback")
      setLibraryVideoReady(true)
      videoEl.play().then(() => {
        if (libraryVideoRef.current !== videoEl) return
        if (screenVolume > 0) {
          videoEl.muted = false
          videoEl.volume = screenVolume
          setAudioUnlocked(true)
        }
      }).catch((err) => {
        if (libraryVideoRef.current !== videoEl) return
        console.error("[MoneyStroker] Video play failed after canplay:", err)
        setLibraryVideoError("Click to play video")
      })
    }

    const handleError = (e: Event) => {
      if (libraryVideoRef.current !== videoEl) return
      const error = (e.target as HTMLVideoElement).error
      console.error("[MoneyStroker] Video load error:", {
        code: error?.code,
        message: error?.message,
        url: videoUrl,
        videoName: video.name
      })
      setLibraryVideoError("Failed to load video - external source may be unavailable")
    }

    const handlePlaying = () => {
      if (libraryVideoRef.current !== videoEl) return
      setLibraryVideoReady(true)
      setLibraryVideoError(null)
    }

    videoEl.addEventListener("canplay", handleCanPlay, { once: true })
    videoEl.addEventListener("error", handleError, { once: true })
    videoEl.addEventListener("playing", handlePlaying)

    // BUG 2 FIX: Use HLS.js for m3u8 streams (most browsers except Safari need this)
    if (isHls && Hls.isSupported()) {
      console.log("[MoneyStroker] Initializing HLS.js for stream")
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
      })
      hlsRef.current = hls
      hls.loadSource(videoUrl)
      hls.attachMedia(videoEl)
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        console.log("[MoneyStroker] HLS manifest parsed, attempting playback")
        setLibraryVideoReady(true)
        videoEl.play().catch((err) => {
          console.error("[MoneyStroker] HLS play failed:", err)
          setLibraryVideoError("Click to play video")
        })
      })
      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          console.error("[MoneyStroker] HLS fatal error:", data)
          setLibraryVideoError("Failed to load HLS stream")
        }
      })
    } else if (isHls && videoEl.canPlayType("application/vnd.apple.mpegurl")) {
      // Safari native HLS support
      console.log("[MoneyStroker] Using native HLS support (Safari)")
      videoEl.src = videoUrl
      videoEl.load()
    } else {
      // Direct video file (mp4, webm, etc.)
      videoEl.src = videoUrl
      videoEl.load()
    }
  }, [])

  // Keep ref in sync for playQueueIndex
  useEffect(() => {
    handleLibraryVideoSelectRef.current = handleLibraryVideoSelect
  }, [handleLibraryVideoSelect])

  // Handle start recording
  const handleStartRecording = useCallback(async () => {
    // If source is screen and not capturing yet, start capture
    if (source === "screen" && !screenStream) {
      const stream = await startScreenCapture()
      if (!stream) return // User cancelled
    }

    setPhase("recording")
    try {
      await startRecording()
    } catch (err) {
      console.error("[MoneyStroker] Failed to start recording:", err)
      setPhase("setup")
    }
  }, [source, screenStream, startScreenCapture, startRecording])

  // Handle stop recording
  const handleStopRecording = useCallback(() => {
    stopRecording()
  }, [stopRecording])

  // Auto-stop when max duration reached
  useEffect(() => {
    if (isRecording && recordingDuration >= maxRecordingDuration) {
      handleStopRecording()
    }
  }, [isRecording, recordingDuration, maxRecordingDuration, handleStopRecording])

  // FEATURE 2: Toggle fullscreen
  const toggleFullscreen = useCallback(async () => {
    if (!previewContainerRef.current) return

    try {
      if (!isFullscreen) {
        await previewContainerRef.current.requestFullscreen()
      } else {
        await document.exitFullscreen()
      }
    } catch (err) {
      console.error("[MoneyStroker] Fullscreen error:", err)
    }
  }, [isFullscreen])

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }

    document.addEventListener("fullscreenchange", handleFullscreenChange)
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange)
  }, [])

  // Handle download
  const handleDownload = useCallback(() => {
    if (!recordedUrl || !recordedBlob) return

    const a = document.createElement("a")
    a.href = recordedUrl
    a.download = `money-stroker-${Date.now()}.webm`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }, [recordedUrl, recordedBlob])

  // Handle new recording
  const handleNewRecording = useCallback(() => {
    if (recordedUrl) {
      URL.revokeObjectURL(recordedUrl)
    }
    if (extractedClipUrl) {
      URL.revokeObjectURL(extractedClipUrl)
    }
    setRecordedBlob(null)
    setRecordedUrl(null)
    setExtractedClipBlob(null)
    setExtractedClipUrl(null)
    setVideoDuration(0)
    setClipStart(0)
    setClipEnd(5)
    setPhase("setup")
    // Clean up Greek God state
    greekGodJob.reset()
    setGreekGodOutputUrl(null)
    setShareUrl(null)
    setLinkCopied(false)
  }, [recordedUrl, extractedClipUrl, greekGodJob])

  // Handle clip selection change
  const handleClipSelect = useCallback((start: number, end: number) => {
    setClipStart(start)
    setClipEnd(end)
  }, [])

  // Load video duration when entering clip selection
  const handleEnterClipSelection = useCallback(async () => {
    if (!recordedBlob) return

    try {
      const duration = await getVideoDuration(recordedBlob)
      setVideoDuration(duration)
      setClipStart(0)
      setClipEnd(Math.min(5, duration))
      setPhase("clip-selection")
    } catch (err) {
      console.error("[MoneyStroker] Failed to get video duration:", err)
    }
  }, [recordedBlob])

  // Extract the selected clip (and optionally submit Greek God job)
  const handleExtractClip = useCallback(async () => {
    if (!recordedBlob) return

    setIsExtracting(true)
    setExtractionProgress(0)
    setShareUrl(null)
    setGreekGodOutputUrl(null)

    try {
      const clipBlob = await extractClip(recordedBlob, clipStart, clipEnd, {
        onProgress: (progress) => setExtractionProgress(progress),
      })

      // Cleanup old URL
      if (extractedClipUrl) {
        URL.revokeObjectURL(extractedClipUrl)
      }

      const url = URL.createObjectURL(clipBlob)
      setExtractedClipBlob(clipBlob)
      setExtractedClipUrl(url)
      setPhase("processing")

      // Submit Greek God job if enabled
      if (greekGodEnabled) {
        const canvasW = orientation === "vertical" ? 1080 : 1920
        const canvasH = orientation === "vertical" ? 1920 : 1080
        const cropRegion = computeWebcamCropRegion(canvasW, canvasH, source, layoutMode, webcamPosition, orientation)

        if (cropRegion) {
          try {
            // Try to use raw recording from IndexedDB (unfiltered webcam)
            let sourceBlob = clipBlob
            if (sessionId && rawRecordingAvailable) {
              try {
                const rawSession = await getRawRecording(sessionId)
                if (rawSession) {
                  sourceBlob = rawSession.blob
                  console.log('[MoneyStroker] Using raw unfiltered webcam recording for Greek God')
                }
              } catch (err) {
                console.warn('[MoneyStroker] Could not retrieve raw recording, using composited:', err)
              }
            }

            // Extract first frame for Greek God transform
            const frameBlob = await extractFrameCropped(sourceBlob, 0.1, cropRegion)
            const frameBase64 = await blobToBase64(frameBlob)

            // Also extract cropped webcam video clip for full pipeline
            // Target WAN 2.2 native portrait resolution
            const isPortrait = cropRegion.height > cropRegion.width
            const targetW = isPortrait ? 720 : 1280
            const targetH = isPortrait ? 1280 : 720
            const webcamClipBlob = await extractClipCropped(
              sourceBlob, 0, clipEnd - clipStart, cropRegion, targetW, targetH
            )

            const formData = new FormData()
            formData.append('file', new File([webcamClipBlob], 'webcam-clip.webm', { type: webcamClipBlob.type }))
            formData.append('firstFrame', frameBase64)
            formData.append('loraStrength', String(muscleIntensity[0]))
            formData.append('animateVideo', 'true')
            await greekGodJob.submitJob(formData)

            // Clean up raw recording from IndexedDB after submission
            if (sessionId && rawRecordingAvailable) {
              try {
                await deleteRawRecording(sessionId)
                console.log('[MoneyStroker] Cleaned up raw recording from IndexedDB')
              } catch (err) {
                console.warn('[MoneyStroker] Could not cleanup raw recording:', err)
              }
            }
          } catch (frameErr) {
            console.error("[MoneyStroker] Failed to extract webcam for Greek God:", frameErr)
          }
        }
      }
    } catch (err) {
      console.error("[MoneyStroker] Failed to extract clip:", err)
    } finally {
      setIsExtracting(false)
    }
  }, [recordedBlob, clipStart, clipEnd, extractedClipUrl, greekGodEnabled, orientation, source, layoutMode, webcamPosition, muscleIntensity, greekGodJob])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recordedUrl) {
        URL.revokeObjectURL(recordedUrl)
      }
      if (extractedClipUrl) {
        URL.revokeObjectURL(extractedClipUrl)
      }
      // BUG 2 FIX: Cleanup HLS instance
      if (hlsRef.current) {
        hlsRef.current.destroy()
        hlsRef.current = null
      }
      // BUG 1 FIX: Cleanup library video element from DOM
      if (libraryVideoRef.current) {
        libraryVideoRef.current.pause()
        libraryVideoRef.current.src = ""
        libraryVideoRef.current.remove()
        libraryVideoRef.current = null
      }
    }
  }, [recordedUrl, extractedClipUrl])

  // Auto-disable Greek God when switching to PiP layouts
  useEffect(() => {
    if (layoutMode === "pip") {
      setGreekGodEnabled(false)
    }
  }, [layoutMode])

  // Resume Greek God job polling on remount
  useEffect(() => {
    if (greekGodJob.isProcessing && phase !== "processing") {
      setPhase("processing")
      setGreekGodEnabled(true)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Watch for Greek God job completion
  useEffect(() => {
    if (greekGodJob.isComplete && greekGodJob.resultUrl) {
      setGreekGodOutputUrl(greekGodJob.resultUrl)
    }
  }, [greekGodJob.isComplete, greekGodJob.resultUrl])

  // Check if ready to record
  const isReadyToRecord = webcamEnabled && webcamStream && (
    source === "webcam-only" ||
    (source === "screen" && screenStream) ||
    (source === "video" && selectedLibraryVideo && libraryVideoReady) ||
    (source === "custom" && customVideoSelection && customVideoReady)
  )

  // Compute reason why recording is blocked (for tooltip)
  const recordingDisabledReason = (() => {
    if (!canRecord) return "Recording not supported in this browser"
    if (!webcamEnabled) return "Enable webcam to start recording"
    if (!webcamStream) return "Waiting for webcam access..."
    if (source === "screen" && !screenStream) return "Share your screen first"
    if (source === "video" && !selectedLibraryVideo) return "Select a video first"
    if (source === "custom" && !customVideoSelection) return "Upload a video first"
    if (source === "custom" && !customVideoReady) return "Waiting for video to load..."
    if (source === "video" && !libraryVideoReady) return "Waiting for video to load..."
    return undefined
  })()

  // FEATURE 3: Keyboard shortcuts (comprehensive hands-free operation)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle shortcuts when typing in inputs, interacting with sliders, or when help overlay is open
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }
      if ((e.target as HTMLElement)?.closest('[data-slot="slider-thumb"]')) {
        return
      }

      const key = e.key.toLowerCase()
      const isShift = e.shiftKey

      // Handle Escape separately
      if (e.key === "Escape") {
        e.preventDefault()
        if (showHelp) {
          setShowHelp(false)
        } else if (isFullscreen) {
          document.exitFullscreen().catch(() => {})
        } else if (showVideoLibrary) {
          setShowVideoLibrary(false)
        }
        return
      }

      // Handle ? for help (needs to check actual character)
      if (e.key === "?") {
        e.preventDefault()
        setShowHelp((prev) => !prev)
        return
      }

      switch (key) {
        case " ": // Space - Pause/play video
          e.preventDefault()
          {
            const video = source === "video" ? libraryVideoRef.current
              : source === "custom" ? customVideoRef.current
              : null
            if (video) {
              if (video.paused) video.play()
              else video.pause()
            }
          }
          break

        case "r": // R - Start/stop recording
          if (phase === "setup" || phase === "recording") {
            if (isRecording) {
              handleStopRecording()
            } else if (isReadyToRecord) {
              handleStartRecording()
            }
          }
          break

        case "m": // M - Mute/unmute mic, Shift+M - Mute/unmute all audio
          if (isShift) {
            if (preMuteVolumes) {
              // Restore previous volumes
              setScreenVolume(preMuteVolumes.screen)
              setMicMuted(false)
              setMicVolume(preMuteVolumes.mic)
              setPreMuteVolumes(null)
              showToast("Audio restored")
            } else {
              // Store current volumes and mute all
              setPreMuteVolumes({ screen: screenVolume, mic: micVolume })
              setMicMuted(true)
              setScreenVolume(0)
              showToast("All audio muted")
            }
          } else {
            setMicMuted((prev) => !prev)
          }
          break

        case "arrowleft": // Left arrow - Seek video back 5 seconds
          e.preventDefault()
          {
            const video = source === "video" ? libraryVideoRef.current
              : source === "custom" ? customVideoRef.current
              : null
            if (video) video.currentTime = Math.max(0, video.currentTime - 5)
          }
          break

        case "arrowright": // Right arrow - Seek video forward 5 seconds
          e.preventDefault()
          {
            const video = source === "video" ? libraryVideoRef.current
              : source === "custom" ? customVideoRef.current
              : null
            if (video) video.currentTime = Math.min(video.duration || 0, video.currentTime + 5)
          }
          break

        case "arrowup": // Up arrow - Increase intensity
          e.preventDefault()
          if (device.connected) {
            deviceService.getState().then((state) => {
              if (state) {
                const newSpeed = Math.min(100, state.currentSpeed + 10)
                deviceService.setSpeed(newSpeed)
              }
            })
          }
          break

        case "arrowdown": // Down arrow - Decrease intensity
          e.preventDefault()
          if (device.connected) {
            deviceService.getState().then((state) => {
              if (state) {
                const newSpeed = Math.max(0, state.currentSpeed - 10)
                deviceService.setSpeed(newSpeed)
              }
            })
          }
          break

        case "f": // F - Toggle fullscreen
          e.preventDefault()
          toggleFullscreen()
          break

        case "e": // E - Toggle edge mode, Shift+E - Force exit edge mode
          e.preventDefault()
          if (isShift && edgeMode) {
            // Force exit edge mode
            toggleEdgeMode()
          } else if (!isShift) {
            // Only allow entering edge mode if device is connected (exiting is always allowed)
            if (!edgeMode && !device.connected) break
            toggleEdgeMode()
          }
          break

        case "v": // V - Open video library
          e.preventDefault()
          setShowVideoLibrary(true)
          break

        case "q": // Q - Add to queue, Shift+Q - Clear queue (double-press)
          e.preventDefault()
          if (isShift) {
            const now = Date.now()
            if (now - lastShiftQRef.current < 2000) {
              clearQueue()
              showToast("Queue cleared")
              lastShiftQRef.current = 0
            } else {
              lastShiftQRef.current = now
              showToast("Press Shift+Q again to clear queue")
            }
          } else if (selectedLibraryVideo) {
            addToQueue(selectedLibraryVideo)
          }
          break

        case "+": // + - Add to queue
        case "=": // = (unshifted +)
          e.preventDefault()
          if (selectedLibraryVideo) {
            addToQueue(selectedLibraryVideo)
          }
          break

        case "n": // N - Next video in queue
          e.preventDefault()
          if (videoQueue.length === 0) {
            showToast("Queue empty. Press Q to add videos.")
          } else if (currentQueueIndex >= videoQueue.length - 1) {
            showToast("Already at last video")
          } else {
            playNextInQueue()
          }
          break

        case "p": // P - Previous video in queue
          e.preventDefault()
          if (videoQueue.length === 0) {
            showToast("Queue empty. Press Q to add videos.")
          } else if (currentQueueIndex <= 0) {
            showToast("Already at first video")
          } else {
            playPreviousInQueue()
          }
          break

        case "t": // T - Reconnect toy (device)
          e.preventDefault()
          // Trigger device reconnection via app context
          // This would typically be handled by a device modal
          console.log("[MoneyStroker] Reconnect toy shortcut pressed")
          break

        case "d": // D - Device settings
          e.preventDefault()
          // Would open device settings panel
          console.log("[MoneyStroker] Device settings shortcut pressed")
          break

        case "l": // L - Toggle lights off
          e.preventDefault()
          setLightsOff((prev) => !prev)
          break

        case "h": // H - Show help overlay
          e.preventDefault()
          setShowHelp((prev) => !prev)
          break

        case "c": // C - Toggle companion overlay
          if (!e.ctrlKey && !e.metaKey && !e.altKey) {
            e.preventDefault()
            companion.toggleVisibility()
          }
          break

        case "1": // 1 - Companion: talk dirty
          if (companion.isVisible) {
            e.preventDefault()
            companion.triggerAction("talk_dirty")
          }
          break

        case "2": // 2 - Companion: encourage
          if (companion.isVisible) {
            e.preventDefault()
            companion.triggerAction("encourage")
          }
          break

        case "3": // 3 - Companion: tease
          if (companion.isVisible) {
            e.preventDefault()
            companion.triggerAction("tease")
          }
          break

        case "b": // B - Go back (guarded during recording)
          e.preventDefault()
          if (isRecording) {
            if (confirm("You're currently recording. Leave and lose the recording?")) {
              handleStopRecording()
              router.back()
            }
          } else {
            router.back()
          }
          break

        case "[": // [ - Volume down
          e.preventDefault()
          setScreenVolume((prev) => Math.max(0, prev - 0.1))
          break

        case "]": // ] - Volume up
          e.preventDefault()
          setScreenVolume((prev) => Math.min(1, prev + 0.1))
          break

        // Quick select videos 1-9
        case "1":
        case "2":
        case "3":
        case "4":
        case "5":
        case "6":
        case "7":
        case "8":
        case "9":
          // Only when video library is open
          if (showVideoLibrary) {
            e.preventDefault()
            // This would require the VideoLibraryModal to expose a way to select by index
            console.log(`[MoneyStroker] Quick select video ${key}`)
          }
          break
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [
    source,
    phase,
    isRecording,
    isReadyToRecord,
    handleStartRecording,
    handleStopRecording,
    toggleFullscreen,
    showHelp,
    isFullscreen,
    showVideoLibrary,
    edgeMode,
    toggleEdgeMode,
    selectedLibraryVideo,
    addToQueue,
    clearQueue,
    playNextInQueue,
    playPreviousInQueue,
    device.connected,
    router,
    showToast,
    preMuteVolumes,
    screenVolume,
    micVolume,
    videoQueue,
    currentQueueIndex,
  ])

  // Onboarding overlay component
  const completeOnboarding = () => {
    localStorage.setItem("money_stroker_onboarding_v4", "true")
    setOnboardingStep(null)
    setHasSeenOnboarding(true)
  }

  const [demoLayout, setDemoLayout] = useState<RecordingLayoutMode>("side-by-side")
  const [demoPosition, setDemoPosition] = useState<WebcamPosition>("left")

  const OnboardingOverlay = () => {
    if (onboardingStep === null) return null

    const totalSteps = 5
    const actions = ["Got it", "Next", "Next", "Next", "Start Recording"]
    const titles = [
      "Allow Camera Access",
      "Pick Your Layout",
      "Record and Share",
      "Greek God + Face Hider",
      "Multiple Income Streams",
    ]

    const renderStepContent = () => {
      switch (onboardingStep) {
        case 1:
          return (
            <div className="flex flex-col items-center gap-5">
              <div className="relative w-64 h-36 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-lg border-2 border-white/10 flex items-center justify-center">
                <div className="bg-white rounded-lg shadow-xl p-3 w-52">
                  <p className="text-xs text-black mb-2">getgooned.io wants to:</p>
                  <div className="flex items-center gap-2 mb-2">
                    <Camera className="w-3.5 h-3.5 text-gray-600" />
                    <span className="text-xs text-black">Use your camera</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="flex-1 px-3 py-1 bg-gray-200 text-xs rounded text-center text-gray-700">Block</span>
                    <span className="flex-1 px-3 py-1 bg-blue-500 text-white text-xs rounded ring-2 ring-green-400 text-center">Allow</span>
                  </div>
                </div>
              </div>
              <div className="text-center">
                <p className="text-white/70 text-sm mb-2">
                  Your camera powers the recording AND the Greek God body transformer
                </p>
                <div className="flex items-center justify-center gap-4 text-white/50 text-xs">
                  <div className="flex items-center gap-1"><Camera className="w-3 h-3" /><span>Recording</span></div>
                  <div className="flex items-center gap-1"><Dumbbell className="w-3 h-3" /><span>Transform</span></div>
                  <div className="flex items-center gap-1"><Shield className="w-3 h-3" /><span>Face Hide</span></div>
                </div>
              </div>
            </div>
          )
        case 2:
          return (
            <div className="flex flex-col items-center gap-5">
              <div className="w-full max-w-xs">
                <LayoutToggle value={demoLayout} onChange={setDemoLayout} />
                <div className="mt-3">
                  <PositionToggle value={demoPosition} onChange={setDemoPosition} layoutMode={demoLayout} />
                </div>
                <div className="mt-4 h-28 bg-gradient-to-br from-pink-500/10 to-purple-500/10 rounded-lg border border-white/10 flex items-center justify-center relative overflow-hidden">
                  {demoLayout === "side-by-side" ? (
                    <div className="flex w-full h-full">
                      <div className={cn("flex-1 bg-pink-500/10 flex items-center justify-center border-r border-white/10", demoPosition === "right" && "order-2 border-r-0 border-l border-white/10")}>
                        <Play className="w-6 h-6 text-white/30" />
                      </div>
                      <div className={cn("w-1/3 bg-green-500/10 flex items-center justify-center", demoPosition === "right" && "order-1")}>
                        <Camera className="w-4 h-4 text-white/30" />
                      </div>
                    </div>
                  ) : demoLayout === "stacked" ? (
                    <div className="flex flex-col w-full h-full">
                      <div className="flex-1 bg-pink-500/10 flex items-center justify-center border-b border-white/10">
                        <Play className="w-6 h-6 text-white/30" />
                      </div>
                      <div className="h-1/3 bg-green-500/10 flex items-center justify-center">
                        <Camera className="w-4 h-4 text-white/30" />
                      </div>
                    </div>
                  ) : (
                    <div className="relative w-full h-full bg-pink-500/10 flex items-center justify-center">
                      <Play className="w-6 h-6 text-white/30" />
                      <div className="absolute bottom-2 right-2 w-12 h-10 bg-green-500/20 border border-white/20 rounded flex items-center justify-center">
                        <Camera className="w-3 h-3 text-white/30" />
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <p className="text-white/70 text-sm text-center max-w-md">
                Split screen recordings get more views on Reddit because they show what you feel
              </p>
            </div>
          )
        case 3:
          return (
            <div className="flex flex-col items-center gap-5">
              <div className="w-full max-w-xs">
                <div className="bg-black/50 rounded-lg border border-white/10 p-5 flex flex-col items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-red-500/80 flex items-center justify-center animate-pulse">
                    <span className="text-white font-bold text-xs">REC</span>
                  </div>
                  <div className="w-full bg-white/5 rounded px-3 py-2 border border-white/10">
                    <p className="text-[10px] text-white/50">Watermark:</p>
                    <p className="text-xs text-green-400 font-mono">getgooned.io/secret/xxxxx</p>
                  </div>
                </div>
              </div>
              <div className="text-center max-w-md space-y-2">
                <p className="text-white/70 text-sm">
                  Hit <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-xs">R</kbd> to record,{" "}
                  <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-xs">Space</kbd> to play/pause,{" "}
                  <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-xs">H</kbd> for all shortcuts
                </p>
                <p className="text-green-400 text-sm">
                  Your affiliate link is baked into every frame. Anyone who signs up = 15% commission, automatically.
                </p>
              </div>
            </div>
          )
        case 4:
          return (
            <div className="flex flex-col items-center gap-5">
              <div className="flex items-center gap-6 flex-wrap justify-center">
                <div className="flex items-center gap-3">
                  <div className="w-24 h-32 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-lg flex items-center justify-center relative">
                    <User className="w-10 h-10 text-white/30" />
                    <p className="absolute bottom-1 text-[9px] text-white/50">Before</p>
                  </div>
                  <ArrowRight className="w-5 h-5 text-white/40" />
                  <div className="w-24 h-32 bg-gradient-to-br from-orange-500/20 to-red-500/20 rounded-lg flex items-center justify-center relative">
                    <Dumbbell className="w-10 h-10 text-orange-400" />
                    <p className="absolute bottom-1 text-[9px] text-orange-400">After</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { name: "Blur", unlocked: true },
                    { name: "Cowboy", unlocked: true },
                    { name: "Shades", unlocked: true },
                    { name: "Ski Mask", unlocked: false, progress: 40 },
                    { name: "Alien", unlocked: false, progress: 10 },
                    { name: "Batman", unlocked: false, progress: 5 },
                  ].map((filter) => (
                    <div
                      key={filter.name}
                      className={cn(
                        "w-14 h-14 rounded-lg border-2 flex flex-col items-center justify-center relative",
                        filter.unlocked
                          ? "bg-green-500/20 border-green-500/50"
                          : "bg-white/5 border-white/10 opacity-50"
                      )}
                    >
                      {filter.unlocked ? (
                        <Check className="w-5 h-5 text-green-400" />
                      ) : (
                        <>
                          <Lock className="w-3 h-3 text-white/30" />
                          <div className="absolute bottom-1 w-10 h-1 bg-white/10 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-500" style={{ width: `${filter.progress}%` }} />
                          </div>
                        </>
                      )}
                      <p className="text-[7px] text-white/50 absolute -bottom-3.5">{filter.name}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="text-center max-w-lg space-y-1.5">
                <p className="text-white/70 text-sm">
                  Transform your body into a Greek God. Hide your face with cowboy hats, ski masks, and more.
                </p>
                <p className="text-blue-400 text-xs">
                  Face hiders unlock through recording milestones and achievements
                </p>
              </div>
            </div>
          )
        case 5:
          return (
            <div className="flex flex-col items-center gap-5">
              <div className="grid grid-cols-2 gap-3 w-full max-w-sm">
                <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                  <DollarSign className="w-4 h-4 text-green-400 mb-1.5" />
                  <p className="text-xs text-green-400 font-medium">15% commission</p>
                  <p className="text-[10px] text-white/40 mt-0.5">From your watermark link</p>
                </div>
                <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                  <Coins className="w-4 h-4 text-blue-400 mb-1.5" />
                  <p className="text-xs text-blue-400 font-medium">Session credits</p>
                  <p className="text-[10px] text-white/40 mt-0.5">Earned while you record</p>
                </div>
                <div className="p-3 bg-purple-500/10 border border-purple-500/30 rounded-lg">
                  <Dumbbell className="w-4 h-4 text-purple-400 mb-1.5" />
                  <p className="text-xs text-purple-400 font-medium">Fansly income</p>
                  <p className="text-[10px] text-white/40 mt-0.5">Post Greek God content</p>
                </div>
                <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                  <Award className="w-4 h-4 text-yellow-400 mb-1.5" />
                  <p className="text-xs text-yellow-400 font-medium">Achievements</p>
                  <p className="text-[10px] text-white/40 mt-0.5">Unlock filters and rewards</p>
                </div>
              </div>
              <div className="text-center max-w-lg space-y-1.5">
                <p className="text-white text-sm font-semibold">
                  A single 5 minute session fires all 4 earning streams simultaneously.
                </p>
                <p className="text-white/60 text-xs">Zero extra work.</p>
              </div>
            </div>
          )
        default:
          return null
      }
    }

    return (
      <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
        <div className="bg-[#141414] border border-green-500/30 rounded-xl p-6 max-w-lg w-full">
          {/* Step indicator dots */}
          <div className="flex items-center justify-center gap-2 mb-5">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <div
                key={i}
                className={cn(
                  "w-2 h-2 rounded-full transition-colors",
                  i + 1 === onboardingStep ? "bg-green-400" : i + 1 < onboardingStep ? "bg-green-400/40" : "bg-white/20"
                )}
              />
            ))}
          </div>

          <h3 className="text-lg font-semibold text-green-400 mb-4 text-center">
            {titles[onboardingStep - 1]}
          </h3>

          {renderStepContent()}

          <div className="flex items-center justify-between mt-6">
            <div className="flex items-center gap-2">
              <span className="text-xs text-white/40">
                {onboardingStep} of {totalSteps}
              </span>
              {onboardingStep > 1 && (
                <button
                  onClick={() => setOnboardingStep(onboardingStep - 1)}
                  className="text-xs text-white/40 hover:text-white/60 transition-colors"
                >
                  Back
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={completeOnboarding}
                className="text-xs text-white/40 hover:text-white/60 transition-colors"
              >
                Skip
              </button>
              <button
                onClick={() => {
                  if (onboardingStep === totalSteps) {
                    completeOnboarding()
                  } else {
                    setOnboardingStep(onboardingStep + 1)
                  }
                }}
                className="px-5 py-2 bg-green-500 hover:bg-green-600 text-black font-medium rounded-lg transition-colors"
              >
                {actions[onboardingStep - 1]}
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={cn("min-h-screen text-white transition-colors duration-500 [&_button:not(:disabled)]:cursor-pointer", lightsOff ? "bg-black" : "bg-[#0a0a0a]")}>
      {/* Lights Off overlay — dims entire page, canvas punches through via z-index */}
      {lightsOff && (
        <div
          className="fixed inset-0 bg-black/85 z-[45] pointer-events-none transition-opacity duration-500"
          aria-hidden="true"
        />
      )}

      {/* Header */}
      <header className={cn("sticky top-0 z-40 flex items-center justify-between px-4 py-3 backdrop-blur-md border-b transition-colors duration-500", lightsOff ? "bg-black border-white/5" : "bg-[#0a0a0a]/90 border-white/10")}>
        <button
          onClick={() => {
            if (phase === "setup") {
              router.back()
            } else {
              handleNewRecording()
            }
          }}
          className="flex items-center gap-2 text-white/70 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="text-sm">{phase === "setup" ? "Back" : "Back to Setup"}</span>
        </button>
        <h1 className="font-semibold flex items-center gap-2 text-sm sm:text-base">
          <Film className="w-5 h-5 text-green-400 flex-shrink-0" />
          <span className="hidden sm:inline">Your Sex Toy Pays For Itself. Yes, Really.</span>
          <span className="sm:hidden">Your Toy Pays For Itself</span>
        </h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowHelp((prev) => !prev)}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            title="Keyboard shortcuts (H)"
          >
            <Settings className="w-5 h-5 text-white/70" />
          </button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Phase: Setup & Recording */}
        {(phase === "setup" || phase === "recording") && (
          <>
            {/* Controls Bar */}
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-[#141414] rounded-xl border border-white/5"
            >
              {/* Collapse header */}
              <button
                onClick={() => setControlsCollapsed(!controlsCollapsed)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors rounded-xl"
              >
                <div className="flex items-center gap-2 text-sm text-white/60">
                  <Settings className="w-3.5 h-3.5" />
                  <span>Controls</span>
                  {controlsCollapsed && (
                    <span className="text-xs text-white/30 ml-1">
                      {source === "video" ? "Library" : source === "screen" ? "Screen" : "Webcam"}
                      {" / "}
                      {layoutMode === "pip" ? "PiP" : layoutMode === "side-by-side" ? "Side by Side" : "Stacked"}
                    </span>
                  )}
                </div>
                <ChevronsUpDown className="w-4 h-4 text-white/40" />
              </button>

              {!controlsCollapsed && (
                <div className="px-4 pb-4">
                  {/* Row 1: Source selector */}
                  <div id="source-selector">
                    <SourceSelector
                      value={source}
                      onChange={handleSourceChange}
                      screenActive={!!screenStream}
                      hasVideoPlaying={!!selectedLibraryVideo}
                      hasCustomVideo={!!customVideoSelection}
                    />
                  </div>

                  {/* Row 2: Layout + Position (same row) */}
                  <div className="flex flex-wrap items-end justify-center gap-4 mt-3 pt-3 border-t border-white/5">
                    <LayoutToggle
                      value={layoutMode}
                      onChange={setLayoutMode}
                      disabled={source === "webcam-only"}
                      disabledMessage="Layout requires a video source. Select Library, Screen, or Custom first."
                    />
                    <PositionToggle
                      value={webcamPosition}
                      onChange={setWebcamPosition}
                      layoutMode={layoutMode}
                    />

                    {/* Orientation toggles inline */}
                    <OrientationToggle
                      value={orientation}
                      onChange={setOrientation}
                    />

                    <div className="space-y-2">
                      <label className="text-sm text-white/60 font-medium">Webcam</label>
                      <div className="flex gap-1 p-1 bg-white/5 rounded-lg border border-white/10">
                        <button
                          onClick={() => setWebcamOrientation("landscape")}
                          className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-all cursor-pointer ${
                            webcamOrientation === "landscape"
                              ? "bg-white/10 text-white"
                              : "text-white/50 hover:bg-white/5 hover:text-white/80"
                          }`}
                          title="Landscape (1280x720)"
                        >
                          <span className="text-lg">▬</span>
                        </button>
                        <button
                          onClick={() => setWebcamOrientation("portrait")}
                          className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-all cursor-pointer ${
                            webcamOrientation === "portrait"
                              ? "bg-white/10 text-white"
                              : "text-white/50 hover:bg-white/5 hover:text-white/80"
                          }`}
                          title="Portrait (720x1280) - for phone held vertically"
                        >
                          <span className="text-lg">▮</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Row 3: Face Privacy Filter */}
                  <div className="mt-4 pt-3 border-t border-white/5">
                    <FaceFilterSelector
                      enabled={faceFilterEnabled}
                      onEnabledChange={setFaceFilterEnabled}
                      selectedFilterId={selectedFilterId}
                      onFilterChange={setSelectedFilterId}
                      maskScale={maskScale}
                      onMaskScaleChange={setMaskScale}
                    />
                  </div>
                </div>
              )}
            </motion.div>

            {/* Preview Area */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-[#141414] rounded-xl border border-white/5 overflow-hidden"
            >
              {/* Preview Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 gap-4">
                {/* Left: Live Preview */}
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm text-white/60 whitespace-nowrap">Live Preview</span>
                  {isRecording && (
                    <span className="flex items-center gap-1.5 px-2 py-0.5 bg-red-500/20 rounded-full text-red-400 text-xs whitespace-nowrap">
                      <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                      Recording
                    </span>
                  )}
                </div>

                {/* Center: Video Info (when video source) */}
                {source === "video" && selectedLibraryVideo && (
                  <div className="flex-1 min-w-0 flex items-center gap-3 justify-center">
                    <div className="flex items-center gap-2 min-w-0">
                      <p className="text-sm font-medium truncate">{selectedLibraryVideo.name}</p>
                      {isFunscriptSyncing && (
                        <span className="flex items-center gap-1 text-xs text-green-400 whitespace-nowrap">
                          <Zap className="w-3 h-3" />
                          Syncing
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-white/50 whitespace-nowrap">
                      {selectedLibraryVideo.has_script && "Sync ready • "}
                      {selectedLibraryVideo.duration > 0 && `${Math.floor(selectedLibraryVideo.duration / 60)}m ${selectedLibraryVideo.duration % 60}s`}
                    </span>
                    <button
                      onClick={() => setShowVideoLibrary(true)}
                      className="px-2 py-1 text-xs font-medium bg-white/10 hover:bg-white/20 rounded-lg transition-colors whitespace-nowrap"
                    >
                      Change
                    </button>
                  </div>
                )}

                {/* Right: Controls */}
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 text-sm text-white/60 whitespace-nowrap cursor-pointer">
                    <Webcam className="w-4 h-4" />
                    Webcam
                    <Switch
                      checked={webcamEnabled}
                      onCheckedChange={setWebcamEnabled}
                    />
                  </label>
                  <button
                    onClick={() => setLightsOff(!lightsOff)}
                    className={cn(
                      "p-1.5 rounded transition-colors",
                      lightsOff
                        ? "text-yellow-400 bg-yellow-400/10 hover:bg-yellow-400/20"
                        : "text-white/50 hover:text-white hover:bg-white/10"
                    )}
                    title={lightsOff ? "Turn lights on (L)" : "Turn lights off (L)"}
                  >
                    {lightsOff ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={toggleFullscreen}
                    className="p-1.5 text-white/50 hover:text-white hover:bg-white/10 rounded transition-colors"
                    title={isFullscreen ? "Exit fullscreen (F)" : "Fullscreen (F)"}
                  >
                    {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Canvas Preview */}
              <div
                ref={previewContainerRef}
                className={cn(
                  "relative bg-black flex items-center justify-center mx-auto",
                  isFullscreen && "!max-h-screen",
                  lightsOff && "z-50"
                )}
                style={{
                  aspectRatio: orientation === "horizontal" ? "16/9" : "9/16",
                  maxHeight: isFullscreen ? "100vh" : "60vh",
                }}
              >
                <canvas
                  ref={previewCanvasRef}
                  className="max-w-full max-h-full"
                  style={{
                    width: orientation === "horizontal" ? "100%" : "auto",
                    height: orientation === "vertical" ? "100%" : "auto",
                  }}
                />


                {/* Face filter output canvas (hidden, used as filtered webcam source for recording) */}
                {faceFilterEnabled && (
                  <canvas
                    ref={needleOutputCanvasRef}
                    className="hidden"
                    width={1280}
                    height={720}
                  />
                )}

                {/* Split Divider for split layouts */}
                {layoutMode === "side-by-side" && !isRecording && (
                  <SplitDivider
                    orientation="vertical"
                    initialSplit={sideBySideSplit}
                    onChange={setSideBySideSplit}
                    containerRef={previewContainerRef}
                  />
                )}
                {layoutMode === "stacked" && !isRecording && (
                  <SplitDivider
                    orientation="horizontal"
                    initialSplit={stackedSplit}
                    onChange={setStackedSplit}
                    containerRef={previewContainerRef}
                  />
                )}

                {/* Edge Mode Indicator */}
                <EdgeModeIndicator
                  active={edgeMode}
                  intensity={edgeModeIntensity}
                  timeRemaining={edgeModeTimeRemaining ?? undefined}
                />

                {/* Earnings Pulse Widget - during recording */}
                {isRecording && (
                  <EarningsPulse sessionCredits={sessionCredits} />
                )}

                {/* Companion Overlay */}
                <CompanionOverlay
                  isVisible={companion.isVisible}
                  currentAction={companion.currentAction}
                  volume={companion.volume}
                  onTriggerAction={companion.triggerAction}
                  onToggleVisibility={companion.toggleVisibility}
                  onAdjustVolume={companion.adjustVolume}
                />

                {/* Source prompt overlay - Screen */}
                {source === "screen" && !screenStream && !isRecording && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/80">
                    <button
                      onClick={startScreenCapture}
                      className="flex flex-col items-center gap-3 px-8 py-6 bg-white/10 hover:bg-white/20 rounded-xl transition-colors"
                    >
                      <Monitor className="w-12 h-12 text-green-400" />
                      <span className="text-lg font-medium">Pick What You're Watching</span>
                      <span className="text-sm text-white/50">Click to choose a browser tab or window</span>
                    </button>
                  </div>
                )}

                {/* Inline Video Picker - replaces modal overlay */}
                {source === "video" && !selectedLibraryVideo && !isRecording && (
                  <InlineVideoPicker
                    onSelect={handleLibraryVideoSelectRef.current}
                    syncReadyOnly={false}
                  />
                )}

                {/* Custom Video Uploader */}
                {source === "custom" && !isRecording && (
                  <CustomVideoUploader
                    onVideoSelect={setCustomVideoSelection}
                    onClear={() => {
                      setCustomVideoSelection(null)
                      setCustomVideoReady(false)
                      setCustomVideoPlaying(false)
                    }}
                    currentSelection={customVideoSelection}
                  />
                )}

                {/* Funscript visualizer widget for video or custom source */}
                {(source === "video" || source === "custom") && funscript && device.connected && (
                  <FunscriptVisualizerWidget
                    funscript={funscript}
                    currentTimeMs={videoCurrentTime}
                    videoDurationMs={videoDurationMs}
                  />
                )}

                {/* Video loading indicator */}
                {source === "video" && selectedLibraryVideo && !libraryVideoReady && !libraryVideoError && (
                  <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
                    <div className="flex flex-col items-center gap-4">
                      {/* Animated ring spinner */}
                      <div className="relative w-12 h-12">
                        <div className="absolute inset-0 rounded-full border-2 border-white/10" />
                        <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-white/60 animate-spin" />
                      </div>
                      <span className="text-sm text-white/40">Loading video...</span>
                    </div>
                  </div>
                )}

                {/* BUG 1 FIX: Click to play overlay when autoplay fails */}
                {source === "video" && selectedLibraryVideo && libraryVideoError && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-25">
                    <button
                      onClick={() => {
                        if (libraryVideoRef.current) {
                          libraryVideoRef.current.play()
                            .then(() => {
                              setLibraryVideoReady(true)
                              setLibraryVideoError(null)
                            })
                            .catch((err) => {
                              console.error("[MoneyStroker] Manual play failed:", err)
                            })
                        }
                      }}
                      className="flex flex-col items-center gap-3 px-8 py-6 bg-white/10 hover:bg-white/20 rounded-xl transition-colors"
                    >
                      <Video className="w-12 h-12 text-green-400" />
                      <span className="text-lg font-medium">Click to Play Video</span>
                      <span className="text-sm text-white/50">{libraryVideoError}</span>
                    </button>
                  </div>
                )}

                {/* No webcam warning */}
                {webcamEnabled && !webcamStream && (
                  <div className="absolute top-4 right-4 flex items-center gap-2 px-3 py-2 bg-yellow-500/20 rounded-lg border border-yellow-500/30">
                    <AlertCircle className="w-4 h-4 text-yellow-400" />
                    <span className="text-sm text-yellow-400">{webcamError || "Webcam not available"}</span>
                  </div>
                )}
                {/* Mic error warning */}
                {micError && (
                  <div className="absolute top-4 left-4 flex items-center gap-2 px-3 py-2 bg-yellow-500/20 rounded-lg border border-yellow-500/30">
                    <AlertCircle className="w-4 h-4 text-yellow-400" />
                    <span className="text-sm text-yellow-400">{micError}</span>
                  </div>
                )}

                {/* FEATURE 1: PiP Editor overlay (only for PiP layouts in setup, not for webcam-only) */}
                {phase === "setup" && !isRecording && webcamStream && (layoutMode === "pip") && source !== "webcam-only" && (
                  <PipEditor
                    position={customPipPosition || getDefaultPipPosition()}
                    onChange={setCustomPipPosition}
                    canvasWidth={orientation === "horizontal" ? 1920 : 1080}
                    canvasHeight={orientation === "horizontal" ? 1080 : 1920}
                    webcamAspectRatio={webcamAspectRatio}
                    disabled={isRecording}
                    className="z-20"
                  />
                )}

                {/* Draggable watermark overlay (only in setup phase, hidden during inline video picker) */}
                {/* Canvas watermark is always visible — this overlay handles drag + double-click edit */}
                {phase === "setup" && !isRecording && (selectedLibraryVideo || source !== "video") && (
                  <div
                    className={`absolute z-30 ${isEditingWatermark ? "cursor-text" : "cursor-grab active:cursor-grabbing"} select-none group ${isDraggingWatermark ? "opacity-80" : ""}`}
                    style={{
                      left: `${watermarkPosition.x}%`,
                      top: `${watermarkPosition.y}%`,
                      transform: "translate(-50%, -50%)",
                    }}
                    onMouseDown={(e) => {
                      if (isEditingWatermark) return
                      e.preventDefault()
                      setIsDraggingWatermark(true)
                      const startX = e.clientX
                      const startY = e.clientY
                      const startPos = { ...watermarkPosition }

                      const handleMouseMove = (moveEvent: MouseEvent) => {
                        const container = previewContainerRef.current
                        if (!container) return

                        const rect = container.getBoundingClientRect()
                        const deltaX = ((moveEvent.clientX - startX) / rect.width) * 100
                        const deltaY = ((moveEvent.clientY - startY) / rect.height) * 100

                        const newX = Math.min(95, Math.max(5, startPos.x + deltaX))
                        const newY = Math.min(95, Math.max(5, startPos.y + deltaY))

                        updateWatermarkSettings({ position: { x: newX, y: newY } })
                      }

                      const handleMouseUp = () => {
                        setIsDraggingWatermark(false)
                        document.removeEventListener("mousemove", handleMouseMove)
                        document.removeEventListener("mouseup", handleMouseUp)
                      }

                      document.addEventListener("mousemove", handleMouseMove)
                      document.addEventListener("mouseup", handleMouseUp)
                    }}
                    onDoubleClick={() => {
                      setIsEditingWatermark(true)
                      setEditingWatermarkText(watermarkText)
                      updateWatermarkSettings({ copyPreset: "custom" })
                    }}
                  >
                    {/* Transparent hitbox sized to match canvas watermark, with hover border + drag/edit indicators */}
                    <div
                      className="rounded-lg border border-transparent group-hover:border-white/40 group-hover:bg-white/5 transition-all"
                      style={{
                        fontSize: watermarkSettings.size === "custom"
                          ? `${watermarkSettings.customSize}px`
                          : watermarkSettings.size === "small" ? "20px"
                          : watermarkSettings.size === "medium" ? "28px"
                          : "38px",
                        padding: "0.5rem 0.75rem",
                      }}
                    >
                      <div className="flex items-center gap-1.5">
                        {!isEditingWatermark && (
                          <GripVertical className="w-3 h-3 text-white/50 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                        )}
                        {isEditingWatermark ? (
                          <input
                            type="text"
                            value={editingWatermarkText}
                            onChange={(e) => setEditingWatermarkText(e.target.value)}
                            onBlur={() => {
                              updateWatermarkSettings({ customCopy: editingWatermarkText })
                              setIsEditingWatermark(false)
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                updateWatermarkSettings({ customCopy: editingWatermarkText })
                                setIsEditingWatermark(false)
                              } else if (e.key === "Escape") {
                                setIsEditingWatermark(false)
                              }
                            }}
                            autoFocus
                            className="bg-black/60 border border-white/30 rounded px-2 py-1 outline-none min-w-[200px]"
                            style={{
                              color: "#ffffff",
                              fontSize: "inherit",
                              fontFamily: "inherit",
                              fontWeight: "bold",
                            }}
                            placeholder="Enter watermark text..."
                          />
                        ) : (
                          <span style={{ opacity: 0, fontWeight: "bold", whiteSpace: "nowrap" }}>{watermarkText}</span>
                        )}
                      </div>
                    </div>
                    {isDraggingWatermark && (
                      <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-pink-500/80 rounded text-xs text-white whitespace-nowrap">
                        {Math.round(watermarkPosition.x)}%, {Math.round(watermarkPosition.y)}%
                      </div>
                    )}
                    {isEditingWatermark && (
                      <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-green-500/80 rounded text-xs text-white whitespace-nowrap">
                        Press Enter to save, Esc to cancel
                      </div>
                    )}
                  </div>
                )}

              </div>

              {/* Audio Levels + Recording Controls */}
              <div className="flex items-center justify-between px-4 py-2 gap-4">
                {/* Compact Audio Controls */}
                <div className="flex items-center gap-3">
                  {/* Screen Audio */}
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setScreenVolume(screenVolume > 0 ? 0 : 1)}
                      className={`p-1 rounded transition-colors ${
                        screenVolume === 0 ? "text-red-400" : "text-white/50 hover:text-white"
                      }`}
                      title={`Screen audio: ${Math.round(screenVolume * 100)}%${screenVolume === 0 ? " (muted)" : ""}`}
                    >
                      {screenVolume === 0 ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                    </button>
                    <Slider
                      value={[screenVolume]}
                      onValueChange={(val) => setScreenVolume(val[0])}
                      min={0}
                      max={1}
                      step={0.05}
                      className="w-16"
                    />
                    {screenStream && screenStream.getAudioTracks().length > 0 && (
                      <AudioMeterBar stream={screenStream} className="w-12" />
                    )}
                  </div>

                  {/* Divider */}
                  <div className="w-px h-5 bg-white/10" />

                  {/* Mic Audio */}
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setMicMuted(!micMuted)}
                      className={`p-1 rounded transition-colors ${
                        micMuted ? "text-red-400" : "text-white/50 hover:text-white"
                      }`}
                      title={`Mic: ${micMuted ? "Muted" : `${Math.round(micVolume * 100)}%`}`}
                    >
                      {micMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                    </button>
                    <Slider
                      value={[micVolume]}
                      onValueChange={(val) => setMicVolume(val[0])}
                      min={0}
                      max={1}
                      step={0.05}
                      className="w-16"
                      disabled={micMuted}
                    />
                    {micStream && !micMuted && (
                      <AudioMeterBar stream={micStream} className="w-12" />
                    )}
                  </div>
                </div>

                {/* Recording Controls */}
                <div className="flex items-center gap-3">
                  {/* Video Playback Controls (library or custom) */}
                  {((source === "video" && selectedLibraryVideo && libraryVideoReady) ||
                    (source === "custom" && customVideoSelection && customVideoReady)) && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          const video = source === "video" ? libraryVideoRef.current : customVideoRef.current
                          if (video) video.currentTime = Math.max(0, video.currentTime - 5)
                        }}
                        className="p-1.5 text-white/50 hover:text-white hover:bg-white/10 rounded transition-colors"
                        title="Back 5s (←)"
                      >
                        <SkipBack className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          const video = source === "video" ? libraryVideoRef.current : customVideoRef.current
                          if (video) { video.paused ? video.play() : video.pause() }
                        }}
                        className="p-1.5 text-white/50 hover:text-white hover:bg-white/10 rounded transition-colors"
                        title={(source === "video" ? videoPlaying : customVideoPlaying) ? "Pause (Space)" : "Play (Space)"}
                      >
                        {(source === "video" ? videoPlaying : customVideoPlaying) ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => {
                          const video = source === "video" ? libraryVideoRef.current : customVideoRef.current
                          if (video) video.currentTime = Math.min(video.duration || 0, video.currentTime + 5)
                        }}
                        className="p-1.5 text-white/50 hover:text-white hover:bg-white/10 rounded transition-colors"
                        title="Forward 5s (→)"
                      >
                        <SkipForward className="w-4 h-4" />
                      </button>
                    </div>
                  )}

                  {!isRecording && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-white/50">Max:</span>
                      {[5, 10, 15, 30, 60].map((sec) => (
                        <button
                          key={sec}
                          onClick={() => setMaxRecordingDuration(sec)}
                          className={cn(
                            "px-2 py-1 text-xs rounded-md transition-colors",
                            maxRecordingDuration === sec
                              ? "bg-green-500/20 text-green-400 border border-green-500/30"
                              : "bg-white/5 text-white/50 hover:bg-white/10"
                          )}
                        >
                          {sec}s
                        </button>
                      ))}
                    </div>
                  )}
                  <RecordingControls
                    isRecording={isRecording}
                    duration={recordingDuration}
                    canRecord={canRecord && !!isReadyToRecord}
                    onStart={handleStartRecording}
                    onStop={handleStopRecording}
                    edgeMode={edgeMode}
                    maxDuration={maxRecordingDuration}
                    disabledReason={recordingDisabledReason}
                  />
                </div>
              </div>
              <WatermarkSettingsPanel
                settings={watermarkSettings}
                onChange={updateWatermarkSettings}
                affiliateCode={affiliateCode}
                isExpanded={showWatermarkSettings}
                onToggleExpand={() => setShowWatermarkSettings(!showWatermarkSettings)}
                phase={phase}
                isRecording={isRecording}
                edgeMode={edgeMode}
              />
            </motion.div>

            {/* Edge Mode Settings */}
            {device.connected && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.18 }}
                className="bg-[#141414] rounded-xl border border-white/5 p-4"
              >
                <div className="flex items-center gap-2 mb-3">
                  <Zap className="w-4 h-4 text-yellow-400" />
                  <span className="text-sm font-medium text-white/80">Edge Mode</span>
                  <span className="text-[10px] text-white/40 ml-auto">Press E to toggle</span>
                </div>
                <div className="space-y-3">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs text-white/50">Cooldown speed</label>
                      <span className="text-xs text-white/60 font-mono">{Math.round(edgeModeIntensity * 100)}%</span>
                    </div>
                    <Slider
                      value={[edgeModeIntensity]}
                      onValueChange={(val) => setEdgeModeIntensity(val[0])}
                      min={0.1}
                      max={0.5}
                      step={0.05}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs text-white/50">Back to full speed in</label>
                    <div className="flex gap-1">
                      {[
                        { value: 15, label: "15s" },
                        { value: 30, label: "30s" },
                        { value: 60, label: "60s" },
                        { value: 0, label: "Manual" },
                      ].map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => setEdgeModeTimeout(opt.value)}
                          className={cn(
                            "flex-1 px-2 py-1.5 rounded text-xs font-medium transition-colors border",
                            edgeModeTimeout === opt.value
                              ? "bg-yellow-500/20 border-yellow-500/30 text-yellow-400"
                              : "bg-white/5 border-white/10 text-white/50 hover:text-white"
                          )}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                {/* Hardware Stacking CTA */}
                <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                  <div className="flex items-start gap-3">
                    <Zap className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white/90 font-medium mb-1">
                        Earn More: Add Your Device Affiliate Link
                      </p>
                      <p className="text-xs text-white/60">
                        Viewers can see you&apos;re using a connected device. Link your device affiliate for extra commissions.
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Info Box with Tips */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-green-500/10 border border-green-500/20 rounded-xl p-4"
            >
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="space-y-1">
                    <p className="text-sm text-green-400 font-medium">Every recording earns you money automatically</p>
                    <p className="text-xs text-white/50">
                      Your link is baked into every frame. Anyone who signs up from your clip = 15% commission. Zero extra work.
                    </p>
                  </div>
                  <RecordingTipsAccordion />
                </div>
              </div>
            </motion.div>
          </>
        )}

        {/* Phase: Review */}
        {phase === "review" && recordedUrl && (
          <>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-[#141414] rounded-xl border border-white/5 overflow-hidden"
            >
              <div className="px-4 py-3 border-b border-white/5">
                <h3 className="font-semibold flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-400" />
                  Recording Complete
                </h3>
              </div>

              {/* Video Preview */}
              <div className="bg-black flex items-center justify-center" style={{ maxHeight: "50vh" }}>
                <video
                  src={recordedUrl}
                  controls
                  className="max-w-full max-h-[50vh]"
                />
              </div>

              {/* Actions */}
              <div className="p-4 flex flex-wrap gap-3">
                <button
                  onClick={handleDownload}
                  className="flex items-center gap-2 px-4 py-2.5 bg-green-500 hover:bg-green-600 text-black font-medium rounded-lg transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Download
                </button>
                <button
                  onClick={handleNewRecording}
                  className="flex items-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white font-medium rounded-lg transition-colors"
                >
                  <Video className="w-4 h-4" />
                  New Recording
                </button>
              </div>

              {/* Achievement Progress Bar */}
              <AchievementProgressBar />
            </motion.div>

            {/* Edit Your Clip */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="bg-[#141414] rounded-xl border border-white/5 overflow-hidden"
            >
              {/* Header */}
              <div className="px-4 py-3 border-b border-white/5">
                <h3 className="font-semibold flex items-center gap-2">
                  <Scissors className="w-5 h-5 text-green-400" />
                  Next: Trim Your Clip
                </h3>
                <p className="text-sm text-white/50 mt-1">
                  Select the best 5 seconds from your recording to create your clip.
                </p>
              </div>

              <div className="p-4 space-y-4">
                {/* Optional Enhancement — collapsed by default */}
                <div className="border border-white/5 rounded-lg overflow-hidden">
                  <button
                    onClick={() => setGreekGodEnabled(!greekGodEnabled)}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors"
                    disabled={layoutMode === "pip"}
                  >
                    <div className="flex items-center gap-2">
                      <Dumbbell className="w-4 h-4 text-yellow-400" />
                      <span className="text-sm font-medium">Add Muscle Enhancement</span>
                      {(layoutMode === "pip") && (
                        <span className="text-xs text-white/30">(requires split/stacked layout)</span>
                      )}
                    </div>
                    <Switch
                      checked={greekGodEnabled}
                      onCheckedChange={(checked) => {
                        if (checked && (layoutMode === "pip")) return
                        setGreekGodEnabled(checked)
                      }}
                      disabled={layoutMode === "pip"}
                    />
                  </button>

                  {greekGodEnabled && (
                    <div className="px-4 pb-4 space-y-4 border-t border-white/5 pt-4">
                      {/* Muscle Intensity Slider */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <label className="text-sm text-white/70">Intensity</label>
                          <span className="text-sm font-mono text-green-400">{muscleIntensity[0].toFixed(1)}</span>
                        </div>
                        <Slider
                          value={muscleIntensity}
                          onValueChange={setMuscleIntensity}
                          min={0.5}
                          max={2.0}
                          step={0.1}
                          className="w-full"
                        />
                      </div>

                      {/* Head Removal */}
                      <div className="space-y-2">
                        <label className="text-sm text-white/70">Head Removal</label>
                        <div className="flex gap-2">
                          {(["none", "crop", "mosaic"] as const).map((option) => (
                            <button
                              key={option}
                              onClick={() => setHeadRemoval(option)}
                              className={cn(
                                "px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                                headRemoval === option
                                  ? "bg-white/10 text-white border border-white/20"
                                  : "bg-white/5 text-white/50 hover:text-white/80 border border-transparent"
                              )}
                            >
                              {option === "none" && "None"}
                              {option === "crop" && "Crop Below Face"}
                              {option === "mosaic" && "Mosaic Blur"}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Requirements */}
                      <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3">
                        <div className="flex items-start gap-2">
                          <Info className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
                          <div className="text-xs text-yellow-400/80">
                            <p className="font-medium">Requirements:</p>
                            <ul className="mt-1 space-y-0.5 list-disc list-inside text-yellow-400/60">
                              <li>Chest must be visible in frame</li>
                              <li>Face visible if nude (needed for transform)</li>
                              <li>Processing takes ~15 to 25 minutes</li>
                            </ul>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Main CTA */}
              <div className="px-4 py-3 bg-white/5 border-t border-white/5">
                <button
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-black font-semibold rounded-lg transition-colors"
                  onClick={handleEnterClipSelection}
                >
                  <Scissors className="w-5 h-5" />
                  Select Your Best 5 Seconds
                </button>
              </div>
            </motion.div>
          </>
        )}

        {/* Phase: Clip Selection */}
        {phase === "clip-selection" && recordedUrl && (
          <>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-[#141414] rounded-xl border border-white/5 overflow-hidden"
            >
              <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
                <h3 className="font-semibold flex items-center gap-2">
                  <Scissors className="w-5 h-5 text-green-400" />
                  Pick Your Best 5 Seconds
                </h3>
                <button
                  onClick={() => setPhase("review")}
                  className="text-sm text-white/50 hover:text-white transition-colors"
                >
                  Back to full video
                </button>
              </div>

              <div className="p-4 space-y-6">
                {/* Timeline Scrubber */}
                <TimelineScrubber
                  videoUrl={recordedUrl}
                  duration={videoDuration}
                  clipDuration={5}
                  onClipSelect={handleClipSelect}
                />

                {/* Clip Preview */}
                <div className="border-t border-white/5 pt-4">
                  <h4 className="text-sm text-white/60 mb-3">Preview Selected Clip</h4>
                  <ClipPreview
                    videoUrl={recordedUrl}
                    startTime={clipStart}
                    endTime={clipEnd}
                    loop={true}
                  />
                </div>
              </div>
            </motion.div>

            {/* Greek God Transform Panel */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-[#141414] rounded-xl border border-white/5 overflow-hidden"
            >
              <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
                <h3 className="font-semibold flex items-center gap-2">
                  <Dumbbell className="w-5 h-5 text-yellow-400" />
                  Greek God Transform
                </h3>
                <Switch
                  checked={greekGodEnabled}
                  onCheckedChange={(checked) => {
                    if (checked && (layoutMode === "pip")) {
                      return // PiP webcam too small for Greek God
                    }
                    setGreekGodEnabled(checked)
                  }}
                  disabled={layoutMode === "pip"}
                />
              </div>

              {greekGodEnabled && (
                <div className="p-4 space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-sm text-white/70">Muscle Intensity</label>
                      <span className="text-sm font-mono text-green-400">{muscleIntensity[0].toFixed(1)}</span>
                    </div>
                    <Slider
                      value={muscleIntensity}
                      onValueChange={setMuscleIntensity}
                      min={0.5}
                      max={2.0}
                      step={0.1}
                      className="w-full"
                    />
                    <p className="text-xs text-white/40">
                      0.5 = subtle enhancement, 1.0 = natural muscle, 1.5+ = very muscular
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm text-white/70">Head Removal (after transform)</label>
                    <div className="flex gap-2">
                      {(["none", "crop", "mosaic"] as const).map((option) => (
                        <button
                          key={option}
                          onClick={() => setHeadRemoval(option)}
                          className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                            headRemoval === option
                              ? "bg-white/10 text-white border border-white/20"
                              : "bg-white/5 text-white/50 hover:text-white/80 border border-transparent"
                          }`}
                        >
                          {option === "none" && "None"}
                          {option === "crop" && "Crop Below Face"}
                          {option === "mosaic" && "Mosaic Blur"}
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-white/40">
                      Applied after Greek God transform. Face is needed during transform for best results.
                    </p>
                  </div>

                  <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3">
                    <div className="flex items-start gap-2">
                      <Info className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
                      <div className="text-xs text-yellow-400/80">
                        <p className="font-medium">Requirements for best results:</p>
                        <ul className="mt-1 space-y-0.5 list-disc list-inside text-yellow-400/60">
                          <li>Chest must be visible in frame</li>
                          <li>Face visible if nude (required for muscle transform)</li>
                          <li>Full video processing takes ~15 to 25 minutes</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="px-4 py-3 bg-white/5 border-t border-white/5">
                <button
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-black font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={handleExtractClip}
                  disabled={isExtracting}
                >
                  {isExtracting ? (
                    <>
                      <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                      Extracting... {Math.round(extractionProgress * 100)}%
                    </>
                  ) : (
                    <>
                      <Wand2 className="w-5 h-5" />
                      {greekGodEnabled ? "Process with Greek God" : "Grab This Clip"}
                    </>
                  )}
                </button>
                {greekGodEnabled && (
                  <p className="text-center text-xs text-white/40 mt-2">
                    Full video transform: ~15 to 25 minutes. You can close this page.
                  </p>
                )}
              </div>
            </motion.div>
          </>
        )}

        {/* Phase: Processing / Complete */}
        {phase === "processing" && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-[#141414] rounded-xl border border-white/5 overflow-hidden"
          >
            <div className="px-4 py-3 border-b border-white/5">
              <h3 className="font-semibold flex items-center gap-2">
                {greekGodEnabled && greekGodJob.isProcessing ? (
                  <Loader2 className="w-5 h-5 text-yellow-400 animate-spin" />
                ) : greekGodEnabled && greekGodJob.isFailed ? (
                  <AlertCircle className="w-5 h-5 text-red-400" />
                ) : (
                  <CheckCircle2 className="w-5 h-5 text-green-400" />
                )}
                {greekGodEnabled && greekGodJob.isProcessing
                  ? "Greek God Processing..."
                  : greekGodEnabled && greekGodJob.isFailed
                    ? "Transform Failed"
                    : greekGodEnabled && greekGodJob.isComplete
                      ? "Transform Complete"
                      : "Clip Ready"}
              </h3>
            </div>

            {/* Greek God: Processing state */}
            {greekGodEnabled && greekGodJob.isProcessing && (
              <div className="p-6">
                {/* Progress bar */}
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-white/70">{greekGodJob.jobStatus?.stage || "Queued"}</span>
                    <span className="text-sm font-mono text-yellow-400">{greekGodJob.jobStatus?.progress || 0}%</span>
                  </div>
                  <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-gradient-to-r from-yellow-500 to-orange-500 rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${greekGodJob.jobStatus?.progress || 5}%` }}
                      transition={{ duration: 0.5 }}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-center gap-3 mb-4">
                  <Dumbbell className="w-6 h-6 text-yellow-400 animate-pulse" />
                  <span className="text-white/60">Transforming your physique...</span>
                </div>

                <p className="text-xs text-white/40 text-center">
                  You can leave this page. Your result will be saved and ready when you return.
                </p>

                {/* Original clip preview */}
                {extractedClipUrl && (
                  <div className="mt-4 bg-black rounded-lg overflow-hidden" style={{ maxHeight: "30vh" }}>
                    <video
                      src={extractedClipUrl}
                      controls
                      loop
                      muted
                      className="max-w-full max-h-[30vh] mx-auto"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Greek God: Complete state */}
            {greekGodEnabled && greekGodJob.isComplete && (
              <div className="p-4 space-y-4">
                {/* Side by side: original clip + transformed image */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-white/40 mb-1 text-center">Original</p>
                    <div className="bg-black rounded-lg overflow-hidden" style={{ maxHeight: "35vh" }}>
                      {extractedClipUrl && (
                        <video
                          src={extractedClipUrl}
                          controls
                          loop
                          muted
                          className="max-w-full max-h-[35vh] mx-auto"
                        />
                      )}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-white/40 mb-1 text-center">Greek God</p>
                    <div className="bg-black rounded-lg overflow-hidden" style={{ maxHeight: "35vh" }}>
                      {greekGodOutputUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={greekGodOutputUrl}
                          alt="Greek God transformed"
                          className="max-w-full max-h-[35vh] mx-auto object-contain"
                        />
                      )}
                    </div>
                  </div>
                </div>

                {/* Head removal controls */}
                {headRemoval !== "none" && (
                  <div className="bg-white/5 rounded-lg p-3 space-y-3">
                    <h4 className="text-sm font-medium text-white/70 flex items-center gap-2">
                      <Scissors className="w-4 h-4" />
                      Head Removal: {headRemoval === "crop" ? "Crop" : "Mosaic"}
                    </h4>
                    {headRemoval === "crop" && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-xs text-white/50">Crop line (from top)</label>
                          <span className="text-xs font-mono text-white/60">{cropLineY}%</span>
                        </div>
                        <Slider
                          value={[cropLineY]}
                          onValueChange={([v]) => setCropLineY(v)}
                          min={5}
                          max={50}
                          step={1}
                          className="w-full"
                        />
                      </div>
                    )}
                    {headRemoval === "mosaic" && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-xs text-white/50">Region position</label>
                          <span className="text-xs font-mono text-white/60">{mosaicRegionY}%</span>
                        </div>
                        <Slider
                          value={[mosaicRegionY]}
                          onValueChange={([v]) => setMosaicRegionY(v)}
                          min={0}
                          max={50}
                          step={1}
                          className="w-full"
                        />
                        <div className="flex items-center justify-between">
                          <label className="text-xs text-white/50">Region height</label>
                          <span className="text-xs font-mono text-white/60">{mosaicRegionHeight}%</span>
                        </div>
                        <Slider
                          value={[mosaicRegionHeight]}
                          onValueChange={([v]) => setMosaicRegionHeight(v)}
                          min={10}
                          max={50}
                          step={1}
                          className="w-full"
                        />
                        <div className="flex items-center justify-between">
                          <label className="text-xs text-white/50">Block size</label>
                          <div className="flex gap-1">
                            {([{ label: "S", size: 8 }, { label: "M", size: 12 }, { label: "L", size: 20 }] as const).map(({ label, size }) => (
                              <button
                                key={size}
                                onClick={() => setMosaicBlockSize(size)}
                                className={`px-2 py-0.5 rounded text-xs ${mosaicBlockSize === size ? "bg-white/20 text-white" : "bg-white/5 text-white/40"}`}
                              >
                                {label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Face Hider Selection (post-processing) */}
                <div className="p-4 bg-white/5 border border-white/10 rounded-lg">
                  <div className="flex items-start gap-4 mb-4">
                    <Shield className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-white mb-1">
                        Hide Your Face (Optional)
                      </p>
                      <p className="text-xs text-white/60 mb-3">
                        Apply a face filter to your transformed video. Filters unlock through achievements.
                      </p>
                      <FaceHiderSelector
                        onSelect={async (filterId) => {
                          setFaceHiderSelected(filterId)
                          if (filterId === "none") {
                            setFaceHiderApplied(false)
                            setFaceHiderOutputUrl(null)
                            return
                          }
                          setFaceHiderProcessing(true)
                          try {
                            const response = await fetch("/api/apply-face-hider", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                videoUrl: greekGodOutputUrl,
                                filterId,
                              }),
                            })
                            if (response.ok) {
                              const { outputUrl } = await response.json()
                              setFaceHiderOutputUrl(outputUrl)
                              setFaceHiderApplied(true)
                            }
                          } catch (error) {
                            console.error("[MoneyStroker] Face hider failed:", error)
                          } finally {
                            setFaceHiderProcessing(false)
                          }
                        }}
                      />
                    </div>
                  </div>

                  {faceHiderProcessing && (
                    <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                      <div className="flex items-center gap-2 mb-1">
                        <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
                        <p className="text-sm text-blue-400">Applying face filter...</p>
                      </div>
                      <p className="text-xs text-white/50">
                        This will take ~30 seconds. Detecting face and overlaying the filter.
                      </p>
                    </div>
                  )}

                  {faceHiderApplied && !faceHiderProcessing && (
                    <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-green-400" />
                        <p className="text-sm text-green-400">Face filter applied successfully!</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Action buttons */}
                <div className="flex flex-wrap gap-3">
                  {/* Download original clip */}
                  <button
                    onClick={() => {
                      if (!extractedClipUrl) return
                      const a = document.createElement("a")
                      a.href = extractedClipUrl
                      a.download = `money-stroker-clip-${Date.now()}.webm`
                      document.body.appendChild(a)
                      a.click()
                      document.body.removeChild(a)
                    }}
                    className="flex items-center gap-2 px-4 py-2.5 bg-green-500 hover:bg-green-600 text-black font-medium rounded-lg transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    Download Clip
                  </button>
                  {/* Download Greek God image (uses face hider output if available) */}
                  {(faceHiderOutputUrl || greekGodOutputUrl) && (
                    <button
                      onClick={() => {
                        const url = faceHiderOutputUrl || greekGodOutputUrl
                        if (!url) return
                        const a = document.createElement("a")
                        a.href = url
                        a.download = `greek-god-${Date.now()}.png`
                        document.body.appendChild(a)
                        a.click()
                        document.body.removeChild(a)
                      }}
                      className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-black font-medium rounded-lg transition-colors"
                    >
                      <Dumbbell className="w-4 h-4" />
                      Download Transform
                    </button>
                  )}
                </div>

                {/* Share buttons */}
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={async () => {
                      if (!extractedClipBlob) return
                      setIsUploading(true)
                      try {
                        const supabase = createBrowserSupabaseClient()
                        const filename = `clip-${Date.now()}.webm`
                        const { data, error } = await supabase.storage
                          .from('character-clips')
                          .upload(filename, extractedClipBlob, { contentType: 'video/webm' })
                        if (error) throw error
                        const { data: urlData } = supabase.storage.from('character-clips').getPublicUrl(data.path)
                        const publicUrl = urlData.publicUrl
                        setShareUrl(publicUrl)
                        await navigator.clipboard.writeText(publicUrl)
                        setLinkCopied(true)
                        setTimeout(() => setLinkCopied(false), 3000)
                      } catch (err) {
                        console.error("[MoneyStroker] Upload for sharing failed:", err)
                      } finally {
                        setIsUploading(false)
                      }
                    }}
                    disabled={isUploading}
                    className="flex items-center gap-2 px-3 py-2 bg-white/10 hover:bg-white/20 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                  >
                    {isUploading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : linkCopied ? (
                      <CheckCircle2 className="w-4 h-4 text-green-400" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                    {linkCopied ? "Copied!" : "Copy Link"}
                  </button>
                  <button
                    onClick={async () => {
                      let url = shareUrl
                      if (!url && extractedClipBlob) {
                        setIsUploading(true)
                        try {
                          const supabase = createBrowserSupabaseClient()
                          const filename = `clip-${Date.now()}.webm`
                          const { data, error } = await supabase.storage
                            .from('character-clips')
                            .upload(filename, extractedClipBlob, { contentType: 'video/webm' })
                          if (error) throw error
                          const { data: urlData } = supabase.storage.from('character-clips').getPublicUrl(data.path)
                          url = urlData.publicUrl
                          setShareUrl(url)
                        } catch (err) {
                          console.error("[MoneyStroker] Upload for Reddit failed:", err)
                          return
                        } finally {
                          setIsUploading(false)
                        }
                      }
                      if (url) {
                        window.open(`https://reddit.com/submit?url=${encodeURIComponent(url)}`, '_blank')
                      }
                    }}
                    disabled={isUploading}
                    className="flex items-center gap-2 px-3 py-2 bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Reddit
                  </button>
                  <button
                    onClick={() => {
                      window.open('https://www.redgifs.com/upload', '_blank')
                    }}
                    className="flex items-center gap-2 px-3 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 text-sm font-medium rounded-lg transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                    RedGifs
                  </button>
                </div>

                {/* Fansly/PornHub CTAs for Greek God content */}
                {greekGodEnabled && greekGodOutputUrl && (
                  <>
                    <div className="h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                    <div>
                      <p className="text-sm text-white/70 mb-3">Post your Greek God content and earn:</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <a
                          href="https://fansly.com/upload"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-3 p-4 bg-gradient-to-br from-pink-500/20 to-purple-500/20 border border-pink-500/50 rounded-lg hover:bg-pink-500/30 transition group"
                        >
                          <ExternalLink className="w-5 h-5 text-pink-400 group-hover:scale-110 transition" />
                          <div className="text-left flex-1">
                            <p className="text-sm font-semibold text-white">Post on Fansly</p>
                            <p className="text-xs text-white/60">Earn from subscriptions + tips</p>
                          </div>
                        </a>
                        <a
                          href="https://www.pornhub.com/upload"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-3 p-4 bg-gradient-to-br from-orange-500/20 to-red-500/20 border border-orange-500/50 rounded-lg hover:bg-orange-500/30 transition group"
                        >
                          <ExternalLink className="w-5 h-5 text-orange-400 group-hover:scale-110 transition" />
                          <div className="text-left flex-1">
                            <p className="text-sm font-semibold text-white">Post on PornHub</p>
                            <p className="text-xs text-white/60">Earn from views + ads</p>
                          </div>
                        </a>
                      </div>
                      <div className="mt-3 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                        <p className="text-xs text-green-400">
                          Add your GetGooned affiliate link in the description for 15% of signups
                        </p>
                      </div>
                    </div>
                  </>
                )}

                {/* Navigation buttons */}
                <div className="flex flex-wrap gap-3 pt-2 border-t border-white/5">
                  <button
                    onClick={() => setPhase("clip-selection")}
                    className="flex items-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white font-medium rounded-lg transition-colors"
                  >
                    <Scissors className="w-4 h-4" />
                    Pick Different Clip
                  </button>
                  <button
                    onClick={handleNewRecording}
                    className="flex items-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white font-medium rounded-lg transition-colors"
                  >
                    <Video className="w-4 h-4" />
                    New Recording
                  </button>
                </div>

                {/* Post-Recording Earnings Summary */}
                <PostRecordingSummary
                  sessionCredits={sessionCredits}
                  greekGodEnabled={greekGodEnabled}
                  onRecordAgain={handleNewRecording}
                />
              </div>
            )}

            {/* Greek God: Failed state */}
            {greekGodEnabled && greekGodJob.isFailed && (
              <div className="p-6 text-center">
                <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-red-500/20 flex items-center justify-center">
                  <AlertCircle className="w-6 h-6 text-red-400" />
                </div>
                <p className="text-white/60 mb-2">
                  {greekGodJob.jobStatus?.errorMessage || "Transformation failed. Try again or download your raw clip."}
                </p>
                <div className="flex flex-wrap justify-center gap-3 mt-4">
                  <button
                    onClick={async () => {
                      if (!extractedClipBlob) return
                      greekGodJob.reset()
                      setGreekGodOutputUrl(null)
                      // Re-submit
                      const canvasW = orientation === "vertical" ? 1080 : 1920
                      const canvasH = orientation === "vertical" ? 1920 : 1080
                      const cropRegion = computeWebcamCropRegion(canvasW, canvasH, source, layoutMode, webcamPosition, orientation)
                      if (cropRegion) {
                        try {
                          const frameBlob = await extractFrameCropped(extractedClipBlob, 0.1, cropRegion)
                          const formData = new FormData()
                          formData.append('file', new File([frameBlob], 'webcam-frame.jpg', { type: 'image/jpeg' }))
                          formData.append('loraStrength', String(muscleIntensity[0]))
                          formData.append('animateVideo', 'false')
                          await greekGodJob.submitJob(formData)
                        } catch (err) {
                          console.error("[MoneyStroker] Retry failed:", err)
                        }
                      }
                    }}
                    className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-black font-medium rounded-lg transition-colors"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Try Again
                  </button>
                  <button
                    onClick={() => {
                      if (!extractedClipUrl) return
                      const a = document.createElement("a")
                      a.href = extractedClipUrl
                      a.download = `money-stroker-clip-${Date.now()}.webm`
                      document.body.appendChild(a)
                      a.click()
                      document.body.removeChild(a)
                    }}
                    className="flex items-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white font-medium rounded-lg transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    Download Raw Clip
                  </button>
                </div>
              </div>
            )}

            {/* Non-Greek God: Standard clip ready state */}
            {!greekGodEnabled && extractedClipUrl && (
              <div>
                {/* Clip Preview */}
                <div className="bg-black flex items-center justify-center" style={{ maxHeight: "50vh" }}>
                  <video
                    src={extractedClipUrl}
                    controls
                    autoPlay
                    loop
                    className="max-w-full max-h-[50vh]"
                  />
                </div>

                {/* Head removal controls */}
                {headRemoval !== "none" && (
                  <div className="mx-4 mt-4 bg-white/5 rounded-lg p-3 space-y-3">
                    <h4 className="text-sm font-medium text-white/70 flex items-center gap-2">
                      <Scissors className="w-4 h-4" />
                      Head Removal: {headRemoval === "crop" ? "Crop" : "Mosaic"}
                    </h4>
                    {headRemoval === "crop" && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-xs text-white/50">Crop line (from top)</label>
                          <span className="text-xs font-mono text-white/60">{cropLineY}%</span>
                        </div>
                        <Slider
                          value={[cropLineY]}
                          onValueChange={([v]) => setCropLineY(v)}
                          min={5}
                          max={50}
                          step={1}
                          className="w-full"
                        />
                      </div>
                    )}
                    {headRemoval === "mosaic" && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-xs text-white/50">Region position</label>
                          <span className="text-xs font-mono text-white/60">{mosaicRegionY}%</span>
                        </div>
                        <Slider
                          value={[mosaicRegionY]}
                          onValueChange={([v]) => setMosaicRegionY(v)}
                          min={0}
                          max={50}
                          step={1}
                          className="w-full"
                        />
                        <div className="flex items-center justify-between">
                          <label className="text-xs text-white/50">Region height</label>
                          <span className="text-xs font-mono text-white/60">{mosaicRegionHeight}%</span>
                        </div>
                        <Slider
                          value={[mosaicRegionHeight]}
                          onValueChange={([v]) => setMosaicRegionHeight(v)}
                          min={10}
                          max={50}
                          step={1}
                          className="w-full"
                        />
                        <div className="flex items-center justify-between">
                          <label className="text-xs text-white/50">Block size</label>
                          <div className="flex gap-1">
                            {([{ label: "S", size: 8 }, { label: "M", size: 12 }, { label: "L", size: 20 }] as const).map(({ label, size }) => (
                              <button
                                key={size}
                                onClick={() => setMosaicBlockSize(size)}
                                className={`px-2 py-0.5 rounded text-xs ${mosaicBlockSize === size ? "bg-white/20 text-white" : "bg-white/5 text-white/40"}`}
                              >
                                {label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                    <button
                      onClick={async () => {
                        if (!extractedClipBlob) return
                        setIsPostProcessing(true)
                        setPostProcessProgress(0)
                        try {
                          const headRemovalConfig: HeadRemovalConfig = {
                            mode: headRemoval,
                            ...(headRemoval === "crop" ? { cropLineY } : {}),
                            ...(headRemoval === "mosaic" ? {
                              mosaicRegion: { x: 0, y: mosaicRegionY, width: 100, height: mosaicRegionHeight },
                              mosaicBlockSize,
                            } : {}),
                          }
                          const processed = await processVideoPostEffects(extractedClipBlob, {
                            headRemoval: headRemovalConfig,
                            onProgress: (p) => setPostProcessProgress(p),
                          })
                          if (extractedClipUrl) URL.revokeObjectURL(extractedClipUrl)
                          const newUrl = URL.createObjectURL(processed)
                          setExtractedClipBlob(processed)
                          setExtractedClipUrl(newUrl)
                          setShareUrl(null)
                        } catch (err) {
                          console.error("[MoneyStroker] Post-processing failed:", err)
                        } finally {
                          setIsPostProcessing(false)
                        }
                      }}
                      disabled={isPostProcessing}
                      className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-white/10 hover:bg-white/20 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                    >
                      {isPostProcessing ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Applying... {Math.round(postProcessProgress * 100)}%
                        </>
                      ) : (
                        <>
                          <Wand2 className="w-4 h-4" />
                          Apply Effects
                        </>
                      )}
                    </button>
                  </div>
                )}

                {/* Action buttons */}
                <div className="p-4 space-y-3">
                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={() => {
                        if (!extractedClipUrl) return
                        const a = document.createElement("a")
                        a.href = extractedClipUrl
                        a.download = `money-stroker-clip-${Date.now()}.webm`
                        document.body.appendChild(a)
                        a.click()
                        document.body.removeChild(a)
                      }}
                      className="flex items-center gap-2 px-4 py-2.5 bg-green-500 hover:bg-green-600 text-black font-medium rounded-lg transition-colors"
                    >
                      <Download className="w-4 h-4" />
                      Download Clip
                    </button>
                    <button
                      onClick={() => setPhase("clip-selection")}
                      className="flex items-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white font-medium rounded-lg transition-colors"
                    >
                      <Scissors className="w-4 h-4" />
                      Pick Different Clip
                    </button>
                    <button
                      onClick={handleNewRecording}
                      className="flex items-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white font-medium rounded-lg transition-colors"
                    >
                      <Video className="w-4 h-4" />
                      New Recording
                    </button>
                  </div>

                  {/* Share buttons */}
                  <div className="flex flex-wrap gap-2 pt-2 border-t border-white/5">
                    <button
                      onClick={async () => {
                        if (!extractedClipBlob) return
                        setIsUploading(true)
                        try {
                          const supabase = createBrowserSupabaseClient()
                          const filename = `clip-${Date.now()}.webm`
                          const { data, error } = await supabase.storage
                            .from('character-clips')
                            .upload(filename, extractedClipBlob, { contentType: 'video/webm' })
                          if (error) throw error
                          const { data: urlData } = supabase.storage.from('character-clips').getPublicUrl(data.path)
                          const publicUrl = urlData.publicUrl
                          setShareUrl(publicUrl)
                          await navigator.clipboard.writeText(publicUrl)
                          setLinkCopied(true)
                          setTimeout(() => setLinkCopied(false), 3000)
                        } catch (err) {
                          console.error("[MoneyStroker] Upload for sharing failed:", err)
                        } finally {
                          setIsUploading(false)
                        }
                      }}
                      disabled={isUploading}
                      className="flex items-center gap-2 px-3 py-2 bg-white/10 hover:bg-white/20 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                    >
                      {isUploading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : linkCopied ? (
                        <CheckCircle2 className="w-4 h-4 text-green-400" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                      {linkCopied ? "Copied!" : "Copy Link"}
                    </button>
                    <button
                      onClick={async () => {
                        let url = shareUrl
                        if (!url && extractedClipBlob) {
                          setIsUploading(true)
                          try {
                            const supabase = createBrowserSupabaseClient()
                            const filename = `clip-${Date.now()}.webm`
                            const { data, error } = await supabase.storage
                              .from('character-clips')
                              .upload(filename, extractedClipBlob, { contentType: 'video/webm' })
                            if (error) throw error
                            const { data: urlData } = supabase.storage.from('character-clips').getPublicUrl(data.path)
                            url = urlData.publicUrl
                            setShareUrl(url)
                          } catch (err) {
                            console.error("[MoneyStroker] Upload for Reddit failed:", err)
                            return
                          } finally {
                            setIsUploading(false)
                          }
                        }
                        if (url) {
                          window.open(`https://reddit.com/submit?url=${encodeURIComponent(url)}`, '_blank')
                        }
                      }}
                      disabled={isUploading}
                      className="flex items-center gap-2 px-3 py-2 bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Reddit
                    </button>
                    <button
                      onClick={() => {
                        window.open('https://www.redgifs.com/upload', '_blank')
                      }}
                      className="flex items-center gap-2 px-3 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 text-sm font-medium rounded-lg transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" />
                      RedGifs
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Fallback: no clip URL yet */}
            {!greekGodEnabled && !extractedClipUrl && (
              <div className="p-8 text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/20 flex items-center justify-center">
                  <Wand2 className="w-8 h-8 text-green-400 animate-pulse" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Processing Your Clip</h3>
                <p className="text-white/60 mb-4">Please wait...</p>
              </div>
            )}
          </motion.div>
        )}

      </div>

      {/* Video Library Modal */}
      <VideoLibraryModal
        isOpen={showVideoLibrary}
        onClose={() => setShowVideoLibrary(false)}
        onSelect={handleLibraryVideoSelect}
        syncReadyOnly={true}
      />

      {/* Keyboard Shortcuts Help Overlay */}
      <ShortcutHelp isOpen={showHelp} onClose={() => setShowHelp(false)} />

      {/* Onboarding Overlay */}
      {onboardingStep !== null && <OnboardingOverlay />}

      {/* Video Queue Panel (fixed position) */}
      {videoQueue.length > 0 && (
        <div className="fixed bottom-4 right-4 z-50">
          <VideoQueue
            queue={videoQueue}
            currentIndex={currentQueueIndex}
            onReorder={reorderQueue}
            onRemove={removeFromQueue}
            onSelect={playQueueIndex}
            onClear={clearQueue}
          />
        </div>
      )}

      {/* Brief feedback toast */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[60] px-4 py-2 bg-[#1a1a1a] border border-white/20 rounded-lg shadow-xl text-sm text-white/80"
          >
            {toastMessage}
          </motion.div>
        )}
      </AnimatePresence>

      {/* First-time Onboarding Toast */}
      {showOnboardingToast && (
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 50 }}
          className="fixed bottom-4 left-4 z-50 max-w-sm"
        >
          <div className="bg-[#1a1a1a] border border-white/10 rounded-xl p-4 shadow-xl">
            <p className="text-sm text-white/80 mb-3">
              <span className="text-green-400 font-medium">Pro tip:</span> Press{" "}
              <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-xs font-mono border border-white/20">H</kbd>{" "}
              to see keyboard shortcuts.
            </p>
            <p className="text-xs text-white/50 mb-3">Your hands might be busy</p>
            <button
              onClick={() => setShowOnboardingToast(false)}
              className="w-full px-3 py-2 bg-green-500/20 hover:bg-green-500/30 text-green-400 text-sm font-medium rounded-lg transition-colors"
            >
              Got it
            </button>
          </div>
        </motion.div>
      )}
    </div>
  )
}
