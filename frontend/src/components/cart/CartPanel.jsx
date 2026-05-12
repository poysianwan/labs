import { useCartStore } from '../../stores/cartStore.js'
import { IconX } from '../ui/Icons.jsx'

export default function CartPanel({ onCheckout }) {
  const { items, removeItem, updateQuantity, updateNotes, getTotal, clearCart } = useCartStore()
  const total = getTotal()

  return (
    <div style={{
      width: 320, background: '#0d0d0d', borderLeft: '1px solid #1a1a1a',
      display: 'flex', flexDirection: 'column', height: '100vh'
    }}>
      {/* Cart header */}
      <div style={{
        padding: '16px 20px', borderBottom: '1px solid #1a1a1a',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center'
      }}>
        <span style={{ color: '#fff', fontWeight: 700, fontSize: 16 }}>
          Current Order
          {items.length > 0 && (
            <span style={{
              marginLeft: 8, background: '#CC0000', color: '#fff',
              borderRadius: '50%', width: 22, height: 22,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 700
            }}>
              {items.reduce((s, i) => s + i.quantity, 0)}
            </span>
          )}
        </span>
        {items.length > 0 && (
          <button onClick={clearCart} style={{
            background: 'transparent', border: 'none', color: '#555',
            fontSize: 12, cursor: 'pointer', padding: '4px 8px'
          }}>Clear all</button>
        )}
      </div>

      {/* Items list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
        {items.length === 0 ? (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            height: '100%', color: '#333', fontSize: 14, flexDirection: 'column', gap: 8
          }}>
            <div style={{ fontSize: 40 }}>🛒</div>
            <div>Tap items to add</div>
          </div>
        ) : items.map(item => (
          <CartItem key={item.product_id} item={item}
            onQtyChange={(q) => updateQuantity(item.product_id, q)}
            onNotesChange={(n) => updateNotes(item.product_id, n)}
            onRemove={() => removeItem(item.product_id)}
          />
        ))}
      </div>

      {/* Total + checkout */}
      <div style={{ borderTop: '1px solid #1a1a1a', padding: 16 }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between',
          marginBottom: 14, alignItems: 'baseline'
        }}>
          <span style={{ color: '#888', fontSize: 14 }}>Total</span>
          <span style={{ color: '#FFD700', fontSize: 28, fontWeight: 900, letterSpacing: -1 }}>
            ₱{total.toFixed(2)}
          </span>
        </div>
        <button
          onClick={onCheckout}
          disabled={items.length === 0}
          data-testid="checkout-btn"
          style={{
            width: '100%', padding: '16px 0', borderRadius: 14, border: 'none',
            background: items.length > 0 ? '#CC0000' : '#1a0000',
            color: items.length > 0 ? '#fff' : '#440000',
            fontSize: 16, fontWeight: 700, cursor: items.length > 0 ? 'pointer' : 'not-allowed',
            letterSpacing: 0.5, transition: 'all 0.15s'
          }}
          onMouseDown={e => items.length > 0 && (e.currentTarget.style.background = '#aa0000')}
          onMouseUp={e => items.length > 0 && (e.currentTarget.style.background = '#CC0000')}
        >
          CHARGE ₱{total.toFixed(2)}
        </button>
      </div>
    </div>
  )
}

function CartItem({ item, onQtyChange, onNotesChange, onRemove }) {
  return (
    <div style={{
      padding: '10px 16px', borderBottom: '1px solid #141414'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1, marginRight: 8 }}>
          <div style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>{item.name}</div>
          <div style={{ color: '#666', fontSize: 12, marginTop: 1 }}>
            ₱{item.unit_price.toFixed(2)} each
          </div>
        </div>
        <div style={{ color: '#FFD700', fontWeight: 700, fontSize: 14, minWidth: 60, textAlign: 'right' }}>
          ₱{(item.unit_price * item.quantity).toFixed(2)}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
        {/* Qty controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
          <button onClick={() => onQtyChange(item.quantity - 1)} style={{
            width: 28, height: 28, borderRadius: '8px 0 0 8px',
            border: '1px solid #222', background: '#1a1a1a',
            color: '#fff', fontSize: 16, cursor: 'pointer', lineHeight: 1
          }}>−</button>
          <div style={{
            width: 32, height: 28, background: '#111',
            border: '1px solid #222', borderLeft: 'none', borderRight: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#FFD700', fontSize: 13, fontWeight: 700
          }}>{item.quantity}</div>
          <button onClick={() => onQtyChange(item.quantity + 1)} style={{
            width: 28, height: 28, borderRadius: '0 8px 8px 0',
            border: '1px solid #222', background: '#1a1a1a',
            color: '#fff', fontSize: 16, cursor: 'pointer', lineHeight: 1
          }}>+</button>
        </div>

        {/* Notes */}
        <input
          placeholder="Notes..."
          value={item.notes}
          onChange={e => onNotesChange(e.target.value)}
          style={{
            flex: 1, padding: '4px 8px', borderRadius: 6,
            border: '1px solid #222', background: '#0d0d0d',
            color: '#aaa', fontSize: 11, outline: 'none'
          }}
        />

        {/* Remove */}
        <button onClick={onRemove} style={{
          background: 'transparent', border: 'none', color: '#333',
          cursor: 'pointer', padding: '0 4px', lineHeight: 1, display: 'flex', alignItems: 'center'
        }}><IconX size={14} /></button>
      </div>
    </div>
  )
}
