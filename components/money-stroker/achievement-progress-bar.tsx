"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { Award, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

interface AchievementProgress {
  achievement_name: string
  achievement_description: string
  metric_label: string
  current: number
  total: number
  xp_earned: number
}

export function AchievementProgressBar() {
  const [progress, setProgress] = useState<AchievementProgress | null>(null)
  const [isExpanded, setIsExpanded] = useState(true)

  useEffect(() => {
    fetch("/api/achievements/next-unlock")
      .then((r) => {
        if (r.ok) return r.json()
        return null
      })
      .then((data) => {
        if (data) setProgress(data)
      })
      .catch(() => {
        // Silently fail - hide progress bar
      })
  }, [])

  if (!progress) return null

  const percent = Math.min(100, (progress.current / progress.total) * 100)

  return (
    <div className="mt-4 bg-white/5 border border-white/10 rounded-lg overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-3 flex items-center justify-between hover:bg-white/5 transition"
      >
        <div className="flex items-center gap-3">
          <Award className="w-5 h-5 text-yellow-400" />
          <div className="text-left">
            <p className="text-sm font-medium text-white">
              {progress.current}/{progress.total} {progress.metric_label}
            </p>
            <p className="text-xs text-white/60">
              Next unlock: {progress.achievement_name}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-green-400">+{progress.xp_earned} XP earned</span>
          <ChevronDown className={cn("w-4 h-4 text-white/50 transition", isExpanded && "rotate-180")} />
        </div>
      </button>

      {isExpanded && (
        <div className="p-3 pt-0 space-y-2">
          <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${percent}%` }}
              className="h-full bg-gradient-to-r from-yellow-500 to-orange-500"
            />
          </div>
          <p className="text-xs text-white/50">
            {progress.achievement_description}
          </p>
        </div>
      )}
    </div>
  )
}
