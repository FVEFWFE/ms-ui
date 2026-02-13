"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Circle, Square } from "lucide-react"
import { cn } from "@/lib/utils"

interface RecordingControlsProps {
  isRecording: boolean
  duration: number
  canRecord: boolean
  onStart: () => void
  onStop: () => void
  edgeMode?: boolean
  className?: string
  maxDuration?: number
  disabledReason?: string
}

// Rolling digit: each digit slides up when it changes
function RollingDigit({ value }: { value: string }) {
  return (
    <span className="relative inline-block w-[0.6em] h-[1.2em] overflow-hidden align-middle">
      <AnimatePresence mode="popLayout">
        <motion.span
          key={value}
          initial={{ y: "100%", opacity: 0 }}
          animate={{ y: "0%", opacity: 1 }}
          exit={{ y: "-100%", opacity: 0 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="absolute inset-0 flex items-center justify-center"
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  )
}

// Rolling timer display: MM:SS with individual animated digits
function RollingTimer({ seconds }: { seconds: number }) {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  const timeStr = `${mins}:${secs.toString().padStart(2, "0")}`
  // Split into characters: "M:SS" or "MM:SS"
  const chars = timeStr.split("")

  return (
    <span className="inline-flex font-mono font-semibold">
      {chars.map((char, i) =>
        char === ":" ? (
          <span key={`colon-${i}`} className="w-[0.3em] h-[1.2em] inline-flex items-center justify-center">:</span>
        ) : (
          <RollingDigit key={`pos-${i}`} value={char} />
        )
      )}
    </span>
  )
}

// Shiny text shimmer effect
function ShinyText({ children }: { children: React.ReactNode }) {
  return (
    <span className="relative inline-block">
      <span className="relative z-10 bg-gradient-to-r from-red-300 via-white to-red-300 bg-clip-text text-transparent bg-[length:200%_100%] animate-shimmer font-semibold tracking-wider text-xs">
        {children}
      </span>
      <style jsx>{`
        @keyframes shimmer {
          0% { background-position: 200% center; }
          100% { background-position: -200% center; }
        }
        .animate-shimmer {
          animation: shimmer 3s linear infinite;
        }
      `}</style>
    </span>
  )
}

export function RecordingControls({
  isRecording,
  duration,
  canRecord,
  onStart,
  onStop,
  edgeMode,
  className,
  maxDuration,
  disabledReason,
}: RecordingControlsProps) {
  const [showTooltip, setShowTooltip] = useState(false)

  return (
    <div className={cn("flex items-center gap-4", className)}>
      {!isRecording ? (
        <div
          className="relative"
          onMouseEnter={() => { if (!canRecord) setShowTooltip(true) }}
          onMouseLeave={() => setShowTooltip(false)}
        >
          <button
            onClick={onStart}
            disabled={!canRecord}
            className={cn(
              "relative flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all",
              canRecord
                ? "bg-red-500 hover:bg-red-600 text-white animate-electric-idle"
                : "bg-white/10 text-white/40 cursor-not-allowed"
            )}
          >
            <Circle className="w-5 h-5 fill-current" />
            Start Recording
            {canRecord && (
              <style jsx>{`
                @keyframes electric-idle {
                  0%, 100% { box-shadow: 0 0 10px rgba(239, 68, 68, 0.2), 0 0 20px rgba(239, 68, 68, 0.1); }
                  50% { box-shadow: 0 0 15px rgba(239, 68, 68, 0.4), 0 0 30px rgba(239, 68, 68, 0.2); }
                }
                .animate-electric-idle {
                  animation: electric-idle 2s ease-in-out infinite;
                }
              `}</style>
            )}
          </button>
          {showTooltip && disabledReason && (
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-black/95 border border-white/20 rounded-lg text-xs text-white/80 whitespace-nowrap z-50 pointer-events-none shadow-xl">
              {disabledReason}
              <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px w-2 h-2 bg-black/95 border-r border-b border-white/20 rotate-45" />
            </div>
          )}
        </div>
      ) : (
        <button
          onClick={onStop}
          className={cn(
            "flex items-center gap-3 px-6 py-3 rounded-xl font-semibold transition-all border",
            edgeMode
              ? "bg-fuchsia-500/20 border-fuchsia-500/30 hover:bg-fuchsia-500/30 animate-electric-edge"
              : "bg-red-500/20 border-red-500/30 hover:bg-red-500/30 animate-electric-recording"
          )}
        >
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
            <span className="text-red-400">
              <ShinyText>REC</ShinyText>
            </span>
            <span className="text-red-400">
              <RollingTimer seconds={duration} />
            </span>
            {maxDuration && (
              <span className="text-white/40 text-xs">/ {maxDuration}s</span>
            )}
          </div>
          <div className="h-4 w-px bg-white/20" />
          <div className="flex items-center gap-2 text-white">
            <Square className="w-4 h-4 fill-current" />
            <span>STOP</span>
          </div>
          <style jsx>{`
            @keyframes electric-recording {
              0%, 100% { box-shadow: 0 0 8px rgba(239, 68, 68, 0.3), 0 0 16px rgba(239, 68, 68, 0.15); }
              25% { box-shadow: 0 0 12px rgba(239, 68, 68, 0.5), 0 0 24px rgba(239, 68, 68, 0.25), inset 0 0 4px rgba(239, 68, 68, 0.1); }
              50% { box-shadow: 0 0 8px rgba(239, 68, 68, 0.3), 0 0 16px rgba(239, 68, 68, 0.15); }
              75% { box-shadow: 0 0 14px rgba(239, 68, 68, 0.6), 0 0 28px rgba(239, 68, 68, 0.3), inset 0 0 6px rgba(239, 68, 68, 0.15); }
            }
            @keyframes electric-edge {
              0%, 100% { box-shadow: 0 0 8px rgba(217, 70, 239, 0.3), 0 0 16px rgba(217, 70, 239, 0.15); }
              25% { box-shadow: 0 0 12px rgba(217, 70, 239, 0.5), 0 0 24px rgba(217, 70, 239, 0.25), inset 0 0 4px rgba(217, 70, 239, 0.1); }
              50% { box-shadow: 0 0 8px rgba(217, 70, 239, 0.3), 0 0 16px rgba(217, 70, 239, 0.15); }
              75% { box-shadow: 0 0 14px rgba(217, 70, 239, 0.6), 0 0 28px rgba(217, 70, 239, 0.3), inset 0 0 6px rgba(217, 70, 239, 0.15); }
            }
            .animate-electric-recording {
              animation: electric-recording 1.5s ease-in-out infinite;
            }
            .animate-electric-edge {
              animation: electric-edge 1.2s ease-in-out infinite;
            }
          `}</style>
        </button>
      )}
    </div>
  )
}
