import { Router } from 'express'
import { query, transaction } from '../db/index.js'
import { authenticate, requireAdmin } from '../middleware/auth.js'
import { z } from 'zod'
import { validate } from '../middleware/validate.js'

const ingredientSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  unit: z.string().min(1, 'Unit is required').max(30),
  current_stock: z.number().optional(),
  low_stock_alert: z.number().nonnegative().optional()
})

const restockSchema = z.object({
  quantity: z.number().positive('Quantity must be positive'),
  note: z.string().max(255).optional()
})

const productUpdateSchema = z.object({
  name: z.string().min(1).max(150).optional(),
  price: z.number().nonnegative().optional(),
  is_available: z.boolean().optional(),
  image_url: z.string().url().max(500).optional().nullable(),
  category_id: z.string().min(1).optional(),
  is_combo: z.boolean().optional()
})

const recipeSchema = z.object({
  ingredients: z.array(z.object({
    ingredient_id: z.string().min(1),
    quantity_used: z.number().positive()
  })).min(1, 'Recipe must have at least one ingredient')
})

const router = Router()

// GET /api/ingredients
router.get('/', authenticate, async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT *, current_stock < low_stock_alert AS is_low FROM ingredients
       WHERE deleted_at IS NULL ORDER BY name`
    )
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: 'SERVER_ERROR' })
  }
})

// POST /api/ingredients — create ingredient
router.post('/', authenticate, requireAdmin, validate(ingredientSchema), async (req, res) => {
  const { name, unit, current_stock = 0, low_stock_alert = 10 } = req.body
  try {
    const { rows } = await query(
      `INSERT INTO ingredients (name, unit, current_stock, low_stock_alert)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [name, unit, current_stock, low_stock_alert]
    )
    await query(
      `INSERT INTO audit_logs (user_id, action, table_name, record_id, new_value)
       VALUES ($1, 'create_ingredient', 'ingredients', $2, $3)`,
      [req.user.id, rows[0].id, JSON.stringify(rows[0])]
    )
    res.status(201).json(rows[0])
  } catch (err) {
    res.status(500).json({ error: 'SERVER_ERROR' })
  }
})

// PUT /api/ingredients/:id
router.put('/:id', authenticate, requireAdmin, validate(ingredientSchema.partial()), async (req, res) => {
  const { name, unit, low_stock_alert } = req.body
  try {
    const { rows } = await query(
      `UPDATE ingredients SET
        name = COALESCE($1, name),
        unit = COALESCE($2, unit),
        low_stock_alert = COALESCE($3, low_stock_alert)
       WHERE id = $4 AND deleted_at IS NULL RETURNING *`,
      [name, unit, low_stock_alert, req.params.id]
    )
    if (!rows.length) return res.status(404).json({ error: 'NOT_FOUND' })
    res.json(rows[0])
  } catch (err) {
    res.status(500).json({ error: 'SERVER_ERROR' })
  }
})

// DELETE /api/ingredients/:id — soft delete
router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const { rows: before } = await query('SELECT name FROM ingredients WHERE id = $1', [req.params.id])
    const { rowCount } = await query(
      `UPDATE ingredients SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL`,
      [req.params.id]
    )
    if (!rowCount) return res.status(404).json({ error: 'NOT_FOUND' })
    
    if (before.length) {
      await query(
        `INSERT INTO audit_logs (user_id, action, table_name, record_id, new_value)
         VALUES ($1, 'delete_ingredient', 'ingredients', $2, $3)`,
        [req.user.id, req.params.id, JSON.stringify({ name: before[0].name })]
      )
    }
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: 'SERVER_ERROR' })
  }
})

// POST /api/ingredients/:id/restock
router.post('/:id/restock', authenticate, validate(restockSchema), async (req, res) => {
  const { quantity, note = 'manual restock' } = req.body

  try {
    const result = await transaction(async (client) => {
      const { rows } = await client.query(
        `UPDATE ingredients SET current_stock = current_stock + $1
         WHERE id = $2 AND deleted_at IS NULL RETURNING id, name, current_stock`,
        [quantity, req.params.id]
      )
      if (!rows.length) throw Object.assign(new Error('NOT_FOUND'), { status: 404 })

      await client.query(
        `INSERT INTO stock_movements (ingredient_id, movement_type, quantity, note)
         VALUES ($1, 'restock', $2, $3)`,
        [req.params.id, quantity, note]
      )

      await client.query(
        `INSERT INTO audit_logs (user_id, action, table_name, record_id, new_value)
         VALUES ($1, 'restock', 'ingredients', $2, $3)`,
        [req.user.id, req.params.id, JSON.stringify({ name: rows[0].name, quantity, note })]
      )

      return rows[0]
    })

    res.json({ ingredient_id: req.params.id, new_stock: result.current_stock })
  } catch (err) {
    if (err.message === 'NOT_FOUND') return res.status(404).json({ error: 'NOT_FOUND' })
    res.status(500).json({ error: 'SERVER_ERROR' })
  }
})

// GET /api/products — full list
router.get('/products', authenticate, async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT p.*, c.name AS category_name FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       WHERE p.deleted_at IS NULL ORDER BY c.sort_order, p.name`
    )
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: 'SERVER_ERROR' })
  }
})

// PUT /api/products/:id
router.put('/products/:id', authenticate, requireAdmin, validate(productUpdateSchema), async (req, res) => {
  const { name, price, is_available, image_url } = req.body
  try {
    const { rows: before } = await query('SELECT * FROM products WHERE id = $1', [req.params.id])
    if (!before.length) return res.status(404).json({ error: 'NOT_FOUND' })

    const { rows } = await query(
      `UPDATE products SET
        name = COALESCE($1, name),
        price = COALESCE($2, price),
        is_available = COALESCE($3, is_available),
        image_url = COALESCE($4, image_url),
        is_combo = COALESCE($5, is_combo)
       WHERE id = $6 RETURNING *`,
      [name, price, is_available, image_url, req.body.is_combo, req.params.id]
    )

    await query(
      `INSERT INTO audit_logs (user_id, action, table_name, record_id, old_value, new_value)
       VALUES ($1, 'update_product', 'products', $2, $3, $4)`,
      [req.user.id, req.params.id, JSON.stringify(before[0]), JSON.stringify(rows[0])]
    )

    res.json(rows[0])
  } catch (err) {
    res.status(500).json({ error: 'SERVER_ERROR' })
  }
})

// GET /api/products/:id/recipe
router.get('/products/:id/recipe', authenticate, async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT pr.*, i.name AS ingredient_name, i.unit FROM product_recipes pr
       JOIN ingredients i ON i.id = pr.ingredient_id
       WHERE pr.product_id = $1`, [req.params.id]
    )
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: 'SERVER_ERROR' })
  }
})

// PUT /api/products/:id/recipe — replace entire recipe
router.put('/products/:id/recipe', authenticate, requireAdmin, validate(recipeSchema), async (req, res) => {
  const { ingredients } = req.body // [{ ingredient_id, quantity_used }]

  try {
    await transaction(async (client) => {
      await client.query('DELETE FROM product_recipes WHERE product_id = $1', [req.params.id])
      for (const ing of ingredients) {
        await client.query(
          `INSERT INTO product_recipes (product_id, ingredient_id, quantity_used)
           VALUES ($1, $2, $3)`,
          [req.params.id, ing.ingredient_id, ing.quantity_used]
        )
      }
    })
    res.json({ product_id: req.params.id, ingredients })
  } catch (err) {
    res.status(500).json({ error: 'SERVER_ERROR' })
  }
})

// POST /api/products — create product
router.post('/products', authenticate, requireAdmin, async (req, res) => {
  const { name, price, category_id, is_available = true, is_combo = false, image_url } = req.body
  if (!name || !price || !category_id) return res.status(400).json({ error: 'VALIDATION_ERROR' })
  try {
    const { rows } = await query(
      `INSERT INTO products (name, price, category_id, is_available, is_combo, image_url)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [name, price, category_id, is_available, is_combo, image_url]
    )
    await query(
      `INSERT INTO audit_logs (user_id, action, table_name, record_id, new_value)
       VALUES ($1, 'create_product', 'products', $2, $3)`,
      [req.user.id, rows[0].id, JSON.stringify(rows[0])]
    )
    res.status(201).json(rows[0])
  } catch (err) {
    res.status(500).json({ error: 'SERVER_ERROR' })
  }
})

// DELETE /api/products/:id — soft delete
router.delete('/products/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const { rows: before } = await query('SELECT name FROM products WHERE id = $1', [req.params.id])
    const { rowCount } = await query(
      `UPDATE products SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL`,
      [req.params.id]
    )
    if (!rowCount) return res.status(404).json({ error: 'NOT_FOUND' })

    if (before.length) {
      await query(
        `INSERT INTO audit_logs (user_id, action, table_name, record_id, new_value)
         VALUES ($1, 'delete_product', 'products', $2, $3)`,
        [req.user.id, req.params.id, JSON.stringify({ name: before[0].name })]
      )
    }
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: 'SERVER_ERROR' })
  }
})

// GET /api/products/:id/combo-items
router.get('/products/:id/combo-items', authenticate, async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT ci.*, p.name AS product_name, p.price FROM combo_items ci
       JOIN products p ON p.id = ci.product_id
       WHERE ci.combo_id = $1`, [req.params.id]
    )
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: 'SERVER_ERROR' })
  }
})

// PUT /api/products/:id/combo-items
router.put('/products/:id/combo-items', authenticate, requireAdmin, async (req, res) => {
  const { items } = req.body // [{ product_id, quantity }]
  try {
    await transaction(async (client) => {
      await client.query('DELETE FROM combo_items WHERE combo_id = $1', [req.params.id])
      for (const item of items) {
        await client.query(
          `INSERT INTO combo_items (combo_id, product_id, quantity)
           VALUES ($1, $2, $3)`,
          [req.params.id, item.product_id, item.quantity]
        )
      }
    })
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: 'SERVER_ERROR' })
  }
})

// GET /api/categories — full list
router.get('/categories', authenticate, async (req, res) => {
  try {
    const { rows } = await query(`SELECT * FROM categories WHERE is_active = true ORDER BY sort_order`)
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: 'SERVER_ERROR' })
  }
})

export default router
