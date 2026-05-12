import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { setToken, clearToken } from '../utils/apiClient.js'

// Synchronously initialize token from local storage so it's ready before components mount
try {
  const stored = JSON.parse(localStorage.getItem('pos-auth'))
  if (stored?.state?.token) {
    setToken(stored.state.token)
  }
} catch (e) {
  // Ignore parse errors
}

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      token: null,

      login: (user, token) => {
        setToken(token)
        set({ user, token })
        setTimeout(() => get().logout(), 12 * 60 * 60 * 1000)
      },

      logout: () => {
        clearToken()
        set({ user: null, token: null })
        localStorage.removeItem('pos-auth')
      },

      isAdmin: () => get().user?.role === 'admin',
      isCashier: () => get().user?.role === 'cashier',
    }),
    {
      name: 'pos-auth',
      onRehydrateStorage: () => (state) => {
        if (state && state.token) {
          setToken(state.token)
        }
      }
    }
  )
)
