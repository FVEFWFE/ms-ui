"use client"

import type React from "react"
import { createContext, useContext, useState, useCallback, useEffect, useRef } from "react"
import { deviceService, type DeviceCommand, type DeviceEventCallback } from "./device-service"
import { loadSavedTokens, getLastDeviceId, saveToyToken, getToyNameFromId, getDeviceTypeFromToyId, getToyIdFromName } from "@/components/device-dropdown"
import { createBrowserSupabaseClient } from "./supabase-browser"
import type { User as SupabaseUser } from "@supabase/supabase-js"
import {
  type CruiseControlConfig,
  type CruiseState,
  DEFAULT_CRUISE_CONFIG,
  createCruiseState,
} from "./cruise-control"
import type { NaturalLanguageCommand, EdgingMode } from "./natural-language-parser"

// Helper to generate random code
function generateReferralCode(): string {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
  let code = ""
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

function generateBetaKey(): string {
  const segment = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
    let s = ""
    for (let i = 0; i < 4; i++) {
      s += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return s
  }
  return `BETA-${segment()}-${segment()}-${segment()}`
}

// Helper to compute if user has an active paid subscription
function computeHasPaid(tier: string | null | undefined, expiresAt: Date | string | null | undefined): boolean {
  if (!tier || tier === "free") return false
  if (!expiresAt) return false
  const expiry = typeof expiresAt === "string" ? new Date(expiresAt) : expiresAt
  return expiry > new Date()
}

// Types
interface DeviceConnection {
  connected: boolean
  deviceType: string
  deviceName: string
  token: string
  status: "active" | "paused" | "idle"
  currentSpeed: number
  reconnectCountdown: number | null // seconds until next reconnect attempt, null if not reconnecting
}

interface User {
  loggedIn: boolean
  id: string | null
  email: string
  displayName: string | null
  tier: "free" | "standard" | "premium"
  expiresAt: Date | null
  hasPaid: boolean // Computed: tier != free and not expired
}

interface Session {
  active: boolean
  characterId: string
  characterName: string
  startTime: Date | null
  paused: boolean
}

interface Settings {
  maxIntensity: number
  minIntensity: number
  soundEffectsEnabled: boolean
}

interface Toast {
  id: string
  type: "success" | "error" | "info" | "warning"
  message: string
  action?: {
    label: string
    href: string
    newTab?: boolean
  }
}

// Beta access state
interface BetaAccess {
  hasBetaAccess: boolean
  betaKey: string | null
  referralCode: string
  referralCount: number
  pendingMessage: string | null
  userEmail: string | null
  hasCompletedEmailCapture: boolean
  hasCompletedDeviceConnection: boolean
  showBetaModal: boolean
  noDeviceMode: boolean  // User explicitly chose to continue without device
}

// Edge state for edging sessions
interface EdgeState {
  isEdging: boolean
  duration: number // seconds per tap (default 5)
  remainingTime: number // seconds left in current edge
  edgeCount: number // total edges this session
  previousSpeed: number // speed to resume after edge
}

// Cruise control state for context
interface CruiseControlState {
  config: CruiseControlConfig
  state: CruiseState
  lastNaturalLanguageCommand: NaturalLanguageCommand | null
}

// Money Mode state for affiliate features
interface MoneyModeState {
  isMoneyMode: boolean
  affiliateCode: string | null
}

interface AppContextType {
  // Device
  device: DeviceConnection
  connectDevice: (deviceType: string, deviceName: string, token: string) => void
  disconnectDevice: () => void
  setDeviceStatus: (status: "active" | "paused" | "idle") => void
  setDeviceSpeed: (speed: number) => Promise<boolean>
  stopDevice: () => Promise<boolean>
  executeDeviceCommand: (command: DeviceCommand) => Promise<boolean>

  // User
  user: User
  isLoading: boolean
  loginWithPassword: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
  signUp: (email: string, password: string, displayName?: string) => Promise<{ success: boolean; error?: string }>
  logout: () => Promise<void>
  upgradeToPremium: (expiresAt: Date) => void

  // Session
  session: Session
  startSession: (characterId: string, characterName: string) => void
  endSession: () => void
  pauseSession: () => void
  resumeSession: () => void

  // Settings
  settings: Settings
  updateSettings: (settings: Partial<Settings>) => void

  // Toasts
  toasts: Toast[]
  showToast: (type: Toast["type"], message: string, action?: Toast["action"]) => void
  dismissToast: (id: string) => void

  // Beta Access
  beta: BetaAccess
  setUserEmail: (email: string) => void
  setPendingMessage: (message: string | null) => void
  completeEmailCapture: () => void
  completeDeviceConnection: () => void
  skipDeviceConnection: () => void
  grantBetaAccess: () => string
  redeemBetaKey: (key: string) => Promise<boolean>
  openBetaModal: () => void
  closeBetaModal: () => void
  incrementReferralCount: () => void

  // Edge (edging sessions)
  edge: EdgeState
  triggerEdge: (seconds?: number) => void
  cancelEdge: () => void
  resetEdgeCount: () => void

  // Cruise Control
  cruise: CruiseControlState
  updateCruiseConfig: (config: Partial<CruiseControlConfig>) => void
  setCruiseEnabled: (enabled: boolean) => void
  setEdgingMode: (mode: EdgingMode) => void
  setLastNaturalLanguageCommand: (command: NaturalLanguageCommand | null) => void

  // Money Mode
  moneyMode: MoneyModeState
  setMoneyMode: (enabled: boolean) => void
}

const AppContext = createContext<AppContextType | null>(null)

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [device, setDevice] = useState<DeviceConnection>({
    connected: false,
    deviceType: "",
    deviceName: "",
    token: "",
    status: "idle",
    currentSpeed: 0,
    reconnectCountdown: null,
  })
  const speedPollRef = useRef<NodeJS.Timeout | null>(null)
  const supabaseRef = useRef(createBrowserSupabaseClient())
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const reconnectCountdownRef = useRef<NodeJS.Timeout | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const [user, setUser] = useState<User>({
    loggedIn: false,
    id: null,
    email: "",
    displayName: null,
    tier: "free",
    expiresAt: null,
    hasPaid: false,
  })

  const [session, setSession] = useState<Session>({
    active: false,
    characterId: "",
    characterName: "",
    startTime: null,
    paused: false,
  })

  const [settings, setSettings] = useState<Settings>({
    maxIntensity: 100,
    minIntensity: 0,
    soundEffectsEnabled: true,
  })

  const [toasts, setToasts] = useState<Toast[]>([])

  const [beta, setBeta] = useState<BetaAccess>({
    hasBetaAccess: true, // Beta gate removed - launch without invite system
    betaKey: null,
    referralCode: generateReferralCode(),
    referralCount: 0,
    pendingMessage: null,
    userEmail: null,
    hasCompletedEmailCapture: true, // Skip email capture during testing
    hasCompletedDeviceConnection: false,
    showBetaModal: false,
    noDeviceMode: false,
  })

  const [edge, setEdge] = useState<EdgeState>({
    isEdging: false,
    duration: 5, // 5 seconds per tap
    remainingTime: 0,
    edgeCount: 0,
    previousSpeed: 0,
  })
  const edgeTimerRef = useRef<NodeJS.Timeout | null>(null)

  const [cruise, setCruise] = useState<CruiseControlState>({
    config: DEFAULT_CRUISE_CONFIG,
    state: createCruiseState(),
    lastNaturalLanguageCommand: null,
  })

  const [moneyMode, setMoneyModeState] = useState<MoneyModeState>({
    isMoneyMode: false,
    affiliateCode: null,
  })

  // Poll device state when connected
  useEffect(() => {
    if (!device.connected || !device.token) {
      if (speedPollRef.current) {
        clearInterval(speedPollRef.current)
        speedPollRef.current = null
      }
      return
    }

    const pollState = async () => {
      const state = await deviceService.getState()
      if (state) {
        setDevice((prev) => ({ ...prev, currentSpeed: state.currentSpeed }))
      }
    }

    // Poll every 2 seconds
    speedPollRef.current = setInterval(pollState, 2000)
    pollState() // Initial poll

    return () => {
      if (speedPollRef.current) {
        clearInterval(speedPollRef.current)
      }
    }
  }, [device.connected, device.token])

  // Create event stream callbacks with auto-reconnect retry
  const createEventStreamCallbacks = (token: string, deviceType: string, deviceName: string): DeviceEventCallback => ({
    onSpeedPlusPressed: () => {
      setDevice((prev) => {
        const newSpeed = Math.min(100, prev.currentSpeed + 10)
        deviceService.setSpeed(newSpeed)
        return { ...prev, currentSpeed: newSpeed }
      })
    },
    onSpeedMinusPressed: () => {
      setDevice((prev) => {
        const newSpeed = Math.max(0, prev.currentSpeed - 10)
        deviceService.setSpeed(newSpeed)
        return { ...prev, currentSpeed: newSpeed }
      })
    },
    onModePressed: () => {
      console.log("[AppContext] Device mode button pressed")
    },
    onConnectionLost: () => {
      console.log("[AppContext] Device connection lost, starting auto-reconnect every 10s...")
      setDevice((prev) => ({ ...prev, connected: false, status: "idle", reconnectCountdown: 10 }))

      const RECONNECT_INTERVAL = 10 // seconds

      // Start countdown ticker
      if (reconnectCountdownRef.current) clearInterval(reconnectCountdownRef.current)
      let countdown = RECONNECT_INTERVAL

      reconnectCountdownRef.current = setInterval(() => {
        countdown--
        if (countdown > 0) {
          setDevice((prev) => prev.connected ? prev : { ...prev, reconnectCountdown: countdown })
        }
      }, 1000)

      const tryReconnect = async () => {
        console.log("[AppContext] Attempting reconnect...")
        deviceService.setDeviceType(deviceType)
        const result = await deviceService.initialize(token)
        if (result.success) {
          const isOnline = await deviceService.checkConnection()
          if (isOnline) {
            console.log("[AppContext] Auto-reconnected successfully")
            // Clear timers
            if (reconnectCountdownRef.current) { clearInterval(reconnectCountdownRef.current); reconnectCountdownRef.current = null }
            if (reconnectTimeoutRef.current) { clearTimeout(reconnectTimeoutRef.current); reconnectTimeoutRef.current = null }
            deviceService.startEventStream(createEventStreamCallbacks(token, deviceType, deviceName))
            setDevice({ connected: true, deviceType, deviceName, token, status: "idle", currentSpeed: 0, reconnectCountdown: null })
            const toastId = Math.random().toString(36).substring(7)
            setToasts((prev) => [...prev, { id: toastId, type: "success", message: `Reconnected to ${deviceName}` }])
            setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== toastId)), 3000)
            return
          }
        }
        // Failed — schedule next attempt
        console.log(`[AppContext] Reconnect failed, retrying in ${RECONNECT_INTERVAL}s...`)
        countdown = RECONNECT_INTERVAL
        setDevice((prev) => prev.connected ? prev : { ...prev, reconnectCountdown: RECONNECT_INTERVAL })
        reconnectTimeoutRef.current = setTimeout(tryReconnect, RECONNECT_INTERVAL * 1000)
      }

      // First attempt after countdown
      reconnectTimeoutRef.current = setTimeout(tryReconnect, RECONNECT_INTERVAL * 1000)
    },
  })

  // Auto-reconnect device from localStorage on mount
  useEffect(() => {
    if (typeof window === 'undefined') return

    const tokens = loadSavedTokens()
    const lastDeviceId = getLastDeviceId()
    if (!lastDeviceId) return

    const saved = tokens[lastDeviceId]
    if (!saved?.token) return

    const deviceName = getToyNameFromId(lastDeviceId)
    const deviceType = getDeviceTypeFromToyId(lastDeviceId)
    const token = saved.token

    deviceService.setDeviceType(deviceType)
    deviceService.initialize(token).then(() => {
      deviceService.checkConnection().then((connected) => {
        if (connected) {
          console.log('[AppContext] Auto-reconnecting to saved device:', deviceName)
          deviceService.startEventStream(createEventStreamCallbacks(token, deviceType, deviceName))
          setDevice({
            connected: true,
            deviceType,
            deviceName,
            token,
            status: "idle",
            currentSpeed: 0,
            reconnectCountdown: null,
          })
        } else {
          console.log('[AppContext] Saved device is offline, keeping token for manual reconnect')
        }
      })
    })
  }, [])

  // Check auth state on mount
  useEffect(() => {
    const supabase = supabaseRef.current

    const checkUser = async () => {
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser()

        if (authUser) {
          // Fetch user profile
          const { data: profile } = await supabase
            .from('users_extended')
            .select('*')
            .eq('id', authUser.id)
            .single()

          setUser({
            loggedIn: true,
            id: authUser.id,
            email: authUser.email || '',
            displayName: profile?.display_name || null,
            tier: profile?.tier || 'free',
            expiresAt: profile?.tier_expires_at ? new Date(profile.tier_expires_at) : null,
            hasPaid: computeHasPaid(profile?.tier, profile?.tier_expires_at),
          })

          if (profile?.beta_access) {
            setBeta((prev) => ({
              ...prev,
              hasBetaAccess: true,
              betaKey: profile.beta_key,
              referralCode: profile.referral_code || prev.referralCode,
            }))
          }
        }
      } catch (error) {
        console.error('[Auth] Error checking user:', error)
      } finally {
        setIsLoading(false)
      }
    }

    checkUser()

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        let { data: profile } = await supabase
          .from('users_extended')
          .select('*')
          .eq('id', session.user.id)
          .single()

        // If no profile exists (new OAuth user), create one via API
        if (!profile) {
          try {
            await fetch('/api/auth/ensure-profile', { method: 'POST' })
            // Re-fetch the profile after creation
            const { data: newProfile } = await supabase
              .from('users_extended')
              .select('*')
              .eq('id', session.user.id)
              .single()
            profile = newProfile
          } catch (e) {
            console.error('[Auth] Failed to create profile:', e)
          }
        }

        setUser({
          loggedIn: true,
          id: session.user.id,
          email: session.user.email || '',
          displayName: profile?.display_name || null,
          tier: profile?.tier || 'free',
          expiresAt: profile?.tier_expires_at ? new Date(profile.tier_expires_at) : null,
          hasPaid: computeHasPaid(profile?.tier, profile?.tier_expires_at),
        })

        if (profile?.beta_access) {
          setBeta((prev) => ({
            ...prev,
            hasBetaAccess: true,
            betaKey: profile.beta_key,
            referralCode: profile.referral_code || prev.referralCode,
          }))
        }

        // Clean up OAuth code from URL if present
        if (typeof window !== 'undefined' && window.location.search.includes('code=')) {
          window.history.replaceState({}, '', window.location.pathname)
        }
      } else if (event === 'SIGNED_OUT') {
        setUser({
          loggedIn: false,
          id: null,
          email: '',
          displayName: null,
          tier: 'free',
          expiresAt: null,
          hasPaid: false,
        })
        setBeta((prev) => ({
          ...prev,
          hasBetaAccess: false,
          betaKey: null,
        }))
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  // Device methods
  const connectDevice = useCallback((deviceType: string, deviceName: string, token: string) => {
    // Cancel any pending auto-reconnect
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }
    if (reconnectCountdownRef.current) {
      clearInterval(reconnectCountdownRef.current)
      reconnectCountdownRef.current = null
    }

    // Set the correct backend before any API calls
    deviceService.setDeviceType(deviceType)

    // Start listening to device button events with auto-reconnect
    deviceService.startEventStream(createEventStreamCallbacks(token, deviceType, deviceName))

    // Save to new localStorage format
    if (typeof window !== 'undefined') {
      const toyId = getToyIdFromName(deviceName)
      saveToyToken(toyId, token)
    }

    setDevice({
      connected: true,
      deviceType,
      deviceName,
      token,
      status: "idle",
      currentSpeed: 0,
      reconnectCountdown: null,
    })
  }, [])

  const disconnectDevice = useCallback(() => {
    // Cancel any pending auto-reconnect
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }
    if (reconnectCountdownRef.current) {
      clearInterval(reconnectCountdownRef.current)
      reconnectCountdownRef.current = null
    }

    deviceService.disconnect()
    setDevice({
      connected: false,
      deviceType: "",
      deviceName: "",
      token: "",
      status: "idle",
      currentSpeed: 0,
      reconnectCountdown: null,
    })
  }, [])

  const setDeviceStatus = useCallback((status: "active" | "paused" | "idle") => {
    setDevice((prev) => ({ ...prev, status }))
    // Stop device when paused
    if (status === "paused" || status === "idle") {
      deviceService.stop()
    }
  }, [])

  const setDeviceSpeed = useCallback(async (speed: number): Promise<boolean> => {
    const success = await deviceService.setSpeed(speed)
    if (success) {
      setDevice((prev) => ({ ...prev, currentSpeed: speed }))
    }
    return success
  }, [])

  const stopDevice = useCallback(async (): Promise<boolean> => {
    const success = await deviceService.stop()
    if (success) {
      setDevice((prev) => ({ ...prev, currentSpeed: 0 }))
    }
    return success
  }, [])

  const executeDeviceCommand = useCallback(async (command: DeviceCommand): Promise<boolean> => {
    const success = await deviceService.executeCommand(command)
    if (success) {
      if (command.pause) {
        setDevice((prev) => ({ ...prev, currentSpeed: 0 }))
      } else {
        setDevice((prev) => ({ ...prev, currentSpeed: command.speed }))
      }
    }
    return success
  }, [])

  // User methods
  const loginWithPassword = useCallback(async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    const supabase = supabaseRef.current

    // Create a promise that resolves when auth state changes to SIGNED_IN
    // This catches cases where signInWithPassword() hangs but auth succeeds
    let authStateCleanup: (() => void) | null = null
    const authStatePromise = new Promise<{ success: boolean; error?: string }>((resolve) => {
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
        if (event === 'SIGNED_IN') {
          console.log('[Auth] Detected SIGNED_IN via auth state change')
          resolve({ success: true })
        }
      })
      authStateCleanup = () => subscription.unsubscribe()
    })

    // Wrap signInWithPassword with a timeout to prevent hanging
    const signInPromise = (async () => {
      try {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) {
          return { success: false, error: error.message }
        }
        return { success: true }
      } catch (e) {
        console.error('[Auth] signInWithPassword error:', e)
        return { success: false, error: 'Authentication failed' }
      }
    })()

    const timeoutPromise = new Promise<{ success: boolean; error?: string }>((resolve) =>
      setTimeout(() => {
        console.warn('[Auth] Login timeout - checking if auth succeeded anyway')
        resolve({ success: false, error: 'timeout' })
      }, 8000)
    )

    try {
      // Race between: direct sign-in result, auth state change, or timeout
      const result = await Promise.race([signInPromise, authStatePromise, timeoutPromise])

      // If timeout occurred, check one more time if user is actually logged in
      if (result.error === 'timeout') {
        const { data: { user: currentUser } } = await supabase.auth.getUser()
        if (currentUser && currentUser.email === email) {
          console.log('[Auth] User is logged in despite timeout')
          return { success: true }
        }
        return { success: false, error: 'Login timed out. Please try again.' }
      }

      return result
    } finally {
      // Cleanup the auth state listener
      if (authStateCleanup) {
        authStateCleanup()
      }
    }
  }, [])

  const signUp = useCallback(async (email: string, password: string, displayName?: string): Promise<{ success: boolean; error?: string; requiresLogin?: boolean }> => {
    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          displayName: displayName || email.split('@')[0],
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        return { success: false, error: data.error || 'Failed to create account' }
      }

      // Account created - now sign in to establish client session
      const supabase = supabaseRef.current

      // Create a promise that resolves when auth state changes to SIGNED_IN
      let authStateCleanup: (() => void) | null = null
      const authStatePromise = new Promise<boolean>((resolve) => {
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
          if (event === 'SIGNED_IN') {
            console.log('[Auth] Detected SIGNED_IN via auth state change after signup')
            resolve(true)
          }
        })
        authStateCleanup = () => subscription.unsubscribe()
      })

      const signInPromise = (async () => {
        try {
          const { error } = await supabase.auth.signInWithPassword({ email, password })
          return !error
        } catch {
          return false
        }
      })()

      const timeoutPromise = new Promise<boolean>((resolve) =>
        setTimeout(() => resolve(false), 8000)
      )

      try {
        // Race between: direct sign-in, auth state change, or timeout
        const signedIn = await Promise.race([signInPromise, authStatePromise, timeoutPromise])

        if (!signedIn) {
          // Timeout - check one more time if user is actually logged in
          const { data: { user: currentUser } } = await supabase.auth.getUser()
          if (currentUser && currentUser.email === email) {
            console.log('[Auth] User is logged in after signup despite timeout')
            return { success: true }
          } else {
            console.warn('[Auth] Auto sign-in after signup timed out, user needs to log in manually')
            // Account created but not logged in
            return { success: true, requiresLogin: true }
          }
        }
        return { success: true }
      } finally {
        if (authStateCleanup) {
          authStateCleanup()
        }
      }
    } catch (error) {
      console.error('[Auth] Signup error:', error)
      return { success: false, error: 'Network error. Please try again.' }
    }
  }, [])

  const logout = useCallback(async () => {
    const supabase = supabaseRef.current
    await supabase.auth.signOut()

    setUser({
      loggedIn: false,
      id: null,
      email: "",
      displayName: null,
      tier: "free",
      expiresAt: null,
      hasPaid: false,
    })
    setSession({
      active: false,
      characterId: "",
      characterName: "",
      startTime: null,
      paused: false,
    })
  }, [])

  const upgradeToPremium = useCallback((expiresAt: Date) => {
    setUser((prev) => ({ ...prev, tier: "premium", expiresAt, hasPaid: true }))
  }, [])

  // Session methods
  const startSession = useCallback((characterId: string, characterName: string) => {
    setSession({
      active: true,
      characterId,
      characterName,
      startTime: new Date(),
      paused: false,
    })
    setDevice((prev) => ({ ...prev, status: "active" }))
  }, [])

  const endSession = useCallback(() => {
    setSession({
      active: false,
      characterId: "",
      characterName: "",
      startTime: null,
      paused: false,
    })
    setDevice((prev) => ({ ...prev, status: "idle" }))
  }, [])

  const pauseSession = useCallback(() => {
    setSession((prev) => ({ ...prev, paused: true }))
    setDevice((prev) => ({ ...prev, status: "paused" }))
  }, [])

  const resumeSession = useCallback(() => {
    setSession((prev) => ({ ...prev, paused: false }))
    setDevice((prev) => ({ ...prev, status: "active" }))
  }, [])

  // Settings methods
  const updateSettings = useCallback((newSettings: Partial<Settings>) => {
    setSettings((prev) => ({ ...prev, ...newSettings }))
  }, [])

  // Toast methods
  const showToast = useCallback((type: Toast["type"], message: string, action?: Toast["action"]) => {
    const id = Math.random().toString(36).substring(7)
    setToasts((prev) => [...prev, { id, type, message, action }])

    // Auto-dismiss after 4 seconds (longer if has action link)
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, action ? 5000 : 3000)
  }, [])

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  // Beta access methods
  const setUserEmail = useCallback((email: string) => {
    setBeta((prev) => ({ ...prev, userEmail: email }))
  }, [])

  const setPendingMessage = useCallback((message: string | null) => {
    setBeta((prev) => ({ ...prev, pendingMessage: message }))
  }, [])

  const completeEmailCapture = useCallback(() => {
    setBeta((prev) => ({ ...prev, hasCompletedEmailCapture: true }))
  }, [])

  const completeDeviceConnection = useCallback(() => {
    setBeta((prev) => ({ ...prev, hasCompletedDeviceConnection: true, noDeviceMode: false }))
  }, [])

  const skipDeviceConnection = useCallback(() => {
    setBeta((prev) => ({
      ...prev,
      hasCompletedDeviceConnection: true,
      noDeviceMode: true
    }))
  }, [])

  const grantBetaAccess = useCallback(() => {
    const newBetaKey = generateBetaKey()
    setBeta((prev) => ({
      ...prev,
      hasBetaAccess: true,
      betaKey: newBetaKey,
      showBetaModal: false,
    }))
    return newBetaKey
  }, [])

  const redeemBetaKey = useCallback(async (key: string): Promise<boolean> => {
    // First validate the key format
    if (!key.startsWith("BETA-") || key.length < 14) {
      return false
    }

    // If user is logged in, try to redeem via API
    if (user.loggedIn) {
      try {
        const response = await fetch('/api/beta/redeem', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key }),
        })
        const data = await response.json()

        if (data.success) {
          setBeta((prev) => ({
            ...prev,
            hasBetaAccess: true,
            betaKey: key,
            showBetaModal: false,
          }))
          return true
        }
        return false
      } catch (error) {
        console.error('[Beta] Redeem error:', error)
        return false
      }
    }

    // For non-logged in users, just validate the key
    try {
      const response = await fetch('/api/beta/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key }),
      })
      const data = await response.json()

      if (data.valid) {
        setBeta((prev) => ({
          ...prev,
          hasBetaAccess: true,
          betaKey: key,
          showBetaModal: false,
        }))
        return true
      }
      return false
    } catch (error) {
      console.error('[Beta] Validate error:', error)
      // Fallback to local validation
      setBeta((prev) => ({
        ...prev,
        hasBetaAccess: true,
        betaKey: key,
        showBetaModal: false,
      }))
      return true
    }
  }, [user.loggedIn])

  const openBetaModal = useCallback(() => {
    setBeta((prev) => ({ ...prev, showBetaModal: true }))
  }, [])

  const closeBetaModal = useCallback(() => {
    setBeta((prev) => ({ ...prev, showBetaModal: false }))
  }, [])

  const incrementReferralCount = useCallback(() => {
    setBeta((prev) => {
      const newCount = prev.referralCount + 1
      // Auto-grant beta access when 1 friend joins
      if (newCount >= 1 && !prev.hasBetaAccess) {
        const newBetaKey = generateBetaKey()
        return {
          ...prev,
          referralCount: newCount,
          hasBetaAccess: true,
          betaKey: newBetaKey,
        }
      }
      return { ...prev, referralCount: newCount }
    })
  }, [])

  // Edge methods - for edging sessions
  const triggerEdge = useCallback((seconds: number = 5) => {
    // If already edging, extend the timer by adding more seconds
    if (edge.isEdging) {
      setEdge((prev) => ({
        ...prev,
        remainingTime: prev.remainingTime + seconds,
      }))
      return
    }

    // Save current speed and stop device
    const savedSpeed = device.currentSpeed
    deviceService.stop()
    setDevice((prev) => ({ ...prev, currentSpeed: 0 }))

    // Start edge state
    setEdge((prev) => ({
      ...prev,
      isEdging: true,
      remainingTime: seconds,
      previousSpeed: savedSpeed,
      edgeCount: prev.edgeCount + 1,
    }))

    // Clear any existing timer
    if (edgeTimerRef.current) {
      clearInterval(edgeTimerRef.current)
    }

    // Start countdown timer
    edgeTimerRef.current = setInterval(() => {
      setEdge((prev) => {
        if (prev.remainingTime <= 1) {
          // Timer complete - resume previous speed
          if (edgeTimerRef.current) {
            clearInterval(edgeTimerRef.current)
            edgeTimerRef.current = null
          }
          // Resume device at previous speed
          deviceService.setSpeed(prev.previousSpeed)
          setDevice((d) => ({ ...d, currentSpeed: prev.previousSpeed }))
          return {
            ...prev,
            isEdging: false,
            remainingTime: 0,
          }
        }
        return {
          ...prev,
          remainingTime: prev.remainingTime - 1,
        }
      })
    }, 1000)
  }, [edge.isEdging, device.currentSpeed])

  const cancelEdge = useCallback(() => {
    // Clear timer
    if (edgeTimerRef.current) {
      clearInterval(edgeTimerRef.current)
      edgeTimerRef.current = null
    }

    // Resume previous speed
    const previousSpeed = edge.previousSpeed
    deviceService.setSpeed(previousSpeed)
    setDevice((prev) => ({ ...prev, currentSpeed: previousSpeed }))

    // Reset edge state
    setEdge((prev) => ({
      ...prev,
      isEdging: false,
      remainingTime: 0,
    }))
  }, [edge.previousSpeed])

  const resetEdgeCount = useCallback(() => {
    setEdge((prev) => ({ ...prev, edgeCount: 0 }))
  }, [])

  // Cruise control methods
  const updateCruiseConfig = useCallback((updates: Partial<CruiseControlConfig>) => {
    setCruise((prev) => ({
      ...prev,
      config: { ...prev.config, ...updates },
    }))
  }, [])

  const setCruiseEnabled = useCallback((enabled: boolean) => {
    setCruise((prev) => ({
      ...prev,
      config: { ...prev.config, enabled },
    }))
  }, [])

  const setEdgingModeHandler = useCallback((mode: EdgingMode) => {
    setCruise((prev) => ({
      ...prev,
      state: {
        ...prev.state,
        edgingMode: mode,
        // If permission granted, clear suppression
        ...(mode === 'permission' ? { suppressedUntil: null } : {}),
      },
    }))
  }, [])

  const setLastNaturalLanguageCommand = useCallback((command: NaturalLanguageCommand | null) => {
    setCruise((prev) => ({
      ...prev,
      lastNaturalLanguageCommand: command,
    }))
  }, [])

  // Money Mode methods
  const setMoneyMode = useCallback((enabled: boolean) => {
    setMoneyModeState((prev) => {
      const newState = { ...prev, isMoneyMode: enabled }
      // Persist to localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem('getgooned_money_mode', enabled ? 'true' : 'false')
      }
      return newState
    })
  }, [])

  // Load Money Mode from localStorage on mount
  useEffect(() => {
    if (typeof window === 'undefined') return
    const stored = localStorage.getItem('getgooned_money_mode')
    if (stored === 'true') {
      setMoneyModeState((prev) => ({ ...prev, isMoneyMode: true }))
    }
  }, [])

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (edgeTimerRef.current) {
        clearInterval(edgeTimerRef.current)
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
    }
  }, [])

  return (
    <AppContext.Provider
      value={{
        device,
        connectDevice,
        disconnectDevice,
        setDeviceStatus,
        setDeviceSpeed,
        stopDevice,
        executeDeviceCommand,
        user,
        isLoading,
        loginWithPassword,
        signUp,
        logout,
        upgradeToPremium,
        session,
        startSession,
        endSession,
        pauseSession,
        resumeSession,
        settings,
        updateSettings,
        toasts,
        showToast,
        dismissToast,
        beta,
        setUserEmail,
        setPendingMessage,
        completeEmailCapture,
        completeDeviceConnection,
        skipDeviceConnection,
        grantBetaAccess,
        redeemBetaKey,
        openBetaModal,
        closeBetaModal,
        incrementReferralCount,
        edge,
        triggerEdge,
        cancelEdge,
        resetEdgeCount,
        cruise,
        updateCruiseConfig,
        setCruiseEnabled,
        setEdgingMode: setEdgingModeHandler,
        setLastNaturalLanguageCommand,
        moneyMode,
        setMoneyMode,
      }}
    >
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const context = useContext(AppContext)
  if (!context) {
    throw new Error("useApp must be used within an AppProvider")
  }
  return context
}
