import { useState, useEffect, useCallback } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../stores/authStore.js'
import { useCartStore } from '../../stores/cartStore.js'
import { getProducts, getCategories, getAppState, saveCashEventOffline, setAppState } from '../../db/index.js'
import { api } from '../../utils/apiClient.js'
import { flushQueue } from '../../utils/syncEngine.js'
import { useOnlineStatus } from '../../hooks/useOnlineStatus.js'
import PaymentModal from '../payment/PaymentModal.jsx'
import CartPanel from './CartPanel.jsx'
import OrdersPanel from '../admin/OrdersPanel.jsx'
import InventoryPanel from '../admin/InventoryPanel.jsx'
import { IconGrid, IconClock, IconChart, IconBox, IconReceipt, IconSearch, IconX, IconBurger, IconFries, IconDrink, IconCheese, IconMeat, IconCombo, IconPlus, IconMinus, IconTrash } from '../ui/Icons.jsx'

const getProductDetail = (name) => {
  const n = name.toLowerCase()
  if (n.includes('classic burger')) return { Icon: IconBurger, desc: 'Beef patty, lettuce, tomato' }
  if (n.includes('cheeseburger')) return { Icon: IconCheese, desc: 'Double cheese, pickles' }
  if (n.includes('double')) return { Icon: IconMeat, desc: 'Two beef patties, sauce' }
  if (n.includes('combo')) return { Icon: n.includes('fries') ? IconFries : IconCombo, desc: 'Burger + fries + drink' }
  if (n.includes('tea')) return { Icon: IconDrink, desc: 'Fresh brewed, 16oz' }
  if (n.includes('coke')) return { Icon: IconDrink, desc: 'Cold soda, 16oz' }
  if (n.includes('fries')) return { Icon: IconFries, desc: 'Salted, thick cut' }
  return { Icon: IconBurger, desc: 'Fresh ingredients' }
}

export default function POSScreen() {
  const { user, logout, isAdmin } = useAuthStore()
  const { items, addItem, updateQuantity, getTotal, getItemCount } = useCartStore()
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [activeCategory, setActiveCategory] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [showPayment, setShowPayment] = useState(false)
  const [isCartOpen, setIsCartOpen] = useState(false)
  const [currentShift, setCurrentShift] = useState(null)
  const [globalShift, setGlobalShift] = useState(null)
  const [shiftLoaded, setShiftLoaded] = useState(false)
  const [openingCash, setOpeningCash] = useState('')
  const [closingCash, setClosingCash] = useState('')
  const [shiftLoading, setShiftLoading] = useState(false)
  const [orderSuccess, setOrderSuccess] = useState(false)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [showCashWithdraw, setShowCashWithdraw] = useState(false)
  const [bypassShift, setBypassShift] = useState(false)
  const [activeTab, setActiveTab] = useState('menu')
  const [shiftError, setShiftError] = useState(null)
  const isOnline = useOnlineStatus()
  const navigate = useNavigate()

  useEffect(() => {
    const load = async () => {
      const [prods, cats] = await Promise.all([getProducts(), getCategories()])
      setProducts(prods)
      setCategories(cats.sort((a, b) => a.sort_order - b.sort_order))
      const localShift = await getAppState('currentShift')
      
      try {
        const dbShift = await api.getCurrentShift()
        setGlobalShift(dbShift)
        if (dbShift) {
           // If the database has an open shift for the CURRENT user, sync it
           if (dbShift.user_id === user.id) {
             setCurrentShift(dbShift)
             await setAppState('currentShift', dbShift)
           } else {
             // If someone else has the shift, the local user is definitely not on shift
             setCurrentShift(null)
             await setAppState('currentShift', null)
           }
        } else {
          setCurrentShift(null)
          await setAppState('currentShift', null)
        }
      } catch (err) {
        console.error('Failed to sync shift with backend:', err)
        // Fallback to local state if offline
        setCurrentShift(localShift)
      }
      setShiftLoaded(true)
    }
    load()
  }, [user.id])

  const handleStartShift = async () => {
    setShiftLoading(true)
    setShiftError(null)
    try {
      const result = await api.startShift(parseFloat(openingCash) || 0)
      const shift = { 
        id: result.shift_id, 
        started_at: result.started_at, 
        opening_cash: parseFloat(openingCash) || 0, 
        user_id: user.id,
        cashier_name: result.cashier_name || user.name
      }
      setCurrentShift(shift)
      setGlobalShift(shift)
      await setAppState('currentShift', shift)
      setOpeningCash('')
    } catch (err) { 
      setShiftError(err.message || 'Failed to start shift')
    } finally { 
      setShiftLoading(false) 
    }
  }

  const handleEndShiftAndLogout = async () => {
    if (!closingCash && closingCash !== '0') return
    setShiftLoading(true)
    try {
      await api.endShift(currentShift.id, parseFloat(closingCash) || 0)
      setCurrentShift(null)
      await setAppState('currentShift', null)
      setClosingCash('')
      logout()
      navigate('/login')
    } catch (err) { alert('Failed to close shift: ' + err.message) }
    finally { setShiftLoading(false) }
  }

  const filteredProducts = products.filter(p => {
    if (p.deleted_at) return false
    if (activeCategory && p.category_id !== activeCategory) return false
    if (searchQuery && !p.name.toLowerCase().includes(searchQuery.toLowerCase())) return false
    return true
  })
  const visibleCategories = categories
    .map(category => ({
      ...category,
      products: products.filter(product => {
        if (product.deleted_at) return false
        if (product.category_id !== category.id) return false
        if (searchQuery && !product.name.toLowerCase().includes(searchQuery.toLowerCase())) return false
        return true
      })
    }))
    .filter(category => category.products.length > 0)
  const mobileSections = activeCategory
    ? visibleCategories.filter(category => category.id === activeCategory)
    : visibleCategories

  const renderSessionControl = (className = '') => (
    <div className={`pos-session-wrap ${className}`} style={{ position: 'relative', flexShrink: 0, marginRight: 8 }}>
      <button
        onClick={() => setShowLogoutConfirm(prev => !prev)}
        style={{
          display: 'flex', alignItems: 'center', gap: 10, fontSize: 11, fontWeight: 800,
          color: 'var(--text-strong)', textTransform: 'uppercase', letterSpacing: 0.8,
          background: 'var(--bg-panel)', padding: '10px 18px',
          borderRadius: 'var(--radius-pill)', border: '1px solid var(--border-light)',
          cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
          transition: 'all 0.2s',
          whiteSpace: 'nowrap',
          marginRight: 8,
          position: 'relative'
        }}
        title={isAdmin() ? 'Logout admin' : 'End shift and logout'}
        aria-label={isAdmin() ? 'Logout admin' : 'End shift and logout'}
        className="pos-session-button"
      >
        <span className="pos-session-tooltip">{isAdmin() ? 'Tap to logout' : 'Tap to end shift'}</span>
        <div className="pulse-dot" style={{
          width: 8, height: 8, borderRadius: '50%',
          background: isAdmin() || globalShift ? 'var(--green)' : 'var(--red)',
          boxShadow: isAdmin() || globalShift ? '0 0 10px rgba(16,185,129,0.2)' : 'none'
        }} />
        {isAdmin() ? (user?.name || 'Admin') : (globalShift ? `${globalShift.cashier_name}` : 'Offline')}
        <span className="pos-session-logout-text">Logout</span>
      </button>
      {showLogoutConfirm && (
        <div style={{ position: 'absolute', top: 'calc(100% + 12px)', right: 0, background: 'var(--bg-panel)', border: '1px solid var(--border-card)', borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-lg)', padding: 24, width: 280, zIndex: 50 }}>
          <div style={{ fontSize: 16, fontWeight: 900, color: 'var(--text-strong)', marginBottom: 8, letterSpacing: -0.5 }}>End Active Session</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20, fontWeight: 500, lineHeight: 1.5 }}>{isAdmin() ? 'Ready to log out of the admin console?' : 'Count all cash in drawer to close shift.'}</div>
          {!isAdmin() && (
            <input type="number" inputMode="numeric" value={closingCash} onChange={e => setClosingCash(e.target.value)} placeholder="Closing count (₱)" style={{ width: '100%', padding: '14px', background: 'var(--bg-image)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', fontSize: 18, fontWeight: 900, color: 'var(--text-strong)', marginBottom: 16, textAlign: 'center' }} />
          )}
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => { setShowLogoutConfirm(false); setClosingCash('') }} style={{ flex: 1, padding: '12px', fontSize: 13, fontWeight: 700, background: 'var(--bg-app)', color: 'var(--text-muted)', borderRadius: 'var(--radius-md)' }}>Cancel</button>
            <button onClick={isAdmin() ? () => { logout(); navigate('/login') } : handleEndShiftAndLogout} disabled={!isAdmin() && (!closingCash && closingCash !== '0') || shiftLoading} style={{ flex: 1.5, padding: '12px', fontSize: 13, fontWeight: 800, background: 'var(--red)', color: 'white', border: 'none', borderRadius: 'var(--radius-md)', opacity: (!isAdmin() && !closingCash) ? 0.5 : 1 }}>{shiftLoading ? 'Closing...' : 'Confirm Logout'}</button>
          </div>
        </div>
      )}
    </div>
  )

  return (
    <div className="pos-layout">

      {/* Left / Bottom Sidebar */}
      <div className="pos-nav">
        {/* LB Logo */}
        <div className="pos-nav-hide-mobile" style={{ width: 56, height: 56, background: 'var(--dark)', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--white)', fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, letterSpacing: 1, marginBottom: 40, boxShadow: 'var(--shadow-md)' }}>
          LB
        </div>

        {/* Nav Items */}
        <div className="pos-nav-links">
          <NavButton icon={<IconClock size={22} />} label="Orders" active={activeTab === 'orders'} onClick={() => setActiveTab('orders')} />
          <NavButton icon={<IconGrid size={22} />} label="Menu" active={activeTab === 'menu'} onClick={() => setActiveTab('menu')} />
          {isAdmin() ? (
            <NavButton icon={<IconChart size={22} />} label="Manage" onClick={() => navigate('/admin')} />
          ) : (
            <>
              <NavButton icon={<IconReceipt size={22} />} label="Drawer" onClick={() => setShowCashWithdraw(true)} />
              <NavButton icon={<IconBox size={22} />} label="Inventory" active={activeTab === 'inventory'} onClick={() => setActiveTab('inventory')} />
            </>
          )}
        </div>

      </div>

      {/* Shift Overlays */}
      {shiftLoaded && !currentShift && !bypassShift && !isAdmin() && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
          background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          {globalShift && globalShift.user_id !== user.id ? (
            <div style={{ background: 'var(--bg-app)', padding: 40, borderRadius: 'var(--radius-xl)', width: 440, maxWidth: '90%', border: '1px solid var(--border-light)', boxShadow: 'var(--shadow-xl)', textAlign: 'center' }}>
              <div style={{ width: 64, height: 64, background: 'var(--red)', color: 'var(--white)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
                <IconClock size={32} />
              </div>
              <h2 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-strong)', margin: '0 0 12px', letterSpacing: -0.5 }}>Register Occupied</h2>
              <p style={{ fontSize: 15, color: 'var(--text-strong)', marginBottom: 8, fontWeight: 600 }}>{globalShift.cashier_name} is currently Online.</p>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 32, lineHeight: 1.5 }}>Only one cashier can manage the drawer at a time. Please wait for them to end their shift before you can start yours.</p>
              
              <button onClick={() => { logout(); navigate('/login') }} style={{ width: '100%', padding: '16px 0', background: 'var(--text-strong)', color: 'var(--bg-panel)', borderRadius: 'var(--radius-lg)', fontSize: 15, fontWeight: 700, border: 'none', cursor: 'pointer' }}>
                Back to Login
              </button>
            </div>
          ) : (
            <div style={{ background: 'var(--bg-app)', padding: 40, borderRadius: 'var(--radius-xl)', width: 440, maxWidth: '90%', border: '1px solid var(--border-light)', boxShadow: 'var(--shadow-xl)', textAlign: 'center' }}>
              <div style={{ width: 64, height: 64, background: 'var(--text-strong)', color: 'var(--bg-panel)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
                <IconBox size={32} />
              </div>
              <h2 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-strong)', margin: '0 0 12px', letterSpacing: -0.5 }}>Register Closed</h2>
              <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 32, lineHeight: 1.5 }}>Please count and enter the floating cash currently in the drawer to start accepting orders.</p>
              
              {shiftError && (
                <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.1)', color: 'var(--red)', borderRadius: 'var(--radius-md)', fontSize: 12, fontWeight: 700, marginBottom: 16 }}>
                  {shiftError}
                </div>
              )}

              <div style={{ background: 'var(--bg-panel)', padding: 8, borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-light)', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-muted)', paddingLeft: 16 }}>₱</div>
                <input type="number" inputMode="numeric" autoFocus value={openingCash} onChange={e => setOpeningCash(e.target.value)} placeholder="0.00" style={{ flex: 1, background: 'transparent', border: 'none', color: 'var(--text-strong)', fontSize: 32, fontWeight: 800, outline: 'none', padding: '12px 16px 12px 0' }} />
              </div>

              <button onClick={handleStartShift} disabled={shiftLoading || openingCash === ''} style={{ width: '100%', padding: '18px 0', background: 'var(--text-strong)', color: 'var(--bg-panel)', borderRadius: 'var(--radius-lg)', fontSize: 16, fontWeight: 700, opacity: (!openingCash || shiftLoading) ? 0.6 : 1, transition: 'all 0.2s', border: 'none', cursor: (!openingCash || shiftLoading) ? 'not-allowed' : 'pointer' }}>
                {shiftLoading ? 'Opening...' : 'Start Shift'}
              </button>
              
              <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginTop: 24 }}>
                <button onClick={() => { logout(); navigate('/login') }} style={{ background: 'transparent', border: 'none', color: 'var(--red)', fontSize: 14, fontWeight: 600, cursor: 'pointer', padding: '10px' }}>
                  Back to Login
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Order success flash */}
      {orderSuccess && (
        <div style={{
          position: 'absolute', top: 40, left: '50%', transform: 'translateX(-50%)',
          background: 'var(--green)', color: 'var(--white)', padding: '12px 32px', borderRadius: 'var(--radius-pill)',
          fontWeight: 700, fontSize: 16, zIndex: 100, boxShadow: 'var(--shadow-md)',
          animation: 'fadeIn 0.2s ease'
        }}>
          Payment Successful
        </div>
      )}

      {/* Center Main Content */}
      <div className={`pos-main pos-tab-${activeTab}`}>
        {activeTab !== 'menu' && (
          <div className="pos-floating-session">
            {renderSessionControl('pos-session-floating')}
          </div>
        )}
        {activeTab === 'menu' && (
          <>
            {/* Top Header & Categories */}
            <div className="pos-menu-header" style={{ padding: '32px 32px 24px', flexShrink: 0 }}>
              {/* Title, Search & Status */}
              <div className="pos-menu-titlebar" style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
                <h1 style={{ fontSize: 32, fontWeight: 900, margin: 0, color: 'var(--text-strong)', flexShrink: 0, letterSpacing: -1 }}>Menu</h1>
                
                <div className="pos-title-spacer" style={{ flex: 1 }} />

                {/* Minimalist Search Bar */}
                <div className="pos-search-wrap" style={{ width: 200, position: 'relative', flexShrink: 1, minWidth: 140 }}>
                  <div style={{ position: 'absolute', top: 0, left: 16, height: '100%', display: 'flex', alignItems: 'center', color: 'var(--text-muted)' }}>
                    <IconSearch size={14} />
                  </div>
                  <input 
                    type="text" 
                    placeholder="Find items..." 
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    style={{ 
                      width: '100%', padding: '12px 16px 12px 42px', 
                      background: 'transparent', border: '1px solid var(--border-light)', 
                      borderRadius: 'var(--radius-pill)', fontSize: 13, fontWeight: 600, 
                      color: 'var(--text-strong)', outline: 'none',
                      transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                    }} 
                    className="search-input"
                  />
                </div>

                {/* Online / Logout Pill */}
                <div className="pos-session-wrap" style={{ position: 'relative', flexShrink: 0, marginRight: 8 }}>
                  {isAdmin() ? (
                    <button 
                      onClick={() => setShowLogoutConfirm(prev => !prev)} 
                      style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 11, fontWeight: 800, color: 'var(--text-strong)', textTransform: 'uppercase', letterSpacing: 0.8, background: 'var(--bg-panel)', padding: '10px 18px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--border-light)', cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.02)', whiteSpace: 'nowrap', position: 'relative' }}
                      title="Logout admin"
                      aria-label="Logout admin"
                      className="pos-session-button"
                    >
                      <span className="pos-session-tooltip">Tap to logout</span>
                      <div className="pulse-dot" style={{
                        width: 8, height: 8, borderRadius: '50%',
                        background: 'var(--green)',
                        boxShadow: '0 0 10px rgba(16,185,129,0.2)'
                      }} />
                      {user?.name || 'Admin'} <span className="pos-session-logout-text">Logout</span>
                    </button>
                  ) : (
                    <button onClick={() => setShowLogoutConfirm(prev => !prev)} style={{ 
                      display: 'flex', alignItems: 'center', gap: 10, fontSize: 11, fontWeight: 800, 
                      color: 'var(--text-strong)', textTransform: 'uppercase', letterSpacing: 0.8,
                      background: 'var(--bg-panel)', padding: '10px 18px', 
                      borderRadius: 'var(--radius-pill)', border: '1px solid var(--border-light)', 
                      cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
                      transition: 'all 0.2s',
                      whiteSpace: 'nowrap',
                      marginRight: 8,
                      position: 'relative'
                    }}
                    title="End shift and logout"
                    aria-label="End shift and logout"
                    className="pos-session-button"
                    >
                      <span className="pos-session-tooltip">Tap to end shift</span>
                      <div className="pulse-dot" style={{ 
                        width: 8, height: 8, borderRadius: '50%', 
                        background: globalShift ? 'var(--green)' : 'var(--red)',
                        boxShadow: globalShift ? '0 0 10px rgba(16,185,129,0.2)' : 'none'
                      }} />
                      {globalShift ? `${globalShift.cashier_name}` : 'Offline'}
                      <span className="pos-session-logout-text">Logout</span>
                    </button>
                  )}
                  {showLogoutConfirm && (
                    <div style={{ position: 'absolute', top: 'calc(100% + 12px)', right: 0, background: 'var(--bg-panel)', border: '1px solid var(--border-card)', borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-lg)', padding: 24, width: 280, zIndex: 50 }}>
                      <div style={{ fontSize: 16, fontWeight: 900, color: 'var(--text-strong)', marginBottom: 8, letterSpacing: -0.5 }}>End Active Session</div>
                      <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20, fontWeight: 500, lineHeight: 1.5 }}>{isAdmin() ? 'Ready to log out of the admin console?' : 'Count all cash in drawer to close shift.'}</div>
                      {!isAdmin() && (
                        <input type="number" inputMode="numeric" value={closingCash} onChange={e => setClosingCash(e.target.value)} placeholder="Closing count (₱)" style={{ width: '100%', padding: '14px', background: 'var(--bg-image)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', fontSize: 18, fontWeight: 900, color: 'var(--text-strong)', marginBottom: 16, textAlign: 'center' }} />
                      )}
                      <div style={{ display: 'flex', gap: 10 }}>
                        <button onClick={() => { setShowLogoutConfirm(false); setClosingCash('') }} style={{ flex: 1, padding: '12px', fontSize: 13, fontWeight: 700, background: 'var(--bg-app)', color: 'var(--text-muted)', borderRadius: 'var(--radius-md)' }}>Cancel</button>
                        <button onClick={isAdmin() ? () => { logout(); navigate('/login') } : handleEndShiftAndLogout} disabled={!isAdmin() && (!closingCash && closingCash !== '0') || shiftLoading} style={{ flex: 1.5, padding: '12px', fontSize: 13, fontWeight: 800, background: 'var(--red)', color: 'white', border: 'none', borderRadius: 'var(--radius-md)', opacity: (!isAdmin() && !closingCash) ? 0.5 : 1 }}>{shiftLoading ? 'Closing...' : 'Confirm Logout'}</button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Minimalist Glass Category Bar */}
              <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 10, width: '100%', WebkitOverflowScrolling: 'touch' }} className="hide-scroll pos-category-pills">
                <button
                  onClick={() => setActiveCategory(null)}
                  style={{
                    padding: '10px 24px', borderRadius: 'var(--radius-pill)', fontSize: 13, fontWeight: 800,
                    textTransform: 'uppercase', letterSpacing: 0.5,
                    background: !activeCategory ? 'var(--dark)' : 'var(--bg-app)',
                    color: !activeCategory ? 'white' : 'var(--text-muted)',
                    boxShadow: !activeCategory ? '0 4px 12px rgba(0,0,0,0.1)' : 'none',
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)', flexShrink: 0
                  }}
                >
                  Show All
                </button>
                {categories.map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => setActiveCategory(cat.id)}
                    style={{
                      padding: '10px 24px', borderRadius: 'var(--radius-pill)', fontSize: 13, fontWeight: 800,
                      textTransform: 'uppercase', letterSpacing: 0.5,
                      background: activeCategory === cat.id ? 'var(--dark)' : 'transparent',
                      color: activeCategory === cat.id ? 'white' : 'var(--text-muted)',
                      border: `1px solid ${activeCategory === cat.id ? 'var(--dark)' : 'var(--border-light)'}`,
                      transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)', flexShrink: 0
                    }}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Product Grid */}
            <div className="pos-mobile-menu-shell">
              <aside className="pos-mobile-category-rail hide-scroll">
                <button
                  onClick={() => setActiveCategory(null)}
                  className={!activeCategory ? 'active' : ''}
                  type="button"
                >
                  <IconGrid size={24} />
                  <span>All</span>
                </button>
                {categories.map(cat => {
                  const firstProduct = products.find(product => product.category_id === cat.id && !product.deleted_at)
                  const { Icon } = getProductDetail(firstProduct?.name || cat.name)
                  return (
                    <button
                      key={cat.id}
                      onClick={() => setActiveCategory(cat.id)}
                      className={activeCategory === cat.id ? 'active' : ''}
                      type="button"
                    >
                      <Icon size={27} sw={1.6} />
                      <span>{cat.name}</span>
                    </button>
                  )
                })}
              </aside>
              <div className="pos-mobile-products hide-scroll">
                {mobileSections.map(section => (
                  <section key={section.id} className="pos-mobile-product-section">
                    <h2>{section.name}</h2>
                    <div className="pos-mobile-product-grid">
                      {section.products.map(product => {
                        const cartQty = items.find(i => i.product_id === product.id)?.quantity || 0
                        return <ProductCard key={product.id} product={product} cartQty={cartQty} onAdd={() => addItem(product)} onReduce={() => updateQuantity(product.id, cartQty - 1)} />
                      })}
                    </div>
                  </section>
                ))}
                {mobileSections.length === 0 && (
                  <div className="pos-mobile-empty">No products available</div>
                )}
              </div>
            </div>
            <div className="pos-product-grid" style={{ flex: 1, overflowY: 'auto', padding: '8px 32px 40px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 20, alignContent: 'start' }}>
              {filteredProducts.map(product => {
                const cartQty = items.find(i => i.product_id === product.id)?.quantity || 0
                return <ProductCard key={product.id} product={product} cartQty={cartQty} onAdd={() => addItem(product)} onReduce={() => updateQuantity(product.id, cartQty - 1)} />
              })}
              {filteredProducts.length === 0 && (
                <div style={{ gridColumn: '1/-1', textAlign: 'center', color: 'var(--text-muted)', paddingTop: 60, fontSize: 16, fontWeight: 500 }}>
                  No products available
                </div>
              )}
            </div>
          </>
        )}

        {/* Full-width dynamic panels */}
        {activeTab === 'orders' && <OrdersPanel />}
        {activeTab === 'inventory' && <InventoryPanel />}

        {/* Floating Checkout Banner for Kiosk Mode */}
        {items.length > 0 && activeTab === 'menu' && (
          <div className="kiosk-banner">
            <button onClick={() => setIsCartOpen(true)} style={{ width: '100%', background: 'var(--text-strong)', color: 'var(--bg-panel)', padding: '16px', borderRadius: 'var(--radius-pill)', fontSize: 16, fontWeight: 700, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{background:'rgba(255,255,255,0.2)', padding:'4px 12px', borderRadius:'100px', fontSize:14}}>{getItemCount()} Items</div>
              <div>View Order</div>
              <div>₱{getTotal().toFixed(2)}</div>
            </button>
          </div>
        )}
        
      </div>

      {/* Right fixed cart panel (Desktop/Tablet Landscape) */}
      <div className="pos-cart-container">
        <CartPanel onCheckout={() => setShowPayment(true)} />
      </div>

      {/* Full Screen Overlay Cart panel (Kiosk mode) */}
      {isCartOpen && (
        <div className="kiosk-cart-overlay">
          <CartPanel onCheckout={() => {setIsCartOpen(false); setShowPayment(true)}} onCloseCart={() => setIsCartOpen(false)} />
        </div>
      )}

      {/* Payment modal */}
      {showPayment && (
        <PaymentModal
          total={useCartStore.getState().getTotal()}
          items={useCartStore.getState().items}
          diningType={'takeout'}
          shiftId={currentShift?.id}
          onSuccess={() => {
            useCartStore.getState().clearCart()
            setShowPayment(false)
            setOrderSuccess(true)
            setTimeout(() => setOrderSuccess(false), 2500)
            if (isOnline) flushQueue()
          }}
          onClose={() => setShowPayment(false)}
        />
      )}

      {showCashWithdraw && (
        <CashWithdrawModal
          shift={currentShift || globalShift}
          onClose={() => setShowCashWithdraw(false)}
          onSaved={() => {
            setShowCashWithdraw(false)
            if (isOnline) flushQueue()
          }}
        />
      )}
    </div>
  )
}

function CashWithdrawModal({ shift, onClose, onSaved }) {
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const amountValue = Number(amount)
  const canSubmit = shift?.id && amountValue > 0 && reason.trim() && !loading

  const submit = async () => {
    if (!canSubmit) return
    setLoading(true)
    setError('')
    try {
      await saveCashEventOffline({
        id: uuidv4(),
        shift_id: shift.id,
        type: 'pay_out',
        amount: amountValue,
        reason: reason.trim(),
        created_at: new Date().toISOString()
      })
      await flushQueue()
      onSaved()
    } catch (err) {
      setError(err.message || 'Unable to record cash withdrawal.')
      setLoading(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(17,17,17,0.45)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 420,
      padding: 'max(16px, env(safe-area-inset-top)) max(16px, env(safe-area-inset-right)) max(16px, env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left))'
    }}>
      <div style={{ width: 'min(100%, 420px)', background: 'var(--bg-panel)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-xl)', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 18 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--text-strong)', letterSpacing: -0.5 }}>Withdraw Cash</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600, marginTop: 6, lineHeight: 1.45 }}>
              Record money taken from the active drawer for deliveries or supplies.
            </div>
          </div>
          <button onClick={onClose} disabled={loading} style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--bg-image)', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <IconX size={15} />
          </button>
        </div>

        {!shift?.id && (
          <div style={{ padding: 14, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.16)', borderRadius: 'var(--radius-lg)', color: 'var(--red)', fontSize: 13, lineHeight: 1.45, fontWeight: 700, marginBottom: 18 }}>
            Open a cashier shift first before withdrawing cash from the drawer.
          </div>
        )}

        <div style={{ display: 'grid', gap: 14 }}>
          <label style={{ display: 'grid', gap: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 900, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.8 }}>Amount (PHP)</span>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="0.00"
              disabled={loading || !shift?.id}
              style={{ width: '100%', padding: '16px 18px', background: 'var(--bg-image)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-lg)', color: 'var(--text-strong)', fontSize: 28, fontWeight: 900, letterSpacing: -0.5 }}
            />
          </label>

          <label style={{ display: 'grid', gap: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 900, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.8 }}>Reason / Purpose</span>
            <textarea
              rows={3}
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Example: Ice delivery, drinking water, emergency supplies"
              disabled={loading || !shift?.id}
              style={{ width: '100%', resize: 'none', padding: 14, background: 'var(--bg-image)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-lg)', color: 'var(--text-strong)', fontSize: 15, fontWeight: 650, lineHeight: 1.45 }}
            />
          </label>
        </div>

        {error && (
          <div style={{ marginTop: 14, color: 'var(--red)', fontSize: 13, fontWeight: 800 }}>
            {error}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.45fr', gap: 10, marginTop: 20 }}>
          <button onClick={onClose} disabled={loading} style={{ padding: '14px 12px', background: 'var(--bg-image)', color: 'var(--text-muted)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', fontSize: 14, fontWeight: 800 }}>
            Cancel
          </button>
          <button onClick={submit} disabled={!canSubmit} style={{ padding: '14px 12px', background: canSubmit ? 'var(--red)' : 'var(--bg-image)', color: canSubmit ? 'white' : 'var(--text-muted)', borderRadius: 'var(--radius-md)', fontSize: 14, fontWeight: 900, opacity: canSubmit ? 1 : 0.65 }}>
            {loading ? 'Recording...' : 'Record Withdrawal'}
          </button>
        </div>
      </div>
    </div>
  )
}

function NavButton({ icon, label, active, onClick }) {
  return (
    <button onClick={onClick} className={`pos-nav-item ${active ? 'active' : ''}`}>
      <div className="pos-nav-icon">{icon}</div>
      <div className="pos-nav-label">{label}</div>
    </button>
  )
}

function ProductCard({ product, cartQty = 0, onAdd, onReduce }) {
  const unavailable = !product.is_available
  const { Icon, desc } = getProductDetail(product.name)
  const displayDescription = product.description || desc
  const isBestSeller = product.name === 'Classic Burger'

  return (
    <div
      onClick={unavailable ? undefined : onAdd}
      style={{
        background: 'var(--bg-panel)',
        border: `1px solid ${cartQty > 0 ? 'var(--text-strong)' : 'var(--border-card)'}`,
        borderRadius: 'var(--radius-xl)',
        padding: '24px',
        textAlign: 'left',
        cursor: unavailable ? 'not-allowed' : 'pointer',
        display: 'flex', flexDirection: 'column',
        position: 'relative',
        boxShadow: cartQty > 0 ? '0 8px 24px rgba(0,0,0,0.06)' : 'var(--shadow-sm)',
        minHeight: 280,
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        opacity: unavailable ? 0.4 : 1,
        transform: cartQty > 0 ? 'translateY(-2px)' : 'none',
        overflow: 'visible'
      }}
      className={`premium-card-lift product-card ${cartQty > 0 ? 'selected' : ''} ${unavailable ? 'unavailable' : ''}`}
    >
      {isBestSeller && (
        <div style={{ position: 'absolute', top: 16, left: 16, background: 'var(--gold-light)', color: '#b45309', padding: '4px 10px', borderRadius: 'var(--radius-sm)', fontSize: 9, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 0.5, zIndex: 2 }}>
          Popular
        </div>
      )}
      {product.is_combo && !isBestSeller && (
        <div style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(0,0,0,0.04)', color: 'var(--text-strong)', padding: '4px 10px', borderRadius: 'var(--radius-sm)', fontSize: 9, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 1, zIndex: 2 }}>
          Combo
        </div>
      )}
      {unavailable && (
        <div className="product-card-unavailable-badge">
          Unavailable
        </div>
      )}

      {/* Symmetric Icon Container */}
      <div className="product-card-visual" style={{ 
        width: '100%', height: 100, background: 'var(--bg-image)', 
        borderRadius: 'var(--radius-lg)', display: 'flex', alignItems: 'center', 
        justifyContent: 'center', marginBottom: 20, position: 'relative',
        transition: 'all 0.3s'
      }}>
        {product.image_url ? (
          <img src={product.image_url} alt="" className="product-card-image" />
        ) : (
          <Icon size={44} color="var(--text-muted)" sw={1.5} />
        )}
        {cartQty > 0 && (
          <div style={{ 
            position: 'absolute', top: 10, right: 10, background: 'var(--text-strong)', 
            color: 'white', minWidth: 32, height: 32, padding: '0 8px', 
            borderRadius: '50%', display: 'flex', alignItems: 'center', 
            justifyContent: 'center', fontSize: 13, fontWeight: 900, 
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)', border: '3px solid var(--bg-panel)',
            zIndex: 10
          }}>
            {cartQty}
          </div>
        )}
      </div>

      <div className="product-card-name" style={{ fontSize: 16, fontWeight: 900, color: 'var(--text-strong)', lineHeight: 1.2, marginBottom: 6, letterSpacing: -0.3 }}>{product.name}</div>
      <div className="product-card-desc" style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500, lineHeight: 1.4, flex: 1, minHeight: 36 }}>{displayDescription}</div>
      
      <div className="product-card-footer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginTop: 20 }}>
        <div className="product-card-price" style={{ fontSize: 18, fontWeight: 900, color: 'var(--text-strong)', letterSpacing: -0.5 }}>
          ₱{parseFloat(product.price).toFixed(0)}
        </div>
        
        {/* Boutique Stepper Pill */}
        {unavailable ? (
          <div className="product-card-unavailable-control">
            Unavailable
          </div>
        ) : cartQty > 0 ? (
          <div className="product-card-stepper" onClick={e => e.stopPropagation()} style={{ 
            display: 'flex', alignItems: 'center', background: 'var(--dark)', 
            borderRadius: 'var(--radius-pill)', overflow: 'hidden', 
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)' 
          }}>
            <button className="product-card-stepper-button" onClick={onReduce} style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.6)', cursor: 'pointer' }}>
              <IconMinus size={14} />
            </button>
            <div className="product-card-stepper-value" style={{ width: 24, textAlign: 'center', color: 'white', fontSize: 13, fontWeight: 900 }}>{cartQty}</div>
            <button className="product-card-stepper-button" onClick={onAdd} style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', cursor: 'pointer' }}>
              <IconPlus size={14} />
            </button>
          </div>
        ) : (
          <div style={{ 
            width: 36, height: 36, borderRadius: '50%', background: 'var(--bg-app)', 
            border: '1px solid var(--border-light)', display: 'flex', 
            alignItems: 'center', justifyContent: 'center', color: 'var(--text-strong)', 
            transition: 'all 0.2s'
          }}>
            <IconPlus size={16} />
          </div>
        )}
      </div>
    </div>
  )
}
