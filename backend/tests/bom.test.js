import { describe, it, expect, beforeAll, afterAll } from '@jest/globals'
import { getClient } from '../src/db/index.js'
import { deductStock, restoreStock } from '../src/services/bom.js'
import { seedTestData, getStock } from './setup.js'

const PATTY  = 'test-ing-0001-0000-0000-000000000000'
const BUN    = 'test-ing-0002-0000-0000-000000000000'
const FRIES  = 'test-ing-0003-0000-0000-000000000000'
const BURGER = 'test-prd-0001-0000-0000-000000000000'
const COMBO  = 'test-prd-0002-0000-0000-000000000000'
const ORDER  = 'test-order-bom-000000000000000000001'

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

describe('BOM deduction engine', () => {

  it('deducts correct ingredient quantities for a single burger', async () => {
    const beforePatty = await getStock(client, PATTY)
    const beforeBun   = await getStock(client, BUN)

    await deductStock(client, [{ product_id: BURGER, quantity: 2 }], ORDER)

    const afterPatty = await getStock(client, PATTY)
    const afterBun   = await getStock(client, BUN)

    expect(afterPatty).toBe(beforePatty - 2)
    expect(afterBun).toBe(beforeBun - 2)
  })

  it('deducts all BOM ingredients for a combo', async () => {
    const before = {
      patty: await getStock(client, PATTY),
      bun:   await getStock(client, BUN),
      fries: await getStock(client, FRIES),
    }

    const orderId = 'test-order-bom-000000000000000000002'
    await deductStock(client, [{ product_id: COMBO, quantity: 1 }], orderId)

    expect(await getStock(client, PATTY)).toBe(before.patty - 1)
    expect(await getStock(client, BUN)).toBe(before.bun - 1)
    expect(await getStock(client, FRIES)).toBe(before.fries - 1)
  })

  it('throws INSUFFICIENT_STOCK when ingredient is at 0', async () => {
    // Zero out patty stock
    await client.query(`UPDATE ingredients SET current_stock = 0 WHERE id = $1`, [PATTY])

    const orderId = 'test-order-bom-000000000000000000003'
    await expect(
      deductStock(client, [{ product_id: BURGER, quantity: 1 }], orderId)
    ).rejects.toMatchObject({ message: 'INSUFFICIENT_STOCK', ingredient: 'Test Patty' })

    // Restore for next test
    await client.query(`UPDATE ingredients SET current_stock = 10 WHERE id = $1`, [PATTY])
  })

  it('does not partially deduct when one ingredient fails', async () => {
    // Patty ok, BUN at 0
    await client.query(`UPDATE ingredients SET current_stock = 0 WHERE id = $1`, [BUN])

    const beforePatty = await getStock(client, PATTY)
    const orderId = 'test-order-bom-000000000000000000004'

    await expect(
      deductStock(client, [{ product_id: BURGER, quantity: 1 }], orderId)
    ).rejects.toMatchObject({ message: 'INSUFFICIENT_STOCK' })

    // Patty should be untouched — check-before-deduct prevents partial writes
    expect(await getStock(client, PATTY)).toBe(beforePatty)

    await client.query(`UPDATE ingredients SET current_stock = 10 WHERE id = $1`, [BUN])
  })

  it('restores stock when order is voided', async () => {
    const orderId = 'test-order-bom-000000000000000000005'

    // Create a real order row first (restoreStock needs it)
    await client.query(`
      INSERT INTO orders (id, user_id, order_number, subtotal, total, status)
      VALUES ($1, 'test-usr-0001-0000-0000-000000000000', 'TEST-VOID', 99, 99, 'completed')`,
      [orderId])

    const beforePatty = await getStock(client, PATTY)
    await deductStock(client, [{ product_id: BURGER, quantity: 1 }], orderId)
    expect(await getStock(client, PATTY)).toBe(beforePatty - 1)

    await restoreStock(client, orderId)
    expect(await getStock(client, PATTY)).toBe(beforePatty)
  })

  it('skips deduction gracefully for products with no recipe', async () => {
    // Insert a product with no recipe
    await client.query(`
      INSERT INTO products (id, category_id, name, price)
      VALUES ('test-prd-0099-0000-0000-000000000000',
              'test-cat-0001-0000-0000-000000000000', 'Water', 10.00)
      ON CONFLICT DO NOTHING`)

    const orderId = 'test-order-bom-000000000000000000006'
    // Should not throw even with no recipe rows
    await expect(
      deductStock(client, [{ product_id: 'test-prd-0099-0000-0000-000000000000', quantity: 1 }], orderId)
    ).resolves.toBeUndefined()
  })
})
