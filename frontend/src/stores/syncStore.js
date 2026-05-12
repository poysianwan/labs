import { create } from 'zustand'

export const useSyncStore = create((set) => ({
  isOnline: navigator.onLine,
  isSyncing: false,
  pendingCount: 0,
  setOnline: (v) => set({ isOnline: v }),
  setSyncing: (v) => set({ isSyncing: v }),
  setPendingCount: (v) => set({ pendingCount: v }),
}))
