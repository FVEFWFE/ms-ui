"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Shield, ChevronDown, Lock, Check } from "lucide-react"
import { cn } from "@/lib/utils"
import { FACE_HIDERS, getFaceHiderById } from "@/lib/face-hider-definitions"
import { useFaceHider } from "@/hooks/use-face-hider"

interface FaceHiderSelectorProps {
  onSelect: (filterId: string) => void
}

export function FaceHiderSelector({ onSelect }: FaceHiderSelectorProps) {
  const { unlockedFilters, getUnlockProgress } = useFaceHider()
  const [selectedFilter, setSelectedFilter] = useState<string>("none")
  const [isOpen, setIsOpen] = useState(false)

  const handleSelect = (filterId: string) => {
    setSelectedFilter(filterId)
    setIsOpen(false)
    onSelect(filterId)
  }

  const currentFilter = getFaceHiderById(selectedFilter)

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition"
      >
        <Shield className="w-4 h-4 text-white/70" />
        <span className="text-sm text-white/70">{currentFilter?.name || "No Filter"}</span>
        <ChevronDown className={cn("w-3 h-3 text-white/50 transition", isOpen && "rotate-180")} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-full mt-2 left-0 w-80 bg-black/95 backdrop-blur border border-white/20 rounded-lg shadow-2xl z-50 p-4"
          >
            <p className="text-xs text-white/50 mb-3">Face Hiders (Applied After Transform)</p>

            <div className="grid grid-cols-4 gap-3 max-h-80 overflow-y-auto">
              {FACE_HIDERS.map((filter) => {
                const progress = getUnlockProgress(filter.id)
                const isUnlocked = unlockedFilters.includes(filter.id)

                return (
                  <button
                    key={filter.id}
                    onClick={() => {
                      if (isUnlocked) {
                        handleSelect(filter.id)
                      }
                    }}
                    disabled={!isUnlocked}
                    className={cn(
                      "relative aspect-square rounded-lg border-2 flex flex-col items-center justify-center transition group",
                      isUnlocked
                        ? "bg-white/5 border-white/20 hover:border-white/40 cursor-pointer"
                        : "bg-white/5 border-white/10 opacity-50 cursor-not-allowed",
                      selectedFilter === filter.id && "border-green-500 bg-green-500/10"
                    )}
                  >
                    {isUnlocked ? (
                      <>
                        <Shield className="w-6 h-6 text-white/50" />
                        {selectedFilter === filter.id && (
                          <div className="absolute top-1 right-1 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                            <Check className="w-3 h-3 text-white" />
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        <Lock className="w-5 h-5 text-white/30 mb-1" />
                        <div className="w-full px-1">
                          <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-blue-500 transition-all"
                              style={{ width: `${progress.progressPercent}%` }}
                            />
                          </div>
                        </div>

                        {/* Tooltip on hover */}
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-black/90 border border-white/20 rounded text-[10px] text-white whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                          {progress.description}
                        </div>
                      </>
                    )}

                    <p className="absolute -bottom-4 left-1/2 -translate-x-1/2 text-[9px] text-white/50 whitespace-nowrap">
                      {filter.name}
                    </p>
                  </button>
                )
              })}
            </div>

            <div className="mt-6 pt-3 border-t border-white/10">
              <p className="text-[10px] text-white/40">
                Unlock more filters by completing recordings and earning achievements
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
