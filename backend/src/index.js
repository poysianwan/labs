import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import authRoutes from './routes/auth.js'
import orderRoutes from './routes/orders.js'
import syncRoutes from './routes/sync.js'
import inventoryRoutes from './routes/inventory.js'
import reportRoutes from './routes/reports.js'
import userRoutes from './routes/users.js'

import helmet from 'helmet'
import rateLimit from 'express-rate-limit'

dotenv.config()

const app = express()

// Security Headers
app.use(helmet())

// Global Rate Limiting
const globalLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // 100 requests per IP
  message: { error: 'TOO_MANY_REQUESTS', message: 'Too many requests, please try again later.' }
})
app.use(globalLimiter)

// Login Rate Limiting (Strict)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts
  message: { error: 'TOO_MANY_ATTEMPTS', message: 'Too many login attempts. Please wait 15 minutes.' }
})

app.use(cors({
  origin: process.env.FRONTEND_URL || '*', // Allow all for now since user has no domain, but prefer env
  credentials: true
}))
app.use(express.json({ limit: '1mb' })) // Lowered from 5mb for safety

// Apply login limit specifically to auth routes
app.use('/api/auth/login', loginLimiter)

// Health check
app.get('/health', (req, res) => res.json({ ok: true, time: new Date() }))
app.get('/api/health', (req, res) => res.json({ ok: true, time: new Date() }))

// Routes
app.use('/api/auth', authRoutes)
app.use('/api/orders', orderRoutes)
app.use('/api/sync', syncRoutes)
app.use('/api/inventory', inventoryRoutes)
app.use('/api/reports', reportRoutes)
app.use('/api/users', userRoutes)

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err)
  res.status(500).json({ error: 'SERVER_ERROR', message: err.message })
})

const PORT = process.env.PORT || 3001

// Only start the server if we're not running in a serverless environment (like Vercel)
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`🍔 Labs Burger API running on port ${PORT}`)
  })
}

export default app
