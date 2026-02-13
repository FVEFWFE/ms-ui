const STORAGE_KEY = "money_stroker_watched_videos"

export function getWatchedVideoIds(): Set<string> {
  if (typeof window === "undefined") return new Set()
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return new Set()
    return new Set(JSON.parse(raw) as string[])
  } catch {
    return new Set()
  }
}

export function markVideoWatched(videoId: string): void {
  if (typeof window === "undefined") return
  try {
    const watched = getWatchedVideoIds()
    watched.add(videoId)
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...watched]))
  } catch {
    // localStorage full or unavailable — silently ignore
  }
}

export function isVideoWatched(videoId: string): boolean {
  return getWatchedVideoIds().has(videoId)
}
