/**
 * BOM Engine — deducts ingredients from stock when an order is placed.
 * All deductions happen inside the caller's transaction (client param).
 * Never call this outside a transaction.
 */

export const deductStock = async (client, items, orderId) => {
  // Gather all product IDs in the order
  const productIds = items.map(i => i.product_id)

  // Fetch all recipes for these products in one query
  const { rows: recipes } = await client.query(
    `SELECT pr.product_id, pr.ingredient_id, pr.quantity_used,
            i.name AS ingredient_name, i.current_stock, i.unit
     FROM product_recipes pr
     JOIN ingredients i ON i.id = pr.ingredient_id
     WHERE pr.product_id = ANY($1)
     FOR UPDATE`,
    [productIds]
  )

  if (recipes.length === 0) return // Products with no recipes (drinks, etc.) skip deduction

  // Build deduction map: ingredient_id → total quantity to deduct
  const deductionMap = new Map()
  for (const item of items) {
    const itemRecipes = recipes.filter(r => r.product_id === item.product_id)
    for (const recipe of itemRecipes) {
      const needed = recipe.quantity_used * item.quantity
      const existing = deductionMap.get(recipe.ingredient_id) || {
        needed: 0,
        available: parseFloat(recipe.current_stock),
        name: recipe.ingredient_name,
        unit: recipe.unit
      }
      existing.needed += needed
      deductionMap.set(recipe.ingredient_id, existing)
    }
  }

  // Check stock sufficiency BEFORE any deduction
  for (const [, data] of deductionMap) {
    if (data.available < data.needed) {
      const err = new Error('INSUFFICIENT_STOCK')
      err.ingredient = data.name
      err.available = data.available
      err.needed = data.needed
      throw err
    }
  }

  // All checks pass — perform deductions
  for (const [ingredientId, data] of deductionMap) {
    await client.query(
      `UPDATE ingredients SET current_stock = current_stock - $1 WHERE id = $2`,
      [data.needed, ingredientId]
    )

    // Write stock movement ledger entry
    await client.query(
      `INSERT INTO stock_movements (ingredient_id, order_id, movement_type, quantity, note)
       VALUES ($1, $2, 'sale', $3, 'auto deduction')`,
      [ingredientId, orderId, -data.needed]
    )
  }
}

export const restoreStock = async (client, orderId) => {
  // Fetch all stock movements for this order
  const { rows: movements } = await client.query(
    `SELECT ingredient_id, quantity FROM stock_movements
     WHERE order_id = $1 AND movement_type = 'sale'`,
    [orderId]
  )

  for (const mov of movements) {
    // Restore = add back the deducted amount (quantity is stored as negative)
    await client.query(
      `UPDATE ingredients SET current_stock = current_stock + $1 WHERE id = $2`,
      [Math.abs(mov.quantity), mov.ingredient_id]
    )

    await client.query(
      `INSERT INTO stock_movements (ingredient_id, order_id, movement_type, quantity, note)
       VALUES ($1, $2, 'void_restore', $3, 'order voided')`,
      [mov.ingredient_id, orderId, Math.abs(mov.quantity)]
    )
  }
}
