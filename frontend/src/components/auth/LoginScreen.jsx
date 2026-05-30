import { useState } from 'react'
import { api, setToken } from '../../utils/apiClient.js'
import { useAuthStore } from '../../stores/authStore.js'
import { cacheDailyInventory, cacheDailyOrders, cacheProducts, cacheCategories, cacheIngredients, getAppState, setAppState } from '../../db/index.js'
import { localDateInputValue } from '../../utils/date.js'
import { IconBackspace, IconCheck } from '../ui/Icons.jsx'

const KEYS = ['1','2','3','4','5','6','7','8','9','←','0','✓']

const APP_VERSION = '1.0.1'

const hashPin = async (pin) => {
  const data = new TextEncoder().encode(pin)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest)).map(byte => byte.toString(16).padStart(2, '0')).join('')
}

const readOfflineLogins = async () => {
  const logins = await getAppState('offline_logins')
  if (Array.isArray(logins)) return logins

  const legacyLogin = await getAppState('offline_login')
  return legacyLogin ? [legacyLogin] : []
}

export default function LoginScreen() {
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const login = useAuthStore(s => s.login)
  const isAppleDevice = typeof navigator !== 'undefined' && /(Macintosh|Mac OS X|iPhone|iPad|iPod)/i.test(navigator.userAgent)
  const isNativeApp = typeof window !== 'undefined' && Boolean(window.Capacitor)
  const showApkDownload = !isAppleDevice && !isNativeApp

  const handleKey = async (key) => {
    if (loading) return
    if (key === '←') { setPin(p => p.slice(0, -1)); setError(''); return }
    if (key === '✓') {
      if (pin.length < 4) { setError('Enter your PIN'); return }
      setLoading(true); setError('')
      try {
        const { token, user } = await api.login(pin)
        setToken(token)
        const snap = await api.snapshot()
        await Promise.all([
          cacheProducts(snap.products),
          cacheCategories(snap.categories),
          cacheIngredients(snap.ingredients),
          cacheDailyInventory({
            products: snap.products,
            categories: snap.categories,
            ingredients: snap.ingredients
          })
        ])
        api.getOrders({ date: localDateInputValue() })
          .then(orders => cacheDailyOrders(localDateInputValue(), orders))
          .catch(() => {})
        await setAppState('offline_login', {
          user,
          token,
          pin_hash: await hashPin(pin),
          cached_at: new Date().toISOString()
        })
        {
          const pinHash = await hashPin(pin)
          const offlineLogins = await readOfflineLogins()
          const nextOfflineLogins = [
            { user, token, pin_hash: pinHash, cached_at: new Date().toISOString() },
            ...offlineLogins.filter(entry => entry.pin_hash !== pinHash)
          ].slice(0, 20)
          await setAppState('offline_logins', nextOfflineLogins)
        }
        login(user, token)
      } catch (err) {
        if (err.message !== 'INVALID_PIN') {
          const pinHash = await hashPin(pin)
          const cachedLogin = (await readOfflineLogins()).find(entry => entry.pin_hash === pinHash)
          if (cachedLogin) {
            setToken(cachedLogin.token)
            login(cachedLogin.user, cachedLogin.token)
            return
          }
        }
        setError(err.message === 'INVALID_PIN' ? 'Wrong PIN. Try again.' : 'Connection error. Check network.')
        setPin('')
      } finally { setLoading(false) }
      return
    }
    if (pin.length >= 6) return
    setPin(p => p + key)
  }

  return (
    <div style={{
      height: '100dvh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg-app)', gap: 32
    }}>
      {/* Branding */}
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 56, color: 'var(--text-strong)', letterSpacing: -1, lineHeight: 1, fontWeight: 800 }}>LABS BURGER</div>
        <div style={{ width: 48, height: 4, background: 'var(--gold)', margin: '14px auto 0', borderRadius: 2 }} />
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 12, letterSpacing: 2, textTransform: 'uppercase', fontWeight: 600 }}>Point of Sale</div>
      </div>

      {/* PIN dots */}
      <div style={{ display: 'flex', gap: 16, alignItems: 'center', height: 24 }}>
        {[0,1,2,3].map(i => (
          <div key={i} style={{
            width: 14, height: 14, borderRadius: '50%', transition: 'all 0.2s cubic-bezier(0.18, 0.89, 0.32, 1.28)',
            background: i < pin.length ? 'var(--text-strong)' : 'var(--border-card)',
            transform: i < pin.length ? 'scale(1.2)' : 'scale(1)'
          }} />
        ))}
      </div>

      {/* Error */}
      {error && (
        <div style={{ color: 'var(--red)', fontSize: 13, fontWeight: 600, background: 'rgba(239,68,68,0.1)', padding: '10px 24px', borderRadius: 'var(--radius-pill)' }}>
          {error}
        </div>
      )}

      {/* PIN pad */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, width: 280 }}>
        {KEYS.map(key => {
          const isConfirm = key === '✓'
          const isReady = isConfirm && pin.length >= 4
          return (
            <button key={key} onClick={() => handleKey(key)} disabled={loading}
              style={{
                height: 72, fontSize: isConfirm || key === '←' ? 24 : 26, fontWeight: 700,
                background: isReady ? 'var(--text-strong)' : 'var(--bg-panel)',
                color: isReady ? 'var(--bg-app)' : (isConfirm ? 'var(--text-faint)' : 'var(--text-strong)'),
                border: `1px solid ${isReady ? 'var(--text-strong)' : 'var(--border-light)'}`,
                borderRadius: 'var(--radius-lg)', transition: 'all 0.1s', opacity: loading ? 0.5 : 1,
                boxShadow: isConfirm ? 'none' : 'var(--shadow-sm)'
              }}>
              {loading && isConfirm ? '...' : isConfirm ? <IconCheck size={22} /> : key === '←' ? <IconBackspace size={22} /> : key}
            </button>
          )
        })}
      </div>

      <div style={{ fontSize: 12, color: 'var(--text-muted)', letterSpacing: 1, fontWeight: 500 }}>ENTER STAFF PIN</div>

      {showApkDownload && (
        <a
          href="/downloads/labs-burger-pos-debug.apk"
          download
          style={{
            position: 'fixed',
            left: '50%',
            bottom: 'calc(14px + env(safe-area-inset-bottom))',
            transform: 'translateX(-50%)',
            color: 'var(--text-muted)',
            background: 'rgba(255,255,255,0.82)',
            border: '1px solid var(--border-light)',
            borderRadius: 'var(--radius-pill)',
            padding: '8px 12px',
            fontSize: 11,
            fontWeight: 800,
            textDecoration: 'none',
            boxShadow: 'var(--shadow-sm)',
            whiteSpace: 'nowrap'
          }}
        >
          Download Android APK
        </a>
      )}

      <div
        style={{
          position: 'fixed',
          right: 'calc(14px + env(safe-area-inset-right))',
          bottom: 'calc(10px + env(safe-area-inset-bottom))',
          color: 'var(--text-faint)',
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: 0.6,
          textTransform: 'uppercase',
          pointerEvents: 'none'
        }}
      >
        v{APP_VERSION}
      </div>
    </div>
  )
}
