import { create } from 'zustand'

export const useCartStore = create((set, get) => ({
  items: [],

  addItem: (product) => {
    const items = get().items
    const existing = items.find(i => i.product_id === product.id)
    if (existing) {
      set({ items: items.map(i =>
        i.product_id === product.id ? { ...i, quantity: i.quantity + 1 } : i
      )})
    } else {
      set({ items: [...items, {
        product_id: product.id,
        name: product.name,
        unit_price: product.price,
        is_combo: Boolean(product.is_combo),
        quantity: 1,
        notes: ''
      }]})
    }
  },

  removeItem: (productId) => {
    set({ items: get().items.filter(i => i.product_id !== productId) })
  },

  updateQuantity: (productId, quantity) => {
    if (quantity <= 0) return get().removeItem(productId)
    set({ items: get().items.map(i =>
      i.product_id === productId ? { ...i, quantity } : i
    )})
  },

  updateNotes: (productId, notes) => {
    set({ items: get().items.map(i =>
      i.product_id === productId ? { ...i, notes } : i
    )})
  },

  clearCart: () => set({ items: [] }),

  getTotal: () => get().items.reduce((sum, i) => sum + (i.unit_price * i.quantity), 0),

  getItemCount: () => get().items.reduce((sum, i) => sum + i.quantity, 0),
}))
