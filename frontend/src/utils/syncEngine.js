import { getPendingOrders, markOrderSynced, setAppState } from '../db/index.js'
import { api } from './apiClient.js'

let syncTimer = null
let isSyncing = false
let onlineListeners = []

export const addOnlineListener = (fn) => {
  onlineListeners.push(fn)
  return () => { onlineListeners = onlineListeners.filter(f => f !== fn) }
}
const notifyOnline = (v) => onlineListeners.forEach(fn => fn(v))

const checkOnline = async () => {
  try { await fetch('/health', { method: 'HEAD', cache: 'no-store' }); return true }
  catch { return false }
}

export const flushQueue = async () => {
  if (isSyncing) return
  isSyncing = true
  try {
    const pending = await getPendingOrders()
    if (!pending.length) return
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
    await setAppState('last_sync', new Date().toISOString())
  } catch (err) { console.warn('[Sync] Failed:', err.message) }
  finally { isSyncing = false }
}

export const initSync = () => {
  window.addEventListener('online', async () => { if (await checkOnline()) { notifyOnline(true); flushQueue() } })
  window.addEventListener('offline', () => notifyOnline(false))
  syncTimer = setInterval(async () => { const o = await checkOnline(); notifyOnline(o); if (o) flushQueue() }, 30000)
  checkOnline().then(async (o) => { notifyOnline(o); if (o) flushQueue() })
}
