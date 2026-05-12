import { useState, useEffect } from 'react'
import { api } from '../../utils/apiClient.js'
import { useAuthStore } from '../../stores/authStore.js'
import { IconPlus, IconX, IconCheck, IconTrash } from '../ui/Icons.jsx'

export default function CashierPanel() {
  const currentUser = useAuthStore(s => s.user)
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Form state
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [formName, setFormName] = useState('')
  const [formPin, setFormPin] = useState('')
  const [formRole, setFormRole] = useState('cashier')
  const [formError, setFormError] = useState('')

  // Delete confirm
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)

  const fetchUsers = async () => {
    try {
      const data = await api.getUsers()
      setUsers(data.filter(u => !u.deleted_at))
      setError(null)
    } catch (err) {
      setError(err.message)
    }
  }

  useEffect(() => {
    fetchUsers()
    const interval = setInterval(fetchUsers, 15000)
    return () => clearInterval(interval)
  }, [])

  const resetForm = () => {
    setShowForm(false)
    setEditingId(null)
    setFormName('')
    setFormPin('')
    setFormRole('cashier')
    setFormError('')
  }

  const openEdit = (user) => {
    setEditingId(user.id)
    setFormName(user.name)
    setFormPin('')
    setFormRole(user.role)
    setFormError('')
    setShowForm(true)
  }

  const openAdd = () => {
    resetForm()
    setShowForm(true)
  }

  const handleSubmit = async () => {
    if (!formName.trim()) return setFormError('Name is required')
    if (!editingId && !formPin) return setFormError('PIN is required for new users')
    if (formPin && formPin.length < 4) return setFormError('PIN must be at least 4 digits')

    setLoading(true)
    setFormError('')
    try {
      if (editingId) {
        const data = { name: formName, role: formRole }
        if (formPin) data.pin = formPin
        await api.updateUser(editingId, data)
      } else {
        await api.createUser({ name: formName, pin: formPin, role: formRole })
      }
      resetForm()
      fetchUsers()
    } catch (err) {
      setFormError(err.message || 'Failed to save')
    } finally {
      setLoading(false)
    }
  }

  const handleToggleActive = async (user) => {
    setLoading(true)
    try {
      await api.updateUser(user.id, { is_active: !user.is_active })
      fetchUsers()
    } catch (err) { alert(err.message) }
    finally { setLoading(false) }
  }

  const handleDelete = async (id) => {
    setLoading(true)
    try {
      await api.deleteUser(id)
      setConfirmDeleteId(null)
      fetchUsers()
    } catch (err) { alert(err.message) }
    finally { setLoading(false) }
  }

  return (
    <div className="admin-pad" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto', gap: 24, paddingBottom: 32 }}>
      <div className="admin-header-row">
        <h2 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-strong)', margin: 0, letterSpacing: -0.5 }}>Cashier Management</h2>
        <button onClick={openAdd} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 20px', background: 'var(--text-strong)', color: 'var(--bg-panel)', border: 'none', borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
          <IconPlus size={16} /> Add User
        </button>
      </div>

      {error && (
        <div style={{ padding: 16, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 'var(--radius-md)', color: 'var(--red)', fontSize: 13, fontWeight: 600 }}>
          Error: {error}
        </div>
      )}

      {/* Add / Edit Form */}
      {showForm && (
        <div style={{ background: 'var(--bg-panel)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-lg)', padding: 24, boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-strong)', margin: 0 }}>
              {editingId ? 'Edit User' : 'Add New User'}
            </h3>
            <button onClick={resetForm} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
              <IconX size={18} />
            </button>
          </div>

          {formError && (
            <div style={{ padding: 10, background: 'rgba(239,68,68,0.1)', borderRadius: 'var(--radius-md)', color: 'var(--red)', fontSize: 13, fontWeight: 600, marginBottom: 16 }}>
              {formError}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 20 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, display: 'block' }}>Name</label>
              <input type="text" value={formName} onChange={e => setFormName(e.target.value)} placeholder="e.g. Cashier 2"
                style={{ width: '100%', padding: '10px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)', fontSize: 14, background: 'var(--bg-image)', color: 'var(--text-strong)' }} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, display: 'block' }}>
                PIN {editingId && <span style={{ fontWeight: 500, textTransform: 'none' }}>(leave blank to keep)</span>}
              </label>
              <input type="password" value={formPin} onChange={e => setFormPin(e.target.value)} placeholder={editingId ? '••••' : '4+ digits'}
                style={{ width: '100%', padding: '10px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)', fontSize: 14, background: 'var(--bg-image)', color: 'var(--text-strong)' }} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, display: 'block' }}>Role</label>
              <select value={formRole} onChange={e => setFormRole(e.target.value)}
                style={{ width: '100%', padding: '10px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)', fontSize: 14, background: 'var(--bg-image)', color: 'var(--text-strong)' }}>
                <option value="cashier">Cashier</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <button onClick={resetForm} style={{ padding: '10px 20px', background: 'var(--bg-image)', color: 'var(--text-muted)', border: 'none', borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
            <button onClick={handleSubmit} disabled={loading} style={{ padding: '10px 24px', background: 'var(--text-strong)', color: 'var(--bg-panel)', border: 'none', borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: loading ? 0.6 : 1 }}>
              {loading ? 'Saving...' : editingId ? 'Save Changes' : 'Create User'}
            </button>
          </div>
        </div>
      )}

      {/* Users Grid - Individual Cards */}
      <div style={{ flex: 1, overflowY: 'auto', paddingRight: 4, minHeight: 0 }}>
        {users.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 14, padding: 40, background: 'var(--bg-panel)', borderRadius: 'var(--radius-xl)', border: '1px dashed var(--border-light)' }}>
            No users found.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16, paddingBottom: 24 }}>
            {users.map((user) => (
              <div key={user.id} style={{
                background: 'var(--bg-panel)',
                border: '1px solid var(--border-card)',
                borderRadius: 'var(--radius-xl)',
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
                boxShadow: 'var(--shadow-sm)',
                opacity: user.is_active ? 1 : 0.6,
                position: 'relative'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ 
                    width: 48, height: 48, borderRadius: 'var(--radius-lg)', 
                    background: user.role === 'admin' ? 'rgba(239,68,68,0.1)' : 'var(--bg-app)', 
                    display: 'flex', alignItems: 'center', justifyContent: 'center', 
                    fontWeight: 800, fontSize: 18, 
                    color: user.role === 'admin' ? 'var(--red)' : 'var(--text-strong)', 
                    flexShrink: 0,
                    border: '1px solid var(--border-light)'
                  }}>
                    {user.name?.[0]?.toUpperCase() || 'U'}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-strong)' }}>{user.name}</div>
                      {user.is_online && (
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--green)' }} title="Online Now" />
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                      <span style={{ fontSize: 11, fontWeight: 800, color: user.role === 'admin' ? 'var(--red)' : '#3b82f6', textTransform: 'uppercase', letterSpacing: 0.5 }}>{user.role}</span>
                      <span style={{ color: 'var(--text-faint)' }}>•</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>Created {new Date(user.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}</span>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                  <button onClick={() => openEdit(user)} style={{ flex: 1, padding: '10px', background: 'var(--bg-app)', color: 'var(--text-strong)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                    Edit
                  </button>
                  <button onClick={() => handleToggleActive(user)} disabled={user.id === currentUser?.id} 
                    style={{ 
                      flex: 1, padding: '10px', 
                      background: user.is_active ? 'rgba(239,68,68,0.05)' : 'rgba(34,197,94,0.05)', 
                      color: user.is_active ? 'var(--red)' : 'var(--green)', 
                      border: `1px solid ${user.is_active ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)'}`, 
                      borderRadius: 'var(--radius-md)', 
                      fontSize: 13, fontWeight: 700, 
                      cursor: user.id === currentUser?.id ? 'not-allowed' : 'pointer' 
                    }}>
                    {user.is_active ? 'Disable' : 'Enable'}
                  </button>
                  {user.id !== currentUser?.id && (
                    <button onClick={() => setConfirmDeleteId(user.id)} style={{ padding: '10px', background: 'transparent', color: 'var(--red)', border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer', opacity: 0.6 }}>
                      <IconTrash size={18} />
                    </button>
                  )}
                </div>

                {confirmDeleteId === user.id && (
                  <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.95)', borderRadius: 'var(--radius-xl)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 20, textAlign: 'center', zIndex: 10 }}>
                    <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--text-strong)', marginBottom: 16 }}>Permanently delete {user.name}?</div>
                    <div style={{ display: 'flex', gap: 8, width: '100%' }}>
                      <button onClick={() => handleDelete(user.id)} style={{ flex: 1, padding: '10px', background: 'var(--red)', color: 'white', border: 'none', borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 700 }}>Delete</button>
                      <button onClick={() => setConfirmDeleteId(null)} style={{ flex: 1, padding: '10px', background: 'var(--bg-app)', color: 'var(--text-strong)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 700 }}>Cancel</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
