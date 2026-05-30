import { useState, useEffect, useCallback } from 'react'
import { api } from '../../utils/apiClient.js'
import { IconX, IconTrash } from '../ui/Icons.jsx'

function IngredientRow({ ing, onRestock, onEdit, onDelete }) {
  const pct = Math.min(100, (ing.current_stock / (ing.low_stock_alert * 4)) * 100)
  return (
    <div className="inventory-card" style={{ 
      background: 'var(--bg-panel)', 
      border: `1px solid ${ing.is_low ? 'rgba(239, 68, 68, 0.2)' : 'var(--border-card)'}`, 
      borderRadius: 'var(--radius-xl)', 
      padding: '20px 24px', 
      display: 'flex', 
      alignItems: 'center', 
      gap: 20, 
      boxShadow: ing.is_low ? '0 4px 12px rgba(239, 68, 68, 0.05)' : 'var(--shadow-sm)',
      transition: 'all 0.2s'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flex: 1.2, minWidth: 200 }}>
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: ing.is_low ? 'var(--red)' : '#10b981', flexShrink: 0, boxShadow: ing.is_low ? '0 0 8px rgba(239,68,68,0.4)' : 'none' }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 17, fontWeight: 900, color: 'var(--text-strong)', marginBottom: 2, letterSpacing: -0.5 }}>{ing.name}</div>
          <div style={{ fontSize: 13, color: ing.is_low ? 'var(--red)' : 'var(--text-muted)', fontWeight: 700 }}>
            {Number(ing.current_stock).toFixed(0)} <span style={{ opacity: 0.8, fontSize: 11 }}>{ing.unit}</span>
            {ing.is_low && <span style={{ marginLeft: 8, background: 'rgba(239,68,68,0.1)', padding: '2px 8px', borderRadius: 'var(--radius-sm)', fontSize: 9, fontWeight: 900, textTransform: 'uppercase' }}>Attention: Low</span>}
          </div>
        </div>
      </div>

      <div style={{ flex: 1, minWidth: 140 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
          <span>Current Stock Level</span>
          <span style={{ color: 'var(--text-strong)' }}>Alert at: {ing.low_stock_alert}</span>
        </div>
        <div style={{ height: 6, background: 'var(--bg-app)', borderRadius: 10, width: '100%', overflow: 'hidden', border: '1px solid var(--border-light)' }}>
          <div style={{ height: '100%', borderRadius: 10, width: `${pct}%`, background: ing.is_low ? 'var(--red)' : '#10b981', transition: 'width 0.6s cubic-bezier(0.4, 0, 0.2, 1)' }} />
        </div>
      </div>

      <div className="inventory-actions" style={{ display: 'flex', gap: 8, marginLeft: 16 }}>
        <button onClick={() => onEdit(ing)} style={{ padding: '8px 14px', background: 'var(--bg-app)', color: 'var(--text-strong)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Edit</button>
        <button onClick={() => onDelete(ing)} style={{ padding: '8px 14px', background: 'rgba(239,68,68,0.05)', color: 'var(--red)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(239,68,68,0.1)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}><IconTrash size={14} /></button>
        <button onClick={() => onRestock(ing)} style={{ padding: '10px 18px', background: 'var(--text-strong)', color: 'var(--bg-panel)', borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 800, whiteSpace: 'nowrap', border: 'none', cursor: 'pointer', boxShadow: '0 2px 6px rgba(0,0,0,0.1)' }}>
          + Restock
        </button>
      </div>
    </div>
  )
}

function InventoryMessageModal({ title, message, onClose }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(17,17,17,0.36)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500, padding: 'max(16px, env(safe-area-inset-top)) max(16px, env(safe-area-inset-right)) max(16px, env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left))' }}>
      <div style={{ width: 'min(100%, 380px)', background: 'var(--bg-panel)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-xl)', boxShadow: '0 20px 60px rgba(0,0,0,0.16)', padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 12 }}>
          <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--text-strong)', letterSpacing: -0.4 }}>{title}</div>
          <button onClick={onClose} style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--bg-image)', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <IconX size={15} />
          </button>
        </div>
        <div style={{ color: 'var(--text-muted)', fontSize: 14, fontWeight: 600, lineHeight: 1.5, marginBottom: 22 }}>{message}</div>
        <button onClick={onClose} style={{ width: '100%', padding: '14px', background: 'var(--text-strong)', color: 'var(--bg-panel)', borderRadius: 'var(--radius-md)', fontSize: 14, fontWeight: 800 }}>
          OK
        </button>
      </div>
    </div>
  )
}

function InventoryConfirmModal({ item, loading, onCancel, onConfirm }) {
  const isIngredient = item?.type === 'ingredient'
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(17,17,17,0.42)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500, padding: 'max(16px, env(safe-area-inset-top)) max(16px, env(safe-area-inset-right)) max(16px, env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left))' }}>
      <div style={{ width: 'min(100%, 420px)', background: 'var(--bg-panel)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-xl)', boxShadow: '0 20px 60px rgba(0,0,0,0.18)', padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 18 }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--text-strong)', letterSpacing: -0.4 }}>
              Remove {isIngredient ? 'ingredient' : 'product'}?
            </div>
            <div style={{ marginTop: 8, color: 'var(--text-muted)', fontSize: 13, fontWeight: 700 }}>
              {item?.name}
            </div>
          </div>
          <button onClick={onCancel} disabled={loading} style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--bg-image)', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <IconX size={15} />
          </button>
        </div>

        <div style={{ padding: 14, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.16)', borderRadius: 'var(--radius-lg)', color: '#b91c1c', fontSize: 13, lineHeight: 1.45, fontWeight: 700, marginBottom: 20 }}>
          {isIngredient
            ? 'This removes the ingredient from inventory. Product recipes that use it may need review.'
            : 'This hides the product from the menu and product list history will remain intact.'}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr', gap: 10 }}>
          <button onClick={onCancel} disabled={loading} style={{ padding: '14px 12px', background: 'var(--bg-image)', color: 'var(--text-muted)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', fontSize: 14, fontWeight: 800 }}>
            Cancel
          </button>
          <button onClick={onConfirm} disabled={loading} style={{ padding: '14px 12px', background: 'var(--red)', color: 'white', borderRadius: 'var(--radius-md)', fontSize: 14, fontWeight: 900, opacity: loading ? 0.6 : 1 }}>
            {loading ? 'Removing...' : 'Remove'}
          </button>
        </div>
      </div>
    </div>
  )
}

function RecipeEditor({ product, onClose }) {
  const [recipe, setRecipe] = useState([])
  const [ingredients, setIngredients] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const load = async () => {
      const [rec, ings] = await Promise.all([api.getRecipe(product.id), api.getIngredients()])
      setRecipe(rec)
      setIngredients(ings)
      setLoading(false)
    }
    load()
  }, [product.id])

  const updateQty = (ingredientId, qty) => {
    setRecipe(r => r.map(row => row.ingredient_id === ingredientId ? { ...row, quantity_used: qty } : row))
  }

  const addIngredient = (ingId) => {
    if (recipe.find(r => r.ingredient_id === ingId)) return
    const ing = ingredients.find(i => i.id === ingId)
    setRecipe(r => [...r, { ingredient_id: ingId, quantity_used: 1, ingredient_name: ing.name, unit: ing.unit }])
  }

  const removeRow = (ingId) => setRecipe(r => r.filter(row => row.ingredient_id !== ingId))

  const save = async () => {
    setSaving(true)
    setError('')
    try {
      await api.updateRecipe(product.id, recipe.map(r => ({ ingredient_id: r.ingredient_id, quantity_used: Number(r.quantity_used) })))
      onClose()
    } catch (err) { setError(err.message || 'Save failed') }
    finally { setSaving(false) }
  }

  const unusedIngredients = ingredients.filter(i => !recipe.find(r => r.ingredient_id === i.id))

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(246,247,251,0.7)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300 }}>
      <div style={{ background: 'var(--bg-panel)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-xl)', padding: 32, width: 480, maxHeight: '80dvh', overflow: 'auto', boxShadow: 'var(--shadow-lg)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 20, color: 'var(--text-strong)', letterSpacing: -0.5 }}>Recipe: {product.name}</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4, fontWeight: 500 }}>Ingredients deducted per sale</div>
          </div>
          <button onClick={onClose} style={{ background: 'var(--bg-image)', color: 'var(--text-muted)', width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><IconX size={14} /></button>
        </div>
        {loading ? <div style={{ color: 'var(--text-muted)', fontWeight: 500 }}>Loading recipe...</div> : (<>
          {recipe.length === 0 && <div style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 20, padding: 16, background: 'var(--bg-image)', borderRadius: 'var(--radius-md)' }}>No ingredients set — stock won't be deducted.</div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {recipe.map(row => (
              <div key={row.ingredient_id} style={{ display: 'flex', gap: 12, alignItems: 'center', background: 'var(--bg-image)', padding: '12px 16px', borderRadius: 'var(--radius-md)' }}>
                <div style={{ flex: 1, fontSize: 14, fontWeight: 600, color: 'var(--text-strong)' }}>{row.ingredient_name}</div>
                <input type="number" min="0.1" step="0.1" value={row.quantity_used}
                  onChange={e => updateQty(row.ingredient_id, e.target.value)}
                  style={{ width: 80, background: 'var(--bg-panel)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', padding: '8px 12px', color: 'var(--text-strong)', fontSize: 14, textAlign: 'right', fontWeight: 600 }} />
                <div style={{ fontSize: 13, color: 'var(--text-muted)', minWidth: 32, fontWeight: 500 }}>{row.unit}</div>
                <button onClick={() => removeRow(row.ingredient_id)} style={{ color: 'var(--red)', background: 'rgba(239,68,68,0.1)', width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><IconX size={12} /></button>
              </div>
            ))}
          </div>

          {unusedIngredients.length > 0 && (
            <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px dashed var(--border-light)' }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700 }}>Add Ingredient</div>
              <select onChange={e => { if (e.target.value) addIngredient(e.target.value); e.target.value = '' }}
                style={{ width: '100%', background: 'var(--bg-image)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', padding: '12px 16px', color: 'var(--text-strong)', fontSize: 14, fontWeight: 500 }}>
                <option value="">Select ingredient to add...</option>
                {unusedIngredients.map(i => <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>)}
              </select>
            </div>
          )}
          {error && (
            <div style={{ color: 'var(--red)', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.18)', borderRadius: 'var(--radius-md)', padding: '10px 12px', marginTop: 16, fontSize: 13, fontWeight: 700 }}>
              {error}
            </div>
          )}
          <div style={{ display: 'flex', gap: 12, marginTop: 32 }}>
            <button onClick={onClose} style={{ flex: 1, padding: '14px', background: 'var(--bg-image)', color: 'var(--text-muted)', borderRadius: 'var(--radius-md)', fontSize: 14, fontWeight: 600 }}>Cancel</button>
            <button onClick={save} disabled={saving} style={{ flex: 2, padding: '14px', background: 'var(--text-strong)', color: 'var(--bg-panel)', borderRadius: 'var(--radius-md)', fontSize: 14, fontWeight: 700 }}>
              {saving ? 'Saving...' : 'Save Recipe'}
            </button>
          </div>
        </>)}
      </div>
    </div>
  )
}

function ComboEditor({ product, onClose }) {
  const [comboItems, setComboItems] = useState([])
  const [availableProducts, setAvailableProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const load = async () => {
      const [items, prods] = await Promise.all([api.getComboItems(product.id), api.getProducts()])
      setComboItems(items)
      // Filter out self and other combos to prevent circular dependencies
      setAvailableProducts(prods.filter(p => p.id !== product.id && !p.is_combo))
      setLoading(false)
    }
    load()
  }, [product.id])

  const updateQty = (productId, qty) => {
    setComboItems(items => items.map(row => row.product_id === productId ? { ...row, quantity: qty } : row))
  }

  const addProduct = (productId) => {
    if (comboItems.find(i => i.product_id === productId)) return
    const prod = availableProducts.find(p => p.id === productId)
    setComboItems(items => [...items, { product_id: productId, quantity: 1, product_name: prod.name }])
  }

  const removeRow = (productId) => setComboItems(items => items.filter(row => row.product_id !== productId))

  const save = async () => {
    setSaving(true)
    setError('')
    try {
      await api.updateComboItems(product.id, comboItems.map(i => ({ product_id: i.product_id, quantity: Number(i.quantity) })))
      onClose()
    } catch (err) { setError(err.message || 'Save failed') }
    finally { setSaving(false) }
  }

  const unusedProducts = availableProducts.filter(p => !comboItems.find(i => i.product_id === p.id))

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(246,247,251,0.7)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300 }}>
      <div style={{ background: 'var(--bg-panel)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-xl)', padding: 32, width: 480, maxHeight: '80dvh', overflow: 'auto', boxShadow: 'var(--shadow-lg)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 20, color: 'var(--text-strong)', letterSpacing: -0.5 }}>Combo: {product.name}</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4, fontWeight: 500 }}>Select products included in this combo</div>
          </div>
          <button onClick={onClose} style={{ background: 'var(--bg-image)', color: 'var(--text-muted)', width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><IconX size={14} /></button>
        </div>
        {loading ? <div style={{ color: 'var(--text-muted)', fontWeight: 500 }}>Loading combo items...</div> : (<>
          {comboItems.length === 0 && <div style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 20, padding: 16, background: 'var(--bg-image)', borderRadius: 'var(--radius-md)' }}>No products in this combo yet.</div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {comboItems.map(row => (
              <div key={row.product_id} style={{ display: 'flex', gap: 12, alignItems: 'center', background: 'var(--bg-image)', padding: '12px 16px', borderRadius: 'var(--radius-md)' }}>
                <div style={{ flex: 1, fontSize: 14, fontWeight: 600, color: 'var(--text-strong)' }}>{row.product_name}</div>
                <input type="number" min="1" step="1" value={row.quantity}
                  onChange={e => updateQty(row.product_id, e.target.value)}
                  style={{ width: 80, background: 'var(--bg-panel)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', padding: '8px 12px', color: 'var(--text-strong)', fontSize: 14, textAlign: 'right', fontWeight: 600 }} />
                <div style={{ fontSize: 13, color: 'var(--text-muted)', minWidth: 32, fontWeight: 500 }}>qty</div>
                <button onClick={() => removeRow(row.product_id)} style={{ color: 'var(--red)', background: 'rgba(239,68,68,0.1)', width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><IconX size={12} /></button>
              </div>
            ))}
          </div>

          {unusedProducts.length > 0 && (
            <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px dashed var(--border-light)' }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700 }}>Add Product to Combo</div>
              <select onChange={e => { if (e.target.value) addProduct(e.target.value); e.target.value = '' }}
                style={{ width: '100%', background: 'var(--bg-image)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', padding: '12px 16px', color: 'var(--text-strong)', fontSize: 14, fontWeight: 500 }}>
                <option value="">Select product to add...</option>
                {unusedProducts.map(p => <option key={p.id} value={p.id}>{p.name} (₱{p.price})</option>)}
              </select>
            </div>
          )}
          {error && (
            <div style={{ color: 'var(--red)', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.18)', borderRadius: 'var(--radius-md)', padding: '10px 12px', marginTop: 16, fontSize: 13, fontWeight: 700 }}>
              {error}
            </div>
          )}
          <div style={{ display: 'flex', gap: 12, marginTop: 32 }}>
            <button onClick={onClose} style={{ flex: 1, padding: '14px', background: 'var(--bg-image)', color: 'var(--text-muted)', borderRadius: 'var(--radius-md)', fontSize: 14, fontWeight: 600 }}>Cancel</button>
            <button onClick={save} disabled={saving} style={{ flex: 2, padding: '14px', background: 'var(--text-strong)', color: 'var(--bg-panel)', borderRadius: 'var(--radius-md)', fontSize: 14, fontWeight: 700 }}>
              {saving ? 'Saving...' : 'Save Combo'}
            </button>
          </div>
        </>)}
      </div>
    </div>
  )
}

function IngredientEditor({ ingredient, onClose }) {
  const [name, setName] = useState(ingredient?.name || '')
  const [unit, setUnit] = useState(ingredient?.unit || 'pcs')
  const [lowStockAlert, setLowStockAlert] = useState(ingredient?.low_stock_alert || 10)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const save = async () => {
    if (!name || !unit) return
    setSaving(true)
    setError('')
    try {
      if (ingredient) {
        await api.updateIngredient(ingredient.id, { name, unit, low_stock_alert: Number(lowStockAlert) })
      } else {
        await api.createIngredient({ name, unit, low_stock_alert: Number(lowStockAlert) })
      }
      onClose()
    } catch (err) { setError(err.message || 'Save failed') }
    finally { setSaving(false) }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(246,247,251,0.7)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300 }}>
      <div style={{ background: 'var(--bg-panel)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-xl)', padding: 32, width: 360, boxShadow: 'var(--shadow-lg)' }}>
        <div style={{ fontWeight: 800, fontSize: 20, color: 'var(--text-strong)', marginBottom: 24, letterSpacing: -0.5 }}>{ingredient ? 'Edit Ingredient' : 'Add New Ingredient'}</div>

        <label style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: 6 }}>Ingredient Name</label>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Beef Patty"
          style={{ width: '100%', background: 'var(--bg-image)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', padding: '12px 16px', color: 'var(--text-strong)', fontSize: 14, marginBottom: 16, fontWeight: 500 }} />

        <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: 6 }}>Unit</label>
            <input value={unit} onChange={e => setUnit(e.target.value)} placeholder="e.g. kg, pcs"
              style={{ width: '100%', background: 'var(--bg-image)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', padding: '12px 16px', color: 'var(--text-strong)', fontSize: 14, fontWeight: 500 }} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: 6 }}>Low Stock Alert</label>
            <input type="number" value={lowStockAlert} onChange={e => setLowStockAlert(e.target.value)}
              style={{ width: '100%', background: 'var(--bg-image)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', padding: '12px 16px', color: 'var(--text-strong)', fontSize: 14, fontWeight: 500 }} />
          </div>
        </div>

        {error && (
          <div style={{ color: 'var(--red)', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.18)', borderRadius: 'var(--radius-md)', padding: '10px 12px', marginBottom: 16, fontSize: 13, fontWeight: 700 }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 12 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '14px', background: 'var(--bg-image)', color: 'var(--text-muted)', borderRadius: 'var(--radius-md)', fontSize: 14, fontWeight: 600 }}>Cancel</button>
          <button onClick={save} disabled={saving} style={{ flex: 2, padding: '14px', background: 'var(--text-strong)', color: 'var(--bg-panel)', borderRadius: 'var(--radius-md)', fontSize: 14, fontWeight: 700 }}>
            {saving ? 'Saving...' : ingredient ? 'Update' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  )
}

function ProductEditor({ product, onClose }) {
  const [name, setName] = useState(product?.name || '')
  const [price, setPrice] = useState(product?.price || '')
  const [categoryId, setCategoryId] = useState(product?.category_id || '')
  const [description, setDescription] = useState(product?.description || '')
  const [imageUrl, setImageUrl] = useState(product?.image_url || '')
  const [categories, setCategories] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    api.getCategories().then(setCategories)
  }, [])

  const selectedCategory = categories.find(c => c.id === categoryId)
  const isCombo = selectedCategory ? selectedCategory.name?.toLowerCase().includes('combo') : Boolean(product?.is_combo)

  const save = async () => {
    if (!name || !price || !categoryId) return
    setSaving(true)
    setError('')
    try {
      const payload = { name, price: Number(price), category_id: categoryId, image_url: imageUrl || null, description: description.trim() || null, is_combo: isCombo }
      if (product) {
        await api.updateProduct(product.id, payload)
      } else {
        await api.createProduct(payload)
      }
      onClose()
    } catch (err) { setError(err.message || 'Save failed') }
    finally { setSaving(false) }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(246,247,251,0.7)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300 }}>
      <div style={{ background: 'var(--bg-panel)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-xl)', padding: 32, width: 480, maxWidth: 'calc(100vw - 32px)', maxHeight: '88dvh', overflowY: 'auto', boxShadow: 'var(--shadow-lg)' }}>
        <div style={{ fontWeight: 800, fontSize: 20, color: 'var(--text-strong)', marginBottom: 24, letterSpacing: -0.5 }}>{product ? 'Edit Product' : 'Add New Product'}</div>

        <label style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: 6 }}>Product Name</label>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Classic Burger"
          style={{ width: '100%', background: 'var(--bg-image)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', padding: '12px 16px', color: 'var(--text-strong)', fontSize: 14, marginBottom: 16, fontWeight: 500 }} />

        <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: 6 }}>Price (₱)</label>
            <input type="number" value={price} onChange={e => setPrice(e.target.value)} placeholder="0.00"
              style={{ width: '100%', background: 'var(--bg-image)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', padding: '12px 16px', color: 'var(--text-strong)', fontSize: 14, fontWeight: 500 }} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: 6 }}>Category</label>
            <select value={categoryId} onChange={e => setCategoryId(e.target.value)}
              style={{ width: '100%', background: 'var(--bg-image)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', padding: '12px 16px', color: 'var(--text-strong)', fontSize: 14, fontWeight: 500 }}>
              <option value="">Select...</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>

        <label style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: 6 }}>Image URL (Optional)</label>
        <input value={imageUrl} onChange={e => setImageUrl(e.target.value)} placeholder="https://..."
          style={{ width: '100%', background: 'var(--bg-image)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', padding: '12px 16px', color: 'var(--text-strong)', fontSize: 14, marginBottom: 16, fontWeight: 500 }} />

        <label style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: 6 }}>Menu Description</label>
        <div style={{ color: 'var(--text-muted)', fontSize: 12, fontWeight: 600, lineHeight: 1.4, marginBottom: 8 }}>
          Write a short POS menu line. Mention what is included, size, flavor, or selling point. Keep it under one sentence so it fits on product cards.
        </div>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Example: Beef patty, lettuce, tomato / Burger + fries + drink / Fresh brewed, 16oz"
          maxLength={255}
          rows={3}
          style={{ width: '100%', resize: 'none', background: 'var(--bg-image)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', padding: '12px 16px', color: 'var(--text-strong)', fontSize: 14, marginBottom: isCombo ? 12 : 24, fontWeight: 500, lineHeight: 1.4 }}
        />

        {isCombo && (
          <div style={{ marginBottom: 24, padding: 14, background: 'var(--bg-image)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-lg)', color: 'var(--text-muted)', fontSize: 13, fontWeight: 700, lineHeight: 1.45 }}>
            Save this combo product here, then use the Recipes & Combos tab to choose which products go inside it.
          </div>
        )}

        {error && (
          <div style={{ color: 'var(--red)', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.18)', borderRadius: 'var(--radius-md)', padding: '10px 12px', marginBottom: 16, fontSize: 13, fontWeight: 700 }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 12 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '14px', background: 'var(--bg-image)', color: 'var(--text-muted)', borderRadius: 'var(--radius-md)', fontSize: 14, fontWeight: 600 }}>Cancel</button>
          <button onClick={save} disabled={saving} style={{ flex: 2, padding: '14px', background: 'var(--text-strong)', color: 'var(--bg-panel)', borderRadius: 'var(--radius-md)', fontSize: 14, fontWeight: 700 }}>
            {saving ? 'Saving...' : product ? 'Update Product' : 'Create Product'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function InventoryPanel() {
  const [ingredients, setIngredients] = useState([])
  const [products, setProducts] = useState([])
  const [view, setView] = useState('stock') // 'stock' | 'products' | 'recipes'
  const [restocking, setRestocking] = useState(null)
  const [restockQty, setRestockQty] = useState('')
  const [restockNote, setRestockNote] = useState('')
  const [editingRecipe, setEditingRecipe] = useState(null)
  const [editingCombo, setEditingCombo] = useState(null)
  const [editingProduct, setEditingProduct] = useState(null)
  const [showProductModal, setShowProductModal] = useState(false)
  const [editingIngredient, setEditingIngredient] = useState(null)
  const [showIngredientModal, setShowIngredientModal] = useState(false)
  const [pendingDelete, setPendingDelete] = useState(null)
  const [messageModal, setMessageModal] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const loadIngredients = useCallback(async () => {
    try { setIngredients(await api.getIngredients()) }
    catch (err) { console.error(err) }
  }, [])

  const loadProducts = useCallback(async () => {
    try { setProducts(await api.getProducts()) }
    catch (err) { console.error(err) }
  }, [])

  useEffect(() => {
    const init = async () => {
      setLoading(true)
      await Promise.all([loadIngredients(), loadProducts()])
      setLoading(false)
    }
    init()
  }, [])

  const handleRestock = async () => {
    const qty = parseFloat(restockQty)
    if (!qty || qty <= 0) return
    setSaving(true)
    try {
      await api.restock(restocking.id, qty, restockNote || 'manual restock')
      setRestocking(null); setRestockQty(''); setRestockNote('')
      await loadIngredients()
    } catch (err) { setMessageModal({ title: 'Restock failed', message: err.message || 'Unable to add stock right now.' }) }
    finally { setSaving(false) }
  }

  const toggleAvailability = async (product) => {
    try {
      await api.updateProduct(product.id, { is_available: !product.is_available })
      await loadProducts()
    } catch (err) { setMessageModal({ title: 'Update failed', message: err.message || 'Unable to update product availability.' }) }
  }

  const handleDeleteProduct = async (product) => {
    setPendingDelete({ type: 'product', id: product.id, name: product.name })
  }

  const handleDeleteIngredient = async (ingredient) => {
    setPendingDelete({ type: 'ingredient', id: ingredient.id, name: ingredient.name })
  }

  const confirmDelete = async () => {
    if (!pendingDelete) return
    setSaving(true)
    try {
      if (pendingDelete.type === 'product') {
        await api.deleteProduct(pendingDelete.id)
        await loadProducts()
      } else {
        await api.deleteIngredient(pendingDelete.id)
        await loadIngredients()
      }
      setPendingDelete(null)
    } catch (err) {
      setMessageModal({ title: 'Delete failed', message: err.message || `Unable to remove ${pendingDelete.name}.` })
    } finally {
      setSaving(false)
    }
  }

  const lowCount = ingredients.filter(i => i.is_low).length

  return (
    <div className="admin-pad">
      <div className="admin-header-row">
        <h2 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-strong)', margin: 0, letterSpacing: -0.5 }}>Inventory Management</h2>
      </div>

      {/* Modern Segmented Control */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 32 }}>
        <div style={{ 
          display: 'flex', gap: 4, background: 'rgba(0,0,0,0.03)', padding: 4, 
          borderRadius: '12px', width: 'fit-content' 
        }}>
          {[
            ['stock', `Stock Levels${lowCount > 0 ? ` (${lowCount})` : ''}`], 
            ['products', 'Product List'], 
            ['recipes', 'Recipes & Combos']
          ].map(([id, label]) => (
            <button key={id} onClick={() => setView(id)} style={{
              padding: '10px 24px', borderRadius: '8px', fontSize: 13, fontWeight: 700,
              background: view === id ? 'var(--bg-panel)' : 'transparent',
              color: view === id ? 'var(--text-strong)' : 'var(--text-muted)',
              border: 'none',
              boxShadow: view === id ? '0 2px 8px rgba(0,0,0,0.08)' : 'none',
              transition: 'all 0.2s',
              cursor: 'pointer'
            }}>{label}</button>
          ))}
        </div>
      </div>

      {loading && <div style={{ color: 'var(--text-muted)', fontSize: 14, fontWeight: 500, textAlign: 'center', padding: 40 }}>Loading inventory assets...</div>}

      <div style={{ flex: 1, overflowY: 'auto', paddingRight: 4, paddingBottom: 40, minHeight: 0 }}>
        {/* Stock view */}
        {!loading && view === 'stock' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-muted)' }}>{ingredients.length} Total Ingredients</div>
              <button onClick={() => { setEditingIngredient(null); setShowIngredientModal(true) }}
                style={{ padding: '10px 20px', background: 'var(--text-strong)', color: 'var(--bg-panel)', borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 800, border: 'none', cursor: 'pointer' }}>
                + Add Ingredient
              </button>
            </div>
            {ingredients.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 14, fontWeight: 500, padding: 60, background: 'var(--bg-panel)', borderRadius: 'var(--radius-xl)', border: '1px dashed var(--border-light)' }}>
                No ingredient records found in database.
              </div>
            ) : (
              ingredients.sort((a, b) => a.is_low === b.is_low ? a.name.localeCompare(b.name) : a.is_low ? -1 : 1).map(ing => (
                <IngredientRow key={ing.id} ing={ing} onRestock={setRestocking} onEdit={(i) => { setEditingIngredient(i); setShowIngredientModal(true) }} onDelete={handleDeleteIngredient} />
              ))
            )}
          </div>
        )}

        {/* Product List view */}
        {!loading && view === 'products' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-muted)' }}>{products.length} Products Configured</div>
              <button onClick={() => { setEditingProduct(null); setShowProductModal(true) }}
                style={{ padding: '10px 20px', background: 'var(--text-strong)', color: 'var(--bg-panel)', borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 800, border: 'none', cursor: 'pointer' }}>
                + New Product
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 20 }}>
              {products.map(p => (
                <div key={p.id} className="inventory-card" style={{ 
                  background: 'var(--bg-panel)', 
                  border: '1px solid var(--border-card)', 
                  borderRadius: 'var(--radius-xl)', 
                  padding: '24px', 
                  display: 'flex', 
                  flexDirection: 'column',
                  gap: 20,
                  boxShadow: 'var(--shadow-sm)',
                  opacity: p.is_available ? 1 : 0.7,
                  transition: 'all 0.2s'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 17, fontWeight: 900, color: p.is_available ? 'var(--text-strong)' : 'var(--text-muted)', letterSpacing: -0.5 }}>{p.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 700, marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>{p.category_name}</div>
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--text-strong)' }}>₱{Number(p.price).toFixed(2)}</div>
                  </div>
                  <div className="inventory-actions" style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <button onClick={() => toggleAvailability(p)} style={{
                      flex: 1.2, padding: '10px', borderRadius: 'var(--radius-md)', fontSize: 12, fontWeight: 800,
                      background: p.is_available ? 'rgba(16, 185, 129, 0.1)' : 'var(--bg-app)',
                      color: p.is_available ? 'var(--green)' : 'var(--text-muted)',
                      border: `1px solid ${p.is_available ? 'rgba(16, 185, 129, 0.2)' : 'var(--border-light)'}`,
                      cursor: 'pointer'
                    }}>{p.is_available ? 'Available' : 'Unavailable'}</button>
                    <button onClick={() => { setEditingProduct(p); setShowProductModal(true) }}
                      style={{ flex: 1, padding: '10px', background: 'var(--bg-app)', color: 'var(--text-strong)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                      Edit
                    </button>
                    <button onClick={() => handleDeleteProduct(p)}
                      style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.05)', color: 'var(--red)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(239,68,68,0.1)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                      <IconTrash size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recipes view */}
        {!loading && view === 'recipes' && (
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 20 }}>Recipes and combo composition</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 20 }}>
              {products.map(p => (
                <div key={p.id} className="inventory-card" style={{ 
                  background: 'var(--bg-panel)', 
                  border: '1px solid var(--border-card)', 
                  borderRadius: 'var(--radius-xl)', 
                  padding: '24px', 
                  display: 'flex', 
                  flexDirection: 'column',
                  gap: 16,
                  boxShadow: 'var(--shadow-sm)'
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 17, fontWeight: 900, color: 'var(--text-strong)', letterSpacing: -0.5 }}>{p.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 700, marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>{p.category_name}</div>
                  </div>
                  <button onClick={() => p.is_combo ? setEditingCombo(p) : setEditingRecipe(p)}
                    style={{ width: '100%', padding: '12px', background: 'var(--text-strong)', color: 'var(--bg-panel)', borderRadius: 'var(--radius-md)', border: 'none', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>
                    {p.is_combo ? 'Configure Combo' : 'Configure Recipe'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Restock modal */}
      {restocking && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(246,247,251,0.7)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
          <div style={{ background: 'var(--bg-panel)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-xl)', padding: 32, width: 360, boxSizing: 'border-box', overflow: 'hidden', boxShadow: 'var(--shadow-lg)' }}>
            <div style={{ fontWeight: 800, fontSize: 20, color: 'var(--text-strong)', marginBottom: 8, letterSpacing: -0.5 }}>Restock {restocking.name}</div>
            <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 24, fontWeight: 500 }}>
              Current stock: <span style={{ color: restocking.is_low ? 'var(--red)' : 'var(--green)', fontWeight: 700 }}>{Number(restocking.current_stock).toFixed(0)} {restocking.unit}</span>
            </div>

            <label style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: 6 }}>Quantity to Add</label>
            <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-image)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', padding: '12px 16px', marginBottom: 16 }}>
              <input type="number" value={restockQty} onChange={e => setRestockQty(e.target.value)}
                placeholder="0" autoFocus
                style={{ flex: 1, minWidth: 0, background: 'transparent', border: 'none', color: 'var(--text-strong)', fontSize: 24, fontWeight: 700, outline: 'none' }} />
              <span style={{ fontSize: 14, color: 'var(--text-muted)', fontWeight: 600, flexShrink: 0 }}>{restocking.unit}</span>
            </div>

            <label style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: 6 }}>Remarks</label>
            <input value={restockNote} onChange={e => setRestockNote(e.target.value)}
              placeholder="e.g. Supplier delivery"
              style={{ width: '100%', background: 'var(--bg-image)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', padding: '12px 16px', color: 'var(--text-strong)', fontSize: 14, marginBottom: 24, fontWeight: 500 }} />

            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => { setRestocking(null); setRestockQty(''); setRestockNote('') }}
                style={{ flex: 1, padding: '14px', background: 'var(--bg-image)', color: 'var(--text-muted)', borderRadius: 'var(--radius-md)', fontSize: 14, fontWeight: 600 }}>Cancel</button>
              <button onClick={handleRestock} disabled={saving || !restockQty}
                style={{ flex: 2, padding: '14px', background: 'var(--text-strong)', color: 'var(--bg-panel)', borderRadius: 'var(--radius-md)', fontSize: 14, fontWeight: 700, opacity: (!restockQty || saving) ? 0.6 : 1 }}>
                {saving ? 'Saving...' : `Add Stock`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Recipe editor modal */}
      {editingRecipe && <RecipeEditor product={editingRecipe} onClose={() => { setEditingRecipe(null); loadProducts() }} />}

      {/* Combo editor modal */}
      {editingCombo && <ComboEditor product={editingCombo} onClose={() => { setEditingCombo(null); loadProducts() }} />}

      {/* Product editor modal */}
      {showProductModal && (
        <ProductEditor
          product={editingProduct}
          onClose={() => { setShowProductModal(false); setEditingProduct(null); loadProducts() }}
        />
      )}

      {/* Ingredient editor modal */}
      {showIngredientModal && (
        <IngredientEditor
          ingredient={editingIngredient}
          onClose={() => { setShowIngredientModal(false); setEditingIngredient(null); loadIngredients() }}
        />
      )}

      {pendingDelete && (
        <InventoryConfirmModal
          item={pendingDelete}
          loading={saving}
          onCancel={() => setPendingDelete(null)}
          onConfirm={confirmDelete}
        />
      )}

      {messageModal && (
        <InventoryMessageModal
          title={messageModal.title}
          message={messageModal.message}
          onClose={() => setMessageModal(null)}
        />
      )}
    </div>
  )
}
