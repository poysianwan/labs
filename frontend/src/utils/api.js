const BASE = '/api'

const getToken = () => {
  const { token } = window.__authStore?.getState() || {}
  return token
}

const req = async (method, path, body) => {
  const token = getToken()
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  })
  const data = await res.json()
  if (!res.ok) throw Object.assign(new Error(data.error || 'REQUEST_FAILED'), { status: res.status, data })
  return data
}

export const api = {
  auth: {
    login: (pin) => req('POST', '/auth/login', { pin }),
    logout: () => req('POST', '/auth/logout'),
  },
  sync: {
    snapshot: () => req('GET', '/sync/snapshot'),
    flushOrders: (orders) => req('POST', '/sync/orders', { orders }),
  },
  orders: {
    create: (order) => req('POST', '/orders', order),
    list: (params = {}) => {
      const qs = new URLSearchParams(params).toString()
      return req('GET', `/orders${qs ? '?' + qs : ''}`)
    },
    get: (id) => req('GET', `/orders/${id}`),
    void: (id, reason) => req('PUT', `/orders/${id}/void`, { reason }),
  },
  inventory: {
    ingredients: () => req('GET', '/inventory'),
    createIngredient: (data) => req('POST', '/inventory', data),
    updateIngredient: (id, data) => req('PUT', `/inventory/${id}`, data),
    restock: (id, quantity, note) => req('POST', `/inventory/${id}/restock`, { quantity, note }),
    products: () => req('GET', '/inventory/products'),
    updateProduct: (id, data) => req('PUT', `/inventory/products/${id}`, data),
    getRecipe: (id) => req('GET', `/inventory/products/${id}/recipe`),
    updateRecipe: (id, ingredients) => req('PUT', `/inventory/products/${id}/recipe`, { ingredients }),
  },
  reports: {
    sales: (from, to) => req('GET', `/reports/sales?from=${from}&to=${to || from}`),
    stockMovements: (params = {}) => {
      const qs = new URLSearchParams(params).toString()
      return req('GET', `/reports/stock-movements?${qs}`)
    },
    startShift: (opening_cash) => req('POST', '/reports/shifts/start', { opening_cash }),
    endShift: (id, closing_cash) => req('POST', `/reports/shifts/${id}/end`, { closing_cash }),
  }
}
