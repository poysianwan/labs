import { useState, useEffect, useMemo } from 'react'
import { api } from '../../utils/apiClient.js'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from 'recharts'
import { IconCalendar } from '../ui/Icons.jsx'

const fmt = (n) => `₱${Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`
const num = (n) => Number(n || 0).toLocaleString('en-PH')
const monthLabel = (month) => new Date(`${month}-01T00:00:00`).toLocaleDateString('en-PH', { month: 'long', year: 'numeric' })
const fullDateLabel = (date) => new Date(`${date}T00:00:00`).toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })

const getMonthDays = (month) => {
  const [year, monthIndex] = month.split('-').map(Number)
  const days = new Date(year, monthIndex, 0).getDate()
  return Array.from({ length: days }, (_, index) => `${month}-${String(index + 1).padStart(2, '0')}`)
}

const buildCalendarGrid = (month, days = []) => {
  const byDate = new Map(days.map(day => [day.date, day]))
  const monthDays = getMonthDays(month)
  const firstDay = new Date(`${month}-01T00:00:00`).getDay()
  const cells = Array.from({ length: firstDay }, () => null)

  monthDays.forEach(date => {
    const value = byDate.get(date) || { date, orders: 0, revenue: 0, voids: 0 }
    cells.push({
      ...value,
      day: Number(date.slice(-2)),
      orders: Number(value.orders || 0),
      revenue: Number(value.revenue || 0),
      voids: Number(value.voids || 0)
    })
  })

  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

const buildFallbackCalendar = async (month) => {
  const days = await Promise.all(
    getMonthDays(month).map(async date => {
      try {
        const orders = await api.getOrders({ date })
        const completed = orders.filter(order => order.status === 'completed')
        const voided = orders.filter(order => order.status === 'voided')
        return {
          date,
          orders: completed.length,
          revenue: completed.reduce((sum, order) => sum + Number(order.total || 0), 0),
          voids: voided.length
        }
      } catch {
        return { date, orders: 0, revenue: 0, voids: 0 }
      }
    })
  )
  return { month, days }
}

export default function SalesReport() {
  const today = new Date().toISOString().split('T')[0]
  const [from, setFrom] = useState(today)
  const [to, setTo] = useState(today)
  const [calendarMonth, setCalendarMonth] = useState(today.slice(0, 7))
  const [calendar, setCalendar] = useState(null)
  const [activeCalendarDay, setActiveCalendarDay] = useState(null)
  const [calendarLoading, setCalendarLoading] = useState(false)
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

  useEffect(() => {
    const loadCalendar = async () => {
      setCalendarLoading(true)
      try {
        try {
          setCalendar(await api.getSalesCalendar(calendarMonth))
        } catch {
          setCalendar(await buildFallbackCalendar(calendarMonth))
        }
      } finally {
        setCalendarLoading(false)
      }
    }
    loadCalendar()
  }, [calendarMonth])

  useEffect(() => {
    setActiveCalendarDay(null)
  }, [calendarMonth])

  const peakHour = data?.hourly?.reduce((a, b) => b.orders > a.orders ? b : a, { orders: 0 })
  const calendarCells = useMemo(() => buildCalendarGrid(calendarMonth, calendar?.days || []), [calendarMonth, calendar])
  const maxCalendarRevenue = useMemo(
    () => Math.max(0, ...(calendar?.days || []).map(day => Number(day.revenue || 0))),
    [calendar]
  )
  const monthTotal = useMemo(
    () => (calendar?.days || []).reduce((sum, day) => sum + Number(day.revenue || 0), 0),
    [calendar]
  )
  const monthOrders = useMemo(
    () => (calendar?.days || []).reduce((sum, day) => sum + Number(day.orders || 0), 0),
    [calendar]
  )
  const activeDay = useMemo(() => {
    if (!activeCalendarDay) return null
    return calendarCells.find(day => day?.date === activeCalendarDay) || null
  }, [activeCalendarDay, calendarCells])

  return (
    <div className="admin-pad">

      {/* Date filter */}
      <div className="admin-header-row">
        <h2 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-strong)', margin: 0, letterSpacing: -0.5 }}>Sales Overview</h2>

        <div className="admin-header-actions sales-report-actions" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>

          <div className="sales-date-range" style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-panel)', padding: '6px 10px', borderRadius: '100px', border: '1px solid var(--border-light)', boxShadow: 'var(--shadow-sm)' }}>
            <label className="sales-date-field">
              <IconCalendar size={16} color="var(--text-muted)" />
              <input type="date" value={from} onChange={e => setFrom(e.target.value)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-strong)', fontSize: 13, fontWeight: 600, outline: 'none', cursor: 'pointer' }} />
            </label>
            <span className="sales-date-divider" />
            <label className="sales-date-field">
              <IconCalendar size={16} color="var(--text-muted)" />
              <input type="date" value={to} onChange={e => setTo(e.target.value)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-strong)', fontSize: 13, fontWeight: 600, outline: 'none', cursor: 'pointer' }} />
            </label>
          </div>

          <div className="sales-range-presets" style={{ display: 'flex', gap: 4, background: 'var(--border-light)', padding: 4, borderRadius: '100px' }}>
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
        <div className="admin-content-scroll" style={{ flex: 1, overflowY: 'auto', paddingRight: 4, paddingBottom: 40, minHeight: 0 }}>
          {/* KPI cards */}
          <div className="admin-kpi-grid" style={{ marginBottom: 32, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 20 }}>
            {[
              { label: 'Total Revenue', value: fmt(data.total_revenue), color: 'var(--text-strong)', trend: 'Overall' },
              { label: 'Total Orders', value: data.total_orders, color: 'var(--text-strong)', trend: 'Completed' },
              { label: 'Cash Sales', value: fmt(data.cash_revenue), color: 'var(--green)', trend: 'Drawer' },
              { label: 'GCash / Digital', value: fmt(data.gcash_revenue), color: '#0284c7', trend: 'Online' },
            ].map(card => (
              <div key={card.label} className="sales-kpi-card" style={{ 
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

          <div className="sales-card sales-calendar-card" style={{
            background: 'var(--bg-panel)',
            border: '1px solid var(--border-card)',
            borderRadius: 'var(--radius-xl)',
            padding: '32px',
            marginBottom: 40,
            boxShadow: 'var(--shadow-sm)'
          }}>
            <div className="sales-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--text-strong)', letterSpacing: -0.5 }}>Monthly Sales Calendar</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600, marginTop: 4 }}>Daily sales performance for {monthLabel(calendarMonth)}</div>
              </div>
              <input
                className="admin-home-month-input"
                type="month"
                value={calendarMonth}
                onChange={event => setCalendarMonth(event.target.value)}
              />
            </div>

            <div className="admin-calendar-summary">
              <div>
                <span>Month total</span>
                <strong>{fmt(monthTotal)}</strong>
              </div>
              <small>{calendarLoading ? 'Loading daily sales...' : `${num(monthOrders)} completed orders this month`}</small>
            </div>

            <div className={`admin-calendar-detail ${activeDay ? 'active' : ''}`}>
              {activeDay ? (
                <>
                  <div>
                    <span>{fullDateLabel(activeDay.date)}</span>
                    <strong>{fmt(activeDay.revenue)}</strong>
                  </div>
                  <div>
                    <span>Completed orders</span>
                    <strong>{num(activeDay.orders)}</strong>
                  </div>
                  <div>
                    <span>Voided orders</span>
                    <strong>{num(activeDay.voids)}</strong>
                  </div>
                </>
              ) : (
                <div>
                  <span>Day details</span>
                  <strong>Tap a calendar day</strong>
                </div>
              )}
            </div>

            <div className="admin-sales-calendar">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} className="admin-sales-calendar-weekday">{day}</div>
              ))}
              {calendarCells.map((day, index) => {
                const strength = day && maxCalendarRevenue > 0 ? Math.max(0.08, day.revenue / maxCalendarRevenue) : 0
                return (
                  <button
                    key={day?.date || `blank-${index}`}
                    className={`admin-sales-calendar-day ${day ? '' : 'empty'} ${day?.date === activeCalendarDay ? 'selected' : ''} ${day?.voids ? 'has-voids' : ''}`}
                    style={day ? { '--sales-strength': strength } : undefined}
                    title={day ? `${day.date}: ${fmt(day.revenue)} from ${num(day.orders)} orders` : ''}
                    type="button"
                    disabled={!day}
                    onFocus={() => day && setActiveCalendarDay(day.date)}
                    onClick={() => day && setActiveCalendarDay(day.date)}
                    aria-pressed={day?.date === activeCalendarDay}
                  >
                    {day && (
                      <>
                        <span>{day.day}</span>
                        <strong>{day.revenue > 0 ? fmt(day.revenue) : '-'}</strong>
                        <small>{day.orders ? `${num(day.orders)} orders` : 'No sales'}</small>
                      </>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Hourly chart card */}
          {data.hourly?.length > 0 && (
            <div className="sales-card" style={{ 
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
            <div className="sales-card" style={{ background: 'var(--bg-panel)', border: '1px solid var(--border-card)', borderRadius: 'var(--radius-xl)', padding: 32, boxShadow: 'var(--shadow-sm)' }}>
              <div className="sales-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
                <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--text-strong)', letterSpacing: -0.5 }}>Top Selling Products</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>{data.top_products?.length || 0} Listed</div>
              </div>
              {data.top_products?.length === 0 && <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>No selling history for this period.</div>}
              <div className="sales-product-list" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {data.top_products?.map((p, i) => (
                  <div key={p.name} className="sales-product-row" style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px', borderRadius: 'var(--radius-lg)', background: i === 0 ? 'rgba(0,0,0,0.01)' : 'transparent', transition: 'all 0.2s' }}>
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
                    <div className="sales-row-amount" style={{ fontSize: 18, fontWeight: 900, color: 'var(--text-strong)', letterSpacing: -0.5 }}>{fmt(p.revenue)}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="sales-recent-section" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div className="sales-recent-title" style={{ fontSize: 18, fontWeight: 900, color: 'var(--text-strong)', letterSpacing: -0.5, paddingLeft: 4 }}>Recent Transactions</div>
              <div className="sales-transaction-list" style={{ maxHeight: 600, overflowY: 'auto', paddingRight: 8, display: 'flex', flexDirection: 'column', gap: 12 }}>
                {orders.length === 0 && <div style={{ color: 'var(--text-muted)', fontSize: 14, textAlign: 'center', padding: 40 }}>No transactions yet today.</div>}
                {orders.map((order) => (
                  <div key={order.id} className="sales-transaction-row" style={{ 
                    background: 'var(--bg-panel)', 
                    border: '1px solid var(--border-card)', 
                    borderRadius: 'var(--radius-xl)', 
                    padding: '16px 20px', 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 16,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
                  }}>
                    <div className="sales-order-number" style={{ 
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
                    <div className="sales-row-amount" style={{ fontSize: 17, fontWeight: 900, color: 'var(--text-strong)', letterSpacing: -0.5 }}>
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
