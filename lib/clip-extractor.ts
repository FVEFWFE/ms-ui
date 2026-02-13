/**
 * Clip Extractor Utility
 *
 * Extracts a time segment from a video blob using canvas + MediaRecorder.
 * Used by Money Stroker to trim recordings to the best 5-second clip.
 */

// Find supported MIME type with codec fallback
function getSupportedMimeType(): string {
  if (typeof MediaRecorder === 'undefined') {
    return 'video/webm'
  }

  const codecs = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm;codecs=vp8',
    'video/webm',
    'video/mp4',
  ]

  for (const codec of codecs) {
    if (MediaRecorder.isTypeSupported(codec)) {
      return codec
    }
  }

  return 'video/webm'
}

/**
 * Extract a clip from a video blob
 *
 * @param videoBlob - Source video blob
 * @param startTime - Start time in seconds
 * @param endTime - End time in seconds
 * @param options - Additional options
 * @returns Promise<Blob> - Extracted clip as a new video blob
 */
export async function extractClip(
  videoBlob: Blob,
  startTime: number,
  endTime: number,
  options?: {
    fps?: number
    videoBitrate?: number
    onProgress?: (progress: number) => void
  }
): Promise<Blob> {
  const {
    fps = 30,
    videoBitrate = 5000000, // 5 Mbps
    onProgress,
  } = options || {}

  const clipDuration = endTime - startTime
  if (clipDuration <= 0) {
    throw new Error('End time must be greater than start time')
  }

  return new Promise((resolve, reject) => {
    // Create video element to play source
    const video = document.createElement('video')
    video.muted = true
    video.playsInline = true

    // Create object URL for the blob
    const videoUrl = URL.createObjectURL(videoBlob)
    video.src = videoUrl

    // Create canvas to capture frames
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')

    if (!ctx) {
      URL.revokeObjectURL(videoUrl)
      reject(new Error('Could not get canvas context'))
      return
    }

    // Wait for video metadata
    video.onloadedmetadata = () => {
      // Set canvas size to match video
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight

      // Seek to start time
      video.currentTime = startTime
    }

    // When seeked to start, begin recording
    video.onseeked = () => {
      // Get canvas stream
      const canvasStream = canvas.captureStream(fps)

      // Try to capture audio from video
      let combinedStream: MediaStream

      try {
        const videoStream = (video as any).captureStream?.()
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

      // Create recorder
      const mimeType = getSupportedMimeType()
      const recorder = new MediaRecorder(combinedStream, {
        mimeType,
        videoBitsPerSecond: videoBitrate,
      })

      const chunks: Blob[] = []

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data)
        }
      }

      recorder.onstop = () => {
        // Cleanup
        URL.revokeObjectURL(videoUrl)
        video.pause()

        // Create output blob
        const outputBlob = new Blob(chunks, { type: mimeType })
        resolve(outputBlob)
      }

      recorder.onerror = (e) => {
        URL.revokeObjectURL(videoUrl)
        video.pause()
        reject(new Error('Recording failed: ' + e))
      }

      // Start recording
      recorder.start(100) // Collect data every 100ms

      // Animation loop to draw frames
      let animationId: number
      const drawFrame = () => {
        if (video.currentTime >= endTime) {
          // Done - stop recording
          cancelAnimationFrame(animationId)
          recorder.stop()
          return
        }

        // Draw current frame
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

        // Report progress
        if (onProgress) {
          const progress = (video.currentTime - startTime) / clipDuration
          onProgress(Math.min(1, Math.max(0, progress)))
        }

        animationId = requestAnimationFrame(drawFrame)
      }

      // Start playback and drawing
      video.play().then(() => {
        drawFrame()
      }).catch((err) => {
        URL.revokeObjectURL(videoUrl)
        reject(new Error('Could not play video: ' + err.message))
      })
    }

    video.onerror = () => {
      URL.revokeObjectURL(videoUrl)
      reject(new Error('Could not load video'))
    }
  })
}

/**
 * Extract a single frame from a video at a specific time
 *
 * @param videoBlob - Source video blob
 * @param time - Time in seconds
 * @param format - Output format ('image/jpeg' | 'image/png')
 * @param quality - JPEG quality (0-1)
 * @returns Promise<Blob> - Frame as image blob
 */
export async function extractFrame(
  videoBlob: Blob,
  time: number,
  format: 'image/jpeg' | 'image/png' = 'image/jpeg',
  quality: number = 0.9
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    video.muted = true
    video.playsInline = true

    const videoUrl = URL.createObjectURL(videoBlob)
    video.src = videoUrl

    video.onloadedmetadata = () => {
      if (time > video.duration) {
        URL.revokeObjectURL(videoUrl)
        reject(new Error('Time exceeds video duration'))
        return
      }
      video.currentTime = time
    }

    video.onseeked = () => {
      const canvas = document.createElement('canvas')
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight

      const ctx = canvas.getContext('2d')
      if (!ctx) {
        URL.revokeObjectURL(videoUrl)
        reject(new Error('Could not get canvas context'))
        return
      }

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(videoUrl)
          if (blob) {
            resolve(blob)
          } else {
            reject(new Error('Could not create image blob'))
          }
        },
        format,
        quality
      )
    }

    video.onerror = () => {
      URL.revokeObjectURL(videoUrl)
      reject(new Error('Could not load video'))
    }
  })
}

/**
 * Get video duration from a blob
 *
 * @param videoBlob - Source video blob
 * @returns Promise<number> - Duration in seconds
 */
export async function getVideoDuration(videoBlob: Blob): Promise<number> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    video.muted = true
    video.playsInline = true

    const videoUrl = URL.createObjectURL(videoBlob)
    video.src = videoUrl

    video.onloadedmetadata = () => {
      URL.revokeObjectURL(videoUrl)
      resolve(video.duration)
    }

    video.onerror = () => {
      URL.revokeObjectURL(videoUrl)
      reject(new Error('Could not load video'))
    }
  })
}

/**
 * Crop region in pixels describing where the webcam is on the composited canvas.
 */
export interface CropRegion {
  x: number
  y: number
  width: number
  height: number
}

/**
 * Compute the pixel region where the webcam feed lives on the composited canvas.
 *
 * Returns null for PiP layouts (webcam too small for useful Greek God transform).
 */
export function computeWebcamCropRegion(
  canvasWidth: number,
  canvasHeight: number,
  source: string,
  layoutMode: string,
  webcamPosition: string,
  _orientation: string
): CropRegion | null {
  // Webcam-only: full frame
  if (source === "webcam-only") {
    return { x: 0, y: 0, width: canvasWidth, height: canvasHeight }
  }

  // PiP layouts: webcam is too small (15-25% of canvas)
  if (layoutMode === "pip") {
    return null
  }

  // Left-center / right-center: full-height webcam strip, max 40% width
  if (webcamPosition === "left-center" || webcamPosition === "right-center") {
    // Approximate strip width as 40% (max) since we don't have actual webcam aspect ratio here.
    // The strip is clamped to max 40% in the recorder. Use that as safe crop.
    const stripWidth = Math.round(canvasWidth * 0.4)
    const x = webcamPosition === "left-center" ? 0 : canvasWidth - stripWidth
    return { x, y: 0, width: stripWidth, height: canvasHeight }
  }

  // Side-by-side: 50/50 split
  if (layoutMode === "side-by-side") {
    const halfWidth = Math.round(canvasWidth / 2)
    const isLeft = webcamPosition === "left"
    return {
      x: isLeft ? 0 : halfWidth,
      y: 0,
      width: halfWidth,
      height: canvasHeight,
    }
  }

  // Stacked: top/bottom split
  if (layoutMode === "stacked") {
    const halfHeight = Math.round(canvasHeight / 2)
    // webcamPosition "left" = webcam on top, "right" = webcam on bottom
    const isTop = webcamPosition === "left"
    return {
      x: 0,
      y: isTop ? 0 : halfHeight,
      width: canvasWidth,
      height: halfHeight,
    }
  }

  // Fallback: full frame
  return { x: 0, y: 0, width: canvasWidth, height: canvasHeight }
}

/**
 * Extract a single frame from a video, cropped to a specific region.
 *
 * @param videoBlob - Source video blob
 * @param time - Time in seconds to seek to
 * @param cropRegion - Pixel region to crop from the video frame
 * @param format - Output format
 * @param quality - JPEG quality (0-1)
 * @returns Promise<Blob> - Cropped frame as image blob
 */
export async function extractFrameCropped(
  videoBlob: Blob,
  time: number,
  cropRegion: CropRegion,
  format: 'image/jpeg' | 'image/png' = 'image/jpeg',
  quality: number = 0.9
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    video.muted = true
    video.playsInline = true

    const videoUrl = URL.createObjectURL(videoBlob)
    video.src = videoUrl

    video.onloadedmetadata = () => {
      if (time > video.duration) {
        URL.revokeObjectURL(videoUrl)
        reject(new Error('Time exceeds video duration'))
        return
      }
      video.currentTime = time
    }

    video.onseeked = () => {
      const canvas = document.createElement('canvas')
      canvas.width = cropRegion.width
      canvas.height = cropRegion.height

      const ctx = canvas.getContext('2d')
      if (!ctx) {
        URL.revokeObjectURL(videoUrl)
        reject(new Error('Could not get canvas context'))
        return
      }

      // Draw the cropped region of the video onto the canvas
      ctx.drawImage(
        video,
        cropRegion.x, cropRegion.y, cropRegion.width, cropRegion.height,
        0, 0, cropRegion.width, cropRegion.height
      )

      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(videoUrl)
          if (blob) {
            resolve(blob)
          } else {
            reject(new Error('Could not create image blob'))
          }
        },
        format,
        quality
      )
    }

    video.onerror = () => {
      URL.revokeObjectURL(videoUrl)
      reject(new Error('Could not load video'))
    }
  })
}

/**
 * Extract a video clip cropped to a specific region of the canvas.
 *
 * Plays the video from startTime to endTime, draws only the cropped region
 * to a canvas, and records the canvas stream. Used for extracting the webcam
 * portion from a split-screen recording for Greek God video pipeline.
 *
 * The output is resized to targetWidth x targetHeight (WAN 2.2 native resolution).
 *
 * @param videoBlob - Source video blob (full recording)
 * @param startTime - Start time in seconds
 * @param endTime - End time in seconds
 * @param cropRegion - Pixel region to crop from each frame
 * @param targetWidth - Output width (should be WAN 2.2 native, e.g. 720)
 * @param targetHeight - Output height (should be WAN 2.2 native, e.g. 1280)
 * @param onProgress - Progress callback (0-1)
 * @returns Promise<Blob> - Cropped + resized video clip
 */
export async function extractClipCropped(
  videoBlob: Blob,
  startTime: number,
  endTime: number,
  cropRegion: CropRegion,
  targetWidth: number = 720,
  targetHeight: number = 1280,
  onProgress?: (progress: number) => void
): Promise<Blob> {
  const clipDuration = endTime - startTime
  if (clipDuration <= 0) {
    throw new Error('End time must be greater than start time')
  }

  const fps = 30
  const mimeType = getSupportedMimeType()

  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    video.muted = true
    video.playsInline = true

    const videoUrl = URL.createObjectURL(videoBlob)
    video.src = videoUrl

    const canvas = document.createElement('canvas')
    canvas.width = targetWidth
    canvas.height = targetHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      URL.revokeObjectURL(videoUrl)
      reject(new Error('Could not get canvas context'))
      return
    }

    const stream = canvas.captureStream(fps)
    const recorder = new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond: 5000000,
    })
    const chunks: Blob[] = []

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data)
    }

    recorder.onstop = () => {
      URL.revokeObjectURL(videoUrl)
      const blob = new Blob(chunks, { type: mimeType.split(';')[0] })
      resolve(blob)
    }

    recorder.onerror = () => {
      URL.revokeObjectURL(videoUrl)
      reject(new Error('MediaRecorder error during cropped clip extraction'))
    }

    let animationFrame: number | null = null

    function drawFrame() {
      if (video.paused || video.ended || video.currentTime >= endTime) {
        if (animationFrame) cancelAnimationFrame(animationFrame)
        recorder.stop()
        return
      }

      // Draw cropped region scaled to target dimensions
      ctx!.drawImage(
        video,
        cropRegion.x, cropRegion.y, cropRegion.width, cropRegion.height,
        0, 0, targetWidth, targetHeight
      )

      const progress = (video.currentTime - startTime) / clipDuration
      onProgress?.(Math.min(Math.max(progress, 0), 1))

      animationFrame = requestAnimationFrame(drawFrame)
    }

    video.onloadedmetadata = () => {
      video.currentTime = startTime
    }

    video.onseeked = () => {
      recorder.start()
      video.play()
      drawFrame()
    }

    // Stop at endTime
    video.ontimeupdate = () => {
      if (video.currentTime >= endTime) {
        video.pause()
      }
    }

    video.onerror = () => {
      URL.revokeObjectURL(videoUrl)
      reject(new Error('Could not load video for cropped extraction'))
    }
  })
}

/**
 * Convert frame blob to base64 string
 *
 * @param imageBlob - Image blob
 * @returns Promise<string> - Base64 data URI
 */
export async function blobToBase64(imageBlob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      resolve(reader.result as string)
    }
    reader.onerror = () => {
      reject(new Error('Could not read blob'))
    }
    reader.readAsDataURL(imageBlob)
  })
}
