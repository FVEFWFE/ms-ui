"use client"

import { useState } from "react"
import { Monitor, Video, Webcam, Info, Upload } from "lucide-react"
import { cn } from "@/lib/utils"
import type { RecordingSource } from "@/hooks/use-money-stroker-recorder"

interface SourceSelectorProps {
  value: RecordingSource
  onChange: (source: RecordingSource) => void
  screenActive?: boolean
  hasVideoPlaying?: boolean
  hasCustomVideo?: boolean
  className?: string
}

// Split-screen sources (webcam + main video content)
const splitSources: {
  value: RecordingSource
  label: string
  icon: typeof Monitor
  shortDesc: string
  longDesc: string
}[] = [
  {
    value: "video",
    label: "GetGooned Library",
    icon: Video,
    shortDesc: "Auto syncs to your toy",
    longDesc: "Play from the GetGooned library. Your toy syncs automatically to our scripted videos. Webcam captures your reaction alongside the video.",
  },
  {
    value: "screen",
    label: "External Porn",
    icon: Monitor,
    shortDesc: "Any window on your screen",
    longDesc: "Capture any video from any site playing in your browser. Perfect for your favorite external porn sites. Audio from the tab is included.",
  },
  {
    value: "custom",
    label: "Custom Upload",
    icon: Upload,
    shortDesc: "Your own video files",
    longDesc: "Upload your own video files with optional funscript for device sync. Works with any MP4, WebM, or MOV from your device.",
  },
]

// Solo mode (webcam only)
const soloSource = {
  value: "webcam-only" as RecordingSource,
  label: "Webcam Only",
  icon: Webcam,
  shortDesc: "Solo cam, full control",
  longDesc: "Pure reaction footage. Works great for AI girlfriend chat sessions or standalone posts.",
}

export function SourceSelector({
  value,
  onChange,
  screenActive,
  hasVideoPlaying,
  hasCustomVideo,
  className,
}: SourceSelectorProps) {
  const [hoveredSource, setHoveredSource] = useState<RecordingSource | null>(null)

  const isSoloMode = value === "webcam-only"

  return (
    <div className={cn("space-y-3", className)}>
      {/* Split-screen sources */}
      <div className="space-y-2">
        <label className="text-sm text-white/60 font-medium">Video Source</label>
        <div className="flex gap-2">
          {splitSources.map((source) => {
            const Icon = source.icon
            const isSelected = value === source.value
            const isScreenAndActive = source.value === "screen" && screenActive
            const isCustomAndActive = source.value === "custom" && hasCustomVideo
            const isHovered = hoveredSource === source.value

            return (
              <div key={source.value} className="relative flex-1">
                <button
                  onClick={() => onChange(source.value)}
                  onMouseEnter={() => setHoveredSource(source.value)}
                  onMouseLeave={() => setHoveredSource(null)}
                  className={cn(
                    "w-full flex flex-col items-start gap-1 px-3 py-2.5 rounded-lg text-left transition-all cursor-pointer",
                    isSelected
                      ? "bg-green-500/20 text-green-400 border border-green-500/30"
                      : "bg-white/5 text-white/70 border border-white/10 hover:bg-white/10 hover:text-white",
                    (isScreenAndActive || isCustomAndActive) && "ring-2 ring-green-500/50"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <Icon className="w-4 h-4" />
                    <span className="text-sm font-medium">{source.label}</span>
                    {(isScreenAndActive || isCustomAndActive) && (
                      <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    )}
                  </div>
                  <span className="text-xs text-white/50">
                    {isSelected && isHovered && source.value === "video" && hasVideoPlaying
                      ? "Change video"
                      : source.shortDesc}
                  </span>
                </button>

                {/* Tooltip on hover */}
                {isHovered && (
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-[#1a1a1a] border border-white/20 rounded-lg text-xs w-56 shadow-xl z-50 pointer-events-none">
                    <div className="flex items-start gap-2">
                      <Info className="w-3.5 h-3.5 text-green-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium text-white mb-1">{source.label}</p>
                        <p className="text-white/60 leading-relaxed">{source.longDesc}</p>
                      </div>
                    </div>
                    {/* Arrow */}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px">
                      <div className="w-2 h-2 bg-[#1a1a1a] border-r border-b border-white/20 rotate-45" />
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Solo mode separator and button */}
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-white/10" />
        <span className="text-xs text-white/40">or</span>
        <div className="h-px flex-1 bg-white/10" />
      </div>

      <div className="relative">
        <button
          onClick={() => onChange(soloSource.value)}
          onMouseEnter={() => setHoveredSource(soloSource.value)}
          onMouseLeave={() => setHoveredSource(null)}
          className={cn(
            "w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer",
            isSoloMode
              ? "bg-green-500/20 text-green-400 border border-green-500/30"
              : "bg-white/5 text-white/50 border border-white/10 hover:bg-white/10 hover:text-white/70"
          )}
        >
          <Webcam className="w-4 h-4" />
          <span>{soloSource.label}</span>
          <span className="text-white/40">({soloSource.shortDesc})</span>
        </button>

        {/* Tooltip on hover */}
        {hoveredSource === soloSource.value && (
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-[#1a1a1a] border border-white/20 rounded-lg text-xs w-56 shadow-xl z-50 pointer-events-none">
            <div className="flex items-start gap-2">
              <Info className="w-3.5 h-3.5 text-green-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-white mb-1">{soloSource.label}</p>
                <p className="text-white/60 leading-relaxed">{soloSource.longDesc}</p>
              </div>
            </div>
            {/* Arrow */}
            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px">
              <div className="w-2 h-2 bg-[#1a1a1a] border-r border-b border-white/20 rotate-45" />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
