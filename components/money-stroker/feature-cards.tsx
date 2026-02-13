"use client"

import { motion } from "framer-motion"
import {
  SplitSquareHorizontal,
  Gauge,
  Stamp,
  Camera,
} from "lucide-react"

const features = [
  {
    icon: SplitSquareHorizontal,
    title: "Split Screen Recording",
    description: "Camera + screen captured together",
    detail: "One file, zero editing needed",
    iconBg: "bg-pink-500/20",
    iconColor: "text-pink-400",
  },
  {
    icon: Gauge,
    title: "Device Sync Visualization",
    description: "Show your device speed on screen",
    detail: "Viewers see what you feel",
    iconBg: "bg-purple-500/20",
    iconColor: "text-purple-400",
  },
  {
    icon: Stamp,
    title: "Auto Watermark",
    description: "Your affiliate link burned into every video",
    detail: "Get 15% when viewers sign up",
    iconBg: "bg-green-500/20",
    iconColor: "text-green-400",
  },
  {
    icon: Camera,
    title: "Multi Angle Ready",
    description: "Works with webcam, phone, or AI glasses",
    detail: "Record from any angle",
    iconBg: "bg-blue-500/20",
    iconColor: "text-blue-400",
  },
]

export function FeatureCards() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {features.map((feature, index) => (
        <motion.div
          key={feature.title}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 + index * 0.1 }}
          className="bg-[#141414] rounded-xl border border-white/5 p-4 space-y-3 hover:border-white/20 hover:bg-white/[3%] transition-colors cursor-default"
        >
          <div className={`w-10 h-10 rounded-lg ${feature.iconBg} flex items-center justify-center`}>
            <feature.icon className={`w-5 h-5 ${feature.iconColor}`} />
          </div>
          <div>
            <h3 className="font-semibold text-sm">{feature.title}</h3>
            <p className="text-xs text-white/60 mt-1">{feature.description}</p>
            <p className="text-xs text-white/40 mt-1">{feature.detail}</p>
          </div>
        </motion.div>
      ))}
    </div>
  )
}
