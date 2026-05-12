const CLOUD_BASE = 'https://labs-pos-backend.onrender.com';
const BASE = CLOUD_BASE + '/api'

let _token = null
export const setToken = (t) => { _token = t }
export const clearToken = () => { _token = null }

const headers = () => ({
  'Content-Type': 'application/json',
  ..._token ? { Authorization: `Bearer ${_token}` } : {}
})

const handle = async (res) => {
  const data = await res.json()
  if (!res.ok) throw Object.assign(new Error(data.error || 'API_ERROR'), data)
  return data
}

export const api = {
  // Auth
  login: (pin) => fetch(`${BASE}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin }) }).then(handle),
  logout: () => fetch(`${BASE}/auth/logout`, { method: 'POST', headers: headers() }).then(handle),

  // Sync
  snapshot: () => fetch(`${BASE}/sync/snapshot`, { headers: headers() }).then(handle),
  syncOrders: (orders) => fetch(`${BASE}/sync/orders`, { method: 'POST', headers: headers(), body: JSON.stringify({ orders }) }).then(handle),

  // Orders
  createOrder: (order) => fetch(`${BASE}/orders`, { method: 'POST', headers: headers(), body: JSON.stringify(order) }).then(handle),
  getOrders: (params = {}) => fetch(`${BASE}/orders?${new URLSearchParams(params)}`, { headers: headers() }).then(handle),
  getOrder: (id) => fetch(`${BASE}/orders/${id}`, { headers: headers() }).then(handle),
  voidOrder: (id, reason) => fetch(`${BASE}/orders/${id}/void`, { method: 'PUT', headers: headers(), body: JSON.stringify({ reason }) }).then(handle),

  // Inventory
  getIngredients: () => fetch(`${BASE}/inventory`, { headers: headers() }).then(handle),
  createIngredient: (data) => fetch(`${BASE}/inventory`, { method: 'POST', headers: headers(), body: JSON.stringify(data) }).then(handle),
  updateIngredient: (id, data) => fetch(`${BASE}/inventory/${id}`, { method: 'PUT', headers: headers(), body: JSON.stringify(data) }).then(handle),
  deleteIngredient: (id) => fetch(`${BASE}/inventory/${id}`, { method: 'DELETE', headers: headers() }).then(handle),
  restock: (id, quantity, note) => fetch(`${BASE}/inventory/${id}/restock`, { method: 'POST', headers: headers(), body: JSON.stringify({ quantity, note }) }).then(handle),
  getProducts: () => fetch(`${BASE}/inventory/products`, { headers: headers() }).then(handle),
  createProduct: (data) => fetch(`${BASE}/inventory/products`, { method: 'POST', headers: headers(), body: JSON.stringify(data) }).then(handle),
  updateProduct: (id, data) => fetch(`${BASE}/inventory/products/${id}`, { method: 'PUT', headers: headers(), body: JSON.stringify(data) }).then(handle),
  deleteProduct: (id) => fetch(`${BASE}/inventory/products/${id}`, { method: 'DELETE', headers: headers() }).then(handle),
  getRecipe: (id) => fetch(`${BASE}/inventory/products/${id}/recipe`, { headers: headers() }).then(handle),
  updateRecipe: (id, ingredients) => fetch(`${BASE}/inventory/products/${id}/recipe`, { method: 'PUT', headers: headers(), body: JSON.stringify({ ingredients }) }).then(handle),
  getComboItems: (id) => fetch(`${BASE}/inventory/products/${id}/combo-items`, { headers: headers() }).then(handle),
  updateComboItems: (id, items) => fetch(`${BASE}/inventory/products/${id}/combo-items`, { method: 'PUT', headers: headers(), body: JSON.stringify({ items }) }).then(handle),
  getCategories: () => fetch(`${BASE}/inventory/categories`, { headers: headers() }).then(handle),

  // Reports & shifts
  getShifts: () => fetch(`${BASE}/reports/shifts`, { headers: headers() }).then(handle),
  getCurrentShift: () => fetch(`${BASE}/reports/current-shift`, { headers: headers() }).then(handle),
  startShift: (opening_cash) => fetch(`${BASE}/reports/shifts/start`, { method: 'POST', headers: headers(), body: JSON.stringify({ opening_cash }) }).then(handle),
  endShift: (id, closing_cash) => fetch(`${BASE}/reports/shifts/${id}/end`, { method: 'POST', headers: headers(), body: JSON.stringify({ closing_cash }) }).then(handle),
  getPettyCash: (id) => fetch(`${BASE}/reports/shifts/${id}/petty-cash`, { headers: headers() }).then(handle),
  logPettyCash: (id, type, amount, reason) => fetch(`${BASE}/reports/shifts/${id}/petty-cash`, { method: 'POST', headers: headers(), body: JSON.stringify({ type, amount, reason }) }).then(handle),
  cashWithdraw: (amount, reason) => fetch(`${BASE}/reports/cash-withdraw`, { method: 'POST', headers: headers(), body: JSON.stringify({ amount, reason }) }).then(handle),
  getSalesReport: (from, to) => fetch(`${BASE}/reports/sales?from=${from}&to=${to || from}`, { headers: headers() }).then(handle),
  getStockMovements: (params = {}) => fetch(`${BASE}/reports/stock-movements?${new URLSearchParams(params)}`, { headers: headers() }).then(handle),

  // User management
  getUsers: () => fetch(`${BASE}/users`, { headers: headers() }).then(handle),
  createUser: (data) => fetch(`${BASE}/users`, { method: 'POST', headers: headers(), body: JSON.stringify(data) }).then(handle),
  updateUser: (id, data) => fetch(`${BASE}/users/${id}`, { method: 'PUT', headers: headers(), body: JSON.stringify(data) }).then(handle),
  deleteUser: (id) => fetch(`${BASE}/users/${id}`, { method: 'DELETE', headers: headers() }).then(handle),

  // Activity Logs
  getActivityLogs: (page = 1) => fetch(`${BASE}/reports/activity-logs?page=${page}`, { headers: headers() }).then(handle),
  revertActivityLog: (id) => fetch(`${BASE}/reports/activity-logs/${id}/revert`, { method: 'POST', headers: headers() }).then(handle),
}
