import { useEffect, useRef, useCallback } from 'react'
import { getPendingOrders, markOrderSynced } from '../db/index.js'
import { api } from '../utils/api.js'
import { useAuthStore } from '../stores/authStore.js'
import { useSyncStore } from '../stores/syncStore.js'

const RETRY_INTERVAL = 30000
const BATCH_SIZE = 10

export const useSyncEngine = () => {
  const token = useAuthStore(s => s.token)
  const { setOnline, setSyncing, setPendingCount } = useSyncStore()
  const retryTimer = useRef(null)
  const isSyncing = useRef(false)

  const updatePendingCount = useCallback(async () => {
    const pending = await getPendingOrders()
    setPendingCount(pending.length)
  }, [setPendingCount])

  const flush = useCallback(async () => {
    if (isSyncing.current || !token) return
    const pending = await getPendingOrders()
    if (pending.length === 0) return

    isSyncing.current = true
    setSyncing(true)

    try {
      // Process in batches
      for (let i = 0; i < pending.length; i += BATCH_SIZE) {
        const batch = pending.slice(i, i + BATCH_SIZE)
        const { results } = await api.sync.flushOrders(batch, token)

        for (const result of results) {
          if (result.status === 'created' || result.status === 'duplicate') {
            await markOrderSynced(result.id)
          }
          // 'error' orders stay in queue for admin review
        }
      }
    } catch (err) {
      console.warn('Sync flush failed, will retry:', err.message)
    } finally {
      isSyncing.current = false
      setSyncing(false)
      await updatePendingCount()
    }
  }, [token, setSyncing, updatePendingCount])

  const handleOnline = useCallback(() => {
    setOnline(true)
    flush()
  }, [setOnline, flush])

  const handleOffline = useCallback(() => {
    setOnline(false)
  }, [setOnline])

  useEffect(() => {
    // Set initial online status
    setOnline(navigator.onLine)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Periodic retry
    retryTimer.current = setInterval(() => {
      if (navigator.onLine) flush()
    }, RETRY_INTERVAL)

    // Initial flush on mount
    if (navigator.onLine) flush()
    updatePendingCount()

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      clearInterval(retryTimer.current)
    }
  }, [handleOnline, handleOffline, flush, updatePendingCount])

  return { flush }
}
