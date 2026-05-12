import { useState, useEffect } from 'react'
import { api } from '../../utils/apiClient.js'
import { useAuthStore } from '../../stores/authStore.js'

const fmt = (n) => `₱${Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`

export default function ShiftPanel() {
  const { isAdmin } = useAuthStore()
  const [pastShifts, setPastShifts] = useState([])
  const [fetchError, setFetchError] = useState(null)
  const [loading, setLoading] = useState(false)

  // Standalone withdraw form
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [withdrawReason, setWithdrawReason] = useState('')
  const [withdrawSuccess, setWithdrawSuccess] = useState(false)

  const refreshHistory = () => {
    api.getShifts().then(setPastShifts).catch((e) => {
      console.error('Fetch shifts error:', e)
      setFetchError(e.message)
    })
  }

  useEffect(() => {
    refreshHistory()
    const interval = setInterval(refreshHistory, 15000)
    return () => clearInterval(interval)
  }, [])

  const handleCashWithdraw = async () => {
    if (!withdrawAmount || !withdrawReason) return alert('Amount and reason are required.')
    setLoading(true)
    try {
      await api.cashWithdraw(parseFloat(withdrawAmount), withdrawReason)
      setWithdrawAmount('')
      setWithdrawReason('')
      setWithdrawSuccess(true)
      setTimeout(() => setWithdrawSuccess(false), 3000)
      refreshHistory()
    } catch (err) { alert(err.message) }
    finally { setLoading(false) }
  }

  return (
    <div className="admin-pad" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', gap: 24, padding: '24px 32px' }}>
      <div className="admin-header-row" style={{ flexShrink: 0 }}>
        <h2 style={{ fontSize: 28, fontWeight: 900, color: 'var(--text-strong)', margin: 0, letterSpacing: -0.8 }}>Network Shift History</h2>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', paddingRight: 8, minHeight: 0 }}>
        {/* Main Withdrawal Card */}
        <div style={{ background: 'var(--bg-panel)', border: '1px solid var(--border-card)', borderRadius: 'var(--radius-xl)', padding: 32, boxShadow: 'var(--shadow-sm)', marginBottom: 40 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
            <div style={{ width: 14, height: 14, borderRadius: '50%', background: 'rgb(239, 68, 68)', boxShadow: '0 0 15px rgba(239, 68, 68, 0.4)' }} />
            <h3 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-strong)', margin: 0, letterSpacing: -0.5 }}>Withdraw Cash from Register</h3>
          </div>
          <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 28, fontWeight: 500, lineHeight: 1.6, maxWidth: 600 }}>
            Safely log money removals for bank deposits or supplies. This creates an independent record in the cash drawer history.
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(140px, 180px) 1fr auto', gap: 20, alignItems: 'flex-end' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>Amount (₱)</label>
              <input type="number" value={withdrawAmount} onChange={e => setWithdrawAmount(e.target.value)} placeholder="0.00" disabled={loading}
                style={{ width: '100%', padding: '14px 18px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-strong)', fontSize: 18, fontWeight: 800, background: 'var(--bg-app)', color: 'var(--text-strong)', outline: 'none', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>Reason / Purpose</label>
              <input type="text" value={withdrawReason} onChange={e => setWithdrawReason(e.target.value)} placeholder="e.g. Bank deposit, grocery run" disabled={loading}
                style={{ width: '100%', padding: '14px 18px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-strong)', fontSize: 15, fontWeight: 600, background: 'var(--bg-app)', color: 'var(--text-strong)', outline: 'none', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)' }} />
            </div>
            <button onClick={handleCashWithdraw} disabled={loading || !withdrawAmount || !withdrawReason}
              style={{ padding: '15px 32px', background: 'rgb(239, 68, 68)', color: 'white', border: 'none', borderRadius: 'var(--radius-lg)', fontSize: 14, fontWeight: 800, cursor: 'pointer', transition: 'all 0.2s', opacity: (loading || !withdrawAmount || !withdrawReason) ? 0.4 : 1, boxShadow: (loading || !withdrawAmount || !withdrawReason) ? 'none' : '0 4px 14px rgba(239, 68, 68, 0.3)' }}>
              {loading ? '...' : 'Complete Withdrawal'}
            </button>
          </div>

          {withdrawSuccess && (
            <div style={{ marginTop: 24, padding: '12px 20px', background: 'rgba(16,185,129,0.08)', borderRadius: 'var(--radius-md)', color: '#059669', fontSize: 14, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 16, height: 16, borderRadius: '50%', background: '#059669', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10 }}>✓</div>
              Withdrawal logged successfully
            </div>
          )}
        </div>

        {/* Sessions List Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, padding: '0 4px' }}>
          <h3 style={{ fontSize: 22, fontWeight: 900, color: 'var(--text-strong)', margin: 0, letterSpacing: -0.5 }}>Individual Statistics</h3>
          <button onClick={refreshHistory} style={{ height: 36, padding: '0 16px', fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', background: 'var(--bg-panel)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.2s' }}>
             Refresh History
          </button>
        </div>

        {fetchError ? (
          <div style={{ padding: 60, textAlign: 'center', color: 'var(--red)', background: 'var(--bg-panel)', borderRadius: 'var(--radius-xl)', border: '1px solid var(--border-light)', fontWeight: 600 }}>{fetchError}</div>
        ) : pastShifts.length === 0 ? (
          <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)', background: 'var(--bg-panel)', borderRadius: 'var(--radius-xl)', border: '1px dashed var(--border-light)', fontSize: 15 }}>No drawer sessions found.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingBottom: 32 }}>
            {pastShifts.map((shift) => {
              const hasVariance = shift.variance !== null && Math.abs(shift.variance) > 0.01
              const isOngoing = !shift.ended_at
              
              return (
                <div key={shift.id} style={{
                  background: 'var(--bg-panel)',
                  border: `1px solid ${isOngoing ? 'rgba(16, 185, 129, 0.4)' : (hasVariance ? 'rgba(239, 68, 68, 0.3)' : 'var(--border-card)')}`,
                  borderRadius: 'var(--radius-xl)',
                  padding: '20px 24px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 16,
                  boxShadow: isOngoing ? '0 8px 30px rgba(16, 185, 129, 0.08)' : 'var(--shadow-sm)',
                  position: 'relative',
                  overflow: 'hidden',
                  transition: 'all 0.2s'
                }}>
                  {isOngoing && <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 6, background: '#10b981' }} />}
                  
                  {/* Row 1: Identity & Primary Action */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ 
                        width: 32, height: 32, borderRadius: 'var(--radius-lg)', 
                        background: isOngoing ? 'rgba(16, 185, 129, 0.1)' : 'var(--bg-app)', 
                        display: 'flex', alignItems: 'center', justifyContent: 'center', 
                        fontWeight: 800, fontSize: 13, color: isOngoing ? '#059669' : 'var(--text-strong)',
                        border: `1px solid ${isOngoing ? 'rgba(16, 185, 129, 0.2)' : 'var(--border-light)'}`,
                        flexShrink: 0
                      }}>
                        {shift.cashier_name?.[0]?.toUpperCase() || 'C'}
                      </div>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 900, color: 'var(--text-strong)', letterSpacing: -0.2 }}>{shift.cashier_name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>
                          {new Date(shift.started_at).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })}
                          {!isOngoing && ` – ${new Date(shift.ended_at).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })}`}
                        </div>
                      </div>
                    </div>

                    {isOngoing && isAdmin() && (
                      <button 
                        onClick={async () => {
                          const amt = prompt(`Close session for ${shift.cashier_name}?\nExpected: ${fmt(shift.expected_cash)}\n\nEnter final cash count:`, shift.expected_cash)
                          if (amt === null) return
                          setLoading(true)
                          try {
                            await api.endShift(shift.id, parseFloat(amt))
                            refreshHistory()
                          } catch (err) { alert(err.message) }
                          finally { setLoading(false) }
                        }}
                        style={{ padding: '6px 12px', borderRadius: 'var(--radius-md)', background: 'var(--text-strong)', color: 'var(--bg-app)', border: 'none', fontSize: 10, fontWeight: 900, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: 1 }}
                      >
                        Close Session
                      </button>
                    )}
                  </div>

                  {/* Row 2: Impacts & Data Visuals */}
                  <div style={{ 
                    display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, 
                    padding: '14px 20px', background: 'var(--bg-app)', 
                    borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-light)' 
                  }}>
                    <div>
                      <div style={{ fontSize: 9, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 }}>Expected</div>
                      <div style={{ fontSize: 15, fontWeight: 900, color: 'var(--text-strong)' }}>{fmt(shift.expected_cash)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 9, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 }}>Actual</div>
                      <div style={{ fontSize: 15, fontWeight: 900, color: isOngoing ? '#059669' : 'var(--text-strong)' }}>
                        {isOngoing ? 'ACTIVE' : fmt(shift.closing_cash)}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 9, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 }}>Variance</div>
                      <div style={{ 
                        fontSize: 15, fontWeight: 900, 
                        color: shift.variance === null ? 'var(--text-muted)' : (shift.variance < -0.01 ? 'rgb(239, 68, 68)' : (shift.variance > 0.01 ? '#059669' : 'var(--text-strong)'))
                      }}>
                        {shift.variance === null ? '–' : (shift.variance > 0.01 ? '+' : '') + fmt(shift.variance)}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
