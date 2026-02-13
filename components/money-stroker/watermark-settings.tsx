"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ChevronDown, ChevronUp, Type, Palette, Move, Check, DollarSign } from "lucide-react"
import { Slider } from "@/components/ui/slider"
import { cn } from "@/lib/utils"

// Watermark copy presets
export const WATERMARK_COPY_PRESETS = [
  { id: "default", label: "Get paid to goon:", prefix: "Get paid to goon:" },
  { id: "link-only", label: "Link only", prefix: "" },
  { id: "goon-to-this", label: "Get paid to goon to this:", prefix: "Get paid to goon to this:" },
  { id: "watch-this", label: "Get paid to watch this:", prefix: "Get paid to watch this:" },
  { id: "sync-toy", label: "Get paid to sync your toy:", prefix: "Get paid to sync your toy:" },
  { id: "while-you-goon", label: "Get paid while you goon:", prefix: "Get paid while you goon:" },
  { id: "your-link", label: "Your link:", prefix: "Your link:" },
  { id: "custom", label: "Custom...", prefix: "" },
] as const

export type WatermarkCopyPreset = typeof WATERMARK_COPY_PRESETS[number]["id"]

// Font family options
export const WATERMARK_FONTS = [
  { id: "default", label: "Default", fontFamily: "system-ui, sans-serif", description: "Clean and readable" },
  { id: "monospace", label: "Monospace", fontFamily: "ui-monospace, monospace", description: "Techy hacker vibe" },
  { id: "bold-condensed", label: "Bold Condensed", fontFamily: "Impact, Haettenschweiler, sans-serif", description: "Attention grabbing" },
  { id: "handwritten", label: "Handwritten", fontFamily: "Comic Sans MS, cursive", description: "Casual personal feel" },
  { id: "neon", label: "Neon Glow", fontFamily: "system-ui, sans-serif", description: "Cyberpunk aesthetic" },
] as const

export type WatermarkFont = typeof WATERMARK_FONTS[number]["id"]

// Background style options
export const WATERMARK_BACKGROUNDS = [
  { id: "none", label: "None" },
  { id: "solid", label: "Solid" },
  { id: "gradient", label: "Gradient" },
  { id: "blur", label: "Frosted Glass" },
] as const

export type WatermarkBackground = typeof WATERMARK_BACKGROUNDS[number]["id"]

// Color options
export const WATERMARK_COLORS = [
  { id: "white", label: "White", color: "#ffffff" },
  { id: "pink", label: "Pink", color: "#ec4899" },
  { id: "green", label: "Green", color: "#22c55e" },
  { id: "cyan", label: "Neon Cyan", color: "#06b6d4" },
  { id: "custom", label: "Custom", color: "#ffffff" },
] as const

export type WatermarkColor = typeof WATERMARK_COLORS[number]["id"]

// Shadow options
export const WATERMARK_SHADOWS = [
  { id: "none", label: "None" },
  { id: "subtle", label: "Subtle" },
  { id: "strong", label: "Strong" },
  { id: "neon-glow", label: "Neon Glow" },
] as const

export type WatermarkShadow = typeof WATERMARK_SHADOWS[number]["id"]

// Text alignment options
export const WATERMARK_ALIGNMENTS = [
  { id: "left", label: "Left" },
  { id: "center", label: "Center" },
  { id: "right", label: "Right" },
] as const

export type WatermarkAlignment = typeof WATERMARK_ALIGNMENTS[number]["id"]

// Position presets (3x3 grid)
export const POSITION_PRESETS = [
  { id: "tl", label: "TL", x: 10, y: 8 },
  { id: "tc", label: "TC", x: 50, y: 8 },
  { id: "tr", label: "TR", x: 90, y: 8 },
  { id: "ml", label: "ML", x: 10, y: 50 },
  { id: "mc", label: "MC", x: 50, y: 50 },
  { id: "mr", label: "MR", x: 90, y: 50 },
  { id: "bl", label: "BL", x: 10, y: 92 },
  { id: "bc", label: "BC", x: 50, y: 92 },
  { id: "br", label: "BR", x: 90, y: 92 },
] as const

export interface WatermarkSettings {
  copyPreset: WatermarkCopyPreset
  customCopy: string
  font: WatermarkFont
  background: WatermarkBackground
  color: WatermarkColor
  customColor: string
  shadow: WatermarkShadow
  size: "small" | "medium" | "large" | "custom"
  customSize: number
  alignment: WatermarkAlignment
  position: { x: number; y: number }
}

interface WatermarkSettingsPanelProps {
  settings: WatermarkSettings
  onChange: (settings: Partial<WatermarkSettings>) => void
  affiliateCode: string
  isExpanded: boolean
  onToggleExpand: () => void
  phase?: string
  isRecording?: boolean
  edgeMode?: boolean
}

export function WatermarkSettingsPanel({
  settings,
  onChange,
  affiliateCode,
  isExpanded,
  onToggleExpand,
  phase,
  isRecording,
  edgeMode,
}: WatermarkSettingsPanelProps) {
  const [activeTab, setActiveTab] = useState<"copy" | "style" | "position">("copy")

  // Get the full watermark text
  const getWatermarkText = () => {
    const prefix = settings.copyPreset === "custom"
      ? settings.customCopy
      : WATERMARK_COPY_PRESETS.find((p) => p.id === settings.copyPreset)?.prefix || ""

    const link = `getgooned.io/secret/${affiliateCode}`
    return prefix ? `${prefix} ${link}` : link
  }

  return (
    <div className="bg-white/5 border-b border-white/5">
      {/* Header */}
      <button
        onClick={onToggleExpand}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="relative group/tip">
            <DollarSign className="w-3.5 h-3.5 text-green-400" />
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-black/90 border border-white/20 rounded-lg text-xs text-white whitespace-nowrap opacity-0 group-hover/tip:opacity-100 transition-opacity pointer-events-none z-50">
              15% of every signup from your link
              <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px w-2 h-2 bg-black/90 border-r border-b border-white/20 rotate-45" />
            </div>
          </div>
          <span className="text-xs text-white/50">Watermark:</span>
          <code className="px-2 py-1 bg-white/10 rounded text-green-400 text-xs truncate max-w-[200px]">
            {getWatermarkText()}
          </code>
          {/* Contextual keyboard shortcuts */}
          <div className="hidden lg:flex items-center gap-2 text-[10px] text-white/25 font-mono ml-2">
            {phase === "setup" && !isRecording && (
              <>
                <span><kbd className="px-1 bg-white/10 rounded">Space</kbd> play</span>
                <span><kbd className="px-1 bg-white/10 rounded">R</kbd> record</span>
                <span><kbd className="px-1 bg-white/10 rounded">V</kbd> videos</span>
                <span><kbd className="px-1 bg-white/10 rounded">F</kbd> fullscreen</span>
                <span><kbd className="px-1 bg-white/10 rounded">M</kbd> mute mic</span>
                <span><kbd className="px-1 bg-white/10 rounded">L</kbd> lights</span>
                <span className="hidden xl:inline"><kbd className="px-1 bg-white/10 rounded">←→</kbd> seek</span>
                <span><kbd className="px-1 bg-white/10 rounded">H</kbd> all shortcuts</span>
              </>
            )}
            {isRecording && !edgeMode && (
              <>
                <span><kbd className="px-1 bg-white/10 rounded">R</kbd> stop</span>
                <span><kbd className="px-1 bg-white/10 rounded">E</kbd> edge</span>
                <span><kbd className="px-1 bg-white/10 rounded">M</kbd> mute</span>
                <span><kbd className="px-1 bg-white/10 rounded">Space</kbd> pause</span>
                <span><kbd className="px-1 bg-white/10 rounded">L</kbd> lights</span>
                <span className="hidden xl:inline"><kbd className="px-1 bg-white/10 rounded">Shift+M</kbd> mute all</span>
                <span className="hidden xl:inline"><kbd className="px-1 bg-white/10 rounded">↑↓</kbd> speed</span>
                <span><kbd className="px-1 bg-white/10 rounded">H</kbd> all shortcuts</span>
              </>
            )}
            {edgeMode && (
              <>
                <span><kbd className="px-1 bg-white/10 rounded">Shift+E</kbd> exit edge</span>
                <span><kbd className="px-1 bg-white/10 rounded">R</kbd> stop</span>
                <span><kbd className="px-1 bg-white/10 rounded">Space</kbd> pause</span>
                <span><kbd className="px-1 bg-white/10 rounded">M</kbd> mute</span>
                <span><kbd className="px-1 bg-white/10 rounded">L</kbd> lights</span>
                <span><kbd className="px-1 bg-white/10 rounded">H</kbd> all shortcuts</span>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 text-white/40 flex-shrink-0">
          <span className="text-xs">Customize</span>
          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

      {/* Expanded Settings */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            {/* Tabs */}
            <div className="flex border-b border-white/10">
              {[
                { id: "copy" as const, label: "Copy", icon: Type },
                { id: "style" as const, label: "Style", icon: Palette },
                { id: "position" as const, label: "Position", icon: Move },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 px-4 py-2 text-xs font-medium transition-colors",
                    activeTab === tab.id
                      ? "text-green-400 border-b-2 border-green-400"
                      : "text-white/50 hover:text-white/80"
                  )}
                >
                  <tab.icon className="w-3.5 h-3.5" />
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="p-4 space-y-4">
              {/* Copy Tab */}
              {activeTab === "copy" && (
                <div className="space-y-3">
                  <label className="text-xs text-white/50 uppercase tracking-wider">
                    Watermark Text Preset
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {WATERMARK_COPY_PRESETS.map((preset) => (
                      <button
                        key={preset.id}
                        onClick={() => onChange({ copyPreset: preset.id })}
                        className={cn(
                          "px-3 py-2 rounded-lg text-xs text-left transition-colors border cursor-pointer",
                          settings.copyPreset === preset.id
                            ? "bg-green-500/20 border-green-500/50 text-green-400"
                            : "bg-white/5 border-white/10 text-white/70 hover:bg-white/10"
                        )}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>

                  {settings.copyPreset === "custom" && (
                    <div className="mt-3">
                      <input
                        type="text"
                        value={settings.customCopy}
                        onChange={(e) => onChange({ customCopy: e.target.value.slice(0, 50) })}
                        placeholder="Enter custom text (max 50 chars)"
                        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-white/30 focus:outline-none focus:border-green-500/50"
                        maxLength={50}
                      />
                      <p className="text-[10px] text-white/40 mt-1">
                        {settings.customCopy.length}/50 characters
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Style Tab */}
              {activeTab === "style" && (
                <div className="space-y-4">
                  {/* Font */}
                  <div className="space-y-2">
                    <label className="text-xs text-white/50 uppercase tracking-wider">Font</label>
                    <div className="grid grid-cols-1 gap-1">
                      {WATERMARK_FONTS.map((font) => (
                        <button
                          key={font.id}
                          onClick={() => onChange({ font: font.id })}
                          className={cn(
                            "flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors border cursor-pointer",
                            settings.font === font.id
                              ? "bg-green-500/20 border-green-500/50"
                              : "bg-white/5 border-white/10 hover:bg-white/10"
                          )}
                        >
                          <span style={{ fontFamily: font.fontFamily }}>{font.label}</span>
                          <span className="text-[10px] text-white/40">{font.description}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Size */}
                  <div className="space-y-2">
                    <label className="text-xs text-white/50 uppercase tracking-wider">Size</label>
                    <div className="flex gap-2">
                      {(["small", "medium", "large", "custom"] as const).map((size) => (
                        <button
                          key={size}
                          onClick={() => onChange({ size })}
                          className={cn(
                            "flex-1 px-2 py-1.5 rounded text-xs font-medium transition-colors border cursor-pointer",
                            settings.size === size
                              ? "bg-green-500/20 border-green-500/50 text-green-400"
                              : "bg-white/5 border-white/10 text-white/60 hover:bg-white/10"
                          )}
                        >
                          {size.charAt(0).toUpperCase() + size.slice(1)}
                        </button>
                      ))}
                    </div>
                    {settings.size === "custom" && (
                      <div className="flex items-center gap-3 mt-2">
                        <Slider
                          value={[settings.customSize]}
                          onValueChange={([val]) => onChange({ customSize: val })}
                          min={12}
                          max={48}
                          step={1}
                          className="flex-1"
                        />
                        <span className="text-xs text-white/60 font-mono w-10">
                          {settings.customSize}px
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Color */}
                  <div className="space-y-2">
                    <label className="text-xs text-white/50 uppercase tracking-wider">Color</label>
                    <div className="flex gap-2">
                      {WATERMARK_COLORS.map((color) => (
                        <button
                          key={color.id}
                          onClick={() => onChange({ color: color.id })}
                          className={cn(
                            "w-8 h-8 rounded-full border-2 transition-all cursor-pointer",
                            settings.color === color.id
                              ? "border-white scale-110"
                              : "border-white/20 hover:border-white/50"
                          )}
                          style={{ backgroundColor: color.color }}
                          title={color.label}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Shadow */}
                  <div className="space-y-2">
                    <label className="text-xs text-white/50 uppercase tracking-wider">Shadow</label>
                    <div className="flex gap-2">
                      {WATERMARK_SHADOWS.map((shadow) => (
                        <button
                          key={shadow.id}
                          onClick={() => onChange({ shadow: shadow.id })}
                          className={cn(
                            "flex-1 px-2 py-1.5 rounded text-xs font-medium transition-colors border cursor-pointer",
                            settings.shadow === shadow.id
                              ? "bg-green-500/20 border-green-500/50 text-green-400"
                              : "bg-white/5 border-white/10 text-white/60 hover:bg-white/10"
                          )}
                        >
                          {shadow.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Background */}
                  <div className="space-y-2">
                    <label className="text-xs text-white/50 uppercase tracking-wider">Background</label>
                    <div className="flex gap-2">
                      {WATERMARK_BACKGROUNDS.map((bg) => (
                        <button
                          key={bg.id}
                          onClick={() => onChange({ background: bg.id })}
                          className={cn(
                            "flex-1 px-2 py-1.5 rounded text-xs font-medium transition-colors border cursor-pointer",
                            settings.background === bg.id
                              ? "bg-green-500/20 border-green-500/50 text-green-400"
                              : "bg-white/5 border-white/10 text-white/60 hover:bg-white/10"
                          )}
                        >
                          {bg.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Alignment */}
                  <div className="space-y-2">
                    <label className="text-xs text-white/50 uppercase tracking-wider">Text Alignment</label>
                    <div className="flex gap-2">
                      {WATERMARK_ALIGNMENTS.map((align) => (
                        <button
                          key={align.id}
                          onClick={() => onChange({ alignment: align.id })}
                          className={cn(
                            "flex-1 px-2 py-1.5 rounded text-xs font-medium transition-colors border cursor-pointer",
                            settings.alignment === align.id
                              ? "bg-green-500/20 border-green-500/50 text-green-400"
                              : "bg-white/5 border-white/10 text-white/60 hover:bg-white/10"
                          )}
                        >
                          {align.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Position Tab */}
              {activeTab === "position" && (
                <div className="space-y-4">
                  {/* Position Grid */}
                  <div className="space-y-2">
                    <label className="text-xs text-white/50 uppercase tracking-wider">
                      Quick Position
                    </label>
                    <div className="grid grid-cols-3 gap-1 w-32 mx-auto">
                      {POSITION_PRESETS.map((pos) => {
                        const isActive =
                          Math.abs(settings.position.x - pos.x) < 5 &&
                          Math.abs(settings.position.y - pos.y) < 5
                        return (
                          <button
                            key={pos.id}
                            onClick={() => onChange({ position: { x: pos.x, y: pos.y } })}
                            className={cn(
                              "w-10 h-8 rounded text-[10px] font-medium transition-colors border cursor-pointer",
                              isActive
                                ? "bg-green-500/20 border-green-500/50 text-green-400"
                                : "bg-white/5 border-white/10 text-white/40 hover:bg-white/10"
                            )}
                          >
                            {pos.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Manual Sliders */}
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs text-white/50">X Position</label>
                        <span className="text-xs text-white/60 font-mono">
                          {Math.round(settings.position.x)}%
                        </span>
                      </div>
                      <Slider
                        value={[settings.position.x]}
                        onValueChange={([x]) => onChange({ position: { ...settings.position, x } })}
                        min={0}
                        max={100}
                        step={1}
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs text-white/50">Y Position</label>
                        <span className="text-xs text-white/60 font-mono">
                          {Math.round(settings.position.y)}%
                        </span>
                      </div>
                      <Slider
                        value={[settings.position.y]}
                        onValueChange={([y]) => onChange({ position: { ...settings.position, y } })}
                        min={0}
                        max={100}
                        step={1}
                      />
                    </div>
                  </div>

                  <p className="text-[10px] text-white/40 flex items-center gap-1.5">
                    <Move className="w-3 h-3" />
                    You can also drag the watermark directly in the preview
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// Default watermark settings
export const DEFAULT_WATERMARK_SETTINGS: WatermarkSettings = {
  copyPreset: "default",
  customCopy: "",
  font: "default",
  background: "solid",
  color: "white",
  customColor: "#ffffff",
  shadow: "subtle",
  size: "large",
  customSize: 24,
  alignment: "center",
  position: { x: 50, y: 92 },
}

// Hook to get watermark text from settings
export function getWatermarkText(settings: WatermarkSettings, affiliateCode: string): string {
  const prefix = settings.copyPreset === "custom"
    ? settings.customCopy
    : WATERMARK_COPY_PRESETS.find((p) => p.id === settings.copyPreset)?.prefix || ""

  const link = `getgooned.io/secret/${affiliateCode}`
  return prefix ? `${prefix} ${link}` : link
}
