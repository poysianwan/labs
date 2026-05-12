import { describe, it, expect, beforeAll, afterAll } from '@jest/globals'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import app from '../src/index.js'
import { seedTestData } from './setup.js'
import { getClient, query } from '../src/db/index.js'
import dotenv from 'dotenv'
dotenv.config()

const PATTY  = 'test-ing-0001-0000-0000-000000000000'
const BURGER = 'test-prd-0001-0000-0000-000000000000'
const ADMIN  = 'test-usr-0001-0000-0000-000000000000'

const adminToken = jwt.sign({ id: ADMIN, name: 'Admin', role: 'admin' }, process.env.JWT_SECRET || 'test', { expiresIn: '1h' })

let client

beforeAll(async () => {
  client = await getClient()
  await client.query('BEGIN')
  await seedTestData(client)
})

afterAll(async () => {
  await client.query('ROLLBACK')
  client.release()
})

describe('Inventory — restock', () => {

  it('increases stock and writes a movement row', async () => {
    const { rows: before } = await query('SELECT current_stock FROM ingredients WHERE id = $1', [PATTY])
    const stockBefore = parseFloat(before[0].current_stock)

    const res = await request(app)
      .post(`/api/inventory/${PATTY}/restock`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ quantity: 50, note: 'test delivery' })

    expect(res.status).toBe(200)
    expect(parseFloat(res.body.new_stock)).toBe(stockBefore + 50)

    const { rows: movements } = await query(
      `SELECT * FROM stock_movements WHERE ingredient_id = $1 AND movement_type = 'restock' ORDER BY created_at DESC LIMIT 1`,
      [PATTY]
    )
    expect(movements).toHaveLength(1)
    expect(parseFloat(movements[0].quantity)).toBe(50)
    expect(movements[0].note).toBe('test delivery')
  })

  it('rejects quantity of 0 or negative', async () => {
    const res = await request(app)
      .post(`/api/inventory/${PATTY}/restock`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ quantity: -5 })
    expect(res.status).toBe(400)
  })

  it('returns is_low: true when below alert threshold', async () => {
    await query(`UPDATE ingredients SET current_stock = 2, low_stock_alert = 5 WHERE id = $1`, [PATTY])

    const res = await request(app)
      .get('/api/inventory')
      .set('Authorization', `Bearer ${adminToken}`)

    const patty = res.body.find(i => i.id === PATTY)
    expect(patty.is_low).toBe(true)
  })
})

describe('Inventory — product recipe editor', () => {

  it('replaces recipe and reads back correctly', async () => {
    const newRecipe = [
      { ingredient_id: PATTY, quantity_used: 2 }  // Double patty
    ]

    const save = await request(app)
      .put(`/api/inventory/products/${BURGER}/recipe`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ingredients: newRecipe })

    expect(save.status).toBe(200)

    const read = await request(app)
      .get(`/api/inventory/products/${BURGER}/recipe`)
      .set('Authorization', `Bearer ${adminToken}`)

    expect(read.body).toHaveLength(1)
    expect(parseFloat(read.body[0].quantity_used)).toBe(2)
  })

  it('clears recipe when empty array sent', async () => {
    const res = await request(app)
      .put(`/api/inventory/products/${BURGER}/recipe`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ingredients: [] })

    expect(res.status).toBe(200)

    const read = await request(app)
      .get(`/api/inventory/products/${BURGER}/recipe`)
      .set('Authorization', `Bearer ${adminToken}`)

    expect(read.body).toHaveLength(0)
  })
})
