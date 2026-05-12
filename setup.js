import { query, transaction } from '../src/db/index.js'

// Wrap each test in a transaction that rolls back after
// so tests never pollute each other
export const withTestDB = (fn) => async () => {
  const client = await (await import('../src/db/index.js')).getClient()
  await client.query('BEGIN')
  try {
    await fn(client)
  } finally {
    await client.query('ROLLBACK')
    client.release()
  }
}

// Seed a minimal test dataset inside a transaction
export const seedTestData = async (client) => {
  // Category
  await client.query(`INSERT INTO categories (id, name, sort_order) VALUES
    ('test-cat-0001-0000-0000-000000000000', 'Test Burgers', 1) ON CONFLICT DO NOTHING`)

  // Ingredients
  await client.query(`INSERT INTO ingredients (id, name, unit, current_stock, low_stock_alert) VALUES
    ('test-ing-0001-0000-0000-000000000000', 'Test Patty',   'pcs', 10, 5),
    ('test-ing-0002-0000-0000-000000000000', 'Test Bun',     'pcs', 10, 5),
    ('test-ing-0003-0000-0000-000000000000', 'Test Fries',   'pcs', 10, 5)
    ON CONFLICT DO NOTHING`)

  // Products
  await client.query(`INSERT INTO products (id, category_id, name, price, is_combo) VALUES
    ('test-prd-0001-0000-0000-000000000000', 'test-cat-0001-0000-0000-000000000000', 'Test Burger', 99.00, false),
    ('test-prd-0002-0000-0000-000000000000', 'test-cat-0001-0000-0000-000000000000', 'Test Combo',  149.00, true)
    ON CONFLICT DO NOTHING`)

  // BOM recipes
  await client.query(`INSERT INTO product_recipes (product_id, ingredient_id, quantity_used) VALUES
    ('test-prd-0001-0000-0000-000000000000', 'test-ing-0001-0000-0000-000000000000', 1),
    ('test-prd-0001-0000-0000-000000000000', 'test-ing-0002-0000-0000-000000000000', 1),
    ('test-prd-0002-0000-0000-000000000000', 'test-ing-0001-0000-0000-000000000000', 1),
    ('test-prd-0002-0000-0000-000000000000', 'test-ing-0002-0000-0000-000000000000', 1),
    ('test-prd-0002-0000-0000-000000000000', 'test-ing-0003-0000-0000-000000000000', 1)
    ON CONFLICT DO NOTHING`)

  // Test user (PIN: 1234 — bcrypt)
  await client.query(`INSERT INTO users (id, name, pin_hash, role) VALUES
    ('test-usr-0001-0000-0000-000000000000', 'Test Admin',    '$2b$10$8K1p/a0dR1xqM2PnVhM8W.QVGOvBf6B6ZaHFMpS0Ov2vB0RqS.4lm', 'admin'),
    ('test-usr-0002-0000-0000-000000000000', 'Test Cashier',  '$2b$10$8K1p/a0dR1xqM2PnVhM8W.QVGOvBf6B6ZaHFMpS0Ov2vB0RqS.4lm', 'cashier')
    ON CONFLICT DO NOTHING`)
}

export const getStock = async (client, ingredientId) => {
  const { rows } = await client.query('SELECT current_stock FROM ingredients WHERE id = $1', [ingredientId])
  return parseFloat(rows[0]?.current_stock || 0)
}

export const getOrderCount = async (client) => {
  const { rows } = await client.query("SELECT COUNT(*) FROM orders WHERE id LIKE 'test-order%'")
  return parseInt(rows[0].count)
}
