"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Coins } from "lucide-react"

interface EarningsPulseProps {
  sessionCredits: {
    strokes: number
    edges: number
    highIntensity: number
    total: number
  }
}

export function EarningsPulse({ sessionCredits }: EarningsPulseProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="absolute top-4 right-4 z-30"
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
    >
      <div className="bg-black/80 backdrop-blur border border-green-500/50 rounded-full px-4 py-2 flex items-center gap-2">
        <Coins className="w-4 h-4 text-green-400" />
        <motion.span
          key={Math.floor(sessionCredits.total * 10)}
          initial={{ scale: 1.2 }}
          animate={{ scale: 1 }}
          className="text-green-400 font-semibold text-sm tabular-nums"
        >
          +{sessionCredits.total.toFixed(1)}
        </motion.span>
        <span className="text-white/50 text-xs">credits</span>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-2 bg-black/90 backdrop-blur border border-white/20 rounded-lg p-3 text-xs space-y-1"
          >
            <div className="flex justify-between gap-6">
              <span className="text-white/50">Strokes:</span>
              <span className="text-white font-mono">+{sessionCredits.strokes.toFixed(1)}</span>
            </div>
            <div className="flex justify-between gap-6">
              <span className="text-white/50">Edges:</span>
              <span className="text-white font-mono">+{sessionCredits.edges.toFixed(1)}</span>
            </div>
            <div className="flex justify-between gap-6">
              <span className="text-white/50">High intensity:</span>
              <span className="text-white font-mono">+{sessionCredits.highIntensity.toFixed(1)}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
