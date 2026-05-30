import { Router } from 'express'
import { query, transaction } from '../db/index.js'
import { authenticate } from '../middleware/auth.js'
import { deductStock } from '../services/bom.js'

const router = Router()

// Generate order number
const generateOrderNumber = async (client) => {
  const { rows } = await client.query(`SELECT nextval('order_number_seq') AS seq`)
  return `LB-${String(rows[0].seq).padStart(4, '0')}`
}

// POST /api/sync/orders — bulk flush from offline queue
router.post('/orders', authenticate, async (req, res) => {
  const { orders } = req.body
  if (!Array.isArray(orders)) {
    return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'orders must be array' })
  }

  const results = []

  for (const order of orders) {
    try {
      await transaction(async (client) => {
        // Idempotency check
        const { rows: existing } = await client.query('SELECT id FROM orders WHERE id = $1', [order.id])
        if (existing.length > 0) {
          results.push({ id: order.id, status: 'duplicate' })
          return
        }

        const orderNumber = await generateOrderNumber(client)
        const subtotal = order.items.reduce((sum, i) => sum + (i.unit_price * i.quantity), 0)

        await client.query(
          `INSERT INTO orders (id, user_id, shift_id, order_number, status, dining_type, subtotal, total, synced, created_at)
           VALUES ($1, $2, $3, $4, 'completed', $5, $6, $7, true, $8)`,
          [order.id, order.user_id || req.user.id, order.shift_id, orderNumber,
           order.dining_type || 'dine_in', subtotal, subtotal, order.created_at || new Date()]
        )

        for (const item of order.items) {
          await client.query(
            `INSERT INTO order_items (order_id, product_id, quantity, unit_price, notes)
             VALUES ($1, $2, $3, $4, $5)`,
            [order.id, item.product_id, item.quantity, item.unit_price, item.notes || null]
          )
        }

        await deductStock(client, order.items, order.id)

        const payArray = order.payments || (order.payment ? [order.payment] : [])
        for (const p of payArray) {
          await client.query(
            `INSERT INTO payments (order_id, method, amount, change_given, reference_note)
             VALUES ($1, $2, $3, $4, $5)`,
            [order.id, p.method, p.amount,
             p.change_given || 0, p.reference_note || null]
          )
        }

        results.push({ id: order.id, status: 'created' })
      })
    } catch (err) {
      if (err.message === 'INSUFFICIENT_STOCK') {
        results.push({ id: order.id, status: 'error', reason: 'INSUFFICIENT_STOCK', ingredient: err.ingredient })
      } else if (err.message === 'COMBO_NOT_CONFIGURED') {
        results.push({ id: order.id, status: 'error', reason: 'COMBO_NOT_CONFIGURED', product_name: err.product_name })
      } else {
        results.push({ id: order.id, status: 'error', reason: err.message })
      }
    }
  }

  res.json({ results })
})

// GET /api/sync/snapshot — fresh catalog + stock for IndexedDB
router.get('/snapshot', authenticate, async (req, res) => {
  try {
    const [products, categories, ingredients] = await Promise.all([
      query(`SELECT p.*, c.name AS category_name,
              COALESCE(
                json_agg(json_build_object('ingredient_id', pr.ingredient_id, 'quantity_used', pr.quantity_used))
                FILTER (WHERE pr.ingredient_id IS NOT NULL), '[]'
              ) AS recipe
             FROM products p
             LEFT JOIN categories c ON c.id = p.category_id
             LEFT JOIN product_recipes pr ON pr.product_id = p.id
             WHERE p.deleted_at IS NULL
             GROUP BY p.id, c.name
             ORDER BY p.name`),
      query(`SELECT * FROM categories WHERE is_active = true ORDER BY sort_order`),
      query(`SELECT *, current_stock < low_stock_alert AS is_low
             FROM ingredients WHERE deleted_at IS NULL ORDER BY name`)
    ])

    res.json({
      products: products.rows,
      categories: categories.rows,
      ingredients: ingredients.rows,
      snapshot_at: new Date()
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'SERVER_ERROR' })
  }
})

export default router
