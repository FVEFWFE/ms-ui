"use client"

import { useState, useEffect } from "react"
import { X, Zap, ExternalLink } from "lucide-react"
import { FunscriptWaveformCanvas } from "./funscript-waveform-canvas"
import type { FunscriptAction, Funscript } from "@/lib/funscript-utils"

const WIDGET_DISMISSED_KEY = "funscript-widget-dismissed"
const DISMISS_DURATION_MS = 24 * 60 * 60 * 1000 // 24 hours

type DeviceType = "vacuglide" | "handy"

interface DeviceInfo {
  name: string
  affiliateUrl: string
  promoCode: string
  discount: string
  description: string
}

const DEVICES: Record<DeviceType, DeviceInfo> = {
  vacuglide: {
    name: "VacuGlide 2",
    affiliateUrl:
      "https://vacuglide.com/?ref=getgooned&utm_source=getgooned&utm_medium=video-widget",
    promoCode: "GOONED",
    discount: "10%",
    description: "Premium stroker with suction control",
  },
  handy: {
    name: "The Handy",
    affiliateUrl:
      "https://www.thehandy.com/?ref=getgooned&utm_source=getgooned&utm_medium=affiliate&utm_campaign=video-widget",
    promoCode: "GETGOONED",
    discount: "10%",
    description: "High speed automatic stroker",
  },
}

interface FunscriptVisualizerWidgetProps {
  funscript: Funscript | null
  currentTimeMs: number
  videoDurationMs: number
  onDismiss?: () => void
}

function isDismissed(): boolean {
  if (typeof window === "undefined") return false
  const dismissed = localStorage.getItem(WIDGET_DISMISSED_KEY)
  if (!dismissed) return false
  return Date.now() - parseInt(dismissed, 10) < DISMISS_DURATION_MS
}

function setDismissed(): void {
  if (typeof window === "undefined") return
  localStorage.setItem(WIDGET_DISMISSED_KEY, Date.now().toString())
}

export function FunscriptVisualizerWidget({
  funscript,
  currentTimeMs,
  videoDurationMs,
  onDismiss,
}: FunscriptVisualizerWidgetProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [selectedDevice, setSelectedDevice] = useState<DeviceType>("vacuglide")

  // Check localStorage on mount
  useEffect(() => {
    setIsVisible(!isDismissed())
  }, [])

  const handleDismiss = () => {
    setDismissed()
    setIsVisible(false)
    onDismiss?.()
  }

  if (!isVisible || !funscript?.actions || funscript.actions.length === 0) {
    return null
  }

  const device = DEVICES[selectedDevice]

  return (
    <div className="absolute right-4 bottom-20 z-40 hidden lg:block w-72 bg-zinc-900/90 backdrop-blur-sm rounded-xl border border-white/10 overflow-hidden shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/10 bg-gradient-to-r from-pink-500/20 to-purple-500/20">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-pink-500" />
          <span className="text-sm font-medium text-white">
            Interactive Video
          </span>
        </div>
        <button
          onClick={handleDismiss}
          className="p-1 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Waveform */}
      <div className="p-3 border-b border-white/10">
        <FunscriptWaveformCanvas
          actions={funscript.actions}
          currentTimeMs={currentTimeMs}
          videoDurationMs={videoDurationMs}
          width={256}
          height={70}
        />
      </div>

      {/* Device Promo */}
      <div className="p-3">
        <p className="text-xs text-white/60 mb-3">
          Sync this video to a compatible device for the full experience
        </p>

        {/* Device Selector Tabs */}
        <div className="flex gap-1 mb-3">
          {(Object.keys(DEVICES) as DeviceType[]).map((key) => (
            <button
              key={key}
              onClick={() => setSelectedDevice(key)}
              className={`flex-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                selectedDevice === key
                  ? "bg-pink-500/20 text-pink-400 border border-pink-500/30"
                  : "bg-white/5 text-white/60 hover:text-white hover:bg-white/10"
              }`}
            >
              {DEVICES[key].name}
            </button>
          ))}
        </div>

        {/* Selected Device Info */}
        <div className="space-y-2">
          <p className="text-xs text-white/50">{device.description}</p>

          {/* Promo Code */}
          <div className="flex items-center gap-2 px-2 py-1.5 bg-white/5 rounded-lg">
            <span className="text-xs text-white/50">Code:</span>
            <span className="text-sm font-mono font-medium text-pink-400">
              {device.promoCode}
            </span>
            <span className="text-xs text-green-400 ml-auto">
              {device.discount} off
            </span>
          </div>

          {/* Buy Button */}
          <a
            href={device.affiliateUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full px-3 py-2 bg-pink-500 hover:bg-pink-600 rounded-lg text-sm font-medium text-white transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            Get {device.name}
          </a>
        </div>
      </div>
    </div>
  )
}
