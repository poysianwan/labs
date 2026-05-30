import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../utils/apiClient.js'
import { localDateInputValue } from '../../utils/date.js'
import {
  IconActivity,
  IconAlertCircle,
  IconBox,
  IconChart,
  IconClipboardList,
  IconReceipt,
  IconTrendingUp,
  IconUsers
} from '../ui/Icons.jsx'

const money = (n) => `₱${Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`
const num = (n) => Number(n || 0).toLocaleString('en-PH')

const timeAgo = (value) => {
  if (!value) return 'Not started'
  const diff = Date.now() - new Date(value).getTime()
  const minutes = Math.max(0, Math.floor(diff / 60000))
  if (minutes < 60) return `${minutes || 1}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ${minutes % 60}m ago`
  return new Date(value).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })
}

const buildFallbackDashboard = async () => {
  const today = localDateInputValue()
  const [sales, currentShift, ingredients, products, orders] = await Promise.all([
    api.getSalesReport(today, today).catch(() => ({
      total_orders: 0,
      total_revenue: 0,
      cash_revenue: 0,
      gcash_revenue: 0,
      top_products: []
    })),
    api.getCurrentShift().catch(() => null),
    api.getIngredients().catch(() => []),
    api.getProducts().catch(() => []),
    api.getOrders({ date: today }).catch(() => [])
  ])

  const voided = orders.filter(order => order.status === 'voided')
  const completed = orders.filter(order => order.status === 'completed')
  const cashierMap = new Map()

  completed.forEach(order => {
    const name = order.cashier || 'System'
    const current = cashierMap.get(name) || { cashier_name: name, total_orders: 0, total_sales: 0 }
    current.total_orders += 1
    current.total_sales += Number(order.total || 0)
    cashierMap.set(name, current)
  })

  const cashierPerformance = [...cashierMap.values()]
    .map(row => ({ ...row, avg_ticket: row.total_orders ? row.total_sales / row.total_orders : 0 }))
    .sort((a, b) => b.total_sales - a.total_sales)
    .slice(0, 5)

  const lowStock = ingredients
    .filter(item => item.is_low || Number(item.current_stock) < Number(item.low_stock_alert))
    .sort((a, b) => Number(a.current_stock) - Number(b.current_stock))
    .slice(0, 6)

  return {
    date: today,
    summary: {
      total_orders: sales.total_orders,
      total_revenue: sales.total_revenue,
      avg_order_value: Number(sales.total_orders || 0) ? Number(sales.total_revenue || 0) / Number(sales.total_orders) : 0,
      cash_revenue: sales.cash_revenue,
      gcash_revenue: sales.gcash_revenue
    },
    current_shift: currentShift ? {
      ...currentShift,
      order_count: completed.filter(order => order.shift_id === currentShift.id).length,
      cash_collected: sales.cash_revenue,
      expected_cash: Number(currentShift.opening_cash || 0) + Number(sales.cash_revenue || 0)
    } : null,
    low_stock: lowStock,
    product_health: {
      total_products: products.length,
      unavailable_products: products.filter(product => product.is_available === false).length,
      unconfigured_combos: 0
    },
    voids: {
      count: voided.length,
      amount: voided.reduce((sum, order) => sum + Number(order.total || 0), 0),
      recent: voided.slice(0, 5)
    },
    top_products: sales.top_products || [],
    recent_orders: orders.slice(0, 6),
    cashier_performance: cashierPerformance
  }
}

function HealthCard({ icon, label, value, detail, tone = 'neutral' }) {
  return (
    <div className={`admin-home-card admin-home-kpi tone-${tone}`}>
      <div className="admin-home-card-top">
        <div className="admin-home-icon">{icon}</div>
        {detail && <div className="admin-home-chip">{detail}</div>}
      </div>
      <div className="admin-home-kpi-value">{value}</div>
      <div className="admin-home-kpi-label">{label}</div>
    </div>
  )
}

function SectionCard({ title, action, children }) {
  return (
    <section className="admin-home-card admin-home-section">
      <div className="admin-home-section-header">
        <h3>{title}</h3>
        {action}
      </div>
      {children}
    </section>
  )
}

export default function AdminHome() {
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError('')
      try {
        try {
          setData(await api.getDashboardReport())
        } catch {
          setData(await buildFallbackDashboard())
        }
      } catch (err) {
        setError('Dashboard data is not available yet. Please check that the backend is running, then refresh this page.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const summary = data?.summary || {}
  const healthIssues = useMemo(() => {
    if (!data) return []
    const issues = []
    if ((data.low_stock?.length || 0) > 0) issues.push(`${data.low_stock.length} low stock`)
    if (Number(data.product_health?.unavailable_products || 0) > 0) issues.push(`${data.product_health.unavailable_products} unavailable`)
    if (Number(data.product_health?.unconfigured_combos || 0) > 0) issues.push(`${data.product_health.unconfigured_combos} combo setup`)
    if (Number(data.voids?.count || 0) > 0) issues.push(`${data.voids.count} voided`)
    return issues
  }, [data])

  if (loading) {
    return (
      <div className="admin-pad admin-home">
        <div className="admin-header-row">
          <h2 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-strong)', margin: 0 }}>Dashboard</h2>
        </div>
        <div className="admin-home-empty">Loading store performance...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="admin-pad admin-home">
        <div className="admin-header-row">
          <h2 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-strong)', margin: 0 }}>Dashboard</h2>
        </div>
        <div className="admin-home-empty">
          <div style={{ marginBottom: 14 }}>{error}</div>
          <button className="admin-home-link" onClick={() => window.location.reload()}>Refresh dashboard</button>
        </div>
      </div>
    )
  }

  return (
    <div className="admin-pad admin-home">
      <div className="admin-header-row">
        <div>
          <h2 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-strong)', margin: 0 }}>Store Dashboard</h2>
          <div style={{ color: 'var(--text-muted)', fontSize: 13, fontWeight: 600, marginTop: 4 }}>
            Today, {new Date(`${data.date}T00:00:00`).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })}
          </div>
        </div>
        <div className="admin-home-status">
          <span className={healthIssues.length ? 'status-dot warn' : 'status-dot ok'} />
          {healthIssues.length ? healthIssues.join(' • ') : 'Store health looks clear'}
        </div>
      </div>

      <div className="admin-content-scroll admin-home-scroll">
        <div className="admin-home-kpi-grid">
          <HealthCard icon={<IconTrendingUp size={20} />} label="Today Sales" value={money(summary.total_revenue)} detail="Revenue" tone="strong" />
          <HealthCard icon={<IconReceipt size={20} />} label="Completed Orders" value={num(summary.total_orders)} detail="Today" />
          <HealthCard icon={<IconChart size={20} />} label="Average Ticket" value={money(summary.avg_order_value)} detail="Per order" />
          <HealthCard icon={<IconAlertCircle size={20} />} label="Voided Amount" value={money(data.voids?.amount)} detail={`${num(data.voids?.count)} voids`} tone={Number(data.voids?.count || 0) ? 'danger' : 'neutral'} />
        </div>

        <div className="admin-home-main-grid">
          <SectionCard
            title="Shift Status"
            action={<button className="admin-home-link" onClick={() => navigate('/admin/shifts')}>View shifts</button>}
          >
            {data.current_shift ? (
              <div className="admin-home-shift">
                <div>
                  <div className="admin-home-muted">Active cashier</div>
                  <div className="admin-home-big">{data.current_shift.cashier_name}</div>
                  <div className="admin-home-muted">Started {timeAgo(data.current_shift.started_at)}</div>
                </div>
                <div className="admin-home-shift-grid">
                  <div><span>Orders</span><strong>{num(data.current_shift.order_count)}</strong></div>
                  <div><span>Cash sales</span><strong>{money(data.current_shift.cash_collected)}</strong></div>
                  <div><span>Expected drawer</span><strong>{money(data.current_shift.expected_cash)}</strong></div>
                </div>
              </div>
            ) : (
              <div className="admin-home-empty compact">No active register shift.</div>
            )}
          </SectionCard>

          <SectionCard
            title="Payment Mix"
            action={<button className="admin-home-link" onClick={() => navigate('/admin/sales')}>Sales report</button>}
          >
            <div className="admin-home-split">
              <div>
                <span>Cash</span>
                <strong>{money(summary.cash_revenue)}</strong>
              </div>
              <div>
                <span>GCash / Digital</span>
                <strong>{money(summary.gcash_revenue)}</strong>
              </div>
            </div>
          </SectionCard>
        </div>

        <div className="admin-home-main-grid">
          <SectionCard
            title="Action Needed"
            action={<button className="admin-home-link" onClick={() => navigate('/admin/inventory')}>Inventory</button>}
          >
            <div className="admin-home-alert-grid">
              <div><IconBox size={18} /><span>Low stock</span><strong>{num(data.low_stock?.length)}</strong></div>
              <div><IconClipboardList size={18} /><span>Unavailable products</span><strong>{num(data.product_health?.unavailable_products)}</strong></div>
              <div><IconActivity size={18} /><span>Unconfigured combos</span><strong>{num(data.product_health?.unconfigured_combos)}</strong></div>
            </div>
            {data.low_stock?.length > 0 && (
              <div className="admin-home-list">
                {data.low_stock.slice(0, 4).map(item => (
                  <div key={item.id} className="admin-home-list-row">
                    <span>{item.name}</span>
                    <strong>{num(item.current_stock)} {item.unit}</strong>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard title="Cashier Performance">
            {data.cashier_performance?.length ? (
              <div className="admin-home-list">
                {data.cashier_performance.map(cashier => (
                  <div key={cashier.cashier_name} className="admin-home-list-row">
                    <span><IconUsers size={16} /> {cashier.cashier_name}</span>
                    <strong>{money(cashier.total_sales)}</strong>
                    <small>{num(cashier.total_orders)} orders • {money(cashier.avg_ticket)} avg</small>
                  </div>
                ))}
              </div>
            ) : (
              <div className="admin-home-empty compact">No cashier sales yet today.</div>
            )}
          </SectionCard>
        </div>

        <div className="admin-home-main-grid">
          <SectionCard title="Top Products">
            {data.top_products?.length ? (
              <div className="admin-home-list">
                {data.top_products.map((product, index) => (
                  <div key={product.name} className="admin-home-list-row">
                    <span><b>{index + 1}</b> {product.name}</span>
                    <strong>{money(product.revenue)}</strong>
                    <small>{num(product.qty_sold)} units sold</small>
                  </div>
                ))}
              </div>
            ) : (
              <div className="admin-home-empty compact">No product sales yet today.</div>
            )}
          </SectionCard>

          <SectionCard
            title="Recent Orders"
            action={<button className="admin-home-link" onClick={() => navigate('/admin/orders')}>View orders</button>}
          >
            {data.recent_orders?.length ? (
              <div className="admin-home-list">
                {data.recent_orders.map(order => (
                  <div key={order.id} className="admin-home-list-row">
                    <span>{order.order_number}</span>
                    <strong>{money(order.total)}</strong>
                    <small>{order.cashier || 'System'} • {order.status}</small>
                  </div>
                ))}
              </div>
            ) : (
              <div className="admin-home-empty compact">No orders recorded today.</div>
            )}
          </SectionCard>
        </div>
      </div>
    </div>
  )
}
