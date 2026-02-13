'use client'

/**
 * Recording Session Storage
 *
 * IndexedDB storage for raw webcam recordings during Money Stroker sessions.
 * Raw recordings are intermediate data used for Greek God transformation.
 * Frontend stores these locally, extracts frames on-demand, then deletes after processing.
 */

export interface RawRecordingSession {
  sessionId: string
  userId: string
  blob: Blob
  createdAt: number
  layoutMode: string
  webcamPosition: string
  orientation: string
  source: string
  cropRegion: {
    x: number
    y: number
    width: number
    height: number
  } | null
}

const DB_NAME = 'getgooned-recordings'
const DB_VERSION = 1
const STORE_NAME = 'rawRecordings'
const MAX_AGE_MS = 24 * 60 * 60 * 1000 // 24 hours

/**
 * Initialize IndexedDB database
 */
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => {
      reject(new Error('Failed to open IndexedDB'))
    }

    request.onsuccess = () => {
      resolve(request.result)
    }

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result

      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'sessionId' })
        store.createIndex('userId', 'userId', { unique: false })
        store.createIndex('createdAt', 'createdAt', { unique: false })
      }
    }
  })
}

/**
 * Save raw recording to IndexedDB
 */
export async function saveRawRecording(
  session: RawRecordingSession
): Promise<void> {
  const db = await openDatabase()

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite')
    const store = transaction.objectStore(STORE_NAME)

    const request = store.put(session)

    request.onerror = () => {
      reject(new Error('Failed to save raw recording'))
    }

    request.onsuccess = () => {
      resolve()
    }

    transaction.onerror = () => {
      reject(new Error('Transaction failed'))
    }
  })
}

/**
 * Get raw recording by sessionId
 */
export async function getRawRecording(
  sessionId: string
): Promise<RawRecordingSession | undefined> {
  const db = await openDatabase()

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly')
    const store = transaction.objectStore(STORE_NAME)

    const request = store.get(sessionId)

    request.onerror = () => {
      reject(new Error('Failed to retrieve recording'))
    }

    request.onsuccess = () => {
      resolve(request.result)
    }
  })
}

/**
 * Delete raw recording by sessionId
 */
export async function deleteRawRecording(sessionId: string): Promise<void> {
  const db = await openDatabase()

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite')
    const store = transaction.objectStore(STORE_NAME)

    const request = store.delete(sessionId)

    request.onerror = () => {
      reject(new Error('Failed to delete recording'))
    }

    request.onsuccess = () => {
      resolve()
    }
  })
}

/**
 * Auto-cleanup: Delete recordings older than 24 hours
 */
export async function cleanupOldRecordings(): Promise<number> {
  const db = await openDatabase()
  const cutoffTime = Date.now() - MAX_AGE_MS

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite')
    const store = transaction.objectStore(STORE_NAME)
    const index = store.index('createdAt')

    const range = IDBKeyRange.upperBound(cutoffTime)
    const request = index.openCursor(range)

    let deletedCount = 0

    request.onerror = () => {
      reject(new Error('Failed to cleanup recordings'))
    }

    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest).result

      if (cursor) {
        cursor.delete()
        deletedCount++
        cursor.continue()
      } else {
        resolve(deletedCount)
      }
    }

    transaction.onerror = () => {
      reject(new Error('Cleanup transaction failed'))
    }
  })
}

/**
 * Check available storage quota
 */
export async function checkStorageQuota(): Promise<{
  available: number
  total: number
  percentageUsed: number
}> {
  if (!navigator.storage?.estimate) {
    return { available: 0, total: 0, percentageUsed: 0 }
  }

  try {
    const estimate = await navigator.storage.estimate()
    const usage = estimate.usage || 0
    const quota = estimate.quota || 0

    return {
      available: Math.max(0, quota - usage),
      total: quota,
      percentageUsed: quota > 0 ? (usage / quota) * 100 : 0,
    }
  } catch (err) {
    console.warn('Could not check storage quota:', err)
    return { available: 0, total: 0, percentageUsed: 0 }
  }
}

/**
 * Get all sessions for a user (for debugging)
 */
export async function getUserRecordings(userId: string): Promise<RawRecordingSession[]> {
  const db = await openDatabase()

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly')
    const store = transaction.objectStore(STORE_NAME)
    const index = store.index('userId')

    const request = index.getAll(userId)

    request.onerror = () => {
      reject(new Error('Failed to retrieve user recordings'))
    }

    request.onsuccess = () => {
      resolve(request.result)
    }
  })
}
