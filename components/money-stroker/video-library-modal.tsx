"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, Search, Play, Clock, Eye, Zap, Loader2, Check } from "lucide-react"
import { cn } from "@/lib/utils"
import { getWatchedVideoIds, markVideoWatched } from "@/lib/watched-videos"

// Unified video interface matching the API
export interface LibraryVideo {
  id: string
  source?: "faptap" | "funscripthub"
  name: string
  duration: number
  thumbnail_url: string
  preview_url?: string | null
  stream_url?: string | null
  stream_url_selfhosted?: string | null
  views: number
  tags: string[] | null
  has_script?: boolean
  script_total_actions?: number | null
}

interface VideoLibraryModalProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (video: LibraryVideo) => void
  syncReadyOnly?: boolean
}

function formatDuration(seconds: number): string {
  if (!seconds) return "0:00"
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, "0")}`
}

function formatViews(views: number): string {
  if (views >= 1000000) return `${(views / 1000000).toFixed(1)}M`
  if (views >= 1000) return `${(views / 1000).toFixed(1)}K`
  return views.toString()
}

// Proxy thumbnail URL for external sources
function getProxiedThumbnailUrl(url: string): string {
  if (!url) return ""
  const safeHosts = ["localhost", "getgooned.io", "supabase.co", "supabase.in"]
  try {
    const hostname = new URL(url).hostname
    if (safeHosts.some((h) => hostname.includes(h))) {
      return url
    }
    return `/api/videos/thumbnail?url=${encodeURIComponent(url)}`
  } catch {
    return `/api/videos/thumbnail?url=${encodeURIComponent(url)}`
  }
}

export function VideoLibraryModal({
  isOpen,
  onClose,
  onSelect,
  syncReadyOnly = true,
}: VideoLibraryModalProps) {
  const [videos, setVideos] = useState<LibraryVideo[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [hoveredVideo, setHoveredVideo] = useState<string | null>(null)
  const [watchedIds, setWatchedIds] = useState<Set<string>>(new Set())
  const observerRef = useRef<HTMLDivElement>(null)

  // Load watched video IDs from localStorage
  useEffect(() => {
    if (isOpen) {
      setWatchedIds(getWatchedVideoIds())
    }
  }, [isOpen])

  // Fetch videos
  const fetchVideos = useCallback(
    async (pageNum: number, searchQuery: string) => {
      setIsLoading(true)
      try {
        const params = new URLSearchParams({
          page: pageNum.toString(),
          limit: "20",
          sort: "views",
          hasScript: syncReadyOnly ? "true" : "false",
        })

        if (searchQuery) {
          params.set("search", searchQuery)
        }

        const response = await fetch(`/api/videos?${params}`)
        const data = await response.json()

        if (pageNum === 1) {
          setVideos(data.videos || [])
        } else {
          setVideos((prev) => [...prev, ...(data.videos || [])])
        }

        setHasMore(data.hasMore || false)
      } catch (error) {
        console.error("[VideoLibrary] Fetch error:", error)
      } finally {
        setIsLoading(false)
      }
    },
    [syncReadyOnly]
  )

  // Initial fetch and reset on search change
  useEffect(() => {
    if (isOpen) {
      setPage(1)
      fetchVideos(1, search)
    }
  }, [isOpen, search, fetchVideos])

  // Load more on scroll
  useEffect(() => {
    if (!isOpen) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isLoading && hasMore) {
          setPage((prev) => {
            const nextPage = prev + 1
            fetchVideos(nextPage, search)
            return nextPage
          })
        }
      },
      { threshold: 0.1 }
    )

    if (observerRef.current) {
      observer.observe(observerRef.current)
    }

    return () => observer.disconnect()
  }, [isOpen, isLoading, hasMore, search, fetchVideos])

  // Handle video selection
  const handleSelect = (video: LibraryVideo) => {
    markVideoWatched(video.id)
    onSelect(video)
    onClose()
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-[#141414] rounded-xl border border-white/10 w-full max-w-4xl max-h-[80vh] flex flex-col overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
            <div>
              <h2 className="font-semibold text-lg">Video Library</h2>
              <p className="text-sm text-white/50">
                {syncReadyOnly
                  ? "Pick a video that syncs to your toy while you record"
                  : "Select a video to record with"}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Search */}
          <div className="px-4 py-3 border-b border-white/10">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search videos..."
                className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-green-500/50 transition-colors"
              />
            </div>
          </div>

          {/* Video Grid */}
          <div className="flex-1 overflow-y-auto p-4">
            {isLoading && videos.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-green-400" />
              </div>
            ) : videos.length === 0 ? (
              <div className="text-center py-12 text-white/50">
                No videos found
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {videos.map((video) => {
                    const hasScript =
                      video.has_script ||
                      (video.script_total_actions &&
                        video.script_total_actions > 0)
                    const thumbnailUrl = video.thumbnail_url
                      ? getProxiedThumbnailUrl(video.thumbnail_url)
                      : null
                    const isHovered = hoveredVideo === video.id
                    const isWatched = watchedIds.has(video.id)

                    return (
                      <motion.div
                        key={video.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={cn("group cursor-pointer", isWatched && "opacity-60 hover:opacity-100 transition-opacity")}
                        onMouseEnter={() => setHoveredVideo(video.id)}
                        onMouseLeave={() => setHoveredVideo(null)}
                        onClick={() => handleSelect(video)}
                      >
                        <div
                          className={cn(
                            "bg-[#1a1a1a] rounded-lg overflow-hidden border transition-all duration-200",
                            isHovered
                              ? "border-green-500/50 shadow-lg shadow-green-500/10 -translate-y-1"
                              : "border-white/10"
                          )}
                        >
                          {/* Thumbnail */}
                          <div className="relative aspect-video bg-black">
                            {thumbnailUrl ? (
                              <img
                                src={thumbnailUrl}
                                alt={video.name}
                                className="absolute inset-0 w-full h-full object-cover"
                              />
                            ) : (
                              <div className="absolute inset-0 flex items-center justify-center">
                                <Play className="w-8 h-8 text-white/30" />
                              </div>
                            )}

                            {/* Play overlay */}
                            <div
                              className={cn(
                                "absolute inset-0 flex items-center justify-center bg-black/50 transition-opacity",
                                isHovered ? "opacity-100" : "opacity-0"
                              )}
                            >
                              <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
                                <Play className="w-5 h-5 text-black fill-black ml-0.5" />
                              </div>
                            </div>

                            {/* Duration */}
                            {video.duration > 0 && (
                              <div className="absolute bottom-2 right-2 px-1.5 py-0.5 bg-black/80 rounded text-xs font-medium flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {formatDuration(video.duration)}
                              </div>
                            )}

                            {/* Sync badge */}
                            {hasScript && (
                              <div className="absolute top-2 left-2 px-1.5 py-0.5 bg-green-500/20 border border-green-500/30 rounded text-xs font-semibold flex items-center gap-1 text-green-300">
                                <Zap className="w-3 h-3" />
                                SYNC
                              </div>
                            )}

                            {/* Watched badge */}
                            {isWatched && !isHovered && (
                              <div className="absolute top-2 right-2 px-1.5 py-0.5 bg-black/70 rounded text-[10px] font-medium flex items-center gap-1 text-white/50">
                                <Check className="w-2.5 h-2.5" />
                                Watched
                              </div>
                            )}
                          </div>

                          {/* Info */}
                          <div className="p-2">
                            <h3 className="text-sm font-medium line-clamp-2 group-hover:text-green-400 transition-colors">
                              {video.name}
                            </h3>
                            <div className="flex items-center gap-2 mt-1 text-xs text-white/50">
                              <div className="flex items-center gap-1">
                                <Eye className="w-3 h-3" />
                                {formatViews(video.views)}
                              </div>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )
                  })}
                </div>

                {/* Load more trigger */}
                <div ref={observerRef} className="py-4 flex justify-center">
                  {isLoading && (
                    <Loader2 className="w-6 h-6 animate-spin text-white/40" />
                  )}
                </div>
              </>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
