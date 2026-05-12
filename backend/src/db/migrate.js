import { query } from './index.js'

const migrations = [
  // 001 — users & roles
  `CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    pin_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'cashier')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
  )`,

  // 002 — shifts
  `CREATE TABLE IF NOT EXISTS shifts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    started_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    opening_cash DECIMAL(10,2) NOT NULL DEFAULT 0,
    closing_cash DECIMAL(10,2)
  )`,

  // 003 — categories
  `CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    sort_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT true
  )`,

  // 004 — products
  `CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID REFERENCES categories(id),
    name VARCHAR(150) NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    is_available BOOLEAN DEFAULT true,
    is_combo BOOLEAN DEFAULT false,
    image_url VARCHAR(500),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
  )`,

  // 005 — ingredients
  `CREATE TABLE IF NOT EXISTS ingredients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(150) NOT NULL,
    unit VARCHAR(30) NOT NULL,
    current_stock DECIMAL(10,3) DEFAULT 0,
    low_stock_alert DECIMAL(10,3) DEFAULT 10,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
  )`,

  // 006 — product recipes (BOM)
  `CREATE TABLE IF NOT EXISTS product_recipes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id),
    ingredient_id UUID NOT NULL REFERENCES ingredients(id),
    quantity_used DECIMAL(10,3) NOT NULL,
    UNIQUE(product_id, ingredient_id)
  )`,

  // 007 — orders
  `CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id),
    shift_id UUID REFERENCES shifts(id),
    order_number VARCHAR(20) NOT NULL UNIQUE,
    status VARCHAR(20) DEFAULT 'completed' CHECK (status IN ('completed','voided','pending')),
    dining_type VARCHAR(20) DEFAULT 'dine_in' CHECK (dining_type IN ('dine_in','takeout')),
    subtotal DECIMAL(10,2) NOT NULL,
    total DECIMAL(10,2) NOT NULL,
    synced BOOLEAN DEFAULT true,
    void_reason VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`,

  // 008 — order items
  `CREATE TABLE IF NOT EXISTS order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id),
    product_id UUID NOT NULL REFERENCES products(id),
    quantity INT NOT NULL CHECK (quantity > 0),
    unit_price DECIMAL(10,2) NOT NULL,
    notes VARCHAR(255)
  )`,

  // 009 — payments
  `CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id),
    method VARCHAR(20) NOT NULL CHECK (method IN ('cash','gcash')),
    amount DECIMAL(10,2) NOT NULL,
    change_given DECIMAL(10,2) DEFAULT 0,
    reference_note VARCHAR(255),
    paid_at TIMESTAMPTZ DEFAULT NOW()
  )`,

  // 010 — stock movements (ledger)
  `CREATE TABLE IF NOT EXISTS stock_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ingredient_id UUID NOT NULL REFERENCES ingredients(id),
    order_id UUID REFERENCES orders(id),
    movement_type VARCHAR(20) NOT NULL CHECK (movement_type IN ('sale','restock','adjustment','void_restore')),
    quantity DECIMAL(10,3) NOT NULL,
    note VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`,

  // 011 — suppliers
  `CREATE TABLE IF NOT EXISTS suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(150) NOT NULL,
    contact VARCHAR(255),
    is_active BOOLEAN DEFAULT true
  )`,

  // 012 — purchase orders
  `CREATE TABLE IF NOT EXISTS purchase_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_id UUID REFERENCES suppliers(id),
    ingredient_id UUID NOT NULL REFERENCES ingredients(id),
    quantity DECIMAL(10,3) NOT NULL,
    unit_cost DECIMAL(10,2),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','received','cancelled')),
    ordered_at TIMESTAMPTZ DEFAULT NOW(),
    received_at TIMESTAMPTZ
  )`,

  // 013 — audit logs
  `CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    table_name VARCHAR(100),
    record_id UUID,
    old_value JSONB,
    new_value JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`,

  // 014 — order number sequence
  `CREATE SEQUENCE IF NOT EXISTS order_number_seq START 1`,

  // 015 — indexes for performance
  `CREATE INDEX IF NOT EXISTS idx_orders_synced ON orders(synced, created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_orders_shift ON orders(shift_id)`,
  `CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_stock_movements_ingredient ON stock_movements(ingredient_id, created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_product_recipes_product ON product_recipes(product_id)`,
  `CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id)`,

  // 016 - fix unique payments for split tenders
  `ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_order_id_key`,

  // 017 - petty cash ledger
  `CREATE TABLE IF NOT EXISTS cash_drawer_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shift_id UUID NOT NULL REFERENCES shifts(id),
    user_id UUID NOT NULL REFERENCES users(id),
    type VARCHAR(20) NOT NULL CHECK (type IN ('pay_in', 'pay_out')),
    amount DECIMAL(10,2) NOT NULL,
    reason VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`,

  // 018 - allow standalone cash withdrawals (no shift required)
  `ALTER TABLE cash_drawer_logs ALTER COLUMN shift_id DROP NOT NULL`,

  // 019 - add is_reverted to audit_logs
  `ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS is_reverted BOOLEAN DEFAULT false`,

  // 020 - combo items table (products composed of other products)
  `CREATE TABLE IF NOT EXISTS combo_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    combo_id UUID NOT NULL REFERENCES products(id),
    product_id UUID NOT NULL REFERENCES products(id),
    quantity INT NOT NULL DEFAULT 1,
    UNIQUE(combo_id, product_id)
  )`
]

const seed = async () => {
  // Seed categories
  await query(`INSERT INTO categories (id, name, sort_order) VALUES
    ('11111111-1111-1111-1111-111111111111', 'Burgers', 1),
    ('22222222-2222-2222-2222-222222222222', 'Combos', 2),
    ('33333333-3333-3333-3333-333333333333', 'Drinks', 3),
    ('44444444-4444-4444-4444-444444444444', 'Sides', 4)
    ON CONFLICT DO NOTHING`)

  // Seed ingredients
  await query(`INSERT INTO ingredients (id, name, unit, current_stock, low_stock_alert) VALUES
    ('aaaa0001-0000-0000-0000-000000000000', 'Beef Patty', 'pcs', 100, 20),
    ('aaaa0002-0000-0000-0000-000000000000', 'Burger Bun', 'pcs', 100, 20),
    ('aaaa0003-0000-0000-0000-000000000000', 'Cheddar Cheese', 'slices', 100, 20),
    ('aaaa0004-0000-0000-0000-000000000000', 'Lettuce', 'leaves', 200, 30),
    ('aaaa0005-0000-0000-0000-000000000000', 'Tomato', 'slices', 150, 30),
    ('aaaa0006-0000-0000-0000-000000000000', 'French Fries', 'servings', 80, 15),
    ('aaaa0007-0000-0000-0000-000000000000', 'Soft Drink Cup', 'pcs', 100, 20),
    ('aaaa0008-0000-0000-0000-000000000000', 'Sauce Packet', 'pcs', 300, 50)
    ON CONFLICT DO NOTHING`)

  // Seed products
  await query(`INSERT INTO products (id, category_id, name, price, is_combo) VALUES
    ('bbbb0001-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', 'Classic Burger', 89.00, false),
    ('bbbb0002-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', 'Cheeseburger', 99.00, false),
    ('bbbb0003-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111', 'Double Patty', 129.00, false),
    ('bbbb0004-0000-0000-0000-000000000000', '22222222-2222-2222-2222-222222222222', 'Classic Combo', 149.00, true),
    ('bbbb0005-0000-0000-0000-000000000000', '22222222-2222-2222-2222-222222222222', 'Cheese Combo', 169.00, true),
    ('bbbb0006-0000-0000-0000-000000000000', '33333333-3333-3333-3333-333333333333', 'Coke', 39.00, false),
    ('bbbb0007-0000-0000-0000-000000000000', '33333333-3333-3333-3333-333333333333', 'Iced Tea', 35.00, false),
    ('bbbb0008-0000-0000-0000-000000000000', '44444444-4444-4444-4444-444444444444', 'Fries', 59.00, false)
    ON CONFLICT DO NOTHING`)

  // Seed BOM (product recipes)
  await query(`INSERT INTO product_recipes (product_id, ingredient_id, quantity_used) VALUES
    ('bbbb0001-0000-0000-0000-000000000000', 'aaaa0001-0000-0000-0000-000000000000', 1),
    ('bbbb0001-0000-0000-0000-000000000000', 'aaaa0002-0000-0000-0000-000000000000', 1),
    ('bbbb0001-0000-0000-0000-000000000000', 'aaaa0004-0000-0000-0000-000000000000', 2),
    ('bbbb0002-0000-0000-0000-000000000000', 'aaaa0001-0000-0000-0000-000000000000', 1),
    ('bbbb0002-0000-0000-0000-000000000000', 'aaaa0002-0000-0000-0000-000000000000', 1),
    ('bbbb0002-0000-0000-0000-000000000000', 'aaaa0003-0000-0000-0000-000000000000', 1),
    ('bbbb0002-0000-0000-0000-000000000000', 'aaaa0004-0000-0000-0000-000000000000', 2),
    ('bbbb0003-0000-0000-0000-000000000000', 'aaaa0001-0000-0000-0000-000000000000', 2),
    ('bbbb0003-0000-0000-0000-000000000000', 'aaaa0002-0000-0000-0000-000000000000', 1),
    ('bbbb0003-0000-0000-0000-000000000000', 'aaaa0004-0000-0000-0000-000000000000', 2),
    ('bbbb0004-0000-0000-0000-000000000000', 'aaaa0001-0000-0000-0000-000000000000', 1),
    ('bbbb0004-0000-0000-0000-000000000000', 'aaaa0002-0000-0000-0000-000000000000', 1),
    ('bbbb0004-0000-0000-0000-000000000000', 'aaaa0004-0000-0000-0000-000000000000', 2),
    ('bbbb0004-0000-0000-0000-000000000000', 'aaaa0006-0000-0000-0000-000000000000', 1),
    ('bbbb0004-0000-0000-0000-000000000000', 'aaaa0007-0000-0000-0000-000000000000', 1),
    ('bbbb0005-0000-0000-0000-000000000000', 'aaaa0001-0000-0000-0000-000000000000', 1),
    ('bbbb0005-0000-0000-0000-000000000000', 'aaaa0002-0000-0000-0000-000000000000', 1),
    ('bbbb0005-0000-0000-0000-000000000000', 'aaaa0003-0000-0000-0000-000000000000', 1),
    ('bbbb0005-0000-0000-0000-000000000000', 'aaaa0004-0000-0000-0000-000000000000', 2),
    ('bbbb0005-0000-0000-0000-000000000000', 'aaaa0006-0000-0000-0000-000000000000', 1),
    ('bbbb0005-0000-0000-0000-000000000000', 'aaaa0007-0000-0000-0000-000000000000', 1),
    ('bbbb0006-0000-0000-0000-000000000000', 'aaaa0007-0000-0000-0000-000000000000', 1),
    ('bbbb0007-0000-0000-0000-000000000000', 'aaaa0007-0000-0000-0000-000000000000', 1),
    ('bbbb0008-0000-0000-0000-000000000000', 'aaaa0006-0000-0000-0000-000000000000', 1)
    ON CONFLICT DO NOTHING`)

  // Seed default admin user (PIN: 0000)
  // PIN hashed: $2b$10$... (bcrypt of '0000')
  await query(`INSERT INTO users (id, name, pin_hash, role) VALUES
    ('cccc0001-0000-0000-0000-000000000000', 'Owner', '$2b$10$lyEYQtzfdot4G97S55nDdOJnCxltcIM5knea6pBGQtFlWuiPn48MO', 'admin'),
    ('cccc0002-0000-0000-0000-000000000000', 'Cashier 1', '$2b$10$pymzlDgza1dNJQtOKzXDxOLTaNkHh40GQ0FW6ESbFkbQgh67o/gX.', 'cashier')
    ON CONFLICT DO NOTHING`)
  
  // Seed combo items (Classic Combo = Classic Burger + Fries + Coke)
  await query(`INSERT INTO combo_items (combo_id, product_id, quantity) VALUES
    ('bbbb0004-0000-0000-0000-000000000000', 'bbbb0001-0000-0000-0000-000000000000', 1),
    ('bbbb0004-0000-0000-0000-000000000000', 'bbbb0008-0000-0000-0000-000000000000', 1),
    ('bbbb0004-0000-0000-0000-000000000000', 'bbbb0006-0000-0000-0000-000000000000', 1),
    ('bbbb0005-0000-0000-0000-000000000000', 'bbbb0002-0000-0000-0000-000000000000', 1),
    ('bbbb0005-0000-0000-0000-000000000000', 'bbbb0008-0000-0000-0000-000000000000', 1),
    ('bbbb0005-0000-0000-0000-000000000000', 'bbbb0006-0000-0000-0000-000000000000', 1)
    ON CONFLICT DO NOTHING`)

  console.log('✅ Seed data inserted')
}

const migrate = async () => {
  console.log('🔄 Running migrations...')
  for (const sql of migrations) {
    await query(sql)
  }
  console.log('✅ Migrations complete')
  await seed()
  process.exit(0)
}

migrate().catch(err => {
  console.error('❌ Migration failed:', err)
  process.exit(1)
})
