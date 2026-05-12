import { useCartStore } from '../../stores/cartStore.js'
import { IconBurger, IconFries, IconDrink, IconCheese, IconMeat, IconCombo, IconArrowLeft } from '../ui/Icons.jsx'

const getProductDetail = (name) => {
  const n = name.toLowerCase()
  if (n.includes('classic burger')) return { Icon: IconBurger, desc: 'No onions' }
  if (n.includes('cheeseburger')) return { Icon: IconCheese, desc: 'Slightly toasted' }
  if (n.includes('double')) return { Icon: IconMeat, desc: 'Add bacon' }
  if (n.includes('combo')) return { Icon: n.includes('fries') ? IconFries : IconCombo, desc: 'Large' }
  if (n.includes('tea')) return { Icon: IconDrink, desc: 'Less ice' }
  if (n.includes('coke')) return { Icon: IconDrink, desc: '16oz' }
  if (n.includes('fries')) return { Icon: IconFries, desc: 'Extra salt' }
  return { Icon: IconBurger, desc: 'Standard' }
}
export default function CartPanel({ onCheckout, onCloseCart }) {
  const { items, removeItem, updateQuantity, updateNotes, clearCart, getTotal, getItemCount } = useCartStore()
  const subtotal = getTotal()
  const total = subtotal

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-panel)' }}>
      {/* Mobile Back Button */}
      {onCloseCart && (
        <button onClick={onCloseCart} style={{padding: '24px 32px', textAlign: 'left', borderBottom: '1px solid var(--border-light)', fontSize: 16, fontWeight: 700, color: 'var(--text-strong)', background: 'var(--bg-image)', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0}}>
          <IconArrowLeft size={20} /> Back to Menu
        </button>
      )}

      {/* Cart header */}
      <div style={{ padding: '32px 32px 24px', borderBottom: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 18, color: 'var(--text-strong)' }}>
          Current order
        </div>
        <div style={{ background: 'var(--bg-image)', color: 'var(--text-strong)', fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 'var(--radius-sm)' }}>
          {getItemCount()} items
        </div>
      </div>

      {/* Items list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
        {items.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', paddingTop: 48, fontSize: 14, fontWeight: 500 }}>
            Tap a product to add
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {items.map(item => (
              <CartItem
                key={item.product_id}
                item={item}
                onRemove={() => removeItem(item.product_id)}
                onQtyChange={(q) => updateQuantity(item.product_id, q)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Total + checkout */}
      <div style={{ padding: '24px 32px 32px', borderTop: '1px solid var(--border-light)', flexShrink: 0 }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
          <span style={{ fontSize: 14, color: 'var(--text-muted)', fontWeight: 500 }}>Subtotal</span>
          <span style={{ fontSize: 14, color: 'var(--text-muted)', fontWeight: 600 }}>₱{subtotal.toFixed(0)}</span>
        </div>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24, alignItems: 'center' }}>
          <span style={{ fontSize: 20, color: 'var(--text-strong)', fontWeight: 500 }}>Total</span>
          <span style={{ fontSize: 22, color: 'var(--text-strong)', fontWeight: 600, letterSpacing: -0.5 }}>
            ₱{total.toFixed(2)}
          </span>
        </div>
        
        <button
          onClick={onCheckout}
          disabled={items.length === 0}
          style={{
            width: '100%', padding: '16px', background: items.length === 0 ? 'var(--bg-image)' : 'var(--text-strong)',
            color: items.length === 0 ? 'var(--text-muted)' : 'var(--bg-panel)', borderRadius: 'var(--radius-lg)', fontSize: 16,
            fontWeight: 700, border: 'none',
            transition: 'background 0.2s, opacity 0.2s',
            opacity: items.length === 0 ? 0.7 : 1
          }}
        >
          Charge ₱{total.toFixed(2)}
        </button>
      </div>
    </div>
  )
}

function CartItem({ item, onQtyChange }) {
  const { Icon, desc } = getProductDetail(item.name)

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
      {/* Thumbnail */}
      <div style={{ width: 48, height: 48, background: 'var(--bg-image)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={22} color="var(--text-muted)" />
      </div>
      
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-main)', marginBottom: 2 }}>{item.name}</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500, marginBottom: 8 }}>{item.notes || desc}</div>
        
        {/* Qty controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={() => onQtyChange(item.quantity - 1)}
            style={{ width: 28, height: 28, borderRadius: '6px', border: '1px solid var(--border-light)', color: 'var(--text-muted)', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-panel)' }}
          >−</button>
          
          <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-main)', minWidth: 12, textAlign: 'center' }}>{item.quantity}</span>
          
          <button
            onClick={() => onQtyChange(item.quantity + 1)}
            style={{ width: 28, height: 28, borderRadius: '6px', border: '1px solid var(--border-light)', color: 'var(--text-muted)', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-panel)' }}
          >+</button>
        </div>
      </div>
    </div>
  )
}
