import { getPendingCashEvents, getPendingOrders, getPendingSyncCount, markCashEventSynced, markOrderSynced, setAppState } from '../db/index.js'
import { api } from './apiClient.js'
import { useSyncStore } from '../stores/syncStore.js'

let syncTimer = null
let isSyncing = false
let onlineListeners = []

export const addOnlineListener = (fn) => {
  onlineListeners.push(fn)
  return () => { onlineListeners = onlineListeners.filter(f => f !== fn) }
}
const notifyOnline = (v) => onlineListeners.forEach(fn => fn(v))
const setSyncState = (patch) => useSyncStore.setState(patch)
const refreshPendingCount = async () => {
  const pendingCount = await getPendingSyncCount()
  setSyncState({ pendingCount })
  return pendingCount
}

const checkOnline = async () => {
  try { await api.checkHealth(); return true }
  catch { return false }
}

export const flushQueue = async () => {
  if (isSyncing) return
  isSyncing = true
  setSyncState({ isSyncing: true })
  try {
    const pending = await getPendingOrders()
    if (pending.length) {
      console.log(`[Sync] Flushing ${pending.length} orders`)
      const chunks = []
      for (let i = 0; i < pending.length; i += 10) chunks.push(pending.slice(i, i + 10))
      for (const chunk of chunks) {
        const { results } = await api.syncOrders(chunk)
        for (const r of results) {
          if (r.status === 'created' || r.status === 'duplicate') await markOrderSynced(r.id)
          else {
            const flagged = JSON.parse(localStorage.getItem('flagged_orders') || '[]')
            flagged.push({ id: r.id, reason: r.reason, at: new Date().toISOString() })
            localStorage.setItem('flagged_orders', JSON.stringify(flagged))
          }
        }
      }
    }

    const cashEvents = await getPendingCashEvents()
    if (cashEvents.length) {
      console.log(`[Sync] Flushing ${cashEvents.length} cash drawer events`)
      for (const event of cashEvents) {
        await api.logPettyCash(event.shift_id, event.type, event.amount, event.reason, {
          id: event.id,
          created_at: event.created_at
        })
        await markCashEventSynced(event.id)
      }
    }

    await setAppState('last_sync', new Date().toISOString())
    await refreshPendingCount()
  } catch (err) { console.warn('[Sync] Failed:', err.message) }
  finally {
    isSyncing = false
    setSyncState({ isSyncing: false })
    await refreshPendingCount()
  }
}

export const initSync = () => {
  if (syncTimer) return
  window.addEventListener('online', async () => { if (await checkOnline()) { notifyOnline(true); setSyncState({ isOnline: true }); flushQueue() } })
  window.addEventListener('offline', () => { notifyOnline(false); setSyncState({ isOnline: false }) })
  syncTimer = setInterval(async () => {
    await refreshPendingCount()
    const o = await checkOnline()
    notifyOnline(o)
    setSyncState({ isOnline: o })
    if (o) flushQueue()
  }, 30000)
  refreshPendingCount()
  checkOnline().then(async (o) => { notifyOnline(o); setSyncState({ isOnline: o }); if (o) flushQueue() })
}
