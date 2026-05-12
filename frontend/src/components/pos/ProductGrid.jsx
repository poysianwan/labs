import { useState, useEffect } from 'react'
import { getProducts, getCategories } from '../../db/index.js'
import { useCartStore } from '../../stores/cartStore.js'

function ProductCard({ product, onAdd }) {
  const [flash, setFlash] = useState(false)

  const handleTap = () => {
    if (!product.is_available) return
    onAdd(product)
    setFlash(true)
    setTimeout(() => setFlash(false), 150)
  }

  return (
    <button
      onClick={handleTap}
      data-testid={`product-${product.id}`}
      style={{
        background: flash ? 'var(--red-dark)' : product.is_available ? 'var(--black-card)' : 'var(--black-soft)',
        border: `1.5px solid ${product.is_available ? 'var(--black-border)' : '#2a2a2a'}`,
        borderRadius: 'var(--radius)',
        padding: '16px 12px',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        gap: 8, minHeight: 100, cursor: product.is_available ? 'pointer' : 'default',
        opacity: product.is_available ? 1 : 0.4,
        transition: 'background 0.1s, transform 0.1s',
      }}
    >
      {product.is_combo && (
        <div style={{
          fontSize: 9, fontWeight: 700, letterSpacing: 1,
          color: 'var(--yellow)', textTransform: 'uppercase',
          background: 'rgba(255,208,0,0.1)', padding: '2px 6px',
          borderRadius: 4, border: '1px solid rgba(255,208,0,0.2)'
        }}>COMBO</div>
      )}
      <div style={{
        fontSize: 15, fontWeight: 600, color: 'var(--white)',
        textAlign: 'center', lineHeight: 1.3
      }}>{product.name}</div>
      <div style={{
        fontSize: 18, fontWeight: 700, color: 'var(--yellow)',
        fontFamily: 'var(--font-display)', letterSpacing: 1
      }}>₱{Number(product.price).toFixed(0)}</div>
      {!product.is_available && (
        <div style={{ fontSize: 10, color: 'var(--gray)', textTransform: 'uppercase', letterSpacing: 1 }}>
          Unavailable
        </div>
      )}
    </button>
  )
}

export default function ProductGrid() {
  const [categories, setCategories] = useState([])
  const [products, setProducts] = useState([])
  const [activeCategory, setActiveCategory] = useState(null)
  const addItem = useCartStore(s => s.addItem)

  useEffect(() => {
    const load = async () => {
      const [cats, prods] = await Promise.all([getCategories(), getProducts()])
      const sorted = cats.sort((a, b) => a.sort_order - b.sort_order)
      setCategories(sorted)
      setProducts(prods)
      if (sorted.length > 0) setActiveCategory(sorted[0].id)
    }
    load()
  }, [])

  const filtered = activeCategory
    ? products.filter(p => p.category_id === activeCategory)
    : products

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      {/* Category tabs */}
      <div style={{
        display: 'flex', gap: 6, padding: '12px 16px',
        background: 'var(--black-soft)',
        borderBottom: '1px solid var(--black-border)',
        overflowX: 'auto', flexShrink: 0
      }}>
        <button
          onClick={() => setActiveCategory(null)}
          style={{
            padding: '8px 18px', borderRadius: 8, fontWeight: 600, fontSize: 14,
            background: !activeCategory ? 'var(--red)' : 'var(--black-card)',
            color: !activeCategory ? 'var(--white)' : 'var(--gray)',
            border: `1px solid ${!activeCategory ? 'var(--red)' : 'var(--black-border)'}`,
            whiteSpace: 'nowrap', transition: 'all 0.15s'
          }}
        >All</button>
        {categories.map(cat => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            style={{
              padding: '8px 18px', borderRadius: 8, fontWeight: 600, fontSize: 14,
              background: activeCategory === cat.id ? 'var(--red)' : 'var(--black-card)',
              color: activeCategory === cat.id ? 'var(--white)' : 'var(--gray)',
              border: `1px solid ${activeCategory === cat.id ? 'var(--red)' : 'var(--black-border)'}`,
              whiteSpace: 'nowrap', transition: 'all 0.15s'
            }}
          >{cat.name}</button>
        ))}
      </div>

      {/* Product grid */}
      <div style={{
        flex: 1, overflowY: 'auto', padding: 16,
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
        gap: 12, alignContent: 'start'
      }}>
        {filtered.map(p => (
          <ProductCard key={p.id} product={p} onAdd={addItem} />
        ))}
        {filtered.length === 0 && (
          <div style={{ gridColumn: '1/-1', textAlign: 'center', color: 'var(--gray)', padding: 40 }}>
            No products in this category
          </div>
        )}
      </div>
    </div>
  )
}
