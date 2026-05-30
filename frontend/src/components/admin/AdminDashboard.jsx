import { useState, useEffect } from 'react'
import { Routes, Route, NavLink, useNavigate, Navigate } from 'react-router-dom'
import { useAuthStore } from '../../stores/authStore.js'
import AdminHome from './AdminHome.jsx'
import SalesReport from './SalesReport.jsx'
import InventoryPanel from './InventoryPanel.jsx'
import ShiftPanel from './ShiftPanel.jsx'
import OrdersPanel from './OrdersPanel.jsx'
import CashierPanel from './CashierPanel.jsx'
import ActivityPanel from './ActivityPanel.jsx'
import { IconChart, IconReceipt, IconBox, IconClock, IconArrowLeft, IconLogout, IconUsers, IconLayoutDashboard, IconClipboardList, IconActivity } from '../ui/Icons.jsx'

export default function AdminDashboard() {
  const { user, logout, isAdmin } = useAuthStore()
  const navigate = useNavigate()
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)

  return (
    <div className="admin-layout">

      {/* Sidebar */}
      <div className="admin-sidebar">
        <div className="admin-header-hide-mobile">
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 800, color: 'var(--text-strong)', letterSpacing: -0.5 }}>LABS BURGER</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500, marginTop: 4 }}>Control Panel</div>
        </div>

        <nav className="admin-nav" style={{ flex: 1, overflowY: 'auto', padding: '0 8px' }}>
          <NavLink to="/admin" end className={({ isActive }) => `admin-nav-item admin-nav-dashboard ${isActive ? 'active' : ''}`}>
            <IconLayoutDashboard size={20} /> <span>Dashboard</span>
          </NavLink>
          <NavLink to="/admin/orders" className={({ isActive }) => `admin-nav-item admin-nav-orders ${isActive ? 'active' : ''}`}>
            <IconClipboardList size={20} /> <span>Orders</span>
          </NavLink>
          <NavLink to="/admin/inventory" className={({ isActive }) => `admin-nav-item admin-nav-inventory ${isActive ? 'active' : ''}`}>
            <IconBox size={20} /> <span>Inventory</span>
          </NavLink>
          <NavLink to="/admin/activity" className={({ isActive }) => `admin-nav-item admin-nav-activity ${isActive ? 'active' : ''}`}>
            <IconActivity size={20} /> <span>Activity</span>
          </NavLink>
          <NavLink to="/admin/shifts" className={({ isActive }) => `admin-nav-item admin-nav-shifts ${isActive ? 'active' : ''}`}>
            <IconClock size={18} /> <span>Shifts</span>
          </NavLink>
          {isAdmin() && (
            <NavLink to="/admin/users" className={({ isActive }) => `admin-nav-item admin-nav-users ${isActive ? 'active' : ''}`}>
              <IconUsers size={20} /> <span>Users</span>
            </NavLink>
          )}
        </nav>

        <div className="admin-footer-hide-mobile">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--bg-image)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, color: 'var(--text-strong)' }}>
              {user?.name?.[0] || 'U'}
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-strong)' }}>{user?.name}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{isAdmin() ? 'Administrator' : 'Cashier'}</div>
            </div>
          </div>
          <button
            onClick={() => navigate('/pos')}
            style={{ width: '100%', padding: '10px', background: 'var(--text-strong)', color: 'var(--bg-panel)', borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 600, marginBottom: 8, cursor: 'pointer', border: 'none' }}
          >
            <IconArrowLeft size={16} /> Back to POS
          </button>
          <button
            onClick={() => setShowLogoutConfirm(true)}
            style={{ width: '100%', padding: '10px', background: 'var(--bg-image)', color: 'var(--red)', borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 600, cursor: 'pointer', border: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
          >
            <IconLogout size={14} /> Logout
          </button>

        </div>
      </div>

      {/* Main content */}
      <div className="admin-main" style={{ display: 'flex', flexDirection: 'column', height: '100dvh', overflow: 'hidden' }}>
        <div className="admin-mobile-appbar" style={{ flexShrink: 0 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 900, color: 'var(--text-strong)', letterSpacing: -0.5 }}>LABS BURGER</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => navigate('/pos')} style={{ padding: '6px 14px', borderRadius: 100, background: 'var(--bg-panel)', color: 'var(--text-strong)', border: '1px solid var(--border-strong)', fontSize: 12, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 6, boxShadow: 'var(--shadow-sm)' }}>
              <IconArrowLeft size={14} /> POS
            </button>
            <button onClick={() => setShowLogoutConfirm(true)} style={{ padding: '6px 14px', borderRadius: 100, background: 'rgba(239,68,68,0.1)', color: '#dc2626', border: '1px solid rgba(239,68,68,0.2)', fontSize: 12, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 6 }}>
              <IconLogout size={14} /> Quit
            </button>
          </div>
        </div>
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', position: 'relative' }}>
          <Routes>
            {isAdmin() && <Route index element={<AdminHome />} />}
            {isAdmin() && <Route path="sales" element={<SalesReport />} />}
            <Route path="inventory" element={<InventoryPanel />} />
            <Route path="orders" element={<OrdersPanel />} />
            <Route path="activity" element={<ActivityPanel />} />
            <Route path="users" element={<CashierPanel />} />
            <Route path="shifts" element={<ShiftPanel />} />
            <Route path="*" element={<Navigate to={isAdmin() ? "/admin" : "orders"} replace />} />
          </Routes>
        </div>
      </div>

      {/* Global Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(246,247,251,0.7)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: 20 }}>
          <div style={{ background: 'var(--bg-panel)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-lg)', padding: 32, maxWidth: 360, width: '100%', textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-strong)', marginBottom: 8 }}>Ready to leave?</div>
            <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 24, fontWeight: 500, lineHeight: 1.5 }}>You're about to log out of the admin panel. Any unsaved changes may be lost.</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <button 
                onClick={() => setShowLogoutConfirm(false)} 
                style={{ padding: '12px', fontSize: 13, fontWeight: 700, background: 'var(--bg-image)', color: 'var(--text-muted)', borderRadius: 'var(--radius-md)', cursor: 'pointer', border: 'none' }}
              >
                Cancel
              </button>
              <button 
                onClick={() => { logout(); navigate('/login') }} 
                style={{ padding: '12px', fontSize: 13, fontWeight: 700, background: 'var(--red)', color: 'white', borderRadius: 'var(--radius-md)', cursor: 'pointer', border: 'none' }}
              >
                Log Out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
