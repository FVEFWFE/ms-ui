"use client"

import { useState, useCallback, useEffect } from "react"
import { GripVertical, GripHorizontal } from "lucide-react"

interface SplitDividerProps {
  orientation: "vertical" | "horizontal" // vertical = side-by-side, horizontal = stacked
  initialSplit?: number // percentage (0-100), default 50
  onChange: (splitPercent: number) => void
  containerRef: React.RefObject<HTMLElement>
}

export function SplitDivider({
  orientation,
  initialSplit = 50,
  onChange,
  containerRef,
}: SplitDividerProps) {
  const [split, setSplit] = useState(initialSplit)
  const [isDragging, setIsDragging] = useState(false)

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return

      const rect = containerRef.current.getBoundingClientRect()
      let newSplit: number

      if (orientation === "vertical") {
        // Side-by-side: horizontal drag
        const x = e.clientX - rect.left
        newSplit = (x / rect.width) * 100
      } else {
        // Stacked: vertical drag
        const y = e.clientY - rect.top
        newSplit = (y / rect.height) * 100
      }

      // Clamp between 20% and 80%
      newSplit = Math.max(20, Math.min(80, newSplit))
      setSplit(newSplit)
      onChange(newSplit)
    }

    const handleMouseUp = () => {
      setIsDragging(false)
    }

    document.addEventListener("mousemove", handleMouseMove)
    document.addEventListener("mouseup", handleMouseUp)

    return () => {
      document.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("mouseup", handleMouseUp)
    }
  }, [isDragging, orientation, containerRef, onChange])

  return (
    <div
      className={`
        absolute z-10 flex items-center justify-center
        ${orientation === "vertical" ? "top-0 bottom-0 w-1 cursor-col-resize hover:w-2" : "left-0 right-0 h-1 cursor-row-resize hover:h-2"}
        ${isDragging ? "bg-green-400/50" : "bg-white/30 hover:bg-green-400/30"}
        transition-all group
      `}
      style={
        orientation === "vertical"
          ? { left: `${split}%`, transform: "translateX(-50%)" }
          : { top: `${split}%`, transform: "translateY(-50%)" }
      }
      onMouseDown={handleMouseDown}
    >
      <div className="absolute bg-white/80 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {orientation === "vertical" ? (
          <GripVertical className="w-3 h-3 text-gray-700" />
        ) : (
          <GripHorizontal className="w-3 h-3 text-gray-700" />
        )}
      </div>
    </div>
  )
}
