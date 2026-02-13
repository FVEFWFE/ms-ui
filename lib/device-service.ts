"use client"

// Device Service with Proxy Pattern
// Supports: VacuGlide 2 / Autoblow Ultra (Autoblow API) and The Handy (Handy API v2)

export type DeviceType = "vacuglide" | "autoblow" | "handy"

export interface DeviceInfo {
  connected: boolean
  deviceType: DeviceType
  firmware?: string
  hardware?: string
  serial?: string
}

export interface DeviceState {
  currentSpeed: number
  targetSpeed: number
  mode: string
  isRunning: boolean
  valveStrokePlus: boolean
  valveStrokeMinus: boolean
}

export type StrokeType = "normal" | "extended" | "pulse" | "tip" | "base" | "full"

export interface DeviceCommand {
  speed: number
  strokeType?: StrokeType
  transition?: "immediate" | "gradual" | "slow"
  pause?: boolean
  // Body part targeting (natural language)
  bodyPartFocus?: "tip" | "base" | "shaft" | "full" | null
}

export interface DeviceEventCallback {
  onSpeedPlusPressed?: () => void
  onSpeedMinusPressed?: () => void
  onModePressed?: () => void
  onConnectionLost?: () => void
  onError?: (error: string) => void
}

// Common interface that both VacuGlide and Handy implement
interface DeviceBackend {
  initialize(token: string): Promise<{ success: boolean; cluster?: string; error?: string }>
  checkConnection(): Promise<boolean>
  getInfo(): Promise<DeviceInfo | null>
  getState(): Promise<DeviceState | null>
  setSpeed(speed: number): Promise<boolean>
  stop(): Promise<boolean>
  setBodyPartFocus(bodyPart: "tip" | "base" | "shaft" | "full" | null): Promise<boolean>
  executeCommand(command: DeviceCommand): Promise<boolean>
  uploadFunscript(funscriptData: object): Promise<boolean>
  startFunscriptSync(startTimeMs?: number): Promise<boolean>
  stopFunscriptSync(): Promise<boolean>
  startEventStream(callbacks: DeviceEventCallback): void
  stopEventStream(): void
  disconnect(): void
  getIsConnected(): boolean
  getDeviceToken(): string
}

// ─── VacuGlide / Autoblow Backend ──────────────────────────────────────────

class VacuGlideService implements DeviceBackend {
  private baseUrl: string = ""
  private deviceToken: string = ""
  private eventSource: EventSource | null = null
  private callbacks: DeviceEventCallback = {}
  private isConnected: boolean = false

  async initialize(token: string): Promise<{ success: boolean; cluster?: string; error?: string }> {
    this.deviceToken = token

    try {
      const connectResponse = await fetch("https://latency.autoblowapi.com/vacuglide/connected", {
        headers: {
          "x-device-token": token,
        },
      })

      if (!connectResponse.ok) {
        return { success: false, error: "Failed to get server cluster" }
      }

      const data = await connectResponse.json()

      if (!data.connected) {
        return { success: false, error: "Device not connected or offline" }
      }

      this.baseUrl = `https://${data.cluster}`
      this.isConnected = true
      return { success: true, cluster: this.baseUrl }
    } catch (error) {
      console.error("[VacuGlide] Initialize error:", error)
      return { success: false, error: "Network error" }
    }
  }

  async checkConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/vacuglide/connected`, {
        headers: {
          "x-device-token": this.deviceToken,
        },
      })

      if (!response.ok) return false

      const data = await response.json()
      return data.connected === true
    } catch (error) {
      console.error("[VacuGlide] Connection check error:", error)
      return false
    }
  }

  async getInfo(): Promise<DeviceInfo | null> {
    try {
      const response = await fetch(`${this.baseUrl}/vacuglide/info`, {
        headers: {
          "x-device-token": this.deviceToken,
        },
      })

      if (!response.ok) return null

      const data = await response.json()
      return {
        connected: true,
        deviceType: "vacuglide",
        firmware: data.firmware,
        hardware: data.hardware,
        serial: data.serial,
      }
    } catch (error) {
      console.error("[VacuGlide] Get info error:", error)
      return null
    }
  }

  async getState(): Promise<DeviceState | null> {
    try {
      const response = await fetch(`${this.baseUrl}/vacuglide/state`, {
        headers: {
          "x-device-token": this.deviceToken,
        },
      })

      if (!response.ok) return null

      const data = await response.json()
      return {
        currentSpeed: data.currentSpeed || 0,
        targetSpeed: data.targetSpeed || 0,
        mode: data.mode || "idle",
        isRunning: data.isRunning || false,
        valveStrokePlus: data.valveStrokePlus || false,
        valveStrokeMinus: data.valveStrokeMinus || false,
      }
    } catch (error) {
      console.error("[VacuGlide] Get state error:", error)
      return null
    }
  }

  async setSpeed(speed: number): Promise<boolean> {
    const clampedSpeed = Math.max(0, Math.min(100, Math.round(speed)))

    try {
      const response = await fetch(`${this.baseUrl}/vacuglide/target-speed`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-device-token": this.deviceToken,
        },
        body: JSON.stringify({ targetSpeed: clampedSpeed }),
      })

      return response.ok
    } catch (error) {
      console.error("[VacuGlide] Set speed error:", error)
      return false
    }
  }

  async stop(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/vacuglide/target-speed/stop`, {
        method: "PUT",
        headers: {
          "x-device-token": this.deviceToken,
        },
      })

      return response.ok
    } catch (error) {
      console.error("[VacuGlide] Stop error:", error)
      return false
    }
  }

  private async setStrokePlusValve(enabled: boolean): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/vacuglide/valve/stroke-plus`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-device-token": this.deviceToken,
        },
        body: JSON.stringify({ valveState: enabled }),
      })

      return response.ok
    } catch (error) {
      console.error("[VacuGlide] Stroke+ valve error:", error)
      return false
    }
  }

  private async setStrokeMinusValve(enabled: boolean): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/vacuglide/valve/stroke-minus`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-device-token": this.deviceToken,
        },
        body: JSON.stringify({ valveState: enabled }),
      })

      return response.ok
    } catch (error) {
      console.error("[VacuGlide] Stroke- valve error:", error)
      return false
    }
  }

  async uploadFunscript(funscriptData: object): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/vacuglide/sync-script/upload-funscript`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-device-token": this.deviceToken,
        },
        body: JSON.stringify(funscriptData),
      })

      return response.ok
    } catch (error) {
      console.error("[VacuGlide] Upload funscript error:", error)
      return false
    }
  }

  async startFunscriptSync(startTimeMs: number = 0): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/vacuglide/sync-script/start`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-device-token": this.deviceToken,
        },
        body: JSON.stringify({ startTimeMs }),
      })

      return response.ok
    } catch (error) {
      console.error("[VacuGlide] Start funscript sync error:", error)
      return false
    }
  }

  async stopFunscriptSync(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/vacuglide/sync-script/stop`, {
        method: "PUT",
        headers: {
          "x-device-token": this.deviceToken,
        },
      })

      return response.ok
    } catch (error) {
      console.error("[VacuGlide] Stop funscript sync error:", error)
      return false
    }
  }

  async setBodyPartFocus(bodyPart: "tip" | "base" | "shaft" | "full" | null): Promise<boolean> {
    switch (bodyPart) {
      case "tip":
        await this.setStrokePlusValve(false)
        return this.setStrokeMinusValve(true)
      case "base":
        await this.setStrokeMinusValve(false)
        return this.setStrokePlusValve(true)
      case "shaft":
        await this.setStrokePlusValve(false)
        return this.setStrokeMinusValve(false)
      case "full":
        await this.setStrokePlusValve(true)
        return this.setStrokeMinusValve(true)
      default:
        await this.setStrokePlusValve(false)
        return this.setStrokeMinusValve(false)
    }
  }

  async executeCommand(command: DeviceCommand): Promise<boolean> {
    if (command.pause) {
      return this.stop()
    }

    if (command.bodyPartFocus) {
      await this.setBodyPartFocus(command.bodyPartFocus)
    } else if (command.strokeType === "extended" || command.strokeType === "full") {
      await this.setStrokePlusValve(true)
    } else if (command.strokeType === "tip") {
      await this.setStrokePlusValve(false)
      await this.setStrokeMinusValve(true)
    } else if (command.strokeType === "base") {
      await this.setStrokePlusValve(true)
      await this.setStrokeMinusValve(false)
    } else if (command.strokeType === "normal") {
      await this.setStrokePlusValve(false)
      await this.setStrokeMinusValve(false)
    }

    return this.setSpeed(command.speed)
  }

  startEventStream(callbacks: DeviceEventCallback): void {
    this.callbacks = callbacks

    if (this.eventSource) {
      this.eventSource.close()
    }

    const eventUrl = `${this.baseUrl}/events/stream?deviceToken=${encodeURIComponent(this.deviceToken)}`
    this.eventSource = new EventSource(eventUrl)

    this.eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        this.handleEvent(data)
      } catch (error) {
        console.error("[VacuGlide] Event parse error:", error)
      }
    }

    this.eventSource.onerror = () => {
      console.error("[VacuGlide] Event stream error")
      this.callbacks.onConnectionLost?.()
    }
  }

  private handleEvent(data: { event: string; [key: string]: unknown }): void {
    switch (data.event) {
      case "speed-minus-button-pressed":
        this.callbacks.onSpeedMinusPressed?.()
        break
      case "speed-plus-button-pressed":
        this.callbacks.onSpeedPlusPressed?.()
        break
      case "mode-button-pressed":
        this.callbacks.onModePressed?.()
        break
      default:
        console.log("[VacuGlide] Unknown event:", data.event)
    }
  }

  stopEventStream(): void {
    if (this.eventSource) {
      this.eventSource.close()
      this.eventSource = null
    }
  }

  disconnect(): void {
    this.stopEventStream()
    this.isConnected = false
    this.deviceToken = ""
    this.baseUrl = ""
  }

  getIsConnected(): boolean {
    return this.isConnected
  }

  getDeviceToken(): string {
    return this.deviceToken
  }
}

// ─── The Handy Backend ─────────────────────────────────────────────────────

class HandyService implements DeviceBackend {
  private static readonly API_BASE = "https://www.handyfeeling.com/api/handy/v2"
  private static readonly SCRIPT_UPLOAD_URL = "https://scripts01.handyfeeling.com/api/script/v0/temp/upload"

  private connectionKey: string = ""
  private isConnected: boolean = false
  private callbacks: DeviceEventCallback = {}
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null
  private currentMode: number = -1 // -1 = unknown, 0 = HAMP, 1 = HSSP, 2 = HDSP, 3 = MAINTENANCE
  private lastSpeed: number = 0
  private serverTimeOffset: number = 0 // local time - server time in ms

  private get headers(): Record<string, string> {
    return {
      "X-Connection-Key": this.connectionKey,
      "Content-Type": "application/json",
    }
  }

  private async apiGet(path: string): Promise<Response> {
    return fetch(`${HandyService.API_BASE}${path}`, { headers: this.headers })
  }

  private async apiPut(path: string, body?: object): Promise<Response> {
    return fetch(`${HandyService.API_BASE}${path}`, {
      method: "PUT",
      headers: this.headers,
      body: body ? JSON.stringify(body) : undefined,
    })
  }

  async initialize(token: string): Promise<{ success: boolean; cluster?: string; error?: string }> {
    this.connectionKey = token

    try {
      const response = await this.apiGet("/connected")

      if (!response.ok) {
        return { success: false, error: "Failed to reach Handy API" }
      }

      const data = await response.json()

      if (!data.connected) {
        return { success: false, error: "Handy not connected. Check your connection key." }
      }

      this.isConnected = true
      return { success: true }
    } catch (error) {
      console.error("[Handy] Initialize error:", error)
      return { success: false, error: "Network error" }
    }
  }

  async checkConnection(): Promise<boolean> {
    try {
      const response = await this.apiGet("/connected")
      if (!response.ok) return false
      const data = await response.json()
      return data.connected === true
    } catch (error) {
      console.error("[Handy] Connection check error:", error)
      return false
    }
  }

  async getInfo(): Promise<DeviceInfo | null> {
    try {
      const response = await this.apiGet("/info")
      if (!response.ok) return null

      const data = await response.json()
      return {
        connected: true,
        deviceType: "handy",
        firmware: data.fwVersion,
        hardware: data.hwVersion,
        serial: data.model?.toString(),
      }
    } catch (error) {
      console.error("[Handy] Get info error:", error)
      return null
    }
  }

  async getState(): Promise<DeviceState | null> {
    try {
      // Handy doesn't have a single state endpoint like VacuGlide.
      // Return a synthetic state based on tracked values.
      const connected = await this.checkConnection()
      if (!connected) return null

      return {
        currentSpeed: this.lastSpeed,
        targetSpeed: this.lastSpeed,
        mode: this.currentMode === 0 ? "hamp" : this.currentMode === 1 ? "hssp" : "idle",
        isRunning: this.lastSpeed > 0,
        valveStrokePlus: false,
        valveStrokeMinus: false,
      }
    } catch (error) {
      console.error("[Handy] Get state error:", error)
      return null
    }
  }

  private async ensureMode(mode: number): Promise<boolean> {
    if (this.currentMode === mode) return true

    try {
      const response = await this.apiPut("/mode", { mode })
      if (response.ok) {
        this.currentMode = mode
        return true
      }
      return false
    } catch (error) {
      console.error("[Handy] Set mode error:", error)
      return false
    }
  }

  async setSpeed(speed: number): Promise<boolean> {
    const clampedSpeed = Math.max(0, Math.min(100, Math.round(speed)))
    this.lastSpeed = clampedSpeed

    try {
      // Switch to HAMP mode (0) if needed
      if (!await this.ensureMode(0)) return false

      if (clampedSpeed === 0) {
        const stopRes = await this.apiPut("/hamp/stop")
        return stopRes.ok
      }

      // Start HAMP if not running, then set velocity
      await this.apiPut("/hamp/start")
      const response = await this.apiPut("/hamp/velocity", { velocity: clampedSpeed })
      return response.ok
    } catch (error) {
      console.error("[Handy] Set speed error:", error)
      return false
    }
  }

  async stop(): Promise<boolean> {
    this.lastSpeed = 0

    try {
      if (this.currentMode === 0) {
        const response = await this.apiPut("/hamp/stop")
        return response.ok
      }
      if (this.currentMode === 1) {
        const response = await this.apiPut("/hssp/stop")
        return response.ok
      }
      // If mode is unknown, try HAMP stop (most common)
      const response = await this.apiPut("/hamp/stop")
      return response.ok
    } catch (error) {
      console.error("[Handy] Stop error:", error)
      return false
    }
  }

  async setBodyPartFocus(bodyPart: "tip" | "base" | "shaft" | "full" | null): Promise<boolean> {
    // Map body parts to slide range (min/max 0-100, where 0 = base, 100 = tip)
    let min = 0
    let max = 100

    switch (bodyPart) {
      case "tip":
        min = 70
        max = 100
        break
      case "base":
        min = 0
        max = 30
        break
      case "shaft":
        min = 20
        max = 80
        break
      case "full":
        min = 0
        max = 100
        break
      default:
        min = 0
        max = 100
        break
    }

    try {
      const response = await this.apiPut("/slide", { min, max })
      return response.ok
    } catch (error) {
      console.error("[Handy] Set slide error:", error)
      return false
    }
  }

  async executeCommand(command: DeviceCommand): Promise<boolean> {
    if (command.pause) {
      return this.stop()
    }

    // Handle body part focus via slide range
    if (command.bodyPartFocus) {
      await this.setBodyPartFocus(command.bodyPartFocus)
    } else if (command.strokeType) {
      // Map stroke types to equivalent body part focus for Handy
      const strokeToBodyPart: Record<string, "tip" | "base" | "shaft" | "full"> = {
        tip: "tip",
        base: "base",
        normal: "shaft",
        extended: "full",
        full: "full",
      }
      const mapped = strokeToBodyPart[command.strokeType]
      if (mapped) {
        await this.setBodyPartFocus(mapped)
      }
    }

    return this.setSpeed(command.speed)
  }

  async uploadFunscript(funscriptData: object): Promise<boolean> {
    try {
      // Convert funscript JSON actions to CSV format for Handy
      const funscript = funscriptData as { actions?: Array<{ at: number; pos: number }> }
      const actions = funscript.actions
      if (!actions || actions.length === 0) {
        console.error("[Handy] No actions in funscript data")
        return false
      }

      // Build CSV: each line is "timestamp,position"
      const csvLines = actions.map((a) => `${a.at},${a.pos}`)
      const csvContent = csvLines.join("\n")
      const csvBlob = new Blob([csvContent], { type: "text/csv" })

      // Upload to HandyFeeling script server
      const formData = new FormData()
      formData.append("file", csvBlob, "funscript.csv")

      const uploadResponse = await fetch(HandyService.SCRIPT_UPLOAD_URL, {
        method: "POST",
        body: formData,
      })

      if (!uploadResponse.ok) {
        console.error("[Handy] Script upload failed:", uploadResponse.status)
        return false
      }

      const uploadData = await uploadResponse.json()
      const scriptUrl = uploadData.url

      if (!scriptUrl) {
        console.error("[Handy] No URL returned from script upload")
        return false
      }

      // Switch to HSSP mode (1)
      if (!await this.ensureMode(1)) return false

      // Setup the script on the Handy
      const setupResponse = await this.apiPut("/hssp/setup", { url: scriptUrl })
      return setupResponse.ok
    } catch (error) {
      console.error("[Handy] Upload funscript error:", error)
      return false
    }
  }

  private async performTimeSync(): Promise<void> {
    const samples: number[] = []
    const numSamples = 10

    for (let i = 0; i < numSamples; i++) {
      try {
        const sendTime = Date.now()
        const response = await this.apiGet("/servertime")
        const receiveTime = Date.now()

        if (response.ok) {
          const data = await response.json()
          const serverTime = data.serverTime
          const roundTrip = receiveTime - sendTime
          const estimatedServerTime = serverTime + roundTrip / 2
          const offset = receiveTime - estimatedServerTime
          samples.push(offset)
        }
      } catch {
        // Skip failed samples
      }
    }

    if (samples.length > 0) {
      // Use median offset for stability
      samples.sort((a, b) => a - b)
      const mid = Math.floor(samples.length / 2)
      this.serverTimeOffset = samples.length % 2 === 0
        ? (samples[mid - 1] + samples[mid]) / 2
        : samples[mid]
    }
  }

  private getEstimatedServerTime(): number {
    return Date.now() - this.serverTimeOffset
  }

  async startFunscriptSync(startTimeMs: number = 0): Promise<boolean> {
    try {
      // Ensure we're in HSSP mode
      if (!await this.ensureMode(1)) return false

      // Perform time sync before playback
      await this.performTimeSync()

      const estimatedServerTime = this.getEstimatedServerTime()

      const response = await this.apiPut("/hssp/play", {
        estimatedServerTime,
        startTime: startTimeMs,
      })

      return response.ok
    } catch (error) {
      console.error("[Handy] Start funscript sync error:", error)
      return false
    }
  }

  async stopFunscriptSync(): Promise<boolean> {
    try {
      const response = await this.apiPut("/hssp/stop")
      return response.ok
    } catch (error) {
      console.error("[Handy] Stop funscript sync error:", error)
      return false
    }
  }

  // Handy has no SSE/button events. Use a heartbeat poller to detect disconnects.
  startEventStream(callbacks: DeviceEventCallback): void {
    this.callbacks = callbacks
    this.stopEventStream()

    this.heartbeatInterval = setInterval(async () => {
      const connected = await this.checkConnection()
      if (!connected) {
        console.error("[Handy] Heartbeat: device disconnected")
        this.callbacks.onConnectionLost?.()
        this.stopEventStream()
      }
    }, 10000) // Poll every 10 seconds
  }

  stopEventStream(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
    }
  }

  disconnect(): void {
    this.stopEventStream()
    this.isConnected = false
    this.connectionKey = ""
    this.currentMode = -1
    this.lastSpeed = 0
    this.serverTimeOffset = 0
  }

  getIsConnected(): boolean {
    return this.isConnected
  }

  getDeviceToken(): string {
    return this.connectionKey
  }
}

// ─── Device Proxy ──────────────────────────────────────────────────────────

class DeviceProxy implements DeviceBackend {
  private vacuglide = new VacuGlideService()
  private handy = new HandyService()
  private activeType: "autoblow" | "handy" = "autoblow"

  private get backend(): DeviceBackend {
    return this.activeType === "handy" ? this.handy : this.vacuglide
  }

  setDeviceType(type: string): void {
    if (type === "handy") {
      this.activeType = "handy"
    } else {
      this.activeType = "autoblow"
    }
  }

  initialize(token: string) { return this.backend.initialize(token) }
  checkConnection() { return this.backend.checkConnection() }
  getInfo() { return this.backend.getInfo() }
  getState() { return this.backend.getState() }
  setSpeed(speed: number) { return this.backend.setSpeed(speed) }
  stop() { return this.backend.stop() }
  setBodyPartFocus(bodyPart: "tip" | "base" | "shaft" | "full" | null) { return this.backend.setBodyPartFocus(bodyPart) }
  executeCommand(command: DeviceCommand) { return this.backend.executeCommand(command) }
  uploadFunscript(funscriptData: object) { return this.backend.uploadFunscript(funscriptData) }
  startFunscriptSync(startTimeMs?: number) { return this.backend.startFunscriptSync(startTimeMs) }
  stopFunscriptSync() { return this.backend.stopFunscriptSync() }
  startEventStream(callbacks: DeviceEventCallback) { return this.backend.startEventStream(callbacks) }
  stopEventStream() { return this.backend.stopEventStream() }
  disconnect() { return this.backend.disconnect() }
  getIsConnected() { return this.backend.getIsConnected() }
  getDeviceToken() { return this.backend.getDeviceToken() }
}

// Singleton proxy instance (replaces old VacuGlideService singleton)
export const deviceService = new DeviceProxy()

// React hook for device service
import { useState, useEffect, useCallback, useRef } from "react"

export interface UseDeviceReturn {
  isConnected: boolean
  isConnecting: boolean
  currentSpeed: number
  deviceInfo: DeviceInfo | null
  error: string | null
  connect: (token: string) => Promise<boolean>
  disconnect: () => void
  setSpeed: (speed: number) => Promise<boolean>
  stop: () => Promise<boolean>
  executeCommand: (command: DeviceCommand) => Promise<boolean>
}

export function useDevice(): UseDeviceReturn {
  const [isConnected, setIsConnected] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [currentSpeed, setCurrentSpeed] = useState(0)
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null)
  const [error, setError] = useState<string | null>(null)
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Poll device state periodically when connected
  useEffect(() => {
    if (!isConnected) {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
        pollIntervalRef.current = null
      }
      return
    }

    const pollState = async () => {
      const state = await deviceService.getState()
      if (state) {
        setCurrentSpeed(state.currentSpeed)
      }
    }

    // Poll every 2 seconds
    pollIntervalRef.current = setInterval(pollState, 2000)
    pollState() // Initial poll

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
      }
    }
  }, [isConnected])

  const connect = useCallback(async (token: string): Promise<boolean> => {
    setIsConnecting(true)
    setError(null)

    const result = await deviceService.initialize(token)

    if (result.success) {
      const info = await deviceService.getInfo()
      setDeviceInfo(info)
      setIsConnected(true)

      // Start listening to button events
      deviceService.startEventStream({
        onSpeedPlusPressed: () => {
          setCurrentSpeed((prev) => Math.min(100, prev + 10))
          deviceService.setSpeed(Math.min(100, currentSpeed + 10))
        },
        onSpeedMinusPressed: () => {
          setCurrentSpeed((prev) => Math.max(0, prev - 10))
          deviceService.setSpeed(Math.max(0, currentSpeed - 10))
        },
        onModePressed: () => {
          console.log("[Device] Mode button pressed")
        },
        onConnectionLost: () => {
          setError("Connection lost")
          setIsConnected(false)
        },
      })
    } else {
      setError(result.error || "Connection failed")
    }

    setIsConnecting(false)
    return result.success
  }, [currentSpeed])

  const disconnect = useCallback(() => {
    deviceService.disconnect()
    setIsConnected(false)
    setDeviceInfo(null)
    setCurrentSpeed(0)
    setError(null)
  }, [])

  const setSpeedHandler = useCallback(async (speed: number): Promise<boolean> => {
    const success = await deviceService.setSpeed(speed)
    if (success) {
      setCurrentSpeed(speed)
    }
    return success
  }, [])

  const stopHandler = useCallback(async (): Promise<boolean> => {
    const success = await deviceService.stop()
    if (success) {
      setCurrentSpeed(0)
    }
    return success
  }, [])

  const executeCommandHandler = useCallback(async (command: DeviceCommand): Promise<boolean> => {
    const success = await deviceService.executeCommand(command)
    if (success && !command.pause) {
      setCurrentSpeed(command.speed)
    } else if (success && command.pause) {
      setCurrentSpeed(0)
    }
    return success
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      deviceService.disconnect()
    }
  }, [])

  return {
    isConnected,
    isConnecting,
    currentSpeed,
    deviceInfo,
    error,
    connect,
    disconnect,
    setSpeed: setSpeedHandler,
    stop: stopHandler,
    executeCommand: executeCommandHandler,
  }
}
