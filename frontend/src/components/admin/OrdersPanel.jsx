import { useState, useEffect } from 'react'
import { api } from '../../utils/apiClient.js'
import { useAuthStore } from '../../stores/authStore.js'
import { IconX, IconPrinter } from '../ui/Icons.jsx'
import { printReceipt, printReceiptBrowser } from '../../utils/printer.js'

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

export default function OrdersPanel() {
  const { isAdmin } = useAuthStore()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [viewingOrder, setViewingOrder] = useState(null)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try { const data = await api.getOrders({ date }); setOrders(data) }
      catch { setOrders([]) }
      finally { setLoading(false) }
    }
    load()
  }, [date])

  const handleVoid = async (id) => {
    const reason = prompt('Void reason:')
    if (!reason) return
    try {
      await api.voidOrder(id, reason)
      setOrders(o => o.map(x => x.id === id ? { ...x, status: 'voided' } : x))
    } catch (e) { alert('Failed to void: ' + e.message) }
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

                <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                  <button onClick={() => setViewingOrder(order.id)}
                    style={{ flex: 1, padding: '10px', background: 'var(--bg-image)', color: 'var(--text-strong)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s' }}>
                    View Details
                  </button>
                  {!isVoided ? (
                    <button onClick={() => handleVoid(order.id)}
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
    </div>
  )
}
