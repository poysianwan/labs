import { Router } from 'express'
import { query } from '../db/index.js'
import { authenticate, requireAdmin } from '../middleware/auth.js'

const router = Router()

// GET /api/reports/current-shift
router.get('/current-shift', authenticate, async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT s.*, u.name as cashier_name FROM shifts s JOIN users u ON u.id = s.user_id WHERE s.ended_at IS NULL LIMIT 1`
    )
    res.json(rows[0] || null)
  } catch (err) {
    res.status(500).json({ error: 'SERVER_ERROR' })
  }
})

// POST /api/reports/shifts/start
router.post('/shifts/start', authenticate, async (req, res) => {
  const { opening_cash = 0 } = req.body
  try {
    // Check if ANY user has an open shift (only one active shift allowed for the whole shop)
    const { rows: openShifts } = await query(
      `SELECT s.id, u.name as cashier_name FROM shifts s JOIN users u ON u.id = s.user_id WHERE s.ended_at IS NULL`
    )

    if (openShifts.length > 0) {
      const active = openShifts[0]
      // If it's the SAME user, just return their current shift session
      if (active.id) {
         // But we double check the user id
         const { rows: current } = await query(`SELECT user_id FROM shifts WHERE id = $1`, [active.id])
         if (current[0].user_id !== req.user.id) {
           return res.status(409).json({ 
             error: 'SHIFT_ALREADY_OPEN', 
             message: `Cannot start shift. ${active.cashier_name} is currently active on the register.`,
             active_cashier: active.cashier_name
           })
         }
      }
      return res.json({ shift_id: active.id, started_at: active.started_at })
    }

    const { rows } = await query(
      `INSERT INTO shifts (user_id, opening_cash) VALUES ($1, $2) RETURNING *`,
      [req.user.id, opening_cash]
    )
    const result = rows[0]
    await query(
      `INSERT INTO audit_logs (user_id, action, table_name, record_id, new_value)
       VALUES ($1, 'shift_start', 'shifts', $2, $3)`,
      [req.user.id, result.id, JSON.stringify({ opening_cash: opening_cash })]
    )
    res.status(201).json({ 
      shift_id: result.id, 
      started_at: result.started_at,
      cashier_name: req.user.name 
    })
  } catch (err) {
    res.status(500).json({ error: 'SERVER_ERROR' })
  }
})

// GET /api/reports/shifts
router.get('/shifts', authenticate, requireAdmin, async (req, res) => {
  try {
    const { rows } = await query(`
      SELECT 
        s.id, 
        s.started_at, 
        s.ended_at, 
        s.opening_cash, 
        s.closing_cash,
        u.name AS cashier_name,
        (SELECT COALESCE(SUM(p.amount - p.change_given), 0) FROM orders o JOIN payments p ON p.order_id = o.id WHERE o.shift_id = s.id AND o.status = 'completed' AND p.method = 'cash') AS cash_collected,
        (SELECT COALESCE(SUM(amount), 0) FROM cash_drawer_logs WHERE shift_id = s.id AND type = 'pay_in') AS petty_in,
        (SELECT COALESCE(SUM(amount), 0) FROM cash_drawer_logs WHERE shift_id = s.id AND type = 'pay_out') AS petty_out
      FROM shifts s
      JOIN users u ON u.id = s.user_id
      ORDER BY s.started_at DESC
      LIMIT 100
    `)

    const decorated = rows.map(r => {
      const expected = parseFloat(r.opening_cash) + parseFloat(r.cash_collected) + parseFloat(r.petty_in) - parseFloat(r.petty_out)
      const variance = r.ended_at ? parseFloat(r.closing_cash || 0) - expected : null
      return { ...r, expected_cash: expected, variance }
    })

    res.json(decorated)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'SERVER_ERROR' })
  }
})

// GET /api/reports/shifts/:id/petty-cash
router.get('/shifts/:id/petty-cash', authenticate, async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT * FROM cash_drawer_logs WHERE shift_id = $1 ORDER BY created_at DESC`,
      [req.params.id]
    )
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: 'SERVER_ERROR' })
  }
})

// POST /api/reports/shifts/:id/petty-cash
router.post('/shifts/:id/petty-cash', authenticate, async (req, res) => {
  const { type, amount, reason } = req.body
  if (!['pay_in', 'pay_out'].includes(type) || !amount || !reason) {
    return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'type, amount, and reason required' })
  }
  try {
    const { rows } = await query(
      `INSERT INTO cash_drawer_logs (shift_id, user_id, type, amount, reason)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [req.params.id, req.user.id, type, amount, reason]
    )
    await query(
      `INSERT INTO audit_logs (user_id, action, table_name, record_id, new_value)
       VALUES ($1, 'petty_cash', 'cash_drawer_logs', $2, $3)`,
      [req.user.id, rows[0].id, JSON.stringify({ type, amount, reason })]
    )
    res.status(201).json(rows[0])
  } catch(err) {
    res.status(500).json({ error: 'SERVER_ERROR' })
  }
})

// POST /api/reports/cash-withdraw  — standalone admin cash withdrawal (no shift needed)
router.post('/cash-withdraw', authenticate, requireAdmin, async (req, res) => {
  const { amount, reason } = req.body
  if (!amount || !reason) {
    return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'amount and reason required' })
  }
  try {
    const { rows } = await query(
      `INSERT INTO cash_drawer_logs (shift_id, user_id, type, amount, reason)
       VALUES (NULL, $1, 'pay_out', $2, $3) RETURNING *`,
      [req.user.id, amount, reason]
    )
    res.status(201).json(rows[0])
  } catch(err) {
    console.error('Cash withdraw error:', err)
    res.status(500).json({ error: 'SERVER_ERROR' })
  }
})

// POST /api/shifts/:id/end
router.post('/shifts/:id/end', authenticate, async (req, res) => {
  const { closing_cash = 0 } = req.body
  try {
    // Calculate expected cash from this shift
    const { rows: cashData } = await query(
      `SELECT COALESCE(SUM(p.amount - p.change_given), 0) AS cash_collected
       FROM orders o JOIN payments p ON p.order_id = o.id
       WHERE o.shift_id = $1 AND p.method = 'cash' AND o.status = 'completed'`,
      [req.params.id]
    )

    const { rows: pettyCash } = await query(
      `SELECT 
         COALESCE(SUM(CASE WHEN type='pay_in' THEN amount ELSE 0 END), 0) AS total_pay_ins,
         COALESCE(SUM(CASE WHEN type='pay_out' THEN amount ELSE 0 END), 0) AS total_pay_outs
       FROM cash_drawer_logs WHERE shift_id = $1`,
      [req.params.id]
    )

    const { rows: shift } = await query('SELECT opening_cash FROM shifts WHERE id = $1', [req.params.id])
    if (!shift.length) return res.status(404).json({ error: 'NOT_FOUND' })

    const expected = parseFloat(shift[0].opening_cash) 
                   + parseFloat(cashData[0].cash_collected)
                   + parseFloat(pettyCash[0].total_pay_ins)
                   - parseFloat(pettyCash[0].total_pay_outs)
                   
    const variance = closing_cash - expected

    await query(
      `UPDATE shifts SET ended_at = NOW(), closing_cash = $1 WHERE id = $2`,
      [closing_cash, req.params.id]
    )
    await query(
      `INSERT INTO audit_logs (user_id, action, table_name, record_id, new_value)
       VALUES ($1, 'shift_end', 'shifts', $2, $3)`,
      [req.user.id, req.params.id, JSON.stringify({ closing_cash })]
    )

    // Summary
    const { rows: summary } = await query(
      `SELECT
        COUNT(*) AS total_orders,
        COALESCE(SUM(o.total), 0) AS total_sales,
        COALESCE(SUM(CASE WHEN p.method='cash' THEN p.amount - p.change_given ELSE 0 END), 0) AS cash_sales,
        COALESCE(SUM(CASE WHEN p.method='gcash' THEN p.amount ELSE 0 END), 0) AS gcash_sales
       FROM orders o JOIN payments p ON p.order_id = o.id
       WHERE o.shift_id = $1 AND o.status = 'completed'`,
      [req.params.id]
    )

    res.json({
      shift_id: req.params.id,
      ...summary[0],
      total_pay_ins: pettyCash[0].total_pay_ins,
      total_pay_outs: pettyCash[0].total_pay_outs,
      expected_cash: expected,
      closing_cash,
      variance
    })
  } catch (err) {
    res.status(500).json({ error: 'SERVER_ERROR' })
  }
})

// GET /api/reports/dashboard
router.get('/dashboard', authenticate, requireAdmin, async (req, res) => {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' })

  try {
    const [
      todaySummary,
      paymentMix,
      voidSummary,
      topProducts,
      lowStock,
      productHealth,
      currentShift,
      recentOrders,
      cashierPerformance
    ] = await Promise.all([
      query(
        `SELECT
           COUNT(*) FILTER (WHERE status = 'completed') AS total_orders,
           COALESCE(SUM(total) FILTER (WHERE status = 'completed'), 0) AS total_revenue,
           COALESCE(AVG(total) FILTER (WHERE status = 'completed'), 0) AS avg_order_value,
           COUNT(*) FILTER (WHERE status = 'voided') AS voided_orders,
           COALESCE(SUM(total) FILTER (WHERE status = 'voided'), 0) AS voided_amount
         FROM orders
         WHERE DATE(created_at AT TIME ZONE 'Asia/Manila') = $1`,
        [today]
      ),
      query(
        `SELECT
           COALESCE(SUM(CASE WHEN p.method = 'cash' THEN p.amount - p.change_given ELSE 0 END), 0) AS cash_revenue,
           COALESCE(SUM(CASE WHEN p.method = 'gcash' THEN p.amount ELSE 0 END), 0) AS gcash_revenue
         FROM payments p
         JOIN orders o ON o.id = p.order_id
         WHERE o.status = 'completed'
           AND DATE(o.created_at AT TIME ZONE 'Asia/Manila') = $1`,
        [today]
      ),
      query(
        `SELECT id, order_number, total, void_reason, created_at
         FROM orders
         WHERE status = 'voided'
           AND DATE(created_at AT TIME ZONE 'Asia/Manila') = $1
         ORDER BY created_at DESC
         LIMIT 5`,
        [today]
      ),
      query(
        `SELECT pr.name, SUM(oi.quantity) AS qty_sold, SUM(oi.quantity * oi.unit_price) AS revenue
         FROM order_items oi
         JOIN products pr ON pr.id = oi.product_id
         JOIN orders o ON o.id = oi.order_id
         WHERE o.status = 'completed'
           AND DATE(o.created_at AT TIME ZONE 'Asia/Manila') = $1
         GROUP BY pr.name
         ORDER BY qty_sold DESC
         LIMIT 5`,
        [today]
      ),
      query(
        `SELECT id, name, unit, current_stock, low_stock_alert
         FROM ingredients
         WHERE deleted_at IS NULL
           AND current_stock < low_stock_alert
         ORDER BY current_stock ASC, name
         LIMIT 6`
      ),
      query(
        `SELECT
           COUNT(*) FILTER (WHERE deleted_at IS NULL) AS total_products,
           COUNT(*) FILTER (WHERE deleted_at IS NULL AND is_available = false) AS unavailable_products,
           COUNT(*) FILTER (
             WHERE deleted_at IS NULL
               AND is_combo = true
               AND NOT EXISTS (SELECT 1 FROM combo_items ci WHERE ci.combo_id = products.id)
           ) AS unconfigured_combos
         FROM products`
      ),
      query(
        `SELECT
           s.id,
           s.started_at,
           s.opening_cash,
           u.name AS cashier_name,
           COALESCE((SELECT SUM(p.amount - p.change_given)
             FROM orders o JOIN payments p ON p.order_id = o.id
             WHERE o.shift_id = s.id AND o.status = 'completed' AND p.method = 'cash'), 0) AS cash_collected,
           COALESCE((SELECT SUM(amount) FROM cash_drawer_logs WHERE shift_id = s.id AND type = 'pay_in'), 0) AS petty_in,
           COALESCE((SELECT SUM(amount) FROM cash_drawer_logs WHERE shift_id = s.id AND type = 'pay_out'), 0) AS petty_out,
           COALESCE((SELECT COUNT(*) FROM orders o WHERE o.shift_id = s.id AND o.status = 'completed'), 0) AS order_count
         FROM shifts s
         JOIN users u ON u.id = s.user_id
         WHERE s.ended_at IS NULL
         ORDER BY s.started_at DESC
         LIMIT 1`
      ),
      query(
        `SELECT o.id, o.order_number, o.total, o.status, o.created_at, u.name AS cashier
         FROM orders o
         LEFT JOIN users u ON u.id = o.user_id
         WHERE DATE(o.created_at AT TIME ZONE 'Asia/Manila') = $1
         ORDER BY o.created_at DESC
         LIMIT 6`,
        [today]
      ),
      query(
        `SELECT u.name AS cashier_name,
                COUNT(o.id) AS total_orders,
                COALESCE(SUM(o.total), 0) AS total_sales,
                COALESCE(AVG(o.total), 0) AS avg_ticket
         FROM orders o
         JOIN users u ON u.id = o.user_id
         WHERE o.status = 'completed'
           AND DATE(o.created_at AT TIME ZONE 'Asia/Manila') = $1
         GROUP BY u.name
         ORDER BY total_sales DESC
         LIMIT 5`,
        [today]
      )
    ])

    const shift = currentShift.rows[0] || null
    const expectedCash = shift
      ? Number(shift.opening_cash || 0) + Number(shift.cash_collected || 0) + Number(shift.petty_in || 0) - Number(shift.petty_out || 0)
      : 0

    res.json({
      date: today,
      summary: {
        ...todaySummary.rows[0],
        ...paymentMix.rows[0]
      },
      current_shift: shift ? { ...shift, expected_cash: expectedCash } : null,
      low_stock: lowStock.rows,
      product_health: productHealth.rows[0],
      voids: {
        count: Number(todaySummary.rows[0]?.voided_orders || 0),
        amount: Number(todaySummary.rows[0]?.voided_amount || 0),
        recent: voidSummary.rows
      },
      top_products: topProducts.rows,
      recent_orders: recentOrders.rows,
      cashier_performance: cashierPerformance.rows
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'SERVER_ERROR' })
  }
})

// GET /api/reports/sales-calendar?month=YYYY-MM
router.get('/sales-calendar', authenticate, requireAdmin, async (req, res) => {
  const requestedMonth = /^\d{4}-\d{2}$/.test(req.query.month || '') ? req.query.month : null
  const month = requestedMonth || new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' }).slice(0, 7)

  try {
    const { rows } = await query(
      `SELECT
         TO_CHAR(DATE(o.created_at AT TIME ZONE 'Asia/Manila'), 'YYYY-MM-DD') AS date,
         COUNT(*) FILTER (WHERE o.status = 'completed') AS orders,
         COALESCE(SUM(o.total) FILTER (WHERE o.status = 'completed'), 0) AS revenue,
         COUNT(*) FILTER (WHERE o.status = 'voided') AS voids
       FROM orders o
       WHERE TO_CHAR(DATE(o.created_at AT TIME ZONE 'Asia/Manila'), 'YYYY-MM') = $1
       GROUP BY DATE(o.created_at AT TIME ZONE 'Asia/Manila')
       ORDER BY date`,
      [month]
    )

    res.json({ month, days: rows })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'SERVER_ERROR' })
  }
})

// GET /api/reports/sales
router.get('/sales', authenticate, requireAdmin, async (req, res) => {
  const { from, to } = req.query
  const fromDate = from || new Date().toISOString().split('T')[0]
  const toDate = to || fromDate

  try {
    const [summary, topProducts, hourly] = await Promise.all([
      query(
        `SELECT COUNT(*) AS total_orders,
                COALESCE(SUM(o.total), 0) AS total_revenue,
                COALESCE(SUM(CASE WHEN p.method='cash' THEN p.amount - p.change_given ELSE 0 END), 0) AS cash_revenue,
                COALESCE(SUM(CASE WHEN p.method='gcash' THEN p.amount ELSE 0 END), 0) AS gcash_revenue
         FROM orders o JOIN payments p ON p.order_id = o.id
         WHERE o.status = 'completed'
           AND DATE(o.created_at AT TIME ZONE 'Asia/Manila') BETWEEN $1 AND $2`,
        [fromDate, toDate]
      ),
      query(
        `SELECT pr.name, SUM(oi.quantity) AS qty_sold, SUM(oi.quantity * oi.unit_price) AS revenue
         FROM order_items oi
         JOIN products pr ON pr.id = oi.product_id
         JOIN orders o ON o.id = oi.order_id
         WHERE o.status = 'completed'
           AND DATE(o.created_at AT TIME ZONE 'Asia/Manila') BETWEEN $1 AND $2
         GROUP BY pr.name ORDER BY qty_sold DESC LIMIT 10`,
        [fromDate, toDate]
      ),
      query(
        `SELECT EXTRACT(HOUR FROM o.created_at AT TIME ZONE 'Asia/Manila') AS hour,
                COUNT(*) AS orders
         FROM orders o
         WHERE o.status = 'completed'
           AND DATE(o.created_at AT TIME ZONE 'Asia/Manila') BETWEEN $1 AND $2
         GROUP BY hour ORDER BY hour`,
        [fromDate, toDate]
      )
    ])

    res.json({
      ...summary.rows[0],
      top_products: topProducts.rows,
      hourly: hourly.rows,
      from: fromDate,
      to: toDate
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'SERVER_ERROR' })
  }
})

// GET /api/reports/stock-movements
router.get('/stock-movements', authenticate, requireAdmin, async (req, res) => {
  const { ingredient_id, from, to } = req.query
  const fromDate = from || new Date().toISOString().split('T')[0]
  const toDate = to || fromDate

  try {
    let sql = `SELECT sm.*, i.name AS ingredient_name, i.unit
               FROM stock_movements sm JOIN ingredients i ON i.id = sm.ingredient_id
               WHERE DATE(sm.created_at AT TIME ZONE 'Asia/Manila') BETWEEN $1 AND $2`
    const params = [fromDate, toDate]

    if (ingredient_id) { params.push(ingredient_id); sql += ` AND sm.ingredient_id = $${params.length}` }
    sql += ` ORDER BY sm.created_at DESC`

    const { rows } = await query(sql, params)
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: 'SERVER_ERROR' })
  }
})


// GET /api/reports/activity-logs
router.get('/activity-logs', authenticate, async (req, res) => {
  const page = parseInt(req.query.page) || 1
  const limit = parseInt(req.query.limit) || 10
  const offset = (page - 1) * limit
  const isAdmin = req.user.role === 'admin'

  try {
    // 1. Get total count
    const { rows: countRows } = await query(
      `SELECT COUNT(*) FROM audit_logs WHERE ($1 OR user_id = $2)`,
      [isAdmin, req.user.id]
    )
    const totalCount = parseInt(countRows[0].count)

    // 2. Get paginated rows
    const { rows } = await query(
      `SELECT a.*, u.name as user_name, u.role as user_role
       FROM audit_logs a
       LEFT JOIN users u ON u.id = a.user_id
       WHERE ($1 OR a.user_id = $2)
       ORDER BY a.created_at DESC
       LIMIT $3 OFFSET $4`,
      [isAdmin, req.user.id, limit, offset]
    )

    res.json({
      logs: rows,
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
      currentPage: page
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'SERVER_ERROR' })
  }
})

// POST /api/reports/activity-logs/:id/revert
router.post('/activity-logs/:id/revert', authenticate, requireAdmin, async (req, res) => {
  try {
    const { rows: logs } = await query('SELECT * FROM audit_logs WHERE id = $1', [req.params.id])
    if (!logs.length) return res.status(404).json({ error: 'NOT_FOUND' })
    const log = logs[0]

    if (log.action.startsWith('revert_')) {
      return res.status(400).json({ error: 'ALREADY_REVERTED', message: 'Cannot revert a reversion.' })
    }

    const details = typeof log.new_value === 'string' ? JSON.parse(log.new_value) : log.new_value
    const old = log.old_value ? (typeof log.old_value === 'string' ? JSON.parse(log.old_value) : log.old_value) : null

    let success = false
    let message = ''

    if (log.action === 'update_product' && old) {
      await query(
        `UPDATE products SET name = $1, price = $2, is_available = $3 WHERE id = $4`,
        [old.name, old.price, old.is_available, log.record_id]
      )
      success = true
      message = `Reverted product ${old.name} to its previous state.`
    } 
    else if (log.action === 'restock') {
      await query(
        `UPDATE ingredients SET current_stock = current_stock - $1 WHERE id = $2`,
        [details.quantity, log.record_id]
      )
      await query(
        `INSERT INTO stock_movements (ingredient_id, movement_type, quantity, note)
         VALUES ($1, 'adjustment', $2, $3)`,
        [log.record_id, -details.quantity, `Revert of restock log ${log.id}`]
      )
      success = true
      message = `Reverted restock of ${details.name} (-${details.quantity} units).`
    }
    else if (log.action === 'petty_cash') {
      const reverseType = details.type === 'pay_in' ? 'pay_out' : 'pay_in'
      const { rows: original } = await query('SELECT shift_id FROM cash_drawer_logs WHERE id = $1', [log.record_id])
      const shiftId = original.length ? original[0].shift_id : null

      await query(
        `INSERT INTO cash_drawer_logs (shift_id, user_id, type, amount, reason)
         VALUES ($1, $2, $3, $4, $5)`,
        [shiftId, req.user.id, reverseType, details.amount, `REVERT: ${details.reason}`]
      )
      success = true
      message = `Reverted ${details.type} of ₱${details.amount}.`
    }
    else if (log.action === 'delete_product') {
      await query(`UPDATE products SET deleted_at = NULL WHERE id = $1`, [log.record_id])
      success = true
      message = `Restored product "${details.name}" to the menu.`
    }
    else if (log.action === 'delete_ingredient') {
      await query(`UPDATE ingredients SET deleted_at = NULL WHERE id = $1`, [log.record_id])
      success = true
      message = `Restored ingredient "${details.name}" to the system.`
    }
    else if (log.action === 'create_product') {
      await query(`UPDATE products SET deleted_at = NOW() WHERE id = $1`, [log.record_id])
      success = true
      message = `Removed accidentally added product "${details.name}".`
    }
    else if (log.action === 'create_ingredient') {
      await query(`UPDATE ingredients SET deleted_at = NOW() WHERE id = $1`, [log.record_id])
      success = true
      message = `Removed accidentally added ingredient "${details.name}".`
    }

    if (success) {
      // Mark the original log as reverted
      await query('UPDATE audit_logs SET is_reverted = TRUE WHERE id = $1', [log.id])
      
      await query(
        `INSERT INTO audit_logs (user_id, action, table_name, record_id, new_value)
         VALUES ($1, $2, $3, $4, $5)`,
        [req.user.id, `revert_${log.action}`, log.table_name, log.id, JSON.stringify({ message, original_log_id: log.id })]
      )
      return res.json({ success: true, message })
    }

    res.status(400).json({ error: 'NOT_REVERSIBLE', message: 'This action cannot be reverted automatically.' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'SERVER_ERROR' })
  }
})

export default router
