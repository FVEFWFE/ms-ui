"use client"

import { cn } from "@/lib/utils"
import type { WebcamPosition, RecordingLayoutMode } from "@/hooks/use-money-stroker-recorder"

interface PositionToggleProps {
  value: WebcamPosition
  onChange: (position: WebcamPosition) => void
  layoutMode?: RecordingLayoutMode
  className?: string
}

// Position options for different modes
const SPLIT_POSITIONS: { value: WebcamPosition; label: string; icon: string }[] = [
  { value: "left", label: "Left", icon: "◀" },
  { value: "right", label: "Right", icon: "▶" },
  { value: "left-center", label: "Left Full", icon: "▌" },
  { value: "right-center", label: "Right Full", icon: "▐" },
]

const PIP_POSITIONS: { value: WebcamPosition; label: string; gridPos: string }[] = [
  { value: "top-left", label: "Top Left", gridPos: "row-start-1 col-start-1" },
  { value: "top-right", label: "Top Right", gridPos: "row-start-1 col-start-2" },
  { value: "bottom-left", label: "Bottom Left", gridPos: "row-start-2 col-start-1" },
  { value: "bottom-right", label: "Bottom Right", gridPos: "row-start-2 col-start-2" },
]

export function PositionToggle({
  value,
  onChange,
  layoutMode = "side-by-side",
  className,
}: PositionToggleProps) {
  const isPipMode = layoutMode === "pip"

  // For PiP modes, show 4-corner grid
  if (isPipMode) {
    return (
      <div className={cn("space-y-2", className)}>
        <label className="text-sm text-white/60 font-medium">PiP Position</label>
        <div className="grid grid-cols-2 gap-1 p-1 bg-white/5 rounded-lg border border-white/10 w-fit">
          {PIP_POSITIONS.map((pos) => {
            // Map old left/right values to bottom corners for backwards compatibility
            const effectiveValue = value === "left" ? "bottom-left"
              : value === "right" ? "bottom-right"
              : value
            const isSelected = effectiveValue === pos.value

            return (
              <button
                key={pos.value}
                onClick={() => onChange(pos.value)}
                className={cn(
                  "w-10 h-8 rounded text-xs font-medium transition-all cursor-pointer flex items-center justify-center",
                  pos.gridPos,
                  isSelected
                    ? "bg-green-500/20 text-green-400 border border-green-500/30"
                    : "bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/80 border border-transparent"
                )}
                title={pos.label}
              >
                {pos.value === "top-left" && "↖"}
                {pos.value === "top-right" && "↗"}
                {pos.value === "bottom-left" && "↙"}
                {pos.value === "bottom-right" && "↘"}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  // For split modes (side-by-side, stacked), show left/right
  return (
    <div className={cn("space-y-2", className)}>
      <label className="text-sm text-white/60 font-medium">Webcam Position</label>
      <div className="flex gap-1 p-1 bg-white/5 rounded-lg border border-white/10">
        {SPLIT_POSITIONS.map((pos) => {
          const isSelected = value === pos.value

          return (
            <button
              key={pos.value}
              onClick={() => onChange(pos.value)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-all cursor-pointer",
                isSelected
                  ? "bg-green-500/20 text-green-400"
                  : "text-white/50 hover:bg-white/5 hover:text-white/80"
              )}
              title={pos.value.includes("center") ? `Full-height webcam on ${pos.value.startsWith("left") ? "left" : "right"}` : `Webcam on ${pos.label.toLowerCase()} side`}
            >
              {(pos.value === "left" || pos.value === "left-center") && <span className="text-base">{pos.icon}</span>}
              <span>{pos.label}</span>
              {(pos.value === "right" || pos.value === "right-center") && <span className="text-base">{pos.icon}</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}
