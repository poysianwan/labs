import { openDB } from 'idb'

const DB_NAME = 'labs-burger-pos'
const DB_VERSION = 3

let dbPromise = null

const localDateKey = (date = new Date()) => {
  const d = date instanceof Date ? date : new Date(date)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export const getDB = () => {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Products cache
        if (!db.objectStoreNames.contains('products')) {
          const products = db.createObjectStore('products', { keyPath: 'id' })
          products.createIndex('category_id', 'category_id')
        }

        // Categories cache
        if (!db.objectStoreNames.contains('categories')) {
          db.createObjectStore('categories', { keyPath: 'id' })
        }

        // Ingredients cache
        if (!db.objectStoreNames.contains('ingredients')) {
          db.createObjectStore('ingredients', { keyPath: 'id' })
        }

        // Offline orders queue
        if (!db.objectStoreNames.contains('orders')) {
          const orders = db.createObjectStore('orders', { keyPath: 'id' })
          orders.createIndex('synced', 'synced')
          orders.createIndex('created_at', 'created_at')
        }

        // App state (current shift, etc)
        if (!db.objectStoreNames.contains('app_state')) {
          db.createObjectStore('app_state', { keyPath: 'key' })
        }

        // Offline drawer events queue
        if (!db.objectStoreNames.contains('cash_events')) {
          const cashEvents = db.createObjectStore('cash_events', { keyPath: 'id' })
          cashEvents.createIndex('synced', 'synced')
          cashEvents.createIndex('created_at', 'created_at')
        }

        // Daily read cache for already-downloaded orders and stock views.
        if (!db.objectStoreNames.contains('daily_cache')) {
          db.createObjectStore('daily_cache', { keyPath: 'key' })
        }
      }
    })
  }
  return dbPromise
}

export const cleanupDailyCache = async () => {
  const db = await getDB()
  if (!db.objectStoreNames.contains('daily_cache')) return

  const today = localDateKey()
  const tx = db.transaction('daily_cache', 'readwrite')
  const rows = await tx.store.getAll()

  for (const row of rows) {
    if (row.date !== today) await tx.store.delete(row.key)
  }

  await tx.done
}

// Products
export const cacheProducts = async (products) => {
  const db = await getDB()
  const tx = db.transaction('products', 'readwrite')
  await tx.store.clear()
  for (const p of products) await tx.store.put(p)
  await tx.done
}

export const getProducts = async () => {
  const db = await getDB()
  return db.getAll('products')
}

// Categories
export const cacheCategories = async (categories) => {
  const db = await getDB()
  const tx = db.transaction('categories', 'readwrite')
  await tx.store.clear()
  for (const c of categories) await tx.store.put(c)
  await tx.done
}

export const getCategories = async () => {
  const db = await getDB()
  return db.getAll('categories')
}

// Ingredients
export const cacheIngredients = async (ingredients) => {
  const db = await getDB()
  const tx = db.transaction('ingredients', 'readwrite')
  await tx.store.clear()
  for (const i of ingredients) await tx.store.put(i)
  await tx.done
}

export const getIngredients = async () => {
  const db = await getDB()
  return db.getAll('ingredients')
}

export const cacheDailyOrders = async (date, orders) => {
  if (date !== localDateKey()) return
  const db = await getDB()
  await cleanupDailyCache()
  await db.put('daily_cache', {
    key: `orders:${date}`,
    type: 'orders',
    date,
    value: orders,
    saved_at: new Date().toISOString()
  })
}

export const getCachedDailyOrders = async (date) => {
  if (date !== localDateKey()) return []
  await cleanupDailyCache()
  const db = await getDB()
  const row = await db.get('daily_cache', `orders:${date}`)
  return row?.date === localDateKey() ? row.value || [] : []
}

export const upsertCachedDailyOrder = async (date, order) => {
  if (date !== localDateKey()) return
  const existing = await getCachedDailyOrders(date)
  const next = [order, ...existing.filter(row => row.id !== order.id)]
  await cacheDailyOrders(date, next)
}

export const cacheDailyInventory = async ({ ingredients, products, categories }) => {
  const db = await getDB()
  const date = localDateKey()
  await cleanupDailyCache()
  await db.put('daily_cache', {
    key: `inventory:${date}`,
    type: 'inventory',
    date,
    value: { ingredients, products, categories },
    saved_at: new Date().toISOString()
  })
}

export const getCachedDailyInventory = async () => {
  await cleanupDailyCache()
  const db = await getDB()
  const date = localDateKey()
  const row = await db.get('daily_cache', `inventory:${date}`)
  return row?.value || null
}

// Orders queue
export const saveOrderOffline = async (order) => {
  const db = await getDB()
  await db.put('orders', { ...order, synced: false })
}

export const markOrderSynced = async (id) => {
  const db = await getDB()
  const order = await db.get('orders', id)
  if (order) await db.put('orders', { ...order, synced: true })
}

export const deleteLocalOrder = async (id) => {
  const db = await getDB()
  await db.delete('orders', id)
}

export const getPendingOrders = async () => {
  const db = await getDB()
  const all = await db.getAll('orders')
  return all.filter(o => o.synced === false).sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
}

export const getRecentOrders = async (limit = 50) => {
  const db = await getDB()
  const all = await db.getAll('orders')
  return all.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, limit)
}

// Cash drawer event queue
export const saveCashEventOffline = async (event) => {
  const db = await getDB()
  await db.put('cash_events', { ...event, synced: false })
}

export const markCashEventSynced = async (id) => {
  const db = await getDB()
  const event = await db.get('cash_events', id)
  if (event) await db.put('cash_events', { ...event, synced: true })
}

export const getPendingCashEvents = async () => {
  const db = await getDB()
  const all = await db.getAll('cash_events')
  return all.filter(e => e.synced === false).sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
}

export const getPendingSyncCount = async () => {
  const [orders, cashEvents] = await Promise.all([getPendingOrders(), getPendingCashEvents()])
  return orders.length + cashEvents.length
}

export const cleanupSyncedRecords = async (daysToKeep = 30) => {
  const db = await getDB()
  const cutoff = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000)
  const tx = db.transaction(['orders', 'cash_events'], 'readwrite')
  const [orders, cashEvents] = await Promise.all([
    tx.objectStore('orders').getAll(),
    tx.objectStore('cash_events').getAll()
  ])

  for (const order of orders) {
    if (order.synced === true && new Date(order.created_at).getTime() < cutoff) {
      await tx.objectStore('orders').delete(order.id)
    }
  }

  for (const event of cashEvents) {
    if (event.synced === true && new Date(event.created_at).getTime() < cutoff) {
      await tx.objectStore('cash_events').delete(event.id)
    }
  }

  await tx.done
}

// App state
export const setAppState = async (key, value) => {
  const db = await getDB()
  await db.put('app_state', { key, value })
}

export const getAppState = async (key) => {
  const db = await getDB()
  const row = await db.get('app_state', key)
  return row?.value
}
