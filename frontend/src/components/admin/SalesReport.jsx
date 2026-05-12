import { useState, useEffect } from 'react'
import { api } from '../../utils/apiClient.js'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from 'recharts'
import { IconCalendar } from '../ui/Icons.jsx'

const fmt = (n) => `₱${Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`

export default function SalesReport() {
  const today = new Date().toISOString().split('T')[0]
  const [from, setFrom] = useState(today)
  const [to, setTo] = useState(today)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [orders, setOrders] = useState([])

  const load = async () => {
    setLoading(true)
    try {
      const [report, orderList] = await Promise.all([
        api.getSalesReport(from, to),
        api.getOrders({ date: from })
      ])
      setData(report)
      setOrders(orderList)
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [from, to])

  const peakHour = data?.hourly?.reduce((a, b) => b.orders > a.orders ? b : a, { orders: 0 })

  return (
    <div className="admin-pad">

      {/* Date filter */}
      <div className="admin-header-row">
        <h2 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-strong)', margin: 0, letterSpacing: -0.5 }}>Sales Overview</h2>

        <div className="admin-header-actions" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>

          <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-panel)', padding: '6px 14px', borderRadius: '100px', border: '1px solid var(--border-light)', boxShadow: 'var(--shadow-sm)' }}>
            <IconCalendar size={16} color="var(--text-muted)" style={{ marginRight: 8 }} />
            <input type="date" value={from} onChange={e => setFrom(e.target.value)}
              style={{ background: 'transparent', border: 'none', color: 'var(--text-strong)', fontSize: 13, fontWeight: 600, outline: 'none', cursor: 'pointer' }} />
            <span style={{ margin: '0 8px', color: 'var(--border-strong)', fontSize: 12 }}>—</span>
            <input type="date" value={to} onChange={e => setTo(e.target.value)}
              style={{ background: 'transparent', border: 'none', color: 'var(--text-strong)', fontSize: 13, fontWeight: 600, outline: 'none', cursor: 'pointer' }} />
          </div>

          <div style={{ display: 'flex', gap: 4, background: 'var(--border-light)', padding: 4, borderRadius: '100px' }}>
            {['Today', '7D', '30D'].map(label => {
              const d7 = new Date(); d7.setDate(d7.getDate() - 7); const str7 = d7.toISOString().split('T')[0];
              const d30 = new Date(); d30.setDate(d30.getDate() - 30); const str30 = d30.toISOString().split('T')[0];
              const isActive = (label === 'Today' && from === today && to === today) ||
                (label === '7D' && from === str7 && to === today) ||
                (label === '30D' && from === str30 && to === today);

              return (
                <button key={label} onClick={() => {
                  const d = new Date()
                  setTo(today)
                  if (label === 'Today') setFrom(today)
                  else if (label === '7D') { d.setDate(d.getDate() - 7); setFrom(d.toISOString().split('T')[0]) }
                  else { d.setDate(d.getDate() - 30); setFrom(d.toISOString().split('T')[0]) }
                }} style={{ padding: '6px 16px', background: isActive ? 'var(--bg-panel)' : 'transparent', color: isActive ? 'var(--text-strong)' : 'var(--text-muted)', borderRadius: '100px', border: isActive ? '1px solid var(--border-light)' : '1px solid transparent', fontSize: 12, fontWeight: 700, boxShadow: isActive ? 'var(--shadow-sm)' : 'none', transition: 'all 0.2s', cursor: 'pointer' }}>
                  {label}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {loading && <div style={{ color: 'var(--text-muted)', fontSize: 14, fontWeight: 500 }}>Loading report...</div>}

      {data && !loading && (
        <div style={{ flex: 1, overflowY: 'auto', paddingRight: 4, paddingBottom: 40, minHeight: 0 }}>
          {/* KPI cards */}
          <div className="admin-kpi-grid" style={{ marginBottom: 32, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 20 }}>
            {[
              { label: 'Total Revenue', value: fmt(data.total_revenue), color: 'var(--text-strong)', trend: 'Overall' },
              { label: 'Total Orders', value: data.total_orders, color: 'var(--text-strong)', trend: 'Completed' },
              { label: 'Cash Sales', value: fmt(data.cash_revenue), color: 'var(--green)', trend: 'Drawer' },
              { label: 'GCash / Digital', value: fmt(data.gcash_revenue), color: '#0284c7', trend: 'Online' },
            ].map(card => (
              <div key={card.label} style={{ 
                background: 'var(--bg-panel)', 
                border: '1px solid var(--border-card)', 
                borderRadius: 'var(--radius-xl)', 
                padding: '28px', 
                boxShadow: 'var(--shadow-sm)',
                transition: 'transform 0.2s, box-shadow 0.2s',
                cursor: 'default'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1.2 }}>{card.label}</div>
                  <div style={{ fontSize: 10, background: 'var(--bg-app)', padding: '2px 8px', borderRadius: 4, fontWeight: 700, color: 'var(--text-muted)' }}>{card.trend}</div>
                </div>
                <div style={{ fontSize: 32, fontWeight: 900, color: card.color, letterSpacing: -1 }}>{card.value}</div>
              </div>
            ))}
          </div>

          {/* Hourly chart card */}
          {data.hourly?.length > 0 && (
            <div style={{ 
              background: 'var(--bg-panel)', 
              border: '1px solid var(--border-card)', 
              borderRadius: 'var(--radius-xl)', 
              padding: '32px', 
              marginBottom: 40, 
              boxShadow: 'var(--shadow-sm)' 
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--text-strong)', letterSpacing: -0.5, marginBottom: 4 }}>Transaction Volume Distribution</div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 500 }}>Hourly pattern of customer orders across the selected period</div>
                </div>
                {peakHour?.orders > 0 && (
                  <div style={{ background: 'rgba(234, 179, 8, 0.1)', border: '1px solid rgba(234, 179, 8, 0.2)', padding: '8px 16px', borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 800, color: '#a16207', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 8, height: 8, background: '#a16207', borderRadius: '50%' }} />
                    Peak: {peakHour.hour}:00
                  </div>
                )}
              </div>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={data.hourly} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-light)" />
                  <XAxis dataKey="hour" tick={{ fill: 'var(--text-muted)', fontSize: 11, fontWeight: 600 }} tickFormatter={h => `${h}:00`} axisLine={false} tickLine={false} dy={10} />
                  <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11, fontWeight: 600 }} allowDecimals={false} axisLine={false} tickLine={false} />
                  <Tooltip
                    cursor={{ fill: 'rgba(0,0,0,0.02)' }}
                    contentStyle={{ background: 'var(--bg-panel)', border: '1px solid var(--border-card)', borderRadius: 'var(--radius-lg)', fontSize: 13, boxShadow: 'var(--shadow-md)', fontWeight: 700, color: 'var(--text-strong)', padding: '12px 16px' }}
                    labelFormatter={h => `Time Slot: ${h}:00 – ${parseInt(h) + 1}:00`}
                    formatter={v => [v, 'Orders Completed']}
                  />
                  <Bar dataKey="orders" radius={[6, 6, 0, 0]} maxBarSize={44}>
                    {data.hourly.map((e, i) => (
                      <Cell key={i} fill={e.hour === peakHour?.hour ? 'var(--text-strong)' : 'var(--border-strong)'} style={{ transition: 'all 0.3s' }} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Bottom columns: Products & Recent Logs */}
          <div className="admin-sales-bottom-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 1fr)', gap: 32 }}>
            <div style={{ background: 'var(--bg-panel)', border: '1px solid var(--border-card)', borderRadius: 'var(--radius-xl)', padding: 32, boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
                <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--text-strong)', letterSpacing: -0.5 }}>Top Selling Products</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>{data.top_products?.length || 0} Listed</div>
              </div>
              {data.top_products?.length === 0 && <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>No selling history for this period.</div>}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {data.top_products?.map((p, i) => (
                  <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px', borderRadius: 'var(--radius-lg)', background: i === 0 ? 'rgba(0,0,0,0.01)' : 'transparent', transition: 'all 0.2s' }}>
                    <div style={{ 
                      width: 32, height: 32, borderRadius: 'var(--radius-md)', 
                      background: i < 3 ? 'rgba(234, 179, 8, 0.1)' : 'var(--bg-app)', 
                      display: 'flex', alignItems: 'center', justifyContent: 'center', 
                      fontSize: 14, fontWeight: 900, color: i < 3 ? '#a16207' : 'var(--text-muted)', flexShrink: 0,
                      border: i < 3 ? '1px solid rgba(234, 179, 8, 0.2)' : '1px solid var(--border-light)'
                    }}>{i + 1}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-strong)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>{p.qty_sold} units sold</div>
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--text-strong)', letterSpacing: -0.5 }}>{fmt(p.revenue)}</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--text-strong)', letterSpacing: -0.5, paddingLeft: 4 }}>Recent Transactions</div>
              <div style={{ maxHeight: 600, overflowY: 'auto', paddingRight: 8, display: 'flex', flexDirection: 'column', gap: 12 }}>
                {orders.length === 0 && <div style={{ color: 'var(--text-muted)', fontSize: 14, textAlign: 'center', padding: 40 }}>No transactions yet today.</div>}
                {orders.map((order) => (
                  <div key={order.id} style={{ 
                    background: 'var(--bg-panel)', 
                    border: '1px solid var(--border-card)', 
                    borderRadius: 'var(--radius-xl)', 
                    padding: '16px 20px', 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 16,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
                  }}>
                    <div style={{ 
                      fontSize: 10, fontWeight: 900, color: 'var(--text-muted)', 
                      background: 'var(--bg-app)', padding: '4px 10px', 
                      borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-light)', 
                      fontFamily: 'monospace', letterSpacing: 1
                    }}>{order.order_number}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-strong)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{order.cashier || 'System'}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, marginTop: 4 }}>
                        {new Date(order.created_at).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })}
                      </div>
                    </div>
                    <div style={{ fontSize: 17, fontWeight: 900, color: 'var(--text-strong)', letterSpacing: -0.5 }}>
                      {fmt(order.total)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
