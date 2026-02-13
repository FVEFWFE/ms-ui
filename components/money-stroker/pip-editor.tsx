"use client"

import { useRef, useState, useCallback, useEffect } from "react"
import { cn } from "@/lib/utils"

export interface PipPosition {
  x: number // percentage (0-100)
  y: number // percentage (0-100)
  width: number // percentage (0-100)
  height: number // percentage (0-100)
}

interface PipEditorProps {
  position: PipPosition
  onChange: (position: PipPosition) => void
  canvasWidth: number
  canvasHeight: number
  webcamAspectRatio: number // width/height of webcam
  className?: string
  disabled?: boolean
}

type ResizeHandle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w" | null

export function PipEditor({
  position,
  onChange,
  canvasWidth,
  canvasHeight,
  webcamAspectRatio,
  className,
  disabled = false,
}: PipEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isHovered, setIsHovered] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const [activeHandle, setActiveHandle] = useState<ResizeHandle>(null)
  const dragStartRef = useRef<{ mouseX: number; mouseY: number; pipX: number; pipY: number } | null>(null)
  const resizeStartRef = useRef<{ mouseX: number; mouseY: number; pip: PipPosition } | null>(null)

  // Canvas aspect ratio — needed because width% is relative to canvas width
  // and height% is relative to canvas height (non-square coordinate space)
  const canvasAspect = canvasWidth / canvasHeight

  // Convert width% to height% preserving webcam aspect ratio
  const widthToHeight = (w: number) => (w * canvasAspect) / webcamAspectRatio
  // Convert height% to width% preserving webcam aspect ratio
  const heightToWidth = (h: number) => (h * webcamAspectRatio) / canvasAspect

  // Show handles when actively interacting
  const showHandles = isHovered || isDragging || isResizing

  // Handle double-click to reset to default
  const handleDoubleClick = useCallback(() => {
    if (disabled) return
    const defaultWidth = 40
    const defaultHeight = widthToHeight(defaultWidth)
    onChange({
      x: 100 - defaultWidth - 2,
      y: 100 - defaultHeight - 2,
      width: defaultWidth,
      height: defaultHeight,
    })
  }, [onChange, disabled, canvasAspect, webcamAspectRatio])

  // Handle mouse down on PiP (start drag)
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (disabled) return
    e.stopPropagation()

    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()

    dragStartRef.current = {
      mouseX: e.clientX - rect.left,
      mouseY: e.clientY - rect.top,
      pipX: position.x,
      pipY: position.y,
    }
    setIsDragging(true)
  }, [position.x, position.y, disabled])

  // Handle mouse down on resize handle
  const handleResizeStart = useCallback((e: React.MouseEvent, handle: ResizeHandle) => {
    if (disabled) return
    e.stopPropagation()
    e.preventDefault()

    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()

    resizeStartRef.current = {
      mouseX: e.clientX - rect.left,
      mouseY: e.clientY - rect.top,
      pip: { ...position },
    }
    setActiveHandle(handle)
    setIsResizing(true)
  }, [position, disabled])

  // Shared resize logic used by both inline and global handlers
  const applyResize = useCallback((deltaX: number, deltaY: number, start: { pip: PipPosition }, handle: ResizeHandle) => {
    let newPip = { ...start.pip }
    const minWidth = 5

    switch (handle) {
      case "e":
        newPip.width = Math.max(minWidth, Math.min(100 - newPip.x, start.pip.width + deltaX))
        newPip.height = widthToHeight(newPip.width)
        break
      case "w": {
        const w = Math.max(minWidth, Math.min(start.pip.x + start.pip.width, start.pip.width - deltaX))
        newPip.x = start.pip.x + (start.pip.width - w)
        newPip.width = w
        newPip.height = widthToHeight(newPip.width)
        break
      }
      case "s": {
        const minHeight = widthToHeight(minWidth)
        newPip.height = Math.max(minHeight, Math.min(100 - newPip.y, start.pip.height + deltaY))
        newPip.width = heightToWidth(newPip.height)
        break
      }
      case "n": {
        const minHeight = widthToHeight(minWidth)
        const h = Math.max(minHeight, Math.min(start.pip.y + start.pip.height, start.pip.height - deltaY))
        newPip.y = start.pip.y + (start.pip.height - h)
        newPip.height = h
        newPip.width = heightToWidth(newPip.height)
        break
      }
      case "se":
      case "ne":
      case "sw":
      case "nw":
        // Corner resize: use horizontal delta for width, compute height
        if (handle.includes("e")) {
          newPip.width = Math.max(minWidth, Math.min(100 - start.pip.x, start.pip.width + deltaX))
        } else {
          const w = Math.max(minWidth, Math.min(start.pip.x + start.pip.width, start.pip.width - deltaX))
          newPip.x = start.pip.x + (start.pip.width - w)
          newPip.width = w
        }
        newPip.height = widthToHeight(newPip.width)

        if (handle.includes("n")) {
          newPip.y = start.pip.y + start.pip.height - newPip.height
        }
        break
    }

    // Ensure bounds — allow up to 75% off-screen (25% must remain visible)
    newPip.x = Math.max(-newPip.width * 0.75, Math.min(100 - newPip.width * 0.25, newPip.x))
    newPip.y = Math.max(-newPip.height * 0.75, Math.min(100 - newPip.height * 0.25, newPip.y))
    newPip.width = Math.min(100, newPip.width)
    newPip.height = Math.min(100, newPip.height)

    return newPip
  }, [canvasAspect, webcamAspectRatio])

  // Handle mouse move (drag or resize)
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top
    const containerWidth = rect.width
    const containerHeight = rect.height

    if (isDragging && dragStartRef.current) {
      const deltaX = ((mouseX - dragStartRef.current.mouseX) / containerWidth) * 100
      const deltaY = ((mouseY - dragStartRef.current.mouseY) / containerHeight) * 100

      let newX = dragStartRef.current.pipX + deltaX
      let newY = dragStartRef.current.pipY + deltaY

      newX = Math.max(-position.width * 0.75, Math.min(100 - position.width * 0.25, newX))
      newY = Math.max(-position.height * 0.75, Math.min(100 - position.height * 0.25, newY))

      onChange({ ...position, x: newX, y: newY })
    }

    if (isResizing && resizeStartRef.current && activeHandle) {
      const start = resizeStartRef.current
      const deltaX = ((mouseX - start.mouseX) / containerWidth) * 100
      const deltaY = ((mouseY - start.mouseY) / containerHeight) * 100
      onChange(applyResize(deltaX, deltaY, start, activeHandle))
    }
  }, [isDragging, isResizing, activeHandle, position, onChange, applyResize])

  // Handle mouse up (end drag or resize)
  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
    setIsResizing(false)
    setActiveHandle(null)
    dragStartRef.current = null
    resizeStartRef.current = null
  }, [])

  // Add global mouse event listeners when dragging/resizing
  useEffect(() => {
    if (isDragging || isResizing) {
      const handleGlobalMouseMove = (e: MouseEvent) => {
        if (!containerRef.current) return
        const rect = containerRef.current.getBoundingClientRect()
        const mouseX = e.clientX - rect.left
        const mouseY = e.clientY - rect.top
        const containerWidth = rect.width
        const containerHeight = rect.height

        if (isDragging && dragStartRef.current) {
          const deltaX = ((mouseX - dragStartRef.current.mouseX) / containerWidth) * 100
          const deltaY = ((mouseY - dragStartRef.current.mouseY) / containerHeight) * 100

          let newX = dragStartRef.current.pipX + deltaX
          let newY = dragStartRef.current.pipY + deltaY

          newX = Math.max(-position.width * 0.75, Math.min(100 - position.width * 0.25, newX))
          newY = Math.max(-position.height * 0.75, Math.min(100 - position.height * 0.25, newY))

          onChange({ ...position, x: newX, y: newY })
        }

        if (isResizing && resizeStartRef.current && activeHandle) {
          const start = resizeStartRef.current
          const deltaX = ((mouseX - start.mouseX) / containerWidth) * 100
          const deltaY = ((mouseY - start.mouseY) / containerHeight) * 100
          onChange(applyResize(deltaX, deltaY, start, activeHandle))
        }
      }

      const handleGlobalMouseUp = () => {
        setIsDragging(false)
        setIsResizing(false)
        setActiveHandle(null)
        dragStartRef.current = null
        resizeStartRef.current = null
      }

      document.addEventListener("mousemove", handleGlobalMouseMove)
      document.addEventListener("mouseup", handleGlobalMouseUp)
      return () => {
        document.removeEventListener("mousemove", handleGlobalMouseMove)
        document.removeEventListener("mouseup", handleGlobalMouseUp)
      }
    }
  }, [isDragging, isResizing, activeHandle, position, onChange, applyResize])

  const handles: { pos: ResizeHandle; style: React.CSSProperties; cursor: string }[] = [
    { pos: "nw", style: { top: -6, left: -6 }, cursor: "nwse-resize" },
    { pos: "n", style: { top: -6, left: "50%", transform: "translateX(-50%)" }, cursor: "ns-resize" },
    { pos: "ne", style: { top: -6, right: -6 }, cursor: "nesw-resize" },
    { pos: "e", style: { top: "50%", right: -6, transform: "translateY(-50%)" }, cursor: "ew-resize" },
    { pos: "se", style: { bottom: -6, right: -6 }, cursor: "nwse-resize" },
    { pos: "s", style: { bottom: -6, left: "50%", transform: "translateX(-50%)" }, cursor: "ns-resize" },
    { pos: "sw", style: { bottom: -6, left: -6 }, cursor: "nesw-resize" },
    { pos: "w", style: { top: "50%", left: -6, transform: "translateY(-50%)" }, cursor: "ew-resize" },
  ]

  if (disabled) return null

  return (
    <div
      ref={containerRef}
      className={cn("absolute inset-0 pointer-events-none", className)}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      {/* PiP interaction area */}
      <div
        className={cn(
          "absolute pointer-events-auto",
          isDragging ? "cursor-grabbing" : "cursor-grab"
        )}
        style={{
          left: `${position.x}%`,
          top: `${position.y}%`,
          width: `${position.width}%`,
          height: `${position.height}%`,
        }}
        onMouseDown={handleMouseDown}
        onDoubleClick={handleDoubleClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => { if (!isDragging && !isResizing) setIsHovered(false) }}
      >
        {/* Border - subtle when idle, bright when hovered/active */}
        <div className={cn(
          "absolute inset-0 rounded-lg pointer-events-none transition-all",
          showHandles
            ? "border-2 border-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.3)]"
            : "border-2 border-white/20 hover:border-white/40"
        )} />

        {/* Resize handles - visible on hover */}
        {showHandles && handles.map(({ pos, style, cursor }) => (
          <div
            key={pos}
            className="absolute w-4 h-4 bg-white border-2 border-blue-500 rounded-sm pointer-events-auto shadow-md hover:scale-125 transition-transform"
            style={{ ...style, cursor }}
            onMouseDown={(e) => handleResizeStart(e, pos)}
          />
        ))}

        {/* Size label when interacting */}
        {(isDragging || isResizing) && (
          <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-black/80 rounded text-[10px] text-white/80 whitespace-nowrap pointer-events-none">
            {Math.round(position.width)}% x {Math.round(position.height)}%
          </div>
        )}
      </div>
    </div>
  )
}
