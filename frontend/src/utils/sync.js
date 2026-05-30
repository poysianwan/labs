import { getPendingOrders, markOrderSynced, cacheProducts, cacheCategories, cacheIngredients, cacheDailyInventory, cleanupDailyCache } from '../db/index.js'
import { api } from '../utils/api.js'

let syncInProgress = false
let retryCount = 0
const MAX_RETRIES = 5
const RETRY_DELAY = 30000

// Connectivity check via actual fetch (more reliable than navigator.onLine)
export const checkOnline = async () => {
  try {
    await fetch('/api/health', { method: 'GET', cache: 'no-store' })
    return true
  } catch {
    return false
  }
}

// Flush pending offline orders to backend
export const syncPendingOrders = async (onProgress) => {
  if (syncInProgress) return
  syncInProgress = true

  try {
    const pending = await getPendingOrders()
    if (pending.length === 0) { syncInProgress = false; return }

    onProgress?.({ type: 'SYNCING', count: pending.length })

    const results = await api.sync.flushOrders(pending)

    let synced = 0, errors = 0
    for (const result of results.results) {
      if (result.status === 'created' || result.status === 'duplicate') {
        await markOrderSynced(result.id)
        synced++
      } else {
        errors++
        console.warn('Sync error for order', result.id, result.reason)
      }
    }

    retryCount = 0
    onProgress?.({ type: 'SYNC_COMPLETE', synced, errors })
  } catch (err) {
    retryCount++
    console.error(`Sync failed (attempt ${retryCount}):`, err)
    onProgress?.({ type: 'SYNC_ERROR', retryCount })

    if (retryCount < MAX_RETRIES) {
      setTimeout(() => { syncInProgress = false; syncPendingOrders(onProgress) }, RETRY_DELAY)
      return
    }
  }

  syncInProgress = false
}

// Refresh full product/stock cache from server
export const refreshSnapshot = async () => {
  try {
    const snapshot = await api.sync.snapshot()
    await Promise.all([
      cacheProducts(snapshot.products),
      cacheCategories(snapshot.categories),
      cacheIngredients(snapshot.ingredients),
      cacheDailyInventory({
        products: snapshot.products,
        categories: snapshot.categories,
        ingredients: snapshot.ingredients
      }),
    ])
    return snapshot
  } catch (err) {
    console.warn('Snapshot refresh failed (offline?):', err)
    return null
  }
}

// Initialize sync engine — sets up online/offline listeners
export const initSyncEngine = (onStatusChange) => {
  let isOnline = navigator.onLine
  onStatusChange?.(isOnline)

  const handleOnline = async () => {
    const actuallyOnline = await checkOnline()
    if (actuallyOnline && !isOnline) {
      isOnline = true
      onStatusChange?.(true)
      await syncPendingOrders(onStatusChange)
      await refreshSnapshot()
    }
  }

  const handleOffline = () => {
    isOnline = false
    onStatusChange?.(false)
  }

  window.addEventListener('online', handleOnline)
  window.addEventListener('offline', handleOffline)

  // Periodic sync check every 30s
  const interval = setInterval(async () => {
    await cleanupDailyCache()
    const online = await checkOnline()
    if (online && !isOnline) { isOnline = true; onStatusChange?.(true) }
    if (!online && isOnline) { isOnline = false; onStatusChange?.(false) }
    if (online) syncPendingOrders(onStatusChange)
  }, 30000)

  return () => {
    window.removeEventListener('online', handleOnline)
    window.removeEventListener('offline', handleOffline)
    clearInterval(interval)
  }
}
