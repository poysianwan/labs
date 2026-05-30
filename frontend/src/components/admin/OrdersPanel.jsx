import { useState, useEffect } from 'react'
import { api } from '../../utils/apiClient.js'
import { useAuthStore } from '../../stores/authStore.js'
import { IconX, IconPrinter } from '../ui/Icons.jsx'
import { printReceipt, printReceiptBrowser } from '../../utils/printer.js'
import { localDateInputValue } from '../../utils/date.js'
import { getRecentOrders } from '../../db/index.js'

const normalizeLocalOrder = (order, user) => {
  const total = (order.items || []).reduce((sum, item) => sum + (Number(item.unit_price) * Number(item.quantity)), 0)
  const paymentMethod = order.payments?.length > 1 ? 'split' : order.payments?.[0]?.method || 'cash'

  return {
    id: order.id,
    order_number: order.order_number || `LB-${String(new Date(order.created_at).getTime()).slice(-4)}`,
    status: 'completed',
    dining_type: order.dining_type || 'takeout',
    total,
    created_at: order.created_at,
    cashier: user?.name || 'Cashier',
    payment_method: paymentMethod,
    isLocal: true
  }
}

function OrderDetailsModal({ orderId, onClose }) {
  const [order, setOrder] = useState(null)
  const [loading, setLoading] = useState(true)
  const [printing, setPrinting] = useState(false)

  useEffect(() => {
    const load = async () => {
      try { const data = await api.getOrder(orderId); setOrder(data) }
      catch { setOrder(null) }
      finally { setLoading(false) }
    }
    load()
  }, [orderId])

  const handlePrint = async () => {
    setPrinting(true)
    const printData = {
      ...order,
      total: Number(order.total),
      subtotal: Number(order.subtotal),
      change_given: Number(order.change_given),
      payment: {
        method: order.method,
        amount: Number(order.paid),
        change_given: Number(order.change_given),
        reference_note: order.reference_note
      },
      items: order.items.map(i => ({ 
        ...i, 
        name: i.product_name,
        unit_price: Number(i.unit_price),
        quantity: Number(i.quantity)
      }))
    }
    const success = await printReceipt(printData)
    if (!success) {
      // Fallback to browser print if service is unavailable
      printReceiptBrowser(printData)
    }
    setPrinting(false)
  }

  if (loading) return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(246,247,251,0.7)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300 }}>
      <div style={{ background: 'var(--bg-panel)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-xl)', padding: 32, width: 400, boxShadow: 'var(--shadow-lg)', textAlign: 'center' }}>
        <div style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Loading order details...</div>
      </div>
    </div>
  )

  if (!order) return null

  const isVoided = order.status === 'voided'

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(246,247,251,0.7)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300 }}>
      <div style={{ background: 'var(--bg-panel)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-xl)', padding: 32, width: 440, maxHeight: '90vh', overflowY: 'auto', boxShadow: 'var(--shadow-lg)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <div style={{ padding: '6px 12px', background: 'var(--bg-image)', borderRadius: 'var(--radius-sm)', fontWeight: 800, color: 'var(--text-strong)', border: '1px solid var(--border-light)' }}>{order.order_number}</div>
              {isVoided && <div style={{ padding: '4px 10px', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--red)', borderRadius: 'var(--radius- pill)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>Voided</div>}
            </div>
            <div style={{ fontSize: 14, color: 'var(--text-muted)', fontWeight: 500 }}>{new Date(order.created_at).toLocaleString('en-PH')}</div>
          </div>
          <button onClick={onClose} style={{ background: 'var(--bg-image)', color: 'var(--text-muted)', width: 32, height: 32, borderRadius: '50%', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><IconX size={14} /></button>
        </div>

        {isVoided && order.void_reason && (
          <div style={{ marginBottom: 20, padding: 14, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.18)', borderRadius: 'var(--radius-lg)' }}>
            <div style={{ fontSize: 11, color: 'var(--red)', fontWeight: 900, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Void reason</div>
            <div style={{ fontSize: 14, color: 'var(--text-strong)', fontWeight: 700, lineHeight: 1.4 }}>{order.void_reason}</div>
          </div>
        )}

        <div style={{ borderBottom: '1px dashed var(--border-light)', paddingBottom: 20, marginBottom: 20 }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>Items Ordered</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {order.items.map((item, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-strong)' }}>{item.product_name} x{item.quantity}</div>
                  {item.notes && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Note: {item.notes}</div>}
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-strong)' }}>₱{(item.unit_price * item.quantity).toFixed(2)}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 500, color: 'var(--text-muted)' }}>
            <span>Subtotal</span>
            <span>₱{parseFloat(order.subtotal).toFixed(2)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 20, fontWeight: 900, color: 'var(--text-strong)', marginTop: 4 }}>
            <span>Total</span>
            <span>₱{parseFloat(order.total).toFixed(2)}</span>
          </div>
        </div>

        <div style={{ marginTop: 24, padding: 16, background: 'var(--bg-image)', borderRadius: 'var(--radius-lg)' }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>Transaction Details</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 600 }}>
              <span style={{ color: 'var(--text-muted)' }}>Processed by</span>
              <span style={{ color: 'var(--text-strong)' }}>{order.cashier_name || order.cashier || 'System'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 600 }}>
              <span style={{ color: 'var(--text-muted)' }}>Payment</span>
              <span style={{ color: 'var(--text-strong)', textTransform: 'uppercase' }}>{order.method}</span>
            </div>
            {order.method === 'cash' && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 600 }}>
                <span style={{ color: 'var(--text-muted)' }}>Tendered</span>
                <span style={{ color: 'var(--text-strong)' }}>₱{parseFloat(order.paid).toFixed(2)}</span>
              </div>
            )}
            {order.change_given > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 600 }}>
                <span style={{ color: 'var(--text-muted)' }}>Change Given</span>
                <span style={{ color: 'var(--text-strong)' }}>₱{parseFloat(order.change_given).toFixed(2)}</span>
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
          <button onClick={handlePrint} disabled={printing}
            style={{ flex: 1, padding: '14px', background: 'var(--bg-image)', color: 'var(--text-strong)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <IconPrinter size={18} />
            {printing ? 'Printing...' : 'Print Receipt'}
          </button>
          <button onClick={onClose} style={{ flex: 1, padding: '14px', background: 'var(--text-strong)', color: 'var(--bg-panel)', border: 'none', borderRadius: 'var(--radius-md)', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Close Details</button>
        </div>
      </div>
    </div>
  )
}

function VoidOrderModal({ order, onCancel, onConfirm }) {
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const quickReasons = ['Customer cancelled', 'Wrong order', 'Duplicate order', 'Payment issue']

  const submit = async () => {
    const trimmedReason = reason.trim()
    if (!trimmedReason || loading) return

    setLoading(true)
    setError('')
    try {
      await onConfirm(order.id, trimmedReason)
    } catch (err) {
      setError(err.message || 'Failed to void order')
      setLoading(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(17,17,17,0.42)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 400, padding: 'max(16px, env(safe-area-inset-top)) max(16px, env(safe-area-inset-right)) max(16px, env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left))' }}>
      <div style={{ width: 'min(100%, 420px)', background: 'var(--bg-panel)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-xl)', boxShadow: '0 20px 60px rgba(0,0,0,0.18)', padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', marginBottom: 18 }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--text-strong)', letterSpacing: -0.4 }}>Void order?</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, color: 'var(--text-muted)', fontSize: 13, fontWeight: 600 }}>
              <span style={{ color: 'var(--text-strong)', background: 'var(--bg-image)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', padding: '4px 8px', fontFamily: 'monospace', fontWeight: 900 }}>{order.order_number}</span>
              <span>will be marked voided</span>
            </div>
          </div>
          <button onClick={onCancel} disabled={loading} style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--bg-image)', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <IconX size={15} />
          </button>
        </div>

        <div style={{ padding: 14, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.16)', borderRadius: 'var(--radius-lg)', color: '#b91c1c', fontSize: 13, lineHeight: 1.45, fontWeight: 600, marginBottom: 18 }}>
          Voiding restores stock for this order and records the reason in the system.
        </div>

        <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>Reason</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
          {quickReasons.map(item => (
            <button
              key={item}
              type="button"
              onClick={() => setReason(item)}
              disabled={loading}
              style={{
                padding: '8px 12px',
                borderRadius: 'var(--radius-pill)',
                background: reason === item ? 'var(--text-strong)' : 'var(--bg-image)',
                color: reason === item ? 'var(--bg-panel)' : 'var(--text-muted)',
                border: `1px solid ${reason === item ? 'var(--text-strong)' : 'var(--border-light)'}`,
                fontSize: 12,
                fontWeight: 800
              }}
            >
              {item}
            </button>
          ))}
        </div>

        <textarea
          value={reason}
          onChange={e => setReason(e.target.value)}
          placeholder="Enter void reason"
          rows={4}
          disabled={loading}
          autoFocus
          style={{ width: '100%', resize: 'none', background: 'var(--bg-image)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-lg)', padding: 14, color: 'var(--text-strong)', fontSize: 16, fontWeight: 600, lineHeight: 1.4, marginBottom: error ? 10 : 18 }}
        />

        {error && (
          <div style={{ color: 'var(--red)', fontSize: 13, fontWeight: 700, marginBottom: 14 }}>
            {error}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 10 }}>
          <button onClick={onCancel} disabled={loading} style={{ padding: '14px 12px', background: 'var(--bg-image)', color: 'var(--text-muted)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', fontSize: 14, fontWeight: 800 }}>
            Cancel
          </button>
          <button onClick={submit} disabled={!reason.trim() || loading} style={{ padding: '14px 12px', background: reason.trim() ? 'var(--red)' : 'var(--bg-image)', color: reason.trim() ? 'white' : 'var(--text-muted)', borderRadius: 'var(--radius-md)', fontSize: 14, fontWeight: 900 }}>
            {loading ? 'Voiding...' : 'Confirm Void'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function OrdersPanel() {
  const { isAdmin, user } = useAuthStore()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [date, setDate] = useState(localDateInputValue())
  const [error, setError] = useState('')
  const [viewingOrder, setViewingOrder] = useState(null)
  const [voidingOrder, setVoidingOrder] = useState(null)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const [remoteOrders, localOrders] = await Promise.all([
          api.getOrders({ date }),
          getRecentOrders(100)
        ])
        const unsyncedLocal = localOrders
          .filter(order => !order.synced && localDateInputValue(new Date(order.created_at)) === date)
          .map(order => normalizeLocalOrder(order, user))
        const remoteIds = new Set(remoteOrders.map(order => order.id))
        setOrders([
          ...unsyncedLocal.filter(order => !remoteIds.has(order.id)),
          ...remoteOrders
        ])
      }
      catch (err) {
        const localOrders = await getRecentOrders(100)
        const unsyncedLocal = localOrders
          .filter(order => !order.synced && localDateInputValue(new Date(order.created_at)) === date)
          .map(order => normalizeLocalOrder(order, user))
        setOrders(unsyncedLocal)
        setError(err.status === 401 ? 'Session expired. Log out and sign in again on localhost.' : '')
      }
      finally { setLoading(false) }
    }
    load()
  }, [date, user])

  const handleVoid = async (id, reason) => {
    await api.voidOrder(id, reason)
    setOrders(o => o.map(x => x.id === id ? { ...x, status: 'voided', void_reason: reason } : x))
    setVoidingOrder(null)
  }

  return (
    <div className="admin-pad">
      <div className="admin-header-row">
        <h2 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-strong)', margin: 0, letterSpacing: -0.5 }}>Daily Orders</h2>
        <input type="date" value={date} onChange={e => setDate(e.target.value)}
          style={{ background: 'var(--bg-panel)', border: '1px solid var(--border-light)', color: 'var(--text-strong)', padding: '10px 16px', borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 600, boxShadow: 'var(--shadow-sm)', flexShrink: 0 }} />
      </div>

      {loading ? <div style={{ color: 'var(--text-muted)', fontWeight: 500 }}>Loading transactions...</div> : (
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, paddingRight: 4 }}>
          {error && (
            <div style={{ color: 'var(--red)', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.18)', borderRadius: 'var(--radius-md)', padding: '12px 14px', marginBottom: 16, fontSize: 13, fontWeight: 700 }}>
              Could not load orders: {error}
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 380px), 1fr))', gap: 16, paddingBottom: 24 }}>
          {orders.filter(o => isAdmin() || o.status !== 'voided').map(order => {
            const isVoided = order.status === 'voided'
            const time = new Date(order.created_at).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
            
            return (
              <div key={order.id} style={{ 
                background: 'var(--bg-panel)', 
                border: `1px solid ${isVoided ? 'rgba(239, 68, 68, 0.2)' : 'var(--border-card)'}`, 
                borderRadius: 'var(--radius-xl)', 
                padding: '24px', 
                display: 'flex', 
                flexDirection: 'column', 
                gap: 16, 
                boxShadow: isVoided ? 'none' : 'var(--shadow-sm)', 
                transition: 'all 0.2s',
                opacity: isVoided ? 0.8 : 1,
                position: 'relative',
                overflow: 'hidden'
              }}>
                {isVoided && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: 'var(--red)' }} />}
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                    <div style={{ 
                      fontSize: 14, fontWeight: 900, color: 'var(--text-strong)', 
                      background: 'var(--bg-image)', padding: '8px 14px', borderRadius: 'var(--radius-md)', 
                      border: '1px solid var(--border-light)', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.05)',
                      fontFamily: 'monospace'
                    }}>
                      {order.order_number}
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ color: 'var(--text-strong)' }}>{order.cashier}</span>
                        <span style={{ opacity: 0.3 }}>•</span>
                        <span>{order.dining_type.replace('_', ' ')}</span>
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500, marginTop: 4 }}>{time}</div>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 20, fontWeight: 900, color: isVoided ? 'var(--text-muted)' : 'var(--text-strong)', letterSpacing: -0.5 }}>₱{parseFloat(order.total).toFixed(2)}</div>
                    <div style={{ 
                      fontSize: 10, fontWeight: 800, 
                      color: isVoided ? 'var(--text-muted)' : (order.payment_method === 'gcash' ? '#0284c7' : 'var(--green)'), 
                      marginTop: 6, textTransform: 'uppercase', letterSpacing: 0.5,
                      background: isVoided ? 'var(--bg-image)' : (order.payment_method === 'gcash' ? 'rgba(2,132,199,0.08)' : 'rgba(34,197,94,0.08)'),
                      padding: '4px 8px', borderRadius: 4, display: 'inline-block'
                    }}>
                      {order.payment_method}
                    </div>
                  </div>
                </div>

                {isVoided && order.void_reason && (
                  <div style={{ padding: '12px 14px', background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.16)', borderRadius: 'var(--radius-md)' }}>
                    <div style={{ fontSize: 10, color: 'var(--red)', fontWeight: 900, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 5 }}>Void reason</div>
                    <div style={{ fontSize: 13, color: 'var(--text-strong)', fontWeight: 700, lineHeight: 1.4 }}>{order.void_reason}</div>
                  </div>
                )}

                <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                  <button onClick={() => setViewingOrder(order.id)}
                    disabled={order.isLocal}
                    style={{ flex: 1, padding: '10px', background: 'var(--bg-image)', color: 'var(--text-strong)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s' }}>
                    View Details
                  </button>
                  {!isVoided ? (
                    <button onClick={() => setVoidingOrder(order)}
                      style={{ padding: '10px 16px', background: 'transparent', color: 'var(--red)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: 0.8 }}>
                      Void
                    </button>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', px: '12px', fontSize: 12, fontWeight: 700, color: 'var(--red)', textTransform: 'uppercase' }}>Voided</div>
                  )}
                </div>
              </div>
            )
          })}
          {orders.length === 0 && <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 14, fontWeight: 500, padding: 40, background: 'var(--bg-panel)', borderRadius: 'var(--radius-lg)', border: '1px dashed var(--border-light)', gridColumn: '1 / -1' }}>No matching orders for this date.</div>}
        </div>
      </div>
    )}

      {viewingOrder && <OrderDetailsModal orderId={viewingOrder} onClose={() => setViewingOrder(null)} />}
      {voidingOrder && <VoidOrderModal order={voidingOrder} onCancel={() => setVoidingOrder(null)} onConfirm={handleVoid} />}
    </div>
  )
}
