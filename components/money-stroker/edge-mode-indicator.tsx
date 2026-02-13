"use client"

import { motion, AnimatePresence } from "framer-motion"
import { Flame } from "lucide-react"

interface EdgeModeIndicatorProps {
  active: boolean
  intensity: number // 0-1 (e.g., 0.2 = 20%)
  timeRemaining?: number // seconds remaining on auto-timeout, null if manual
}

// Glitch text effect via CSS keyframes
function GlitchText({ children }: { children: string }) {
  return (
    <span className="relative inline-block font-bold text-white tracking-wide">
      <span className="relative z-10">{children}</span>
      <span
        className="absolute top-0 left-0 font-bold tracking-wide text-cyan-400 opacity-80 animate-glitch-1"
        aria-hidden
      >
        {children}
      </span>
      <span
        className="absolute top-0 left-0 font-bold tracking-wide text-red-400 opacity-80 animate-glitch-2"
        aria-hidden
      >
        {children}
      </span>
      <style jsx>{`
        @keyframes glitch-1 {
          0%, 100% { clip-path: inset(0 0 80% 0); transform: translate(-2px, -1px); }
          20% { clip-path: inset(20% 0 60% 0); transform: translate(2px, 1px); }
          40% { clip-path: inset(40% 0 40% 0); transform: translate(-1px, 0); }
          60% { clip-path: inset(60% 0 20% 0); transform: translate(1px, -1px); }
          80% { clip-path: inset(80% 0 0 0); transform: translate(-2px, 1px); }
        }
        @keyframes glitch-2 {
          0%, 100% { clip-path: inset(80% 0 0 0); transform: translate(2px, 1px); }
          20% { clip-path: inset(60% 0 20% 0); transform: translate(-2px, -1px); }
          40% { clip-path: inset(20% 0 60% 0); transform: translate(1px, 0); }
          60% { clip-path: inset(0 0 80% 0); transform: translate(-1px, 1px); }
          80% { clip-path: inset(40% 0 40% 0); transform: translate(2px, -1px); }
        }
        .animate-glitch-1 {
          animation: glitch-1 0.8s infinite steps(1);
        }
        .animate-glitch-2 {
          animation: glitch-2 0.8s infinite steps(1);
          animation-delay: 0.1s;
        }
      `}</style>
    </span>
  )
}

export function EdgeModeIndicator({ active, intensity, timeRemaining }: EdgeModeIndicatorProps) {
  return (
    <AnimatePresence>
      {active && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8, y: -20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: -20 }}
          className="absolute top-4 left-1/2 -translate-x-1/2 z-50"
        >
          <motion.div
            animate={{
              boxShadow: [
                "0 0 20px rgba(239, 68, 68, 0.3)",
                "0 0 40px rgba(239, 68, 68, 0.6)",
                "0 0 20px rgba(239, 68, 68, 0.3)",
              ],
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            className="flex items-center gap-2 px-4 py-2 bg-red-500/90 backdrop-blur-sm rounded-full border border-red-400/50"
          >
            <motion.div
              animate={{ rotate: [0, -10, 10, -10, 0] }}
              transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 1 }}
            >
              <Flame className="w-5 h-5 text-white" />
            </motion.div>
            <GlitchText>EDGE MODE</GlitchText>
            <span className="text-white/80 text-sm font-mono">{Math.round(intensity * 100)}%</span>
            {timeRemaining !== undefined && timeRemaining > 0 && (
              <span className="text-white/60 text-xs font-mono ml-1">
                ({timeRemaining}s)
              </span>
            )}
          </motion.div>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-center text-white/50 text-xs mt-2"
          >
            Press E to exit
          </motion.p>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
