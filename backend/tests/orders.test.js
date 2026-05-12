import { describe, it, expect, beforeAll, afterAll } from '@jest/globals'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import app from '../src/index.js'
import { getClient } from '../src/db/index.js'
import { seedTestData, getStock, getOrderCount } from './setup.js'
import dotenv from 'dotenv'
dotenv.config()

const PATTY  = 'test-ing-0001-0000-0000-000000000000'
const BUN    = 'test-ing-0002-0000-0000-000000000000'
const BURGER = 'test-prd-0001-0000-0000-000000000000'
const COMBO  = 'test-prd-0002-0000-0000-000000000000'
const ADMIN  = 'test-usr-0001-0000-0000-000000000000'
const CASHIER= 'test-usr-0002-0000-0000-000000000000'

const makeToken = (userId, role) =>
  jwt.sign({ id: userId, name: 'Test', role }, process.env.JWT_SECRET, { expiresIn: '1h' })

const makeOrder = (overrides = {}) => ({
  id: `test-order-api-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  shift_id: null,
  dining_type: 'dine_in',
  items: [{ product_id: BURGER, quantity: 1, unit_price: 99.00, notes: null }],
  payment: { method: 'cash', amount: 100.00, change_given: 1.00, reference_note: null },
  created_at: new Date().toISOString(),
  ...overrides
})

let client
let adminToken
let cashierToken

beforeAll(async () => {
  client = await getClient()
  await client.query('BEGIN')
  await seedTestData(client)
  adminToken   = makeToken(ADMIN, 'admin')
  cashierToken = makeToken(CASHIER, 'cashier')
})

afterAll(async () => {
  await client.query('ROLLBACK')
  client.release()
})

describe('POST /api/orders — order creation', () => {

  it('creates an order and returns 201 with order_number', async () => {
    const order = makeOrder()
    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${cashierToken}`)
      .send(order)

    expect(res.status).toBe(201)
    expect(res.body.order_number).toMatch(/^LB-/)
    expect(res.body.status).toBe('completed')
  })

  it('deducts ingredients from stock on order creation', async () => {
    // Get fresh stock values via the API (global DB, not the rolled-back client)
    const before = await request(app)
      .get('/api/inventory')
      .set('Authorization', `Bearer ${adminToken}`)

    const beforePatty = parseFloat(before.body.find(i => i.id === PATTY)?.current_stock || 0)

    const order = makeOrder()
    await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${cashierToken}`)
      .send(order)

    const after = await request(app)
      .get('/api/inventory')
      .set('Authorization', `Bearer ${adminToken}`)

    const afterPatty = parseFloat(after.body.find(i => i.id === PATTY)?.current_stock || 0)
    expect(afterPatty).toBe(beforePatty - 1)
  })

  it('returns 409 DUPLICATE_ORDER for same UUID submitted twice', async () => {
    const order = makeOrder()

    const first = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${cashierToken}`)
      .send(order)
    expect(first.status).toBe(201)

    const second = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${cashierToken}`)
      .send(order)
    expect(second.status).toBe(409)
    expect(second.body.error).toBe('DUPLICATE_ORDER')
  })

  it('returns 422 INSUFFICIENT_STOCK when ingredient is depleted', async () => {
    // Zero out patty via restock endpoint (negative is not allowed, so set directly via SQL)
    await request(app)
      .post(`/api/inventory/${PATTY}/restock`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ quantity: -9999 })   // Will be rejected (qty must be >0)

    // Use SQL to force zero (only in test context)
    const db = await import('../src/db/index.js')
    await db.query(`UPDATE ingredients SET current_stock = 0 WHERE id = $1`, [PATTY])

    const order = makeOrder()
    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${cashierToken}`)
      .send(order)

    expect(res.status).toBe(422)
    expect(res.body.error).toBe('INSUFFICIENT_STOCK')
    expect(res.body.ingredient).toBe('Test Patty')

    // Restore stock
    await db.query(`UPDATE ingredients SET current_stock = 10 WHERE id = $1`, [PATTY])
  })

  it('requires a valid JWT', async () => {
    const res = await request(app)
      .post('/api/orders')
      .send(makeOrder())
    expect(res.status).toBe(401)
  })

  it('returns 400 when required fields are missing', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({ id: 'some-id' })  // missing items and payment
    expect(res.status).toBe(400)
  })
})

describe('POST /api/sync/orders — bulk sync', () => {

  it('processes a batch and returns per-order status', async () => {
    const orders = [makeOrder(), makeOrder(), makeOrder()]
    const res = await request(app)
      .post('/api/sync/orders')
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({ orders })

    expect(res.status).toBe(200)
    expect(res.body.results).toHaveLength(3)
    res.body.results.forEach(r => expect(r.status).toBe('created'))
  })

  it('marks duplicates without error in a mixed batch', async () => {
    const unique = makeOrder()
    const dup    = makeOrder()

    // Submit dup first so it exists
    await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${cashierToken}`)
      .send(dup)

    const res = await request(app)
      .post('/api/sync/orders')
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({ orders: [unique, dup] })

    expect(res.body.results.find(r => r.id === unique.id).status).toBe('created')
    expect(res.body.results.find(r => r.id === dup.id).status).toBe('duplicate')
  })

  it('does not double-deduct stock when same order synced twice', async () => {
    const db = await import('../src/db/index.js')
    const { rows: before } = await db.query(
      'SELECT current_stock FROM ingredients WHERE id = $1', [PATTY]
    )
    const stockBefore = parseFloat(before[0].current_stock)

    const order = makeOrder()
    await request(app)
      .post('/api/sync/orders')
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({ orders: [order] })

    await request(app)
      .post('/api/sync/orders')
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({ orders: [order] })

    const { rows: after } = await db.query(
      'SELECT current_stock FROM ingredients WHERE id = $1', [PATTY]
    )
    expect(parseFloat(after[0].current_stock)).toBe(stockBefore - 1)
  })

  it('preserves offline created_at timestamp', async () => {
    const offlineTime = '2025-01-15T10:32:00.000Z'
    const order = makeOrder({ created_at: offlineTime })

    await request(app)
      .post('/api/sync/orders')
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({ orders: [order] })

    const res = await request(app)
      .get(`/api/orders/${order.id}`)
      .set('Authorization', `Bearer ${cashierToken}`)

    expect(new Date(res.body.created_at).toISOString()).toBe(offlineTime)
  })

  it('handles empty batch gracefully', async () => {
    const res = await request(app)
      .post('/api/sync/orders')
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({ orders: [] })

    expect(res.status).toBe(200)
    expect(res.body.results).toHaveLength(0)
  })
})

describe('PUT /api/orders/:id/void — void order', () => {

  it('voids an order and restores stock', async () => {
    const db = await import('../src/db/index.js')
    const { rows: before } = await db.query(
      'SELECT current_stock FROM ingredients WHERE id = $1', [PATTY]
    )
    const stockBefore = parseFloat(before[0].current_stock)

    const order = makeOrder()
    const created = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${cashierToken}`)
      .send(order)

    expect(created.status).toBe(201)

    const voided = await request(app)
      .put(`/api/orders/${order.id}/void`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'test void' })

    expect(voided.status).toBe(200)
    expect(voided.body.status).toBe('voided')

    const { rows: after } = await db.query(
      'SELECT current_stock FROM ingredients WHERE id = $1', [PATTY]
    )
    expect(parseFloat(after[0].current_stock)).toBe(stockBefore)
  })

  it('blocks cashier from voiding orders', async () => {
    const order = makeOrder()
    await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${cashierToken}`)
      .send(order)

    const res = await request(app)
      .put(`/api/orders/${order.id}/void`)
      .set('Authorization', `Bearer ${cashierToken}`)
      .send({ reason: 'cashier trying to void' })

    expect(res.status).toBe(403)
  })
})

describe('Auth guards', () => {

  it('blocks cashier from inventory routes', async () => {
    const res = await request(app)
      .get('/api/inventory')
      .set('Authorization', `Bearer ${cashierToken}`)
    expect(res.status).toBe(403)
  })

  it('blocks cashier from sales reports', async () => {
    const res = await request(app)
      .get('/api/reports/sales')
      .set('Authorization', `Bearer ${cashierToken}`)
    expect(res.status).toBe(403)
  })

  it('rejects expired tokens', async () => {
    const expiredToken = jwt.sign(
      { id: CASHIER, role: 'cashier' },
      process.env.JWT_SECRET,
      { expiresIn: '-1s' }
    )
    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${expiredToken}`)
      .send(makeOrder())
    expect(res.status).toBe(401)
  })
})
