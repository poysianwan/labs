import { useState, useEffect, useCallback } from 'react'
import { api } from '../../utils/apiClient.js'
import { localDateInputValue } from '../../utils/date.js'
import { cacheDailyOrders, getCachedDailyOrders, getRecentOrders } from '../../db/index.js'

const normalizeLocalOrder = (order) => {
  const total = (order.items || []).reduce((sum, item) => sum + (Number(item.unit_price) * Number(item.quantity)), 0)
  const paymentMethod = order.payments?.length > 1 ? 'split' : order.payments?.[0]?.method || 'cash'

  return {
    id: order.id,
    order_number: order.order_number || `LB-${String(new Date(order.created_at).getTime()).slice(-4)}`,
    status: 'completed',
    dining_type: order.dining_type || 'takeout',
    total,
    created_at: order.created_at,
    cashier: order.cashier || 'Cashier',
    payment_method: paymentMethod,
    isLocal: true
  }
}

const fmt = (n) => `₱${Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`

function OrderRow({ order, onVoid }) {
  const [expanded, setExpanded] = useState(false)
  const [items, setItems] = useState(null)
  const [loadingItems, setLoadingItems] = useState(false)

  const loadItems = async () => {
    if (items) { setExpanded(e => !e); return }
    setLoadingItems(true)
    try {
      const detail = await api.getOrder(order.id)
      setItems(detail.items || [])
      setExpanded(true)
    } catch { setItems([]) }
    finally { setLoadingItems(false) }
  }

  const isVoided = order.status === 'voided'

  return (
    <div style={{
      border: `1px solid ${isVoided ? '#1f1f1f' : '#252525'}`,
      borderRadius: 10, marginBottom: 8, overflow: 'hidden',
      opacity: isVoided ? 0.5 : 1
    }}>
      {/* Row header */}
      <div
        onClick={loadItems}
        style={{
          display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px',
          background: '#141414', cursor: 'pointer', userSelect: 'none'
        }}
      >
        <div style={{ fontWeight: 700, fontSize: 13, color: '#CC0000', minWidth: 72 }}>{order.order_number}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: isVoided ? '#444' : '#fff' }}>
            {order.dining_type === 'dine_in' ? 'Dine In' : 'Takeout'}
            {isVoided && <span style={{ marginLeft: 8, fontSize: 10, background: '#2a1a1a', color: '#665', padding: '1px 6px', borderRadius: 4, fontWeight: 700 }}>VOIDED</span>}
          </div>
          <div style={{ fontSize: 11, color: '#444' }}>
            {order.cashier} · {new Date(order.created_at).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
        <div style={{
          fontSize: 11, padding: '3px 8px', borderRadius: 12,
          background: order.payment_method === 'gcash' ? 'rgba(103,232,249,0.1)' : 'rgba(134,239,172,0.1)',
          color: order.payment_method === 'gcash' ? '#67e8f9' : '#86efac',
          border: `1px solid ${order.payment_method === 'gcash' ? 'rgba(103,232,249,0.2)' : 'rgba(134,239,172,0.2)'}`,
          textTransform: 'uppercase', fontWeight: 700, letterSpacing: 0.5
        }}>{order.payment_method}</div>
        <div style={{ fontWeight: 700, fontSize: 15, color: isVoided ? '#333' : '#FFD700', minWidth: 80, textAlign: 'right' }}>
          {fmt(order.total)}
        </div>
        {!isVoided && (
          <button
            onClick={(e) => { e.stopPropagation(); onVoid(order) }}
            style={{ fontSize: 11, color: '#555', background: 'none', border: '1px solid #2a2a2a', borderRadius: 6, padding: '4px 10px', marginLeft: 4, flexShrink: 0 }}
          >Void</button>
        )}
        <div style={{ color: '#333', fontSize: 14, transition: 'transform 0.15s', transform: expanded ? 'rotate(90deg)' : 'none' }}>›</div>
      </div>

      {/* Expanded items */}
      {expanded && (
        <div style={{ background: '#0f0f0f', padding: '12px 16px', borderTop: '1px solid #1e1e1e' }}>
          {loadingItems && <div style={{ color: '#444', fontSize: 13 }}>Loading...</div>}
          {items && items.map(item => (
            <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: 13, borderBottom: '1px solid #1a1a1a' }}>
              <div style={{ color: '#888' }}>
                <span style={{ color: '#fff', fontWeight: 600 }}>{item.quantity}×</span> {item.product_name}
                {item.notes && <span style={{ color: '#555', fontStyle: 'italic' }}> · {item.notes}</span>}
              </div>
              <div style={{ color: '#666' }}>{fmt(item.unit_price * item.quantity)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function VoidModal({ order, onConfirm, onCancel }) {
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)

  const QUICK_REASONS = ['Customer cancelled', 'Wrong order', 'Duplicate order', 'Test order']

  const handleVoid = async () => {
    if (!reason.trim()) return
    setLoading(true)
    try { await onConfirm(order.id, reason) }
    finally { setLoading(false) }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300 }}>
      <div style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 16, padding: 28, width: 380 }}>
        <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 4 }}>Void Order {order.order_number}</div>
        <div style={{ fontSize: 13, color: '#555', marginBottom: 20 }}>
          This will restore stock for all ingredients. This action cannot be undone.
        </div>

        {/* Quick reasons */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
          {QUICK_REASONS.map(r => (
            <button key={r} onClick={() => setReason(r)} style={{
              fontSize: 12, padding: '5px 12px', borderRadius: 20,
              background: reason === r ? 'rgba(204,0,0,0.2)' : '#252525',
              color: reason === r ? '#fca5a5' : '#666',
              border: `1px solid ${reason === r ? 'rgba(204,0,0,0.4)' : '#2a2a2a'}`,
            }}>{r}</button>
          ))}
        </div>

        <input
          value={reason} onChange={e => setReason(e.target.value)}
          placeholder="Or type a reason..."
          style={{ width: '100%', background: '#111', border: '1px solid #333', borderRadius: 10, padding: '12px 14px', color: '#fff', fontSize: 14, marginBottom: 20 }}
        />

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onCancel} style={{ flex: 1, padding: '12px 0', background: 'transparent', color: '#666', border: '1px solid #333', borderRadius: 10, fontSize: 14 }}>Cancel</button>
          <button onClick={handleVoid} disabled={!reason.trim() || loading}
            style={{ flex: 2, padding: '12px 0', background: reason.trim() ? '#CC0000' : '#252525', color: reason.trim() ? '#fff' : '#444', borderRadius: 10, fontSize: 14, fontWeight: 700, opacity: loading ? 0.7 : 1 }}>
            {loading ? 'Voiding...' : 'Confirm Void'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function OrdersPanel() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [date, setDate] = useState(localDateInputValue())
  const [error, setError] = useState('')
  const [voidTarget, setVoidTarget] = useState(null)
  const [filter, setFilter] = useState('all') // all | cash | gcash | voided

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [remoteOrders, localOrders] = await Promise.all([
        api.getOrders({ date }),
        getRecentOrders(100)
      ])
      await cacheDailyOrders(date, remoteOrders)
      const unsyncedLocal = localOrders
        .filter(order => !order.synced && localDateInputValue(new Date(order.created_at)) === date)
        .map(normalizeLocalOrder)
      const remoteIds = new Set(remoteOrders.map(order => order.id))
      setOrders([
        ...unsyncedLocal.filter(order => !remoteIds.has(order.id)),
        ...remoteOrders
      ])
    } catch (err) {
      console.error(err)
      const [cachedOrders, localOrders] = await Promise.all([
        getCachedDailyOrders(date),
        getRecentOrders(100)
      ])
      const unsyncedLocal = localOrders
        .filter(order => !order.synced && localDateInputValue(new Date(order.created_at)) === date)
        .map(normalizeLocalOrder)
      const cachedIds = new Set(cachedOrders.map(order => order.id))
      setOrders([
        ...unsyncedLocal.filter(order => !cachedIds.has(order.id)),
        ...cachedOrders
      ])
      setError(err.status === 401 ? 'Session expired. Log out and sign in again on localhost.' : '')
    }
    finally { setLoading(false) }
  }, [date])

  useEffect(() => { load() }, [load])

  const handleVoid = async (orderId, reason) => {
    await api.voidOrder(orderId, reason)
    setVoidTarget(null)
    await load()
  }

  const filtered = orders.filter(o => {
    if (filter === 'cash') return o.payment_method === 'cash' && o.status !== 'voided'
    if (filter === 'gcash') return o.payment_method === 'gcash' && o.status !== 'voided'
    if (filter === 'voided') return o.status === 'voided'
    return true
  })

  const totals = orders.reduce((acc, o) => {
    if (o.status === 'voided') return acc
    acc.total += Number(o.total)
    if (o.payment_method === 'cash') acc.cash += Number(o.total)
    if (o.payment_method === 'gcash') acc.gcash += Number(o.total)
    acc.count++
    return acc
  }, { total: 0, cash: 0, gcash: 0, count: 0 })

  return (
    <div style={{ padding: 24, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexShrink: 0 }}>
        <div style={{ fontFamily: "'Bebas Neue', cursive", fontSize: 28, letterSpacing: 3 }}>ORDERS</div>
        <input type="date" value={date} onChange={e => setDate(e.target.value)}
          style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 8, padding: '8px 12px', color: '#fff', fontSize: 14 }} />
        <button onClick={load} style={{ padding: '8px 14px', background: '#252525', color: '#888', borderRadius: 8, fontSize: 13, border: '1px solid #2a2a2a' }}>Refresh</button>
      </div>

      {/* Summary strip */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexShrink: 0 }}>
        {[
          { label: 'Orders', value: totals.count, color: '#fff' },
          { label: 'Revenue', value: fmt(totals.total), color: '#FFD700' },
          { label: 'Cash', value: fmt(totals.cash), color: '#86efac' },
          { label: 'GCash', value: fmt(totals.gcash), color: '#67e8f9' },
        ].map(s => (
          <div key={s.label} style={{ background: '#141414', border: '1px solid #1e1e1e', borderRadius: 10, padding: '10px 16px', flex: 1 }}>
            <div style={{ fontSize: 10, color: '#444', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontFamily: "'Bebas Neue', cursive", fontSize: 22, color: s.color, letterSpacing: 1 }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Filter pills */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexShrink: 0 }}>
        {[['all', 'All'], ['cash', 'Cash'], ['gcash', 'GCash'], ['voided', 'Voided']].map(([id, label]) => (
          <button key={id} onClick={() => setFilter(id)} style={{
            padding: '6px 16px', borderRadius: 20, fontSize: 12, fontWeight: 600,
            background: filter === id ? '#CC0000' : '#1a1a1a',
            color: filter === id ? '#fff' : '#555',
            border: `1px solid ${filter === id ? '#CC0000' : '#252525'}`, transition: 'all 0.12s'
          }}>{label}</button>
        ))}
      </div>

      {/* Orders list */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading && <div style={{ color: '#444', fontSize: 14, padding: 20 }}>Loading orders...</div>}
        {!loading && error && (
          <div style={{ color: '#fca5a5', background: 'rgba(204,0,0,0.12)', border: '1px solid rgba(204,0,0,0.25)', borderRadius: 10, padding: 14, marginBottom: 12, fontSize: 13, fontWeight: 600 }}>
            Could not load orders: {error}
          </div>
        )}
        {!loading && filtered.length === 0 && (
          <div style={{ textAlign: 'center', color: '#333', padding: 48 }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🧾</div>
            <div style={{ fontSize: 14 }}>No orders for this date</div>
          </div>
        )}
        {!loading && filtered.map(order => (
          <OrderRow key={order.id} order={order} onVoid={setVoidTarget} />
        ))}
      </div>

      {voidTarget && (
        <VoidModal order={voidTarget} onConfirm={handleVoid} onCancel={() => setVoidTarget(null)} />
      )}
    </div>
  )
}
