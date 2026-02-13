/**
 * Video Post-Processor
 *
 * Handles head removal (crop / mosaic) and watermark baking on video clips and images.
 * Uses canvas + MediaRecorder for video processing (same pattern as clip-extractor).
 */

export interface HeadRemovalConfig {
  mode: 'none' | 'crop' | 'mosaic'
  /** For "crop": percentage of frame height from top to black out (0-50) */
  cropLineY?: number
  /** For "mosaic": region to pixelate */
  mosaicRegion?: { x: number; y: number; width: number; height: number }
  /** For "mosaic": block size in pixels (default 12) */
  mosaicBlockSize?: number
}

export interface WatermarkConfig {
  text: string
  /** Position as percentage (0-100) */
  position: { x: number; y: number }
  fontSize: number
  fontFamily: string
  color: string
  shadow: 'none' | 'subtle' | 'strong' | 'neon-glow'
  background: 'none' | 'gradient' | 'blur' | 'solid'
}

function getSupportedMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return 'video/webm'

  const codecs = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm;codecs=vp8',
    'video/webm',
    'video/mp4',
  ]

  for (const codec of codecs) {
    if (MediaRecorder.isTypeSupported(codec)) return codec
  }

  return 'video/webm'
}

function applyHeadRemoval(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  config: HeadRemovalConfig
) {
  if (config.mode === 'crop' && config.cropLineY != null) {
    const cropY = Math.round((config.cropLineY / 100) * height)
    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, width, cropY)
  } else if (config.mode === 'mosaic' && config.mosaicRegion) {
    const { x, y, width: rw, height: rh } = config.mosaicRegion
    const blockSize = config.mosaicBlockSize || 12

    // Read the region pixels
    const regionX = Math.round((x / 100) * width)
    const regionY = Math.round((y / 100) * height)
    const regionW = Math.round((rw / 100) * width)
    const regionH = Math.round((rh / 100) * height)

    const imageData = ctx.getImageData(regionX, regionY, regionW, regionH)
    const data = imageData.data

    // Pixelate
    for (let by = 0; by < regionH; by += blockSize) {
      for (let bx = 0; bx < regionW; bx += blockSize) {
        // Sample center of block
        const sampleX = Math.min(bx + Math.floor(blockSize / 2), regionW - 1)
        const sampleY = Math.min(by + Math.floor(blockSize / 2), regionH - 1)
        const idx = (sampleY * regionW + sampleX) * 4
        const r = data[idx]
        const g = data[idx + 1]
        const b = data[idx + 2]

        // Fill block with sampled color
        for (let py = by; py < Math.min(by + blockSize, regionH); py++) {
          for (let px = bx; px < Math.min(bx + blockSize, regionW); px++) {
            const pidx = (py * regionW + px) * 4
            data[pidx] = r
            data[pidx + 1] = g
            data[pidx + 2] = b
          }
        }
      }
    }

    ctx.putImageData(imageData, regionX, regionY)
  }
}

function applyWatermark(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  config: WatermarkConfig
) {
  ctx.save()

  const { text, position, fontSize, fontFamily, color, shadow, background } = config

  ctx.font = `bold ${fontSize}px ${fontFamily}`

  const posX = (position.x / 100) * width
  const posY = (position.y / 100) * height

  // Measure text for pill background
  const textMetrics = ctx.measureText(text)
  const paddingH = fontSize * 0.8
  const paddingV = fontSize * 0.4
  const pillWidth = textMetrics.width + paddingH * 2
  const pillHeight = fontSize + paddingV * 2
  const pillX = posX - pillWidth / 2
  const pillY = posY - pillHeight / 2

  // Draw background
  if (background !== 'none') {
    ctx.beginPath()
    ctx.roundRect(pillX, pillY, pillWidth, pillHeight, pillHeight / 2)

    if (background === 'gradient') {
      const grad = ctx.createLinearGradient(pillX, pillY, pillX + pillWidth, pillY)
      grad.addColorStop(0, 'rgba(0, 0, 0, 0.8)')
      grad.addColorStop(1, 'rgba(30, 30, 30, 0.6)')
      ctx.fillStyle = grad
    } else if (background === 'blur') {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.1)'
    } else {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'
    }
    ctx.fill()

    const borderColor = color === '#ffffff' ? 'rgba(236, 72, 153, 0.5)' : `${color}66`
    ctx.strokeStyle = borderColor
    ctx.lineWidth = 1
    ctx.stroke()
  }

  // Apply shadow
  if (shadow === 'subtle') {
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)'
    ctx.shadowBlur = 4
    ctx.shadowOffsetX = 1
    ctx.shadowOffsetY = 1
  } else if (shadow === 'strong') {
    ctx.shadowColor = 'rgba(0, 0, 0, 0.8)'
    ctx.shadowBlur = 8
    ctx.shadowOffsetX = 2
    ctx.shadowOffsetY = 2
  } else if (shadow === 'neon-glow') {
    ctx.shadowColor = color
    ctx.shadowBlur = 15
    ctx.shadowOffsetX = 0
    ctx.shadowOffsetY = 0
  }

  // Draw text
  ctx.fillStyle = `${color}f2`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, posX, posY)

  ctx.restore()
}

/**
 * Process a video blob with head removal and/or watermark baking.
 * Re-encodes the video frame by frame using canvas + MediaRecorder.
 */
export async function processVideoPostEffects(
  videoBlob: Blob,
  options: {
    headRemoval?: HeadRemovalConfig
    watermark?: WatermarkConfig
    fps?: number
    videoBitrate?: number
    onProgress?: (progress: number) => void
  }
): Promise<Blob> {
  const {
    headRemoval,
    watermark,
    fps = 30,
    videoBitrate = 5000000,
    onProgress,
  } = options

  // Nothing to do
  if ((!headRemoval || headRemoval.mode === 'none') && !watermark) {
    return videoBlob
  }

  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    video.muted = true
    video.playsInline = true

    const videoUrl = URL.createObjectURL(videoBlob)
    video.src = videoUrl

    video.onloadedmetadata = () => {
      const canvas = document.createElement('canvas')
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      const ctx = canvas.getContext('2d')

      if (!ctx) {
        URL.revokeObjectURL(videoUrl)
        reject(new Error('Could not get canvas context'))
        return
      }

      video.currentTime = 0

      video.onseeked = () => {
        const canvasStream = canvas.captureStream(fps)

        // Capture audio if present
        let combinedStream: MediaStream
        try {
          const videoStream = (video as unknown as { captureStream?: () => MediaStream }).captureStream?.()
          if (videoStream && videoStream.getAudioTracks().length > 0) {
            combinedStream = new MediaStream([
              ...canvasStream.getVideoTracks(),
              ...videoStream.getAudioTracks(),
            ])
          } else {
            combinedStream = canvasStream
          }
        } catch {
          combinedStream = canvasStream
        }

        const mimeType = getSupportedMimeType()
        const recorder = new MediaRecorder(combinedStream, {
          mimeType,
          videoBitsPerSecond: videoBitrate,
        })

        const chunks: Blob[] = []
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunks.push(e.data)
        }

        recorder.onstop = () => {
          URL.revokeObjectURL(videoUrl)
          video.pause()
          resolve(new Blob(chunks, { type: mimeType }))
        }

        recorder.onerror = (e) => {
          URL.revokeObjectURL(videoUrl)
          video.pause()
          reject(new Error('Recording failed: ' + e))
        }

        recorder.start(100)

        const duration = video.duration
        let animationId: number

        const drawFrame = () => {
          if (video.currentTime >= duration || video.ended) {
            cancelAnimationFrame(animationId)
            recorder.stop()
            return
          }

          // Draw original frame
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

          // Apply head removal
          if (headRemoval && headRemoval.mode !== 'none') {
            applyHeadRemoval(ctx, canvas.width, canvas.height, headRemoval)
          }

          // Apply watermark
          if (watermark) {
            applyWatermark(ctx, canvas.width, canvas.height, watermark)
          }

          if (onProgress && duration > 0) {
            onProgress(Math.min(1, video.currentTime / duration))
          }

          animationId = requestAnimationFrame(drawFrame)
        }

        video.play().then(() => {
          drawFrame()
        }).catch((err) => {
          URL.revokeObjectURL(videoUrl)
          reject(new Error('Could not play video: ' + err.message))
        })
      }
    }

    video.onerror = () => {
      URL.revokeObjectURL(videoUrl)
      reject(new Error('Could not load video'))
    }
  })
}

/**
 * Bake a watermark onto a still image.
 * Loads the image, draws it to canvas, applies watermark, exports as PNG.
 */
export async function bakeWatermarkOnImage(
  imageUrl: string,
  config: WatermarkConfig
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'

    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight

      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Could not get canvas context'))
        return
      }

      ctx.drawImage(img, 0, 0)
      applyWatermark(ctx, canvas.width, canvas.height, config)

      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob)
          } else {
            reject(new Error('Could not create image blob'))
          }
        },
        'image/png'
      )
    }

    img.onerror = () => {
      reject(new Error('Could not load image from URL'))
    }

    img.src = imageUrl
  })
}
