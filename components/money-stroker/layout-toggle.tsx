"use client"

import { cn } from "@/lib/utils"
import type { RecordingLayoutMode } from "@/hooks/use-money-stroker-recorder"
import { RECORDING_LAYOUTS } from "@/hooks/use-money-stroker-recorder"

interface LayoutToggleProps {
  value: RecordingLayoutMode
  onChange: (mode: RecordingLayoutMode) => void
  className?: string
  disabled?: boolean
  disabledMessage?: string
}

export function LayoutToggle({
  value,
  onChange,
  className,
  disabled = false,
  disabledMessage = "Select a video source to change layout",
}: LayoutToggleProps) {
  return (
    <div className={cn("space-y-2", className)}>
      <label className="text-sm text-white/60 font-medium">Layout</label>
      <div>
        <div className={cn(
          "flex gap-1 p-1 bg-white/5 rounded-lg border",
          disabled ? "border-white/5 opacity-50" : "border-white/10"
        )}>
          {RECORDING_LAYOUTS.map((layout) => {
            const isSelected = value === layout.mode

            return (
              <button
                key={layout.mode}
                onClick={() => !disabled && onChange(layout.mode)}
                disabled={disabled}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-all",
                  disabled
                    ? "cursor-not-allowed opacity-50"
                    : "cursor-pointer",
                  isSelected && !disabled
                    ? "bg-white/10 text-white"
                    : "text-white/50 hover:bg-white/5 hover:text-white/80"
                )}
                title={disabled ? disabledMessage : layout.description}
              >
                <span className="text-base">{layout.icon}</span>
                <span className="hidden md:inline">{layout.label}</span>
              </button>
            )
          })}
        </div>
        {disabled && (
          <p className="text-xs text-white/40 mt-1.5">{disabledMessage}</p>
        )}
      </div>
    </div>
  )
}
