import { useState, useEffect } from 'react'
import { api } from '../../utils/apiClient.js'
import { useAuthStore } from '../../stores/authStore.js'
import { IconClock, IconBox, IconTrash, IconPlus, IconTrendingUp, IconAlertCircle, IconUser, IconArrowLeft, IconCheck, IconRotateCcw } from '../ui/Icons.jsx'

const LOG_CONFIG = {
  void_order: { icon: IconTrash, color: 'var(--red)', label: 'Order Voided' },
  order_complete: { icon: IconTrendingUp, color: 'var(--green)', label: 'Order Completed' },
  restock: { icon: IconBox, color: 'var(--gold)', label: 'Stock Restock', reversible: true },
  shift_start: { icon: IconClock, color: 'var(--green)', label: 'Shift Started' },
  shift_end: { icon: IconClock, color: 'var(--red)', label: 'Shift Ended' },
  petty_cash: { icon: IconAlertCircle, color: 'var(--text-strong)', label: 'Cash Movement', reversible: true },
  update_product: { icon: IconBox, color: 'var(--gold)', label: 'Product Updated', reversible: true },
  create_product: { icon: IconPlus, color: 'var(--green)', label: 'Product Added', reversible: true },
  delete_product: { icon: IconTrash, color: 'var(--red)', label: 'Product Removed', reversible: true },
  create_ingredient: { icon: IconPlus, color: 'var(--green)', label: 'Ingredient Added', reversible: true },
  delete_ingredient: { icon: IconTrash, color: 'var(--red)', label: 'Ingredient Removed', reversible: true },
}

const fmtLabel = (s) => s.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')
const parseValue = (value) => {
  if (!value) return null
  if (typeof value !== 'string') return value
  try { return JSON.parse(value) } catch { return value }
}
const summarizeLog = (log) => {
  const details = parseValue(log.new_value) || parseValue(log.old_value)
  if (!details || typeof details !== 'object') return log.details || 'No additional summary available.'
  if (log.action.startsWith('revert_')) return details.message || 'Action was rolled back.'

  switch (log.action) {
    case 'order_complete':
      return `Order ${details.order_number || log.record_id} was processed for ₱${Number(details.total || 0).toFixed(2)}.`
    case 'void_order':
      return `Order ${log.record_id || ''} was voided. Reason: ${details.reason || 'No reason recorded'}.`
    case 'restock':
      return `Restocked ${details.name || 'item'} by ${details.quantity || 0} ${details.unit || 'units'}.`
    case 'update_product':
      return `Updated product details for ${details.name || 'this product'}.`
    case 'shift_start':
      return `Shift opened with ₱${Number(details.opening_cash || 0).toFixed(2)}.`
    case 'shift_end':
      return `Shift closed with ₱${Number(details.closing_cash || 0).toFixed(2)}.`
    case 'petty_cash':
      return `${details.type === 'pay_in' ? 'Added' : 'Withdrew'} ₱${Number(details.amount || 0).toFixed(2)}. ${details.reason || ''}`
    default:
      return `${fmtLabel(log.action)}${details.name ? `: ${details.name}` : ''}`
  }
}

function DetailBlock({ title, value }) {
  if (!value) return null
  const entries = typeof value === 'object' && !Array.isArray(value) ? Object.entries(value) : null

  return (
    <div className="activity-detail-block">
      <div className="activity-detail-title">{title}</div>
      {entries ? (
        <div className="activity-detail-grid">
          {entries.map(([key, val]) => (
            <div key={key} className="activity-detail-row">
              <span>{fmtLabel(key)}</span>
              <strong>{typeof val === 'object' && val !== null ? JSON.stringify(val) : String(val ?? '-')}</strong>
            </div>
          ))}
        </div>
      ) : (
        <pre className="activity-detail-pre">{String(value)}</pre>
      )}
    </div>
  )
}

function ActivityDetailsModal({ log, config, isAdmin, canRevert, onClose, onRevert }) {
  const oldValue = parseValue(log.old_value)
  const newValue = parseValue(log.new_value)
  const created = new Date(log.created_at)

  return (
    <div className="activity-modal-backdrop" onMouseDown={onClose}>
      <div className="activity-modal" onMouseDown={e => e.stopPropagation()}>
        <div className="activity-modal-header">
          <div>
            <div className="activity-modal-eyebrow">{config.label}</div>
            <h3>Activity Details</h3>
          </div>
          <button className="activity-modal-close" onClick={onClose} aria-label="Close details">×</button>
        </div>

        <div className="activity-detail-summary">
          <div>
            <span>Action</span>
            <strong>{fmtLabel(log.action)}</strong>
          </div>
          <div>
            <span>User</span>
            <strong>{log.user_name || 'System'}</strong>
          </div>
          <div>
            <span>When</span>
            <strong>{created.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })} {created.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })}</strong>
          </div>
          <div>
            <span>Record</span>
            <strong>{log.record_id || '-'}</strong>
          </div>
        </div>

        <div className="activity-modal-description">{summarizeLog(log)}</div>
        <DetailBlock title="New Value" value={newValue} />
        <DetailBlock title="Previous Value" value={oldValue} />

        <div className="activity-modal-actions">
          <button className="activity-secondary-btn" onClick={onClose}>Close</button>
          {isAdmin && canRevert && (
            <button className="activity-danger-btn" onClick={onRevert}>
              <IconRotateCcw size={14} /> Revert Action
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default function ActivityPanel() {
  const { isAdmin } = useAuthStore()
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [revertingLog, setRevertingLog] = useState(null)
  const [selectedLog, setSelectedLog] = useState(null)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  const fetchLogs = (p) => {
    setLoading(true)
    api.getActivityLogs(p)
      .then(res => {
        setLogs(res.logs)
        setTotalPages(res.totalPages)
        setPage(res.currentPage)
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchLogs(page)
  }, [page])

  const handleRevert = async () => {
    if (!revertingLog) return
    const targetId = revertingLog.id
    setLoading(true)
    try {
      await api.revertActivityLog(targetId)
      
      // Update local state instantly so the button disappears
      setLogs(prev => prev.map(log => 
        log.id === targetId ? { ...log, is_reverted: true } : log
      ))
      
      setRevertingLog(null)
      setSelectedLog(null)
      fetchLogs(page) // Refresh to get the new 'revert_' log entry
    } catch (err) {
      alert(err.message || 'Failed to revert action')
    } finally {
      setLoading(false)
    }
  }

  const renderLogDetails = (log) => {
    const isRevert = log.action.startsWith('revert_')
    const val = log.new_value || log.old_value
    if (!val) return log.details || '-'
    
    try {
      const details = typeof val === 'string' ? JSON.parse(val) : val
      const old = log.old_value ? (typeof log.old_value === 'string' ? JSON.parse(log.old_value) : log.old_value) : null

      if (isRevert) return <span>{details.message || 'Action was rolled back.'}</span>
      
      switch (log.action) {
        case 'order_complete':
          return <span>Order <strong>{details.order_number}</strong> for ₱{Number(details.total).toFixed(2)} was processed.</span>
        case 'void_order':
          return <span>Order <strong>#{log.record_id?.slice(0,8)}</strong> voided. Reason: <span style={{ color: 'var(--red)' }}>"{details.reason}"</span></span>
        case 'restock':
          return <span>Restocked <strong>{details.name}</strong> (+{details.quantity} {details.unit || 'units'}).</span>
        case 'update_product':
          return <span>Updated <strong>{details.name}</strong> price/info.</span>
        case 'create_product':
        case 'delete_product':
        case 'create_ingredient':
        case 'delete_ingredient':
          return <span>{fmtLabel(log.action)}: <strong>{details.name}</strong></span>
        case 'shift_start':
          return <span>Shift opened with <strong>₱{Number(details.opening_cash).toFixed(2)}</strong>.</span>
        case 'shift_end':
          return <span>Shift closed with <strong>₱{Number(details.closing_cash).toFixed(2)}</strong>.</span>
        case 'petty_cash':
          return <span>{details.type === 'pay_in' ? 'Added' : 'Withdrew'} <strong>₱{Number(details.amount).toFixed(2)}</strong>: "{details.reason}"</span>
        default:
          return log.details || JSON.stringify(details)
      }
    } catch (e) {
      return log.details || '-'
    }
  }

  return (
    <div className="admin-pad" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', padding: '24px 32px 16px' }}>
      <div className="admin-header-row" style={{ flexShrink: 0, marginBottom: 16 }}>
        <h2 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-strong)', margin: 0, letterSpacing: -0.5 }}>System Activity Log</h2>
      </div>
      
      <div style={{ flex: 1, overflowY: 'auto', paddingRight: 4, minHeight: 0 }}>
        {loading ? (
          <div style={{ color: 'var(--text-muted)', fontSize: 14, fontWeight: 500, padding: 32 }}>Loading activity...</div>
        ) : logs.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 14, padding: 40, background: 'var(--bg-panel)', borderRadius: 'var(--radius-xl)', border: '1px dashed var(--border-light)' }}>
            No activity records found.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingBottom: 24 }}>
            {logs.map((log) => {
              const isReverted = log.is_reverted
              const isUndoAction = log.action.toLowerCase().startsWith('revert_')
              const config = isUndoAction 
                ? { icon: IconRotateCcw, color: '#3b82f6', label: 'Action Reverted' }
                : (LOG_CONFIG[log.action] || { icon: IconAlertCircle, color: 'var(--text-muted)', label: fmtLabel(log.action) })
              const canRevert = !isReverted && !isUndoAction && isAdmin() && config.reversible
              
              const Icon = config.icon
              const timeStr = new Date(log.created_at).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })
              const dateStr = new Date(log.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })

              return (
                <div
                  key={log.id}
                  className="activity-card"
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedLog(log)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      setSelectedLog(log)
                    }
                  }}
                  style={{
                  background: 'var(--bg-panel)',
                  border: `1px solid ${isReverted ? 'rgba(59, 130, 246, 0.2)' : 'var(--border-card)'}`,
                  borderRadius: 'var(--radius-xl)',
                  padding: '20px 24px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 20,
                  boxShadow: isReverted ? 'none' : 'var(--shadow-sm)',
                  position: 'relative',
                  overflow: 'hidden',
                  opacity: isReverted ? 0.8 : 1
                }}>
                  {isReverted && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: '#3b82f6' }} />}

                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 16, minWidth: 0 }}>
                    <div style={{ 
                      width: 44, height: 44, borderRadius: 'var(--radius-lg)', 
                      background: isUndoAction || isReverted ? 'rgba(59, 130, 246, 0.1)' : 'var(--bg-app)', 
                      display: 'flex', alignItems: 'center', justifyContent: 'center', 
                      color: isUndoAction || isReverted ? '#3b82f6' : config.color, 
                      flexShrink: 0,
                      border: `1px solid ${isUndoAction || isReverted ? 'rgba(59, 130, 246, 0.2)' : 'var(--border-light)'}`
                    }}>
                      <Icon size={22} />
                    </div>
                    
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
                        {config.label}
                      </div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: isReverted ? 'rgba(59, 130, 246, 0.8)' : 'var(--text-strong)', letterSpacing: -0.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {renderLogDetails(log)}
                      </div>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right', flexShrink: 0, borderLeft: '1px solid var(--border-light)', paddingLeft: 20, minWidth: 140 }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-strong)' }}>{log.user_name || 'System'}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, marginTop: 4 }}>
                      {dateStr} <span style={{ opacity: 0.4 }}>•</span> {timeStr}
                    </div>
                  </div>

                  {canRevert && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setRevertingLog(log)
                      }}
                      disabled={loading || revertingLog?.id === log.id}
                      title="Undo this action"
                      style={{
                        padding: '10px 16px', borderRadius: 'var(--radius-md)', 
                        background: 'transparent', color: 'var(--text-muted)', 
                        border: '1px solid var(--border-light)', 
                        fontSize: 12, fontWeight: 700, cursor: 'pointer',
                        transition: 'all 0.2s',
                        marginLeft: 10,
                        flexShrink: 0
                      }}
                      onMouseOver={(e) => { e.currentTarget.style.color = 'var(--red)'; e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.3)'; e.currentTarget.style.background = 'rgba(239, 68, 68, 0.05)' }}
                      onMouseOut={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border-light)'; e.currentTarget.style.background = 'transparent' }}
                    >
                      {loading && revertingLog?.id === log.id ? '...' : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <IconRotateCcw size={14} /> Revert
                        </div>
                      )}
                    </button>
                  )}
                  {isReverted && (
                    <div style={{ 
                      fontSize: 10, fontWeight: 900, color: '#3b82f6', 
                      background: 'rgba(59, 130, 246, 0.1)', 
                      padding: '4px 12px', borderRadius: 100,
                      textTransform: 'uppercase', letterSpacing: 0.5,
                      marginLeft: 10,
                      flexShrink: 0
                    }}>
                      Reverted
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 24, padding: '16px 0 0', flexShrink: 0, background: 'linear-gradient(to top, var(--bg-app) 80%, transparent)' }}>
        <button 
          disabled={page <= 1 || loading}
          onClick={() => setPage(p => p - 1)}
          style={{ padding: '8px 16px', borderRadius: 8, background: 'var(--bg-panel)', border: '1px solid var(--border-light)', color: page <= 1 ? 'var(--text-muted)' : 'var(--text-strong)', fontWeight: 700, cursor: page <= 1 ? 'default' : 'pointer', fontSize: 13, opacity: page <= 1 ? 0.5 : 1 }}
        >
          Previous
        </button>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>
          Page <span style={{ color: 'var(--text-strong)' }}>{page}</span> of {totalPages}
        </div>
        <button 
          disabled={page >= totalPages || loading}
          onClick={() => setPage(p => p + 1)}
          style={{ padding: '8px 16px', borderRadius: 8, background: 'var(--bg-panel)', border: '1px solid var(--border-light)', color: page >= totalPages ? 'var(--text-muted)' : 'var(--text-strong)', fontWeight: 700, cursor: page >= totalPages ? 'default' : 'pointer', fontSize: 13, opacity: page >= totalPages ? 0.5 : 1 }}
        >
          Next
        </button>
      </div>

      {revertingLog && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div style={{ background: 'var(--bg-panel)', padding: 32, borderRadius: 'var(--radius-xl)', maxWidth: 400, width: '100%', textAlign: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-strong)', marginBottom: 8 }}>Revert this action?</div>
            <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 24, lineHeight: 1.5 }}>
              Are you sure you want to undo "<strong>{LOG_CONFIG[revertingLog.action]?.label || fmtLabel(revertingLog.action)}</strong>"? 
              This will attempt to restore the previous data in the database.
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <button onClick={() => setRevertingLog(null)} style={{ padding: 12, borderRadius: 'var(--radius-md)', background: 'var(--bg-image)', color: 'var(--text-muted)', border: 'none', fontWeight: 600 }}>Cancel</button>
              <button onClick={handleRevert} style={{ padding: 12, borderRadius: 'var(--radius-md)', background: 'var(--red)', color: 'white', border: 'none', fontWeight: 600 }}>Yes, Revert</button>
            </div>
          </div>
        </div>
      )}

      {selectedLog && (() => {
        const isReverted = selectedLog.is_reverted
        const isUndoAction = selectedLog.action.toLowerCase().startsWith('revert_')
        const config = isUndoAction
          ? { icon: IconRotateCcw, color: '#3b82f6', label: 'Action Reverted' }
          : (LOG_CONFIG[selectedLog.action] || { icon: IconAlertCircle, color: 'var(--text-muted)', label: fmtLabel(selectedLog.action) })
        const canRevert = !isReverted && !isUndoAction && isAdmin() && config.reversible

        return (
          <ActivityDetailsModal
            log={selectedLog}
            config={config}
            isAdmin={isAdmin()}
            canRevert={canRevert}
            onClose={() => setSelectedLog(null)}
            onRevert={() => setRevertingLog(selectedLog)}
          />
        )
      })()}
    </div>
  )
}
