import { Router } from 'express'
import { query, transaction } from '../db/index.js'
import { authenticate, requireAdmin } from '../middleware/auth.js'
import { deductStock, restoreStock } from '../services/bom.js'
import { z } from 'zod'
import { validate } from '../middleware/validate.js'

const orderSchema = z.object({
  id: z.string().min(1, 'Invalid order ID format'),
  shift_id: z.string().min(1).nullable().optional(),
  user_id: z.string().min(1).nullable().optional(),
  dining_type: z.enum(['dine_in', 'takeout']).default('dine_in'),
  items: z.array(z.object({
    product_id: z.string().min(1),
    quantity: z.number().int().positive(),
    unit_price: z.coerce.number().nonnegative(),
    notes: z.string().max(255).nullable().optional()
  })).min(1),
  payments: z.array(z.object({
    method: z.enum(['cash', 'gcash']),
    amount: z.number().nonnegative(),
    change_given: z.number().nonnegative().optional(),
    reference_note: z.string().max(255).nullable().optional()
  })).min(1),
  created_at: z.string().min(1).optional()
}).passthrough()

const router = Router()

// Generate order number like LB-0001
const generateOrderNumber = async (client) => {
  const { rows } = await client.query(`SELECT nextval('order_number_seq') AS seq`)
  return `LB-${String(rows[0].seq).padStart(4, '0')}`
}

// POST /api/orders — create a single order (online flow)
router.post('/', authenticate, validate(orderSchema), async (req, res) => {
  const { id, shift_id, dining_type = 'dine_in', items, payments, created_at } = req.body
  const payArray = payments

  try {
    const result = await transaction(async (client) => {
      // Check for duplicate (idempotency)
      const { rows: existing } = await client.query('SELECT id, order_number FROM orders WHERE id = $1', [id])
      if (existing.length > 0) {
        const err = new Error('DUPLICATE_ORDER')
        err.status = 409
        err.orderId = id
        throw err
      }

      const orderNumber = await generateOrderNumber(client)
      const subtotal = items.reduce((sum, i) => sum + (i.unit_price * i.quantity), 0)
      const total = subtotal

      // Insert order
      await client.query(
        `INSERT INTO orders (id, user_id, shift_id, order_number, status, dining_type, subtotal, total, synced, created_at)
         VALUES ($1, $2, $3, $4, 'completed', $5, $6, $7, true, $8)`,
        [id, req.user.id, shift_id, orderNumber, dining_type, subtotal, total, created_at || new Date()]
      )

      // Insert order items
      for (const item of items) {
        await client.query(
          `INSERT INTO order_items (order_id, product_id, quantity, unit_price, notes)
           VALUES ($1, $2, $3, $4, $5)`,
          [id, item.product_id, item.quantity, item.unit_price, item.notes || null]
        )
      }

      // Deduct stock via BOM engine
      await deductStock(client, items, id)

      // Insert payments
      for (const p of payArray) {
        await client.query(
          `INSERT INTO payments (order_id, method, amount, change_given, reference_note)
           VALUES ($1, $2, $3, $4, $5)`,
          [id, p.method, p.amount, p.change_given || 0, p.reference_note || null]
        )
      }

      await client.query(
        `INSERT INTO audit_logs (user_id, action, table_name, record_id, new_value)
         VALUES ($1, 'order_complete', 'orders', $2, $3)`,
        [req.user.id, id, JSON.stringify({ total, order_number: orderNumber })]
      )

      return { orderNumber, subtotal, total }
    })

    res.status(201).json({
      id,
      order_number: result.orderNumber,
      status: 'completed',
      total: result.total
    })
  } catch (err) {
    if (err.message === 'DUPLICATE_ORDER') {
      return res.status(409).json({ error: 'DUPLICATE_ORDER', id })
    }
    if (err.message === 'INSUFFICIENT_STOCK') {
      return res.status(422).json({
        error: 'INSUFFICIENT_STOCK',
        ingredient: err.ingredient,
        available: err.available,
        needed: err.needed
      })
    }
    if (err.message === 'COMBO_NOT_CONFIGURED') {
      return res.status(422).json({
        error: 'COMBO_NOT_CONFIGURED',
        product_id: err.product_id,
        product_name: err.product_name
      })
    }
    console.error('Order creation error:', err)
    res.status(500).json({ error: 'SERVER_ERROR' })
  }
})

// GET /api/orders — list orders
router.get('/', authenticate, async (req, res) => {
  try {
    const { shift_id, date } = req.query
    let sql = `SELECT o.id, o.order_number, o.status, o.dining_type, o.total, o.void_reason,
                      o.created_at, u.name AS cashier,
                      CASE 
                        WHEN COUNT(p.id) > 1 THEN 'split' 
                        ELSE MAX(p.method) 
                      END AS payment_method
               FROM orders o
               JOIN payments p ON p.order_id = o.id
               JOIN users u ON u.id = o.user_id
               WHERE 1=1`
    const params = []

    if (shift_id) { params.push(shift_id); sql += ` AND o.shift_id = $${params.length}` }
    if (date) {
      params.push(date)
      sql += ` AND DATE(o.created_at AT TIME ZONE 'Asia/Manila') = $${params.length}`
    } else {
      sql += ` AND DATE(o.created_at AT TIME ZONE 'Asia/Manila') = CURRENT_DATE`
    }

    sql += ` GROUP BY o.id, u.name ORDER BY o.created_at DESC`
    const { rows } = await query(sql, params)
    res.json(rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'SERVER_ERROR' })
  }
})

// GET /api/orders/:id — single order with items
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { rows: orders } = await query(
      `SELECT o.*, u.name AS cashier_name, p.method, p.amount AS paid, p.change_given, p.reference_note
       FROM orders o 
       JOIN payments p ON p.order_id = o.id
       JOIN users u ON u.id = o.user_id
       WHERE o.id = $1`, [req.params.id]
    )
    if (!orders.length) return res.status(404).json({ error: 'NOT_FOUND' })

    const { rows: items } = await query(
      `SELECT oi.*, pr.name AS product_name FROM order_items oi
       JOIN products pr ON pr.id = oi.product_id
       WHERE oi.order_id = $1`, [req.params.id]
    )

    res.json({ ...orders[0], items })
  } catch (err) {
    res.status(500).json({ error: 'SERVER_ERROR' })
  }
})

// PUT /api/orders/:id/void — void order
router.put('/:id/void', authenticate, async (req, res) => {
  const { reason = 'No reason provided' } = req.body
  try {
    await transaction(async (client) => {
      const { rows } = await client.query('SELECT status FROM orders WHERE id = $1', [req.params.id])
      if (!rows.length) throw Object.assign(new Error('NOT_FOUND'), { status: 404 })
      if (rows[0].status === 'voided') throw Object.assign(new Error('ALREADY_VOIDED'), { status: 409 })

      await client.query(
        `UPDATE orders SET status = 'voided', void_reason = $1 WHERE id = $2`,
        [reason, req.params.id]
      )

      await restoreStock(client, req.params.id)

      await client.query(
        `INSERT INTO audit_logs (user_id, action, table_name, record_id, new_value)
         VALUES ($1, 'void_order', 'orders', $2, $3)`,
        [req.user.id, req.params.id, JSON.stringify({ reason })]
      )
    })

    res.json({ id: req.params.id, status: 'voided' })
  } catch (err) {
    if (err.message === 'NOT_FOUND') return res.status(404).json({ error: 'NOT_FOUND' })
    if (err.message === 'ALREADY_VOIDED') return res.status(409).json({ error: 'ALREADY_VOIDED' })
    console.error(err)
    res.status(500).json({ error: 'SERVER_ERROR' })
  }
})

export default router
