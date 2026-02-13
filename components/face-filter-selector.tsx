'use client'

import { useRef, useEffect, useState } from 'react'
import { Eye, EyeOff, ChevronDown, ChevronUp, Sparkles, EyeOff as BlurIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'

export type FaceFilterId = string

interface FaceFilter {
  id: FaceFilterId
  label: string
  description: string
  glbUrl?: string
  scaleMultiplier: number
  previewUrl?: string
}

const FACE_FILTERS: FaceFilter[] = [
  {
    id: 'raccoon',
    label: 'Raccoon',
    description: '3D face tracking mask',
    glbUrl: 'https://cloud.needle.tools/-/assets/Z23hmXBZWllze-ZWllze/file',
    scaleMultiplier: 1,
  },
  {
    id: 'spartan-warrior',
    label: 'Spartan',
    description: 'Bronze spartan helmet',
    glbUrl: '/face-filters/spartan-warrior.glb',
    scaleMultiplier: 0.25,
    previewUrl: '/face-filters/previews/spartan-warrior.mp4',
  },
  {
    id: 'bronze-adonis',
    label: 'Adonis',
    description: 'Greek god mask',
    glbUrl: '/face-filters/bronze-adonis.glb',
    scaleMultiplier: 0.25,
    previewUrl: '/face-filters/previews/bronze-adonis.mp4',
  },
  {
    id: 'luchador',
    label: 'Luchador',
    description: 'Wrestling mask',
    glbUrl: '/face-filters/luchador.glb',
    scaleMultiplier: 0.25,
    previewUrl: '/face-filters/previews/luchador.mp4',
  },
  {
    id: 'military-gas-mask',
    label: 'Gas Mask',
    description: 'Tactical respirator',
    glbUrl: '/face-filters/military-gas-mask.glb',
    scaleMultiplier: 0.25,
    previewUrl: '/face-filters/previews/military-gas-mask.mp4',
  },
  {
    id: 'phantom-lover',
    label: 'Phantom',
    description: 'Sleek phantom mask',
    glbUrl: '/face-filters/phantom-lover.glb',
    scaleMultiplier: 0.25,
    previewUrl: '/face-filters/previews/phantom-lover.mp4',
  },
  {
    id: 'gimp-muzzle',
    label: 'Gimp',
    description: 'Black leather muzzle',
    glbUrl: '/face-filters/gimp-muzzle.glb',
    scaleMultiplier: 0.25,
    previewUrl: '/face-filters/previews/gimp-muzzle.mp4',
  },
  {
    id: 'heart-eyes-blindfold',
    label: 'Heart Eyes',
    description: 'Heart shaped blindfold',
    glbUrl: '/face-filters/heart-eyes-blindfold.glb',
    scaleMultiplier: 0.25,
    previewUrl: '/face-filters/previews/heart-eyes-blindfold.mp4',
  },
  {
    id: 'crystal-ice-king',
    label: 'Ice King',
    description: 'Ice crown mask',
    glbUrl: '/face-filters/crystal-ice-king.glb',
    scaleMultiplier: 0.25,
    previewUrl: '/face-filters/previews/crystal-ice-king.mp4',
  },
  {
    id: 'bonk-visor',
    label: 'Bonk',
    description: 'Rusty iron visor',
    glbUrl: '/face-filters/bonk-visor.glb',
    scaleMultiplier: 0.25,
    previewUrl: '/face-filters/previews/bonk-visor.mp4',
  },
  {
    id: 'smoke-bourbon',
    label: 'Bourbon',
    description: 'Gentleman smoker mask',
    glbUrl: '/face-filters/smoke-bourbon.glb',
    scaleMultiplier: 0.25,
    previewUrl: '/face-filters/previews/smoke-bourbon.mp4',
  },
  {
    id: 'tactical-tissue-bando',
    label: 'Tactical',
    description: 'Tactical bandana wrap',
    glbUrl: '/face-filters/tactical-tissue-bando.glb',
    scaleMultiplier: 0.25,
    previewUrl: '/face-filters/previews/tactical-tissue-bando.mp4',
  },
  {
    id: 'blur_light',
    label: 'Light Blur',
    description: 'Subtle privacy protection',
    scaleMultiplier: 1,
  },
  {
    id: 'blur_heavy',
    label: 'Heavy Blur',
    description: 'Complete anonymity',
    scaleMultiplier: 1,
  },
]

/** Check if a filter uses a 3D GLB mask (vs blur) */
export function is3DMask(filterId: FaceFilterId): boolean {
  const filter = FACE_FILTERS.find((f) => f.id === filterId)
  return !!filter?.glbUrl
}

/** Get the GLB URL for a 3D mask filter */
export function getFilterGlbUrl(filterId: FaceFilterId): string | undefined {
  return FACE_FILTERS.find((f) => f.id === filterId)?.glbUrl
}

/** Get scale multiplier for a filter (Meshy models = 0.25, raccoon = 1) */
export function getScaleMultiplier(filterId: FaceFilterId): number {
  return FACE_FILTERS.find((f) => f.id === filterId)?.scaleMultiplier ?? 1
}

function MaskThumb({
  filter,
  selected,
  onClick,
}: {
  filter: FaceFilter
  selected: boolean
  onClick: () => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (videoRef.current && filter.previewUrl) {
      videoRef.current.play().catch(() => {})
    }
  }, [filter.previewUrl])

  const isBlur = filter.id.startsWith('blur_')

  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-1 group min-w-0"
    >
      <div
        className={`
          aspect-square rounded-lg overflow-hidden transition-all duration-150
          border-2
          ${selected
            ? 'border-purple-500 ring-1 ring-purple-500/40'
            : 'border-white/10 group-hover:border-white/30'
          }
        `}
      >
        {filter.previewUrl ? (
          <video
            ref={videoRef}
            src={filter.previewUrl}
            muted
            loop
            playsInline
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-neutral-800">
            {isBlur ? (
              <BlurIcon className="w-5 h-5 text-gray-500" />
            ) : (
              <Sparkles className="w-5 h-5 text-purple-400/70" />
            )}
          </div>
        )}
      </div>
      <span className={`text-[10px] leading-none w-full truncate text-center ${selected ? 'text-purple-300' : 'text-white/40 group-hover:text-white/60'}`}>
        {filter.label}
      </span>
    </button>
  )
}

interface FaceFilterSelectorProps {
  enabled: boolean
  onEnabledChange: (enabled: boolean) => void
  selectedFilterId: FaceFilterId
  onFilterChange: (filterId: FaceFilterId) => void
  maskScale?: number
  onMaskScaleChange?: (scale: number) => void
}

export function FaceFilterSelector({
  enabled,
  onEnabledChange,
  selectedFilterId,
  onFilterChange,
  maskScale = 0.45,
  onMaskScaleChange,
}: FaceFilterSelectorProps) {
  const [expanded, setExpanded] = useState(true)
  const scrollRef = useRef<HTMLDivElement>(null)
  const selected = FACE_FILTERS.find((f) => f.id === selectedFilterId)
  const is3D = !!selected?.glbUrl

  // Scroll selected into view when expanding
  useEffect(() => {
    if (expanded && scrollRef.current) {
      const idx = FACE_FILTERS.findIndex((f) => f.id === selectedFilterId)
      if (idx > 0) {
        const child = scrollRef.current.children[idx] as HTMLElement
        child?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
      }
    }
  }, [expanded, selectedFilterId])

  return (
    <div className="space-y-2">
      {/* Header row: icon + label + selected name + expand toggle + ON/OFF */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => onEnabledChange(!enabled)}
          className="flex items-center gap-1.5 flex-shrink-0"
        >
          {enabled ? (
            <Eye className="w-4 h-4 text-green-500" />
          ) : (
            <EyeOff className="w-4 h-4 text-gray-500" />
          )}
        </button>

        <button
          onClick={() => enabled && setExpanded(!expanded)}
          className={`flex-1 flex items-center gap-1.5 min-w-0 ${enabled ? 'cursor-pointer' : 'cursor-default'}`}
        >
          <span className="text-sm font-medium text-white/80 whitespace-nowrap">Mask</span>
          {enabled && selected && (
            <span className="text-xs text-purple-400 truncate">{selected.label}</span>
          )}
          {enabled && (
            expanded
              ? <ChevronUp className="w-3.5 h-3.5 text-white/30 flex-shrink-0" />
              : <ChevronDown className="w-3.5 h-3.5 text-white/30 flex-shrink-0" />
          )}
        </button>

        <Button
          variant={enabled ? 'default' : 'outline'}
          size="sm"
          onClick={() => onEnabledChange(!enabled)}
          className="h-7 w-14 text-xs"
        >
          {enabled ? 'ON' : 'OFF'}
        </Button>
      </div>

      {/* Expandable mask strip */}
      {enabled && expanded && (
        <div className="space-y-2">
          {/* Horizontal scroll strip — grid fills width, scrolls when narrow */}
          <div
            ref={scrollRef}
            className="grid gap-1.5 overflow-x-auto pb-1"
            style={{
              gridTemplateColumns: `repeat(${FACE_FILTERS.length}, minmax(56px, 1fr))`,
              scrollbarWidth: 'none',
              msOverflowStyle: 'none' as any,
            }}
          >
            {FACE_FILTERS.map((filter) => (
              <MaskThumb
                key={filter.id}
                filter={filter}
                selected={selectedFilterId === filter.id}
                onClick={() => onFilterChange(filter.id)}
              />
            ))}
          </div>

          {/* Mask Size Slider (3D masks only) */}
          {is3D && onMaskScaleChange && (
            <div className="flex items-center gap-3">
              <label className="text-[10px] text-white/30 flex-shrink-0">Size</label>
              <Slider
                value={[maskScale]}
                onValueChange={([v]) => onMaskScaleChange(v)}
                min={0.2}
                max={0.8}
                step={0.05}
                className="flex-1"
              />
              <span className="text-[10px] text-white/30 w-7 text-right">{Math.round(maskScale * 100)}%</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
