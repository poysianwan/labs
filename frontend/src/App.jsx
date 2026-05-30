import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './stores/authStore.js'
import { initSync } from './utils/syncEngine.js'
import LoginScreen from './components/auth/LoginScreen.jsx'
import POSScreen from './components/pos/POSScreen.jsx'
import AdminDashboard from './components/admin/AdminDashboard.jsx'
import PWAInstallPrompt from './components/shared/PWAInstallPrompt.jsx'
import './index.css'

const ProtectedRoute = ({ children, adminOnly = false }) => {
  const { user } = useAuthStore()
  if (!user) return <Navigate to="/login" replace />
  if (adminOnly && user.role !== 'admin') return <Navigate to="/pos" replace />
  return children
}

export default function App() {
  const { user } = useAuthStore()

  useEffect(() => {
    initSync()
  }, [])

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/pos" replace /> : <LoginScreen />} />
        <Route path="/pos" element={<ProtectedRoute><POSScreen /></ProtectedRoute>} />
        <Route path="/admin/*" element={<ProtectedRoute adminOnly><AdminDashboard /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to={user ? '/pos' : '/login'} replace />} />
      </Routes>
      <PWAInstallPrompt />
    </BrowserRouter>
  )
}
