"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Home, Plane, Laptop, Camera, Smartphone, ChevronRight } from "lucide-react"
import Link from "next/link"

type SetupMode = "home" | "weekender"

interface SetupTabsProps {
  onShowPackingList: () => void
}

export function SetupTabs({ onShowPackingList }: SetupTabsProps) {
  const [mode, setMode] = useState<SetupMode>("home")

  return (
    <div className="space-y-4">
      {/* Tab Buttons */}
      <div className="flex gap-2">
        <button
          onClick={() => setMode("home")}
          className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-medium transition-all ${
            mode === "home"
              ? "bg-green-500 text-black"
              : "bg-white/5 text-white/60 hover:bg-white/10"
          }`}
        >
          <Home className="w-4 h-4" />
          Home Setup
        </button>
        <button
          onClick={() => setMode("weekender")}
          className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-medium transition-all ${
            mode === "weekender"
              ? "bg-green-500 text-black"
              : "bg-white/5 text-white/60 hover:bg-white/10"
          }`}
        >
          <Plane className="w-4 h-4" />
          Weekender Setup
        </button>
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        {mode === "home" ? (
          <motion.div
            key="home"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-[#141414] rounded-xl border border-white/5 p-6"
          >
            <h3 className="text-lg font-semibold mb-2">Record from your desk</h3>
            <p className="text-white/60 text-sm mb-4">
              Use your existing webcam and laptop. Most creators start here.
            </p>

            <div className="space-y-3 mb-6">
              <div className="flex items-center gap-3 text-sm">
                <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                  <Laptop className="w-4 h-4 text-blue-400" />
                </div>
                <span className="text-white/70">Laptop with webcam</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center">
                  <Camera className="w-4 h-4 text-green-400" />
                </div>
                <span className="text-white/70">External webcam (optional, better angles)</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
                  <Smartphone className="w-4 h-4 text-purple-400" />
                </div>
                <span className="text-white/70">Your Handy or VacuGlide device</span>
              </div>
            </div>

            <Link
              href="/chat"
              className="flex items-center justify-center gap-2 w-full py-3 bg-green-500 hover:bg-green-600 text-black font-medium rounded-xl transition-colors"
            >
              Start a Session
              <ChevronRight className="w-4 h-4" />
            </Link>
          </motion.div>
        ) : (
          <motion.div
            key="weekender"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-[#141414] rounded-xl border border-white/5 p-6"
          >
            <h3 className="text-lg font-semibold mb-2">Run a content business from a hotel room</h3>
            <p className="text-white/60 text-sm mb-4">
              Fits in one bag. Luxury hotels = free production value.
            </p>

            <div className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 rounded-lg border border-amber-500/20 p-4 mb-6">
              <p className="text-sm text-amber-400">
                <span className="font-semibold">The Weekender Bag:</span> Everything you need to shoot content anywhere. Sets up in 10 minutes.
              </p>
            </div>

            <button
              onClick={onShowPackingList}
              className="flex items-center justify-center gap-2 w-full py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-black font-medium rounded-xl transition-colors"
            >
              See Full Packing List
              <ChevronRight className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
