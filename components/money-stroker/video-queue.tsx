"use client"

import { useState } from "react"
import { motion, AnimatePresence, Reorder } from "framer-motion"
import { X, ChevronDown, ChevronUp, GripVertical, Play, Trash2, ListVideo } from "lucide-react"
import { cn } from "@/lib/utils"

export interface QueuedVideo {
  id: string
  name: string
  thumbnail: string
  duration: number
  has_script: boolean
  stream_url?: string | null
  stream_url_selfhosted?: string | null
}

interface VideoQueueProps {
  queue: QueuedVideo[]
  currentIndex: number
  onReorder: (videos: QueuedVideo[]) => void
  onRemove: (id: string) => void
  onSelect: (index: number) => void
  onClear: () => void
  className?: string
}

export function VideoQueue({
  queue,
  currentIndex,
  onReorder,
  onRemove,
  onSelect,
  onClear,
  className,
}: VideoQueueProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)

  if (queue.length === 0) {
    return null
  }

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className={cn(
        "bg-[#1a1a1a] rounded-xl border border-white/10 overflow-hidden w-72",
        className
      )}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-2 bg-white/5 border-b border-white/10 cursor-pointer"
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <div className="flex items-center gap-2">
          <ListVideo className="w-4 h-4 text-green-400" />
          <span className="text-sm font-medium">Queue ({queue.length})</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation()
              onClear()
            }}
            className="p-1 text-white/40 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
            title="Clear queue"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          {isCollapsed ? (
            <ChevronDown className="w-4 h-4 text-white/40" />
          ) : (
            <ChevronUp className="w-4 h-4 text-white/40" />
          )}
        </div>
      </div>

      {/* Queue List */}
      <AnimatePresence>
        {!isCollapsed && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: "auto" }}
            exit={{ height: 0 }}
            className="overflow-hidden"
          >
            <Reorder.Group
              axis="y"
              values={queue}
              onReorder={onReorder}
              className="p-2 space-y-1 max-h-64 overflow-y-auto"
            >
              {queue.map((video, index) => (
                <Reorder.Item
                  key={video.id}
                  value={video}
                  className={cn(
                    "flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-grab active:cursor-grabbing transition-colors group",
                    index === currentIndex
                      ? "bg-green-500/20 border border-green-500/30"
                      : "bg-white/5 hover:bg-white/10 border border-transparent"
                  )}
                >
                  <GripVertical className="w-3.5 h-3.5 text-white/30 flex-shrink-0" />

                  {/* Thumbnail */}
                  <div className="relative w-12 h-8 rounded overflow-hidden flex-shrink-0 bg-black">
                    {video.thumbnail ? (
                      <img
                        src={video.thumbnail}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-white/10 flex items-center justify-center">
                        <Play className="w-3 h-3 text-white/40" />
                      </div>
                    )}
                    {index === currentIndex && (
                      <div className="absolute inset-0 flex items-center justify-center bg-green-500/40">
                        <Play className="w-3 h-3 text-white" fill="white" />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">
                      {index + 1}. {video.name}
                    </p>
                    <p className="text-[10px] text-white/40">
                      {formatDuration(video.duration)}
                      {video.has_script && " • Sync"}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {index !== currentIndex && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          onSelect(index)
                        }}
                        className="p-1 text-white/40 hover:text-white hover:bg-white/10 rounded transition-colors"
                        title="Play now"
                      >
                        <Play className="w-3 h-3" />
                      </button>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onRemove(video.id)
                      }}
                      className="p-1 text-white/40 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                      title="Remove from queue"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                </Reorder.Item>
              ))}
            </Reorder.Group>

            {/* Keyboard hint */}
            <div className="px-3 py-2 border-t border-white/5 text-center">
              <p className="text-[10px] text-white/30">
                <kbd className="px-1 bg-white/10 rounded">N</kbd> next • <kbd className="px-1 bg-white/10 rounded">Q</kbd> add
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
