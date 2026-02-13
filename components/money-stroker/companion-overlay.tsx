"use client"

import { motion, AnimatePresence } from "framer-motion"
import { Volume2, MessageCircle, X } from "lucide-react"
import { cn } from "@/lib/utils"
import type { CompanionAction } from "@/hooks/use-companion-overlay"

interface CompanionOverlayProps {
  isVisible: boolean
  currentAction: CompanionAction
  volume: number
  onTriggerAction: (action: CompanionAction) => void
  onToggleVisibility: () => void
  onAdjustVolume: (delta: number) => void
}

export function CompanionOverlay({
  isVisible,
  currentAction,
  volume,
  onTriggerAction,
  onToggleVisibility,
  onAdjustVolume,
}: CompanionOverlayProps) {
  if (!isVisible) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, x: 100 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 100 }}
        className="absolute right-4 bottom-4 w-72 bg-black/90 backdrop-blur border border-white/20 rounded-lg shadow-2xl z-40"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
          <div className="flex items-center gap-2">
            <MessageCircle className="w-4 h-4 text-pink-400" />
            <span className="text-xs font-medium text-white/80">AI Companion</span>
          </div>
          <button
            onClick={onToggleVisibility}
            className="p-1 hover:bg-white/10 rounded transition-colors"
          >
            <X className="w-3 h-3 text-white/50" />
          </button>
        </div>

        {/* Companion avatar area */}
        <div className="aspect-[4/3] bg-gradient-to-br from-pink-500/10 to-purple-500/10 flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 bg-pink-500/20 rounded-full flex items-center justify-center mx-auto mb-2 border border-pink-500/30">
              <MessageCircle className="w-8 h-8 text-pink-400" />
            </div>
            <p className="text-xs text-white/50">
              {currentAction === "idle" && "Waiting..."}
              {currentAction === "talk_dirty" && "Talking dirty..."}
              {currentAction === "encourage" && "Encouraging you..."}
              {currentAction === "tease" && "Teasing you..."}
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="p-3 space-y-2">
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => onTriggerAction("talk_dirty")}
              className={cn(
                "px-2 py-2 bg-white/5 hover:bg-pink-500/20 border border-white/10 rounded text-xs transition",
                currentAction === "talk_dirty" && "bg-pink-500/20 border-pink-500/50"
              )}
            >
              Talk Dirty
            </button>
            <button
              onClick={() => onTriggerAction("encourage")}
              className={cn(
                "px-2 py-2 bg-white/5 hover:bg-green-500/20 border border-white/10 rounded text-xs transition",
                currentAction === "encourage" && "bg-green-500/20 border-green-500/50"
              )}
            >
              Encourage
            </button>
            <button
              onClick={() => onTriggerAction("tease")}
              className={cn(
                "px-2 py-2 bg-white/5 hover:bg-purple-500/20 border border-white/10 rounded text-xs transition",
                currentAction === "tease" && "bg-purple-500/20 border-purple-500/50"
              )}
            >
              Tease
            </button>
          </div>

          {/* Volume control */}
          <div className="flex items-center gap-2">
            <Volume2 className="w-4 h-4 text-white/50 flex-shrink-0" />
            <input
              type="range"
              min="0"
              max="100"
              value={Math.round(volume * 100)}
              onChange={(e) => onAdjustVolume(parseInt(e.target.value) / 100 - volume)}
              className="flex-1 h-1 accent-pink-400 cursor-pointer"
            />
            <span className="text-xs text-white/50 w-8 text-right">{Math.round(volume * 100)}%</span>
          </div>

          {/* Keyboard hints */}
          <p className="text-[9px] text-white/30 text-center">
            <kbd className="px-1 bg-white/10 rounded">1</kbd> dirty{" "}
            <kbd className="px-1 bg-white/10 rounded">2</kbd> encourage{" "}
            <kbd className="px-1 bg-white/10 rounded">3</kbd> tease{" "}
            <kbd className="px-1 bg-white/10 rounded">C</kbd> hide
          </p>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
