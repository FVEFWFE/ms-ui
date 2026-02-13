"use client"

import { motion, AnimatePresence } from "framer-motion"
import { X, Keyboard } from "lucide-react"

interface ShortcutHelpProps {
  isOpen: boolean
  onClose: () => void
}

interface ShortcutGroup {
  title: string
  shortcuts: { key: string; action: string }[]
}

const shortcutGroups: ShortcutGroup[] = [
  {
    title: "Playback",
    shortcuts: [
      { key: "Space", action: "Play / Pause video" },
      { key: "← →", action: "Seek 5 seconds" },
      { key: "[ ]", action: "Volume up / down" },
      { key: "↑ ↓", action: "Adjust intensity ±10%" },
    ],
  },
  {
    title: "Recording",
    shortcuts: [
      { key: "R", action: "Start / Stop recording" },
      { key: "M", action: "Mute / Unmute mic" },
      { key: "Shift+M", action: "Mute all audio" },
      { key: "F", action: "Toggle fullscreen" },
    ],
  },
  {
    title: "Edge Control",
    shortcuts: [
      { key: "E", action: "Toggle edge mode" },
      { key: "Shift+E", action: "Exit edge mode" },
    ],
  },
  {
    title: "Video Queue",
    shortcuts: [
      { key: "Q or +", action: "Add to queue" },
      { key: "N", action: "Next video in queue" },
      { key: "P", action: "Previous video" },
      { key: "Shift+Q", action: "Clear queue" },
    ],
  },
  {
    title: "Navigation",
    shortcuts: [
      { key: "V", action: "Open video library" },
      { key: "Escape", action: "Close modal / Exit fullscreen" },
      { key: "B", action: "Go back" },
    ],
  },
  {
    title: "Device",
    shortcuts: [
      { key: "T", action: "Reconnect toy" },
      { key: "D", action: "Device settings" },
    ],
  },
  {
    title: "Companion",
    shortcuts: [
      { key: "C", action: "Toggle companion" },
      { key: "1", action: "Talk dirty (when visible)" },
      { key: "2", action: "Encourage (when visible)" },
      { key: "3", action: "Tease (when visible)" },
    ],
  },
]

export function ShortcutHelp({ isOpen, onClose }: ShortcutHelpProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed inset-4 md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-[600px] md:max-h-[80vh] z-[101] bg-[#141414] rounded-2xl border border-white/10 overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-500/20 rounded-lg">
                  <Keyboard className="w-5 h-5 text-green-400" />
                </div>
                <h2 className="text-lg font-semibold">Keyboard Shortcuts</h2>
              </div>
              <button
                onClick={onClose}
                className="p-2 text-white/50 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              <p className="text-white/50 text-sm mb-6">
                Hands-free operation for when things get messy
              </p>

              <div className="grid md:grid-cols-2 gap-6">
                {shortcutGroups.map((group) => (
                  <div key={group.title}>
                    <h3 className="text-sm font-medium text-white/70 mb-3 uppercase tracking-wider">
                      {group.title}
                    </h3>
                    <div className="space-y-2">
                      {group.shortcuts.map((shortcut) => (
                        <div
                          key={shortcut.key}
                          className="flex items-center justify-between gap-4 py-1.5"
                        >
                          <span className="text-sm text-white/60">{shortcut.action}</span>
                          <kbd className="px-2 py-1 bg-white/10 rounded text-xs font-mono text-white/80 border border-white/20 whitespace-nowrap">
                            {shortcut.key}
                          </kbd>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-white/5 border-t border-white/10 text-center">
              <p className="text-white/40 text-sm">
                Press <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-xs font-mono border border-white/20">H</kbd> or <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-xs font-mono border border-white/20">?</kbd> to toggle this panel
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
