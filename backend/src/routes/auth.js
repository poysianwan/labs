import { Router } from 'express'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { query } from '../db/index.js'
import { authenticate } from '../middleware/auth.js'

import { z } from 'zod'
import { validate } from '../middleware/validate.js'

const loginSchema = z.object({
  pin: z.string().min(4, 'PIN must be at least 4 digits').max(10, 'PIN too long')
})

const router = Router()

router.post('/login', validate(loginSchema), async (req, res) => {
  try {
    const { pin } = req.body
    if (!pin) return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'PIN required' })

    const { rows } = await query(
      `SELECT id, name, role, pin_hash FROM users WHERE is_active = true AND deleted_at IS NULL ORDER BY role DESC`
    )

    let matchedUser = null
    for (const user of rows) {
      const match = await bcrypt.compare(String(pin), user.pin_hash)
      if (match) { matchedUser = user; break }
    }

    if (!matchedUser) {
      return res.status(401).json({ error: 'INVALID_PIN', message: 'Incorrect PIN' })
    }

    const token = jwt.sign(
      { id: matchedUser.id, name: matchedUser.name, role: matchedUser.role },
      process.env.JWT_SECRET,
      { expiresIn: '12h' }
    )

    res.json({
      token,
      user: { id: matchedUser.id, name: matchedUser.name, role: matchedUser.role }
    })
  } catch (err) {
    console.error('Login error:', err)
    res.status(500).json({ error: 'SERVER_ERROR' })
  }
})

router.post('/logout', authenticate, (req, res) => {
  res.json({ ok: true })
})

export default router
