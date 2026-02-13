"use client"

import { motion, AnimatePresence } from "framer-motion"
import {
  Camera,
  Smartphone,
  Laptop,
  Glasses,
  MonitorSmartphone,
  Mouse,
  Battery,
  Sun,
  Headphones,
  Droplets,
  X,
  ChevronDown,
} from "lucide-react"
import { useState } from "react"

interface PackingListProps {
  isOpen: boolean
  onClose: () => void
}

const categories = [
  {
    title: "Cameras",
    icon: Camera,
    iconBg: "bg-blue-500/20",
    iconColor: "text-blue-400",
    items: [
      "MacBook Pro + charger",
      "Insta360 Link webcam",
      "Insta360 Go 3 + charger",
      "AI POV glasses + charger",
      "Phone",
    ],
  },
  {
    title: "Mounts",
    icon: MonitorSmartphone,
    iconBg: "bg-green-500/20",
    iconColor: "text-green-400",
    items: [
      "Monkey tail mount ($19)",
      "Insta360 sticky mount",
      "Phone tripod",
      "Stanley vice mount (for device)",
    ],
  },
  {
    title: "Control",
    icon: Mouse,
    iconBg: "bg-purple-500/20",
    iconColor: "text-purple-400",
    items: [
      "Wireless mouse + charging cable",
    ],
  },
  {
    title: "The Main Event",
    icon: Droplets,
    iconBg: "bg-pink-500/20",
    iconColor: "text-pink-400",
    items: [
      "Handy 2",
      "Sleeve + sleeve holder",
      "Lube",
    ],
  },
  {
    title: "Power",
    icon: Battery,
    iconBg: "bg-yellow-500/20",
    iconColor: "text-yellow-400",
    items: [
      "Powerbank",
      "Long USB C cable",
    ],
  },
  {
    title: "Light",
    icon: Sun,
    iconBg: "bg-orange-500/20",
    iconColor: "text-orange-400",
    items: [
      "Flat light source",
    ],
  },
  {
    title: "Audio",
    icon: Headphones,
    iconBg: "bg-cyan-500/20",
    iconColor: "text-cyan-400",
    items: [
      "Earbuds",
    ],
  },
]

export function PackingList({ isOpen, onClose }: PackingListProps) {
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null)

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="overflow-hidden"
        >
          <div className="bg-gradient-to-br from-amber-500/5 to-orange-500/5 rounded-xl border border-amber-500/20 p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-amber-400">The Weekender Bag</h3>
              <button
                onClick={onClose}
                className="p-1.5 text-white/50 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Categories */}
            <div className="space-y-3">
              {categories.map((category) => (
                <div
                  key={category.title}
                  className="bg-black/30 rounded-lg border border-white/5 overflow-hidden"
                >
                  <button
                    onClick={() => setExpandedCategory(
                      expandedCategory === category.title ? null : category.title
                    )}
                    className="w-full flex items-center justify-between p-3 text-left hover:bg-white/5 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg ${category.iconBg} flex items-center justify-center`}>
                        <category.icon className={`w-4 h-4 ${category.iconColor}`} />
                      </div>
                      <span className="font-medium text-sm">{category.title}</span>
                      <span className="text-xs text-white/40">({category.items.length})</span>
                    </div>
                    <motion.div
                      animate={{ rotate: expandedCategory === category.title ? 180 : 0 }}
                      className="text-white/50"
                    >
                      <ChevronDown className="w-4 h-4" />
                    </motion.div>
                  </button>

                  <AnimatePresence>
                    {expandedCategory === category.title && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="border-t border-white/5"
                      >
                        <ul className="p-3 space-y-2">
                          {category.items.map((item) => (
                            <li
                              key={item}
                              className="flex items-center gap-2 text-sm text-white/60"
                            >
                              <div className="w-1.5 h-1.5 rounded-full bg-white/30" />
                              {item}
                            </li>
                          ))}
                        </ul>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="mt-6 pt-4 border-t border-white/10 text-center">
              <p className="text-sm text-white/50">
                Total cost: Less than one month's rent. Sets up in 10 minutes.
              </p>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// Inline version that's always visible
export function PackingListInline() {
  const [expandedCategory, setExpandedCategory] = useState<string | null>("Cameras")

  return (
    <div className="space-y-3">
      {categories.map((category) => (
        <div
          key={category.title}
          className="bg-[#141414] rounded-lg border border-white/5 overflow-hidden"
        >
          <button
            onClick={() => setExpandedCategory(
              expandedCategory === category.title ? null : category.title
            )}
            className="w-full flex items-center justify-between p-3 text-left hover:bg-white/5 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-lg ${category.iconBg} flex items-center justify-center`}>
                <category.icon className={`w-4 h-4 ${category.iconColor}`} />
              </div>
              <span className="font-medium text-sm">{category.title}</span>
              <span className="text-xs text-white/40">({category.items.length})</span>
            </div>
            <motion.div
              animate={{ rotate: expandedCategory === category.title ? 180 : 0 }}
              className="text-white/50"
            >
              <ChevronDown className="w-4 h-4" />
            </motion.div>
          </button>

          <AnimatePresence>
            {expandedCategory === category.title && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="border-t border-white/5"
              >
                <ul className="p-3 space-y-2">
                  {category.items.map((item) => (
                    <li
                      key={item}
                      className="flex items-center gap-2 text-sm text-white/60"
                    >
                      <div className="w-1.5 h-1.5 rounded-full bg-white/30" />
                      {item}
                    </li>
                  ))}
                </ul>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ))}

      {/* Footer */}
      <div className="pt-2 text-center">
        <p className="text-sm text-white/50">
          Total cost: Less than one month's rent. Sets up in 10 minutes.
        </p>
      </div>
    </div>
  )
}
