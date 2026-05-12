import { Router } from 'express'
import bcrypt from 'bcrypt'
import { query } from '../db/index.js'
import { authenticate, requireAdmin } from '../middleware/auth.js'
import { z } from 'zod'
import { validate } from '../middleware/validate.js'

const userCreateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  pin: z.string().min(4, 'PIN must be at least 4 digits').max(10),
  role: z.enum(['admin', 'cashier']).default('cashier')
})

const userUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  pin: z.string().min(4).max(10).optional(),
  role: z.enum(['admin', 'cashier']).optional(),
  is_active: z.boolean().optional()
})

const router = Router()

// GET /api/users — list all users (admin only)
router.get('/', authenticate, requireAdmin, async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT 
        u.id, 
        u.name, 
        u.role, 
        u.is_active, 
        u.created_at, 
        u.deleted_at,
        EXISTS (SELECT 1 FROM shifts s WHERE s.user_id = u.id AND s.ended_at IS NULL) AS is_online
      FROM users u 
      WHERE u.deleted_at IS NULL
      ORDER BY u.role DESC, u.name ASC`
    )
    res.json(rows)
  } catch (err) {
    console.error('List users error:', err)
    res.status(500).json({ error: 'SERVER_ERROR' })
  }
})

// POST /api/users — create a new user (admin only)
router.post('/', authenticate, requireAdmin, validate(userCreateSchema), async (req, res) => {
  const { name, pin, role = 'cashier' } = req.body
  try {
    const pin_hash = await bcrypt.hash(String(pin), 10)
    const { rows } = await query(
      `INSERT INTO users (name, pin_hash, role) VALUES ($1, $2, $3) RETURNING id, name, role, is_active, created_at`,
      [name, pin_hash, role]
    )
    res.status(201).json(rows[0])
  } catch (err) {
    console.error('Create user error:', err)
    res.status(500).json({ error: 'SERVER_ERROR' })
  }
})

// PUT /api/users/:id — update user info (admin only)
router.put('/:id', authenticate, requireAdmin, validate(userUpdateSchema), async (req, res) => {
  const { name, pin, role, is_active } = req.body
  try {
    const updates = []
    const values = []
    let idx = 1

    if (name !== undefined) { updates.push(`name = $${idx++}`); values.push(name) }
    if (role !== undefined) { updates.push(`role = $${idx++}`); values.push(role) }
    if (is_active !== undefined) { updates.push(`is_active = $${idx++}`); values.push(is_active) }
    if (pin !== undefined && pin !== '') {
      const pin_hash = await bcrypt.hash(String(pin), 10)
      updates.push(`pin_hash = $${idx++}`); values.push(pin_hash)
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'No fields to update' })
    }

    values.push(req.params.id)
    const { rows } = await query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = $${idx} RETURNING id, name, role, is_active, created_at`,
      values
    )

    if (rows.length === 0) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'User not found' })
    }
    res.json(rows[0])
  } catch (err) {
    console.error('Update user error:', err)
    res.status(500).json({ error: 'SERVER_ERROR' })
  }
})

// DELETE /api/users/:id — soft delete user (admin only)
router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    // Prevent self-delete
    if (req.params.id === req.user.id) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Cannot delete your own account' })
    }
    const { rows } = await query(
      `UPDATE users SET deleted_at = NOW(), is_active = false WHERE id = $1 AND deleted_at IS NULL RETURNING id`,
      [req.params.id]
    )
    if (rows.length === 0) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'User not found' })
    }
    res.json({ ok: true })
  } catch (err) {
    console.error('Delete user error:', err)
    res.status(500).json({ error: 'SERVER_ERROR' })
  }
})

export default router
