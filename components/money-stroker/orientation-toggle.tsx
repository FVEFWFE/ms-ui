"use client"

import { cn } from "@/lib/utils"
import type { CanvasOrientation } from "@/hooks/use-money-stroker-recorder"

interface OrientationToggleProps {
  value: CanvasOrientation
  onChange: (orientation: CanvasOrientation) => void
  className?: string
}

export function OrientationToggle({
  value,
  onChange,
  className,
}: OrientationToggleProps) {
  return (
    <div className={cn("space-y-2", className)}>
      <label className="text-sm text-white/60 font-medium">Orientation</label>
      <div className="flex gap-1 p-1 bg-white/5 rounded-lg border border-white/10">
        <button
          onClick={() => onChange("horizontal")}
          className={cn(
            "flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-all cursor-pointer",
            value === "horizontal"
              ? "bg-white/10 text-white"
              : "text-white/50 hover:bg-white/5 hover:text-white/80"
          )}
          title="Landscape (1920x1080)"
        >
          <span className="text-lg">▬</span>
          <span className="hidden sm:inline">Landscape</span>
        </button>
        <button
          onClick={() => onChange("vertical")}
          className={cn(
            "flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-all cursor-pointer",
            value === "vertical"
              ? "bg-white/10 text-white"
              : "text-white/50 hover:bg-white/5 hover:text-white/80"
          )}
          title="Portrait (1080x1920)"
        >
          <span className="text-lg">▮</span>
          <span className="hidden sm:inline">Portrait</span>
        </button>
      </div>
    </div>
  )
}
