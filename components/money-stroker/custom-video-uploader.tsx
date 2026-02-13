"use client"

import { useState, useCallback, useRef } from "react"
import { Upload, Film, FileText, X, Check, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { parseFunscript, type Funscript } from "@/lib/funscript-utils"

export interface CustomVideoSelection {
  videoFile: File
  videoUrl: string // blob URL
  videoDuration: number // ms
  videoWidth: number
  videoHeight: number
  funscript: Funscript | null
}

interface CustomVideoUploaderProps {
  onVideoSelect: (selection: CustomVideoSelection) => void
  onClear: () => void
  currentSelection: CustomVideoSelection | null
}

const ACCEPTED_VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"]
const MAX_VIDEO_SIZE_MB = 100
const MAX_VIDEO_SIZE_BYTES = MAX_VIDEO_SIZE_MB * 1024 * 1024

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000)
  const min = Math.floor(totalSec / 60)
  const sec = totalSec % 60
  return `${min}:${sec.toString().padStart(2, "0")}`
}

export function CustomVideoUploader({
  onVideoSelect,
  onClear,
  currentSelection,
}: CustomVideoUploaderProps) {
  const [isDraggingVideo, setIsDraggingVideo] = useState(false)
  const [isDraggingFunscript, setIsDraggingFunscript] = useState(false)
  const [videoError, setVideoError] = useState<string | null>(null)
  const [funscriptError, setFunscriptError] = useState<string | null>(null)
  const [funscriptFileName, setFunscriptFileName] = useState<string | null>(null)
  const [isLoadingVideo, setIsLoadingVideo] = useState(false)

  const videoInputRef = useRef<HTMLInputElement>(null)
  const funscriptInputRef = useRef<HTMLInputElement>(null)

  const validateAndLoadVideo = useCallback(
    async (file: File): Promise<void> => {
      setVideoError(null)
      setIsLoadingVideo(true)

      // Type check
      if (!ACCEPTED_VIDEO_TYPES.includes(file.type)) {
        setVideoError("Must be MP4, WebM, or MOV")
        setIsLoadingVideo(false)
        return
      }

      // Size check
      if (file.size > MAX_VIDEO_SIZE_BYTES) {
        setVideoError(`Must be under ${MAX_VIDEO_SIZE_MB}MB (yours: ${formatFileSize(file.size)})`)
        setIsLoadingVideo(false)
        return
      }

      // Create blob URL and extract metadata
      const url = URL.createObjectURL(file)
      const video = document.createElement("video")
      video.preload = "metadata"

      try {
        await new Promise<void>((resolve, reject) => {
          video.onloadedmetadata = () => resolve()
          video.onerror = () => reject(new Error("Could not load video file"))
          video.src = url
        })

        const selection: CustomVideoSelection = {
          videoFile: file,
          videoUrl: url,
          videoDuration: video.duration * 1000,
          videoWidth: video.videoWidth,
          videoHeight: video.videoHeight,
          funscript: currentSelection?.funscript || null,
        }

        onVideoSelect(selection)
      } catch {
        URL.revokeObjectURL(url)
        setVideoError("Could not load video file. Try a different format.")
      } finally {
        setIsLoadingVideo(false)
      }
    },
    [onVideoSelect, currentSelection?.funscript]
  )

  const validateAndLoadFunscript = useCallback(
    async (file: File): Promise<void> => {
      setFunscriptError(null)

      if (!currentSelection) {
        setFunscriptError("Select a video first")
        return
      }

      try {
        const text = await file.text()
        const json = JSON.parse(text)

        // Validate structure via parseFunscript
        const actions = parseFunscript(json)
        if (actions.length === 0) {
          setFunscriptError("No valid actions found in funscript")
          return
        }

        const funscript: Funscript = {
          version: json.version || "1.0",
          inverted: json.inverted || false,
          range: json.range || 100,
          actions,
        }

        setFunscriptFileName(file.name)
        onVideoSelect({
          ...currentSelection,
          funscript,
        })
      } catch {
        setFunscriptError("Invalid funscript JSON")
      }
    },
    [currentSelection, onVideoSelect]
  )

  const handleVideoDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDraggingVideo(false)
      const file = e.dataTransfer.files[0]
      if (file) validateAndLoadVideo(file)
    },
    [validateAndLoadVideo]
  )

  const handleFunscriptDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDraggingFunscript(false)
      const file = e.dataTransfer.files[0]
      if (file) validateAndLoadFunscript(file)
    },
    [validateAndLoadFunscript]
  )

  const handleClear = useCallback(() => {
    if (currentSelection?.videoUrl) {
      URL.revokeObjectURL(currentSelection.videoUrl)
    }
    setVideoError(null)
    setFunscriptError(null)
    setFunscriptFileName(null)
    onClear()
  }, [currentSelection, onClear])

  const handleClearFunscript = useCallback(() => {
    if (!currentSelection) return
    setFunscriptError(null)
    setFunscriptFileName(null)
    onVideoSelect({
      ...currentSelection,
      funscript: null,
    })
  }, [currentSelection, onVideoSelect])

  // Already have a video loaded
  if (currentSelection) {
    return (
      <div className="space-y-3 p-4">
        {/* Video info */}
        <div className="flex items-center gap-3 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
          <Film className="w-5 h-5 text-green-400 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-white font-medium truncate">
              {currentSelection.videoFile.name}
            </p>
            <p className="text-xs text-white/50">
              {currentSelection.videoWidth}x{currentSelection.videoHeight} &middot;{" "}
              {formatDuration(currentSelection.videoDuration)} &middot;{" "}
              {formatFileSize(currentSelection.videoFile.size)}
            </p>
          </div>
          <button
            onClick={handleClear}
            className="p-1.5 text-white/40 hover:text-white hover:bg-white/10 rounded transition-colors"
            title="Remove video"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Funscript section */}
        {currentSelection.funscript ? (
          <div className="flex items-center gap-3 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
            <FileText className="w-5 h-5 text-blue-400 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white font-medium truncate">
                {funscriptFileName || "Custom funscript"}
              </p>
              <p className="text-xs text-white/50">
                {currentSelection.funscript.actions.length} actions &middot; Device will sync
              </p>
            </div>
            <button
              onClick={handleClearFunscript}
              className="p-1.5 text-white/40 hover:text-white hover:bg-white/10 rounded transition-colors"
              title="Remove funscript"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div
            onDrop={handleFunscriptDrop}
            onDragOver={(e) => {
              e.preventDefault()
              setIsDraggingFunscript(true)
            }}
            onDragLeave={() => setIsDraggingFunscript(false)}
            onClick={() => funscriptInputRef.current?.click()}
            className={cn(
              "flex items-center gap-3 p-3 border border-dashed rounded-lg cursor-pointer transition-all",
              isDraggingFunscript
                ? "border-blue-500/50 bg-blue-500/10"
                : "border-white/10 hover:border-white/20 hover:bg-white/5"
            )}
          >
            <FileText className="w-5 h-5 text-white/30 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm text-white/50">
                Add .funscript file <span className="text-white/30">(optional)</span>
              </p>
              <p className="text-xs text-white/30">Drop here or click to browse</p>
            </div>
            <input
              ref={funscriptInputRef}
              type="file"
              accept=".funscript,.json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) validateAndLoadFunscript(file)
                e.target.value = ""
              }}
            />
          </div>
        )}

        {funscriptError && (
          <div className="flex items-center gap-2 text-xs text-red-400">
            <AlertCircle className="w-3.5 h-3.5" />
            {funscriptError}
          </div>
        )}
      </div>
    )
  }

  // No video yet — show upload zone
  return (
    <div className="p-4">
      <div
        onDrop={handleVideoDrop}
        onDragOver={(e) => {
          e.preventDefault()
          setIsDraggingVideo(true)
        }}
        onDragLeave={() => setIsDraggingVideo(false)}
        onClick={() => videoInputRef.current?.click()}
        className={cn(
          "flex flex-col items-center justify-center gap-3 p-8 border-2 border-dashed rounded-xl cursor-pointer transition-all",
          isDraggingVideo
            ? "border-green-500/50 bg-green-500/10"
            : "border-white/10 hover:border-white/20 hover:bg-white/5"
        )}
      >
        {isLoadingVideo ? (
          <>
            <div className="w-10 h-10 border-2 border-white/20 border-t-green-400 rounded-full animate-spin" />
            <p className="text-sm text-white/50">Loading video...</p>
          </>
        ) : (
          <>
            <Upload className="w-10 h-10 text-white/30" />
            <div className="text-center">
              <p className="text-sm text-white/70 font-medium">
                Drop your video here or click to browse
              </p>
              <p className="text-xs text-white/40 mt-1">
                MP4, WebM, or MOV &middot; Max {MAX_VIDEO_SIZE_MB}MB
              </p>
            </div>
          </>
        )}
      </div>

      {videoError && (
        <div className="flex items-center gap-2 text-xs text-red-400 mt-2">
          <AlertCircle className="w-3.5 h-3.5" />
          {videoError}
        </div>
      )}

      <input
        ref={videoInputRef}
        type="file"
        accept="video/mp4,video/webm,video/quicktime"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) validateAndLoadVideo(file)
          e.target.value = ""
        }}
      />
    </div>
  )
}
