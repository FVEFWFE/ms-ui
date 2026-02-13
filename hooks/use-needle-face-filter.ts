'use client'

import { useEffect, useRef, useCallback } from 'react'

interface UseNeedleFaceFilterOptions {
  enabled: boolean
  outputCanvasRef: React.RefObject<HTMLCanvasElement | null>
  glbUrl?: string
  scale?: number // 0.1-1.0, default 0.45
}

const DEFAULT_RACCOON_GLB = 'https://cloud.needle.tools/-/assets/Z23hmXBZWllze-ZWllze/file'
const DEFAULT_SCALE = 0.45

/**
 * Integrates Needle Engine 3D face masks into the recording pipeline.
 *
 * Creates an off-screen <needle-engine> element that:
 * 1. Opens its own webcam stream + runs MediaPipe face tracking
 * 2. Renders a 3D mask over the face via WebGL
 * 3. Copies each frame from the WebGL canvas to the output 2D canvas
 *
 * The output canvas is then used as the webcam source for the recorder,
 * baking the 3D mask into the final recorded video.
 *
 * Scale changes are applied at runtime via _headMatrix without reloading
 * the engine or restarting the webcam stream.
 */
export function useNeedleFaceFilter({
  enabled,
  outputCanvasRef,
  glbUrl = DEFAULT_RACCOON_GLB,
  scale = DEFAULT_SCALE,
}: UseNeedleFaceFilterOptions) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const needleElementRef = useRef<HTMLElement | null>(null)
  const animationFrameRef = useRef<number>()
  const isInitializedRef = useRef(false)
  const scalePollingRef = useRef<ReturnType<typeof setInterval>>()
  const rootRef = useRef<any>(null)
  const baseMatrixRef = useRef<any>(null)
  const scaleReadyRef = useRef(false) // true once baseline is cached and first scale applied

  // Find FaceFilterRoot component and cache baseline _headMatrix
  const findRoot = useCallback(async () => {
    if (rootRef.current) return rootRef.current

    const engine = needleElementRef.current as any
    const ctx = engine?.context
    if (!ctx?.scene) return null

    const { FaceFilterRoot } = await import('@needle-tools/facefilter')
    const { getComponent } = await import('@needle-tools/engine')

    let found: any = null
    ctx.scene.traverse((obj: any) => {
      if (found) return
      const comp = getComponent(obj, FaceFilterRoot as any)
      if (comp) found = comp
    })

    if (found) {
      rootRef.current = found
      if (found._headMatrix && !baseMatrixRef.current) {
        const { Matrix4 } = await import('three')
        baseMatrixRef.current = new Matrix4().copy(found._headMatrix)
        console.log('[NeedleFaceFilter] Cached baseline _headMatrix')
      }
    }
    return found
  }, [])

  // Apply scale by modifying _headMatrix relative to cached baseline
  const applyScale = useCallback(
    async (newScale: number) => {
      const root = await findRoot()
      if (!root || !baseMatrixRef.current) return false

      const { Matrix4, Vector3 } = await import('three')

      const scaleFactor = newScale / DEFAULT_SCALE
      const newMatrix = new Matrix4().copy(baseMatrixRef.current)
      newMatrix.scale(new Vector3(scaleFactor, scaleFactor, scaleFactor))
      root._headMatrix = newMatrix

      return true
    },
    [findRoot]
  )

  // Main init/cleanup effect — only depends on enabled, outputCanvasRef, glbUrl
  // Scale is intentionally NOT a dependency here to avoid reloading the engine
  useEffect(() => {
    if (!enabled || !outputCanvasRef.current) {
      cleanup()
      return
    }

    if (isInitializedRef.current) return

    const initNeedle = async () => {
      isInitializedRef.current = true

      try {
        console.log('[NeedleFaceFilter] Initializing Needle Engine...')

        await import('@needle-tools/facefilter')
        console.log('[NeedleFaceFilter] Facefilter module loaded')

        if (!enabled || !outputCanvasRef.current) {
          isInitializedRef.current = false
          return
        }

        // Set preserveDrawingBuffer via official API BEFORE creating <needle-engine>
        let usedOfficialAPI = false
        try {
          const { Context } = await import('@needle-tools/engine')
          Context.DefaultWebGLRendererParameters.preserveDrawingBuffer = true
          usedOfficialAPI = true
          console.log('[NeedleFaceFilter] Set preserveDrawingBuffer via Context API')
        } catch (e) {
          console.warn('[NeedleFaceFilter] Context API not available, will patch shadow DOM canvas')
        }

        // Create off-screen container
        const container = document.createElement('div')
        container.style.cssText =
          'position: fixed; left: -640px; top: 0; width: 640px; height: 480px; overflow: hidden; pointer-events: none; z-index: -1;'
        document.body.appendChild(container)
        containerRef.current = container

        // Create <needle-engine> element
        const needleEl = document.createElement('needle-engine') as HTMLElement
        needleEl.setAttribute('face-filter', glbUrl)
        needleEl.setAttribute('face-filter-show-video', 'true')
        needleEl.setAttribute('face-filter-scale', String(scale))
        needleEl.setAttribute('camera-controls', 'false')
        needleEl.setAttribute('hide-loading-overlay', '')
        needleEl.style.width = '640px'
        needleEl.style.height = '480px'
        needleEl.style.display = 'block'

        // Fallback: patch shadow DOM canvas if official API wasn't available
        if (!usedOfficialAPI) {
          const shadowCanvas = needleEl.shadowRoot?.querySelector('canvas')
          if (shadowCanvas) {
            const origGetContext = shadowCanvas.getContext.bind(shadowCanvas)
            ;(shadowCanvas as any).getContext = function (type: string, attrs?: any) {
              if (type === 'webgl' || type === 'webgl2') {
                console.log('[NeedleFaceFilter] Fallback: Intercepted WebGL context, adding preserveDrawingBuffer')
                attrs = { ...(attrs || {}), preserveDrawingBuffer: true }
              }
              return origGetContext(type, attrs)
            }
          } else {
            console.warn('[NeedleFaceFilter] Shadow DOM canvas not found for patching')
          }
        }

        // Append to container — triggers connectedCallback → engine loading → WebGL init
        container.appendChild(needleEl)
        needleElementRef.current = needleEl

        const outputCanvas = outputCanvasRef.current
        if (!outputCanvas) {
          console.warn('[NeedleFaceFilter] Output canvas ref missing')
          isInitializedRef.current = false
          return
        }

        const ctx = outputCanvas.getContext('2d')
        if (!ctx) {
          console.error('[NeedleFaceFilter] Failed to get 2D context from output canvas')
          isInitializedRef.current = false
          return
        }

        // Start render loop: copy WebGL canvas → output 2D canvas
        let webglCanvas: HTMLCanvasElement | null = null

        const renderLoop = () => {
          if (!webglCanvas) {
            webglCanvas = needleEl.shadowRoot?.querySelector('canvas') || null
          }

          if (webglCanvas && webglCanvas.width > 0 && webglCanvas.height > 0) {
            if (outputCanvas.width !== webglCanvas.width) outputCanvas.width = webglCanvas.width
            if (outputCanvas.height !== webglCanvas.height) outputCanvas.height = webglCanvas.height
            ctx.drawImage(webglCanvas, 0, 0)
          }

          animationFrameRef.current = requestAnimationFrame(renderLoop)
        }

        console.log('[NeedleFaceFilter] Starting render loop')
        renderLoop()

        // Poll until FaceFilterRoot is available, cache baseline, apply initial scale
        let attempts = 0
        scalePollingRef.current = setInterval(async () => {
          attempts++
          const success = await applyScale(scale)
          if (success) {
            scaleReadyRef.current = true
            console.log(`[NeedleFaceFilter] Initial scale ${scale} applied after ${attempts} attempts`)
            clearInterval(scalePollingRef.current!)
            scalePollingRef.current = undefined
          } else if (attempts >= 30) {
            console.warn('[NeedleFaceFilter] Scale polling timed out (15s). Mask uses attribute-defined scale.')
            clearInterval(scalePollingRef.current!)
            scalePollingRef.current = undefined
          }
        }, 500)
      } catch (err) {
        console.error('[NeedleFaceFilter] Initialization failed:', err)
        isInitializedRef.current = false
      }
    }

    initNeedle()

    return () => {
      cleanup()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, outputCanvasRef, glbUrl])

  // Separate effect for live scale updates — runs without restarting engine
  useEffect(() => {
    if (!scaleReadyRef.current) return
    applyScale(scale).then((ok) => {
      if (ok) console.log(`[NeedleFaceFilter] Live scale updated to ${scale}`)
    })
  }, [scale, applyScale])

  function cleanup() {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = undefined
    }
    if (scalePollingRef.current) {
      clearInterval(scalePollingRef.current)
      scalePollingRef.current = undefined
    }
    if (needleElementRef.current) {
      needleElementRef.current.remove()
      needleElementRef.current = null
    }
    if (containerRef.current) {
      containerRef.current.remove()
      containerRef.current = null
    }
    try {
      import('@needle-tools/engine').then(({ Context }) => {
        Context.DefaultWebGLRendererParameters.preserveDrawingBuffer = false
      })
    } catch {
      // Ignore — engine may not be loaded
    }
    rootRef.current = null
    baseMatrixRef.current = null
    scaleReadyRef.current = false
    isInitializedRef.current = false
  }
}
