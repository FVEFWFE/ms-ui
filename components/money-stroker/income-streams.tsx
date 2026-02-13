"use client"

import { motion } from "framer-motion"
import { DollarSign, Users, ArrowRight } from "lucide-react"

export function IncomeStreams() {
  return (
    <div className="grid md:grid-cols-2 gap-6">
      {/* Stream 1: Platform Revenue */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 rounded-xl border border-green-500/20 p-6 hover:border-green-500/40 transition-colors"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
            <DollarSign className="w-5 h-5 text-green-400" />
          </div>
          <h3 className="text-lg font-semibold text-green-400">Stream 1: Platform Revenue</h3>
        </div>
        <ul className="space-y-3">
          <li className="flex items-start gap-2">
            <ArrowRight className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
            <span className="text-white/70 text-sm">Post on OnlyFans, Fansly, PornHub</span>
          </li>
          <li className="flex items-start gap-2">
            <ArrowRight className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
            <span className="text-white/70 text-sm">Fans pay to watch your content</span>
          </li>
          <li className="flex items-start gap-2">
            <ArrowRight className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
            <span className="text-white/70 text-sm">You keep the earnings</span>
          </li>
        </ul>
      </motion.div>

      {/* Stream 2: Affiliate Commissions */}
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 rounded-xl border border-purple-500/20 p-6 hover:border-purple-500/40 transition-colors"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
            <Users className="w-5 h-5 text-purple-400" />
          </div>
          <h3 className="text-lg font-semibold text-purple-400">Stream 2: Affiliate Commissions</h3>
        </div>
        <ul className="space-y-3">
          <li className="flex items-start gap-2">
            <ArrowRight className="w-4 h-4 text-purple-400 mt-0.5 flex-shrink-0" />
            <span className="text-white/70 text-sm">Every video has your referral link</span>
          </li>
          <li className="flex items-start gap-2">
            <ArrowRight className="w-4 h-4 text-purple-400 mt-0.5 flex-shrink-0" />
            <span className="text-white/70 text-sm">Viewers sign up for GetGooned</span>
          </li>
          <li className="flex items-start gap-2">
            <ArrowRight className="w-4 h-4 text-purple-400 mt-0.5 flex-shrink-0" />
            <span className="text-white/70 text-sm">You get <span className="text-purple-300 font-medium">15%</span> of their subscription forever</span>
          </li>
          <li className="flex items-start gap-2">
            <ArrowRight className="w-4 h-4 text-purple-400 mt-0.5 flex-shrink-0" />
            <span className="text-white/70 text-sm">Plus <span className="text-purple-300 font-medium">5%</span> from anyone THEY refer</span>
          </li>
        </ul>
      </motion.div>
    </div>
  )
}
