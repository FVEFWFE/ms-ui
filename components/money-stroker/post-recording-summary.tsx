"use client"

import Link from "next/link"
import { DollarSign, Coins, Users, Trophy, Share2, ChevronRight, Video } from "lucide-react"

interface PostRecordingSummaryProps {
  sessionCredits: {
    strokes: number
    edges: number
    highIntensity: number
    total: number
  }
  greekGodEnabled: boolean
  onRecordAgain: () => void
}

export function PostRecordingSummary({
  sessionCredits,
  greekGodEnabled,
  onRecordAgain,
}: PostRecordingSummaryProps) {
  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-white mb-2">Session Complete</h2>
        <p className="text-white/60">Here&apos;s what you earned</p>
      </div>

      {/* Primary earnings */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-5 h-5 text-green-400" />
            <p className="text-sm text-white/70">Commission Potential</p>
          </div>
          <p className="text-2xl font-bold text-green-400">15%</p>
          <p className="text-xs text-white/50 mt-1">
            Every signup from your watermarked video
          </p>
        </div>

        <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <Coins className="w-5 h-5 text-blue-400" />
            <p className="text-sm text-white/70">Session Credits</p>
          </div>
          <p className="text-2xl font-bold text-blue-400">
            +{sessionCredits.total.toFixed(1)}
          </p>
          <p className="text-xs text-white/50 mt-1">
            {sessionCredits.strokes.toFixed(0)} strokes, {Math.floor(sessionCredits.edges / 5)} edges
          </p>
        </div>
      </div>

      {/* Secondary earning teasers */}
      <div className="space-y-3">
        <p className="text-sm text-white/70 font-medium">Boost your earnings:</p>

        {/* Engagement Pod teaser */}
        <Link
          href="/engage"
          className="block p-4 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition group"
        >
          <div className="flex items-center gap-3">
            <Users className="w-5 h-5 text-purple-400" />
            <div className="flex-1">
              <p className="text-sm font-medium text-white group-hover:text-purple-400 transition">
                Share to Engagement Pod
              </p>
              <p className="text-xs text-white/60">
                Submit your video, get real engagement, earn 1 to 10 credits per action
              </p>
            </div>
            <ChevronRight className="w-4 h-4 text-white/30 group-hover:text-white/60 transition" />
          </div>
        </Link>

        {/* Raffle entry badge */}
        <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
          <div className="flex items-center gap-3">
            <Trophy className="w-5 h-5 text-yellow-400" />
            <div className="flex-1">
              <p className="text-sm font-medium text-white">
                You earned 1 raffle entry
              </p>
              <p className="text-xs text-white/60">
                This month&apos;s prizes: Meta Quest 3, Handy, VacuGlide
              </p>
            </div>
          </div>
        </div>

        {/* Share characters teaser */}
        <Link
          href="/my-characters"
          className="block p-4 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition group"
        >
          <div className="flex items-center gap-3">
            <Share2 className="w-5 h-5 text-pink-400" />
            <div className="flex-1">
              <p className="text-sm font-medium text-white group-hover:text-pink-400 transition">
                Share Your Characters
              </p>
              <p className="text-xs text-white/60">
                Earn 15% + 50 credits when friends sign up via your character
              </p>
            </div>
            <ChevronRight className="w-4 h-4 text-white/30 group-hover:text-white/60 transition" />
          </div>
        </Link>
      </div>

      {/* Primary CTA */}
      <div className="pt-4 border-t border-white/10">
        <button
          onClick={onRecordAgain}
          className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 rounded-lg font-semibold text-black transition-colors"
        >
          <Video className="w-5 h-5" />
          Record Another Session
        </button>
      </div>
    </div>
  )
}
