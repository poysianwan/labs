import { useState, useEffect } from 'react'
import { api } from '../../utils/api.js'
import { useAuthStore } from '../../stores/authStore.js'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

function InventoryTab({ token }) {
  const [ingredients, setIngredients] = useState([])
  const [restocking, setRestocking] = useState(null)
  const [restockQty, setRestockQty] = useState('')
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try { setIngredients(await api.inventory.ingredients(token)) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const handleRestock = async (ing) => {
    const qty = parseFloat(restockQty)
    if (!qty || qty <= 0) return
    try {
      await api.inventory.restock(ing.id, qty, 'manual restock', token)
      setRestocking(null); setRestockQty('')
      load()
    } catch (err) { alert('Restock failed: ' + err.message) }
  }

  if (loading) return <div style={{ padding: 32, color: 'var(--gray)' }}>Loading inventory...</div>

  return (
    <div style={{ padding: 24 }}>
      <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 20, fontFamily: 'var(--font-display)', letterSpacing: 2 }}>
        STOCK LEVELS
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {ingredients.map(ing => (
          <div key={ing.id} style={{
            background: 'var(--black-card)', border: `1px solid ${ing.is_low ? 'rgba(204,0,0,0.5)' : 'var(--black-border)'}`,
            borderRadius: 'var(--radius-sm)', padding: '14px 18px',
            display: 'flex', alignItems: 'center', gap: 16
          }}>
            {ing.is_low && (
              <div style={{
                width: 8, height: 8, borderRadius: '50%',
                background: 'var(--red)', flexShrink: 0,
                boxShadow: '0 0 6px var(--red)'
              }} />
            )}
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 15 }}>{ing.name}</div>
              <div style={{ fontSize: 12, color: ing.is_low ? '#ff6b6b' : 'var(--gray)' }}>
                {ing.is_low ? `LOW — ` : ''}{Number(ing.current_stock).toFixed(0)} {ing.unit} remaining
              </div>
            </div>
            {/* Stock bar */}
            <div style={{ width: 120, height: 6, background: 'var(--black-border)', borderRadius: 3 }}>
              <div style={{
                height: '100%', borderRadius: 3,
                width: `${Math.min(100, (ing.current_stock / (ing.low_stock_alert * 3)) * 100)}%`,
                background: ing.is_low ? 'var(--red)' : 'var(--green)',
                transition: 'width 0.3s'
              }} />
            </div>
            <button
              onClick={() => { setRestocking(ing); setRestockQty('') }}
              style={{
                padding: '8px 16px', background: 'var(--red)', color: 'var(--white)',
                borderRadius: 8, fontSize: 13, fontWeight: 600
              }}>+ Restock</button>
          </div>
        ))}
      </div>

      {/* Restock modal */}
      {restocking && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200
        }}>
          <div style={{
            background: 'var(--black-card)', border: '1px solid var(--black-border)',
            borderRadius: 'var(--radius)', padding: 32, width: 320
          }}>
            <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 8 }}>Restock {restocking.name}</div>
            <div style={{ color: 'var(--gray)', fontSize: 13, marginBottom: 20 }}>
              Current: {Number(restocking.current_stock).toFixed(0)} {restocking.unit}
            </div>
            <input
              type="number" value={restockQty} onChange={e => setRestockQty(e.target.value)}
              placeholder={`Quantity (${restocking.unit})`}
              autoFocus
              style={{
                width: '100%', background: 'var(--black)', border: '1px solid var(--black-border)',
                borderRadius: 8, padding: '12px 16px', color: 'var(--white)', fontSize: 16,
                marginBottom: 16
              }}
            />
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => setRestocking(null)} className="btn-ghost" style={{ flex: 1 }}>Cancel</button>
              <button onClick={() => handleRestock(restocking)} className="btn-primary" style={{ flex: 1 }}>
                Add Stock
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ReportsTab({ token }) {
  const [data, setData] = useState(null)
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [loading, setLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    try { setData(await api.reports.sales({ from: date, to: date }, token)) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [date])

  return (
    <div style={{ padding: 24, overflowY: 'auto', flex: 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'var(--font-display)', letterSpacing: 2 }}>
          DAILY REPORT
        </div>
        <input
          type="date" value={date} onChange={e => setDate(e.target.value)}
          style={{
            background: 'var(--black-card)', border: '1px solid var(--black-border)',
            borderRadius: 8, padding: '8px 12px', color: 'var(--white)', fontSize: 14
          }}
        />
      </div>

      {loading && <div style={{ color: 'var(--gray)' }}>Loading...</div>}

      {data && (
        <>
          {/* Summary cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 28 }}>
            {[
              { label: 'Total Revenue', value: `₱${Number(data.total_revenue).toLocaleString()}`, color: 'var(--yellow)' },
              { label: 'Orders', value: data.total_orders, color: 'var(--white)' },
              { label: 'Cash / GCash', value: `₱${Number(data.cash_revenue).toFixed(0)} / ₱${Number(data.gcash_revenue).toFixed(0)}`, color: 'var(--green)' },
            ].map(card => (
              <div key={card.label} style={{
                background: 'var(--black-card)', border: '1px solid var(--black-border)',
                borderRadius: 'var(--radius)', padding: '20px 24px'
              }}>
                <div style={{ fontSize: 12, color: 'var(--gray)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>
                  {card.label}
                </div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 28, color: card.color }}>
                  {card.value}
                </div>
              </div>
            ))}
          </div>

          {/* Hourly chart */}
          {data.hourly?.length > 0 && (
            <div style={{ background: 'var(--black-card)', border: '1px solid var(--black-border)', borderRadius: 'var(--radius)', padding: 20, marginBottom: 24 }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, color: 'var(--gray)' }}>ORDERS BY HOUR</div>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={data.hourly}>
                  <XAxis dataKey="hour" tick={{ fill: '#666', fontSize: 11 }} tickFormatter={h => `${h}:00`} />
                  <YAxis tick={{ fill: '#666', fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ background: 'var(--black-card)', border: '1px solid var(--black-border)', borderRadius: 8 }}
                    labelFormatter={h => `${h}:00`}
                  />
                  <Bar dataKey="orders" radius={[4,4,0,0]}>
                    {data.hourly.map((entry, i) => (
                      <Cell key={i} fill={entry.orders === Math.max(...data.hourly.map(h => h.orders)) ? '#CC0000' : '#333'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Top products */}
          {data.top_products?.length > 0 && (
            <div style={{ background: 'var(--black-card)', border: '1px solid var(--black-border)', borderRadius: 'var(--radius)', padding: 20 }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, color: 'var(--gray)' }}>TOP PRODUCTS</div>
              {data.top_products.map((p, i) => (
                <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: i < data.top_products.length - 1 ? '1px solid var(--black-border)' : 'none' }}>
                  <div style={{ width: 24, height: 24, borderRadius: '50%', background: i === 0 ? 'var(--yellow)' : 'var(--black-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: i === 0 ? 'var(--black)' : 'var(--gray)', flexShrink: 0 }}>{i + 1}</div>
                  <div style={{ flex: 1, fontSize: 14, fontWeight: 500 }}>{p.name}</div>
                  <div style={{ fontSize: 13, color: 'var(--gray)' }}>{p.qty_sold} sold</div>
                  <div style={{ fontSize: 14, color: 'var(--yellow)', fontWeight: 700 }}>₱{Number(p.revenue).toFixed(0)}</div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('reports')
  const token = useAuthStore(s => s.token)
  const tabs = [
    { id: 'reports', label: 'Sales Reports' },
    { id: 'inventory', label: 'Inventory' },
  ]

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Tab bar */}
      <div style={{
        display: 'flex', gap: 4, padding: '12px 24px',
        background: 'var(--black-soft)', borderBottom: '1px solid var(--black-border)'
      }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '10px 20px', borderRadius: 8, fontSize: 14, fontWeight: 600,
              background: activeTab === tab.id ? 'var(--red)' : 'transparent',
              color: activeTab === tab.id ? 'var(--white)' : 'var(--gray)',
              border: `1px solid ${activeTab === tab.id ? 'var(--red)' : 'transparent'}`,
              transition: 'all 0.15s'
            }}
          >{tab.label}</button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {activeTab === 'reports' && <ReportsTab token={token} />}
        {activeTab === 'inventory' && <InventoryTab token={token} />}
      </div>
    </div>
  )
}
