import { useAuthStore } from '../../stores/authStore.js'
import { useSyncStore } from '../../stores/syncStore.js'

export default function StatusBar({ currentShift, onShiftEnd }) {
  const user = useAuthStore(s => s.user)
  const logout = useAuthStore(s => s.logout)
  const { isOnline, isSyncing, pendingCount } = useSyncStore()

  return (
    <div style={{
      height: 48, background: 'var(--black-soft)',
      borderBottom: '1px solid var(--black-border)',
      display: 'flex', alignItems: 'center',
      padding: '0 16px', gap: 16, flexShrink: 0
    }}>
      {/* Brand */}
      <div style={{
        fontFamily: 'var(--font-display)', fontSize: 20,
        color: 'var(--yellow)', letterSpacing: 2
      }}>LABS BURGER</div>

      <div style={{ flex: 1 }} />

      {/* Sync status */}
      {pendingCount > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'rgba(255,208,0,0.1)', border: '1px solid rgba(255,208,0,0.3)',
          padding: '4px 10px', borderRadius: 20, fontSize: 12
        }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--yellow)' }} />
          <span style={{ color: 'var(--yellow)' }}>
            {isSyncing ? 'Syncing...' : `${pendingCount} pending`}
          </span>
        </div>
      )}

      {/* Online/Offline */}
      <div data-testid="offline-badge" style={{
        display: 'flex', alignItems: 'center', gap: 6,
        background: isOnline ? 'rgba(34,197,94,0.1)' : 'rgba(204,0,0,0.15)',
        border: `1px solid ${isOnline ? 'rgba(34,197,94,0.3)' : 'rgba(204,0,0,0.4)'}`,
        padding: '4px 10px', borderRadius: 20, fontSize: 12,
        visibility: isOnline ? 'hidden' : 'visible'
      }}>
        <div style={{
          width: 6, height: 6, borderRadius: '50%',
          background: isOnline ? 'var(--green)' : 'var(--red)'
        }} />
        <span style={{ color: isOnline ? 'var(--green)' : '#ff6b6b' }}>
          {isOnline ? 'Online' : 'Offline'}
        </span>
      </div>

      {/* Shift indicator */}
      {currentShift && (
        <div style={{ fontSize: 12, color: 'var(--gray)' }}>
          Shift #{currentShift.id?.slice(-4)}
        </div>
      )}

      {/* User */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '6px 12px', background: 'var(--black-card)',
        borderRadius: 8, border: '1px solid var(--black-border)'
      }}>
        <div style={{
          width: 28, height: 28, borderRadius: '50%',
          background: user?.role === 'admin' ? 'var(--red)' : 'var(--black-border)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 12, fontWeight: 700, color: 'var(--white)'
        }}>
          {user?.name?.[0]?.toUpperCase()}
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1 }}>{user?.name}</div>
          <div style={{ fontSize: 10, color: 'var(--gray)', textTransform: 'uppercase', letterSpacing: 1 }}>
            {user?.role}
          </div>
        </div>
        <button onClick={logout} style={{
          background: 'none', color: 'var(--gray)', fontSize: 11,
          padding: '4px 8px', borderRadius: 6,
          border: '1px solid var(--black-border)', marginLeft: 4
        }}>Exit</button>
      </div>
    </div>
  )
}
