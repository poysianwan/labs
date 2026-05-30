import { useState, useEffect } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { api } from '../../utils/apiClient.js'
import { useAuthStore } from '../../stores/authStore.js'
import { saveOrderOffline, markOrderSynced, deleteLocalOrder } from '../../db/index.js'
import { useSyncStore } from '../../stores/syncStore.js'
import { IconCheck, IconX } from '../ui/Icons.jsx'

const NUMPAD = ['1','2','3','4','5','6','7','8','9','·','0','←']
const QUICK_CASH = [10,20,50,100,200,500]

export default function PaymentModal({ total, items, diningType, shiftId, onClose, onSuccess }) {
  const [method, setMethod] = useState('cash')
  const [amountStr, setAmountStr] = useState('')
  
  const [splitGcashStr, setSplitGcashStr] = useState('')
  const [splitCashStr, setSplitCashStr] = useState('')
  const [splitFocus, setSplitFocus] = useState('gcash')
  
  const [referenceNote, setReferenceNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(null)
  const token = useAuthStore(s => s.token)
  const user = useAuthStore(s => s.user)
  const isOnline = useSyncStore(s => s.isOnline)

  const amount = parseFloat(amountStr) || 0
  const splitGcash = parseFloat(splitGcashStr) || 0
  const splitCash = parseFloat(splitCashStr) || 0
  const splitCashDue = Math.max(0, total - splitGcash)
  const splitChange = Math.max(0, splitCash - splitCashDue)
  const hasComboItem = items.some(item => item.is_combo || item.name?.toLowerCase().includes('combo'))

  let change = 0
  let canPay = false
  if (method === 'cash') {
    change = Math.max(0, amount - total)
    canPay = amount >= total
  } else if (method === 'gcash') {
    canPay = true
  } else if (method === 'split') {
    change = splitChange
    canPay = splitGcash > 0 && splitCash >= splitCashDue && splitGcash <= total && splitCashDue > 0
  }

  const handleNum = (key) => {
    let updateFn
    let currentStr
    
    if (method === 'cash') { updateFn = setAmountStr; currentStr = amountStr }
    else if (method === 'split' && splitFocus === 'gcash') { updateFn = setSplitGcashStr; currentStr = splitGcashStr }
    else if (method === 'split' && splitFocus === 'cash') { updateFn = setSplitCashStr; currentStr = splitCashStr }
    else return

    if (key === '←') { updateFn(s => s.slice(0,-1)); return }
    if (key === '·') {
      if (currentStr.includes('.')) return
      updateFn(s => s ? s + '.' : '0.')
      return
    }
    if (currentStr.length >= 8) return
    updateFn(s => s + key)
  }

  const addQuickCash = (value) => {
    const addToAmount = (current) => {
      const next = (parseFloat(current) || 0) + value
      return Number.isInteger(next) ? String(next) : next.toFixed(2)
    }

    if (method === 'cash') setAmountStr(addToAmount)
    else if (method === 'split' && splitFocus === 'cash') setSplitCashStr(addToAmount)
    else if (method === 'split' && splitFocus === 'gcash') setSplitGcashStr(addToAmount)
  }

  const handlePay = async () => {
    if (!canPay || loading) return
    setLoading(true); setError('')
    const orderId = uuidv4()
    const now = new Date().toISOString()

    let paymentsArr = []
    if (method === 'cash') {
      paymentsArr.push({ method: 'cash', amount: amount, change_given: change, reference_note: null })
    } else if (method === 'gcash') {
      paymentsArr.push({ method: 'gcash', amount: total, change_given: 0, reference_note: referenceNote || null })
    } else if (method === 'split') {
      paymentsArr.push({ method: 'gcash', amount: splitGcash, change_given: 0, reference_note: referenceNote || null })
      if (splitCashDue > 0) {
        paymentsArr.push({ method: 'cash', amount: splitCash, change_given: change, reference_note: null })
      }
    }

    const orderPayload = {
      id: orderId,
      user_id: user.id,
      shift_id: shiftId,
      dining_type: diningType,
      items: items.map(i => ({ product_id: i.product_id, quantity: i.quantity, unit_price: i.unit_price, notes: i.notes || null })),
      payments: paymentsArr,
      created_at: now
    }

    // Always save locally first
    await saveOrderOffline(orderPayload)

    // Try to sync if online
    if (isOnline) {
      try {
        await api.createOrder(orderPayload)
        await markOrderSynced(orderId)
      } catch (err) {
        if (err.error === 'DUPLICATE_ORDER') {
          await markOrderSynced(orderId)
        } else if (err.error === 'INSUFFICIENT_STOCK') {
          await deleteLocalOrder(orderId)
          setError(`Out of stock: ${err.ingredient || err.message || 'ingredient unavailable'}`)
          setLoading(false); return
        } else if (err.error === 'COMBO_NOT_CONFIGURED') {
          await deleteLocalOrder(orderId)
          setError(`Combo not configured: ${err.product_name || 'selected combo'}. Add combo items in Inventory before selling it.`)
          setLoading(false); return
        } else {
          if (hasComboItem) await deleteLocalOrder(orderId)
          setError(hasComboItem
            ? `Combo order failed: ${err.message || err.error || 'server error'}. Check that the combo has items configured in Inventory.`
            : `API Error: ${err.message || err.error || 'Server error'}`)
          setLoading(false); return
        }
      }
    }

    setDone({ change, method, total })
    setLoading(false)
  }

  if (done) {
    return (
      <div style={{
        position:'fixed',inset:0,zIndex:9999,
        background:'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', display:'flex',
        alignItems:'center',justifyContent:'center'
      }}>
        <div style={{
          background:'var(--bg-panel)', border:'1px solid var(--border-light)',
          borderRadius:'var(--radius-xl)', padding:40, textAlign:'center',
          maxWidth:320, width:'90%', boxShadow:'var(--shadow-lg)'
        }}>
          <div style={{width:56, height:56, borderRadius:'50%', background:'rgba(16, 185, 129, 0.12)', display:'flex', alignItems:'center', justifyContent:'center', marginBottom:16, margin: '0 auto 16px'}}><IconCheck size={28} color="var(--green)" /></div>
          <div style={{fontSize:24, fontWeight:700, color:'var(--text-strong)', letterSpacing:-0.5}}>Order Completed</div>
          {(done.method==='cash'||done.method==='split')&&done.change>0&&(
            <div style={{marginTop:24}}>
              <div style={{fontSize:14,color:'var(--text-muted)', fontWeight:500}}>Change Due</div>
              <div style={{fontSize:48, fontWeight:700, color:'var(--gold)', letterSpacing:-1}}>₱{done.change.toFixed(2)}</div>
            </div>
          )}
          {(done.method==='gcash'||done.method==='split')&&(
            <div style={{marginTop:12,fontSize:14,color:'var(--text-muted)', fontWeight:500}}>GCash payment recorded</div>
          )}
          <button onClick={onSuccess} style={{
            marginTop:32,width:'100%',padding:'16px',
            background:'var(--text-strong)',color:'var(--bg-panel)',
            fontSize:16,fontWeight:600,borderRadius:'var(--radius-lg)'
          }}>Done</button>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      position:'fixed',inset:0,zIndex:9999,
      background:'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display:'flex',
      alignItems:'center',justifyContent:'center', padding: '16px'
    }}>
      <div className="payment-modal">
        
        {/* Left Column */}
        <div className="payment-left" style={{gap: 'var(--pm-gap)'}}>
          {/* Header */}
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start'}}>
            <div>
              <div style={{fontSize:'var(--pm-font-tiny)', fontWeight:700, color:'var(--text-muted)', letterSpacing: 1, textTransform: 'uppercase', marginBottom:4}}>Total to pay</div>
              <div style={{fontSize:'var(--pm-font-huge)', fontWeight:700, color:'var(--text-strong)', letterSpacing:-1}}>₱{total.toFixed(2)}</div>
            </div>
            <button onClick={onClose} style={{background:'var(--bg-image)', color:'var(--text-muted)', width:36, height:36, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center'}}><IconX size={16} /></button>
          </div>

          {/* Segmented Mode Buttons */}
          <div style={{display:'flex', gap: 6, background: 'var(--bg-image)', padding: 6, borderRadius: 'var(--radius-lg)', marginBottom: 8}}>
            {['cash','gcash','split'].map(m=>(
              <button key={m} onClick={()=>{setMethod(m);setAmountStr('');setSplitGcashStr('');setSplitCashStr('');setSplitFocus('gcash')}} style={{
                flex: 1, padding: '12px 0', fontSize:'var(--pm-font-tab)', fontWeight: m===method?700:600, 
                color: method===m ? 'var(--text-strong)' : 'var(--text-muted)',
                background: method===m ? 'var(--bg-panel)' : 'transparent',
                borderRadius: 'var(--radius-md)',
                boxShadow: method===m ? 'var(--shadow-sm)' : 'none',
                textTransform:'capitalize', transition: 'all 0.15s'
              }}>{m}</button>
            ))}
          </div>

          {/* Dynamic Content */}
          <div style={{display: 'flex', flexDirection: 'column', gap: 'var(--pm-gap)', flex: 1}}>
            {/* Cash */}
            {method==='cash'&&(
              <>
                <div style={{background:'var(--bg-image)', borderRadius:'var(--radius-lg)', padding:'var(--pm-box-pad)', textAlign:'left'}}>
                  <div style={{fontSize:'var(--pm-font-tiny)', color:'var(--text-muted)', fontWeight:700, letterSpacing:1, marginBottom:4}}>TENDERED</div>
                  <div style={{display:'flex', alignItems:'center', width:'100%'}}>
                    <span style={{fontSize:'var(--pm-font-large)', fontWeight:700, color:'var(--text-strong)', letterSpacing:-1}}>₱</span>
                    <input type="number" inputMode="numeric" pattern="[0-9]*" value={amountStr} onChange={e=>setAmountStr(e.target.value)} placeholder="0" style={{flex:1, background:'transparent', border:'none', outline:'none', fontSize:'var(--pm-font-large)', fontWeight:700, color:'var(--text-strong)', letterSpacing:-1, width:'100%'}} />
                  </div>
                </div>
                <div style={{background:amount>=total ? 'rgba(16, 185, 129, 0.1)' : 'var(--bg-image)', borderRadius:'var(--radius-lg)', padding:'var(--pm-box-pad)', textAlign:'left'}}>
                  <div style={{fontSize:'var(--pm-font-tiny)', color:amount>=total ? 'var(--green)' : 'var(--text-muted)', fontWeight:700, letterSpacing:1, marginBottom:4}}>CHANGE DUE</div>
                  <div style={{fontSize:'var(--pm-font-large)', fontWeight:700, color:amount>=total ? 'var(--green)' : 'var(--text-muted)', letterSpacing:-1}}>₱{change.toFixed(2)}</div>
                </div>
              </>
            )}

            {/* GCash */}
            {method==='gcash'&&(
              <div style={{display:'flex', flexDirection:'column', gap:'var(--pm-gap)'}}>
                <div style={{background:'var(--bg-image)', borderRadius:'var(--radius-lg)', padding:'var(--pm-box-pad)', fontSize:'var(--pm-font-tab)', color:'var(--text-strong)', fontWeight:600, lineHeight:1.5}}>
                  Verify GCash transfer of <strong style={{color:'var(--gold)'}}>₱{total.toFixed(2)}</strong>.
                </div>
                <input value={referenceNote} onChange={e=>setReferenceNote(e.target.value)} placeholder="Wait, enter Reference or Name" style={{width:'100%', background:'var(--bg-image)', borderRadius:'var(--radius-lg)', padding:'var(--pm-box-pad)', color:'var(--text-strong)', fontSize:'var(--pm-font-tab)', fontWeight:600}} />
              </div>
            )}

            {/* Split */}
            {method==='split'&&(
              <>
                <div style={{background:'var(--bg-image)', borderRadius:'var(--radius-lg)', overflow:'hidden', display:'flex', flexDirection:'column', border:'1px solid var(--border-light)'}}>
                  
                  {/* GCASH ROW */}
                  <div onClick={()=>setSplitFocus('gcash')} style={{padding:'var(--pm-box-pad)', background:splitFocus==='gcash'?'var(--bg-panel)':'transparent', borderBottom:'1px solid var(--border-light)', cursor:'pointer', transition:'all 0.15s'}}>
                    <div style={{fontSize:'var(--pm-font-tiny)', color:splitFocus==='gcash'?'var(--text-strong)':'var(--text-muted)', fontWeight:700, letterSpacing: 1, marginBottom:2}}>1. GCASH AMOUNT</div>
                    <div style={{display:'flex', alignItems:'center', width:'100%'}}>
                      <span style={{fontSize:'var(--pm-font-large)', fontWeight:700, color:'var(--text-strong)', letterSpacing:-1}}>₱</span>
                      <input type="number" inputMode="numeric" pattern="[0-9]*" value={splitGcashStr} onChange={e=>setSplitGcashStr(e.target.value)} placeholder="0" style={{flex:1, background:'transparent', border:'none', outline:'none', fontSize:'var(--pm-font-large)', fontWeight:700, color:'var(--text-strong)', letterSpacing:-1, width:'100%'}} />
                    </div>
                    {splitGcash > 0 && splitFocus === 'gcash' && (
                      <input value={referenceNote} onChange={e=>setReferenceNote(e.target.value)} placeholder="GCash Ref or Name (Optional)" style={{width:'100%', background:'var(--bg-app)', border:'1px solid var(--border-light)', borderRadius:'var(--radius-md)', padding:'var(--pm-quick-pad) 12px', color:'var(--text-strong)', fontSize:'var(--pm-font-small)', fontWeight:500, marginTop:12}} />
                    )}
                  </div>

                  {/* CASH ROW */}
                  <div onClick={()=>splitGcash>0&&setSplitFocus('cash')} style={{padding:'var(--pm-box-pad)', background:splitFocus==='cash'?'var(--bg-panel)':'transparent', cursor:splitGcash>0?'pointer':'not-allowed', transition:'all 0.15s', opacity:splitGcash===0?0.5:1}}>
                    <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:2}}>
                      <div style={{fontSize:'var(--pm-font-tiny)', color:splitFocus==='cash'?'var(--text-strong)':'var(--text-muted)', fontWeight:700, letterSpacing: 1}}>2. CASH TENDERED</div>
                      <div style={{fontSize:'var(--pm-font-tiny)', color:'var(--text-strong)', fontWeight:700}}>(DUE: ₱{splitCashDue.toFixed(2)})</div>
                    </div>
                    <div style={{display:'flex', alignItems:'center', width:'100%'}}>
                      <span style={{fontSize:'var(--pm-font-large)', fontWeight:700, color:splitGcash>0&&splitCash<splitCashDue&&splitFocus!=='cash'?'var(--red)':'var(--text-strong)', letterSpacing:-1}}>₱</span>
                      <input type="number" inputMode="numeric" pattern="[0-9]*" value={splitCashStr} onChange={e=>setSplitCashStr(e.target.value)} placeholder="0" disabled={splitGcash===0} style={{flex:1, background:'transparent', border:'none', outline:'none', fontSize:'var(--pm-font-large)', fontWeight:700, color:splitGcash>0&&splitCash<splitCashDue&&splitFocus!=='cash'?'var(--red)':'var(--text-strong)', letterSpacing:-1, width:'100%'}} />
                    </div>
                  </div>

                </div>

                <div style={{background:splitCash>=splitCashDue&&splitCashDue>0 ? 'rgba(16, 185, 129, 0.1)' : 'var(--bg-image)', borderRadius:'var(--radius-lg)', padding:'var(--pm-box-pad)', textAlign:'left'}}>
                  <div style={{fontSize:'var(--pm-font-tiny)', color:splitCash>=splitCashDue&&splitCashDue>0 ? 'var(--green)' : 'var(--text-muted)', fontWeight:700, letterSpacing: 1, marginBottom:4}}>CHANGE DUE</div>
                  <div style={{fontSize:'var(--pm-font-large)', fontWeight:700, color:splitCash>=splitCashDue&&splitCashDue>0 ? 'var(--green)' : 'var(--text-muted)', letterSpacing:-1}}>₱{change.toFixed(2)}</div>
                </div>
              </>
            )}

            {error&&<div style={{color:'var(--red)',fontSize:'var(--pm-font-small)',fontWeight:600}}>{error}</div>}
          </div>

          {/* Quick Cash at bottom of Left Half */}
          {method !== 'gcash' && (
            <div style={{display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'var(--pm-quick-pad)', marginTop: 'auto'}}>
              {QUICK_CASH.map(v=>(
                <button key={v} onClick={()=>addQuickCash(v)} style={{padding:'var(--pm-quick-pad)', fontSize:'var(--pm-font-small)', fontWeight:600, background:'var(--bg-panel)', color:'var(--text-strong)', border:'1px solid var(--border-light)', borderRadius:'var(--radius-md)'}}>+₱{v}</button>
              ))}
              <button onClick={()=>{
                  if(method==='cash') setAmountStr(String(total))
                  else if(method==='split' && splitFocus==='cash') setSplitCashStr(String(splitCashDue))
                  else if(method==='split' && splitFocus==='gcash') setSplitGcashStr(String(total))
              }} style={{padding:'var(--pm-quick-pad)', fontSize:'var(--pm-font-small)', fontWeight:700, background:'var(--text-strong)', color:'var(--bg-panel)', borderRadius:'var(--radius-md)'}}>Exact</button>
            </div>
          )}
        </div>

        {/* Right Column */}
        <div className="payment-sidebar">
          {method !== 'gcash' ? (
            <div className="numpad-hide-mobile" style={{display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'var(--pm-quick-pad)', marginTop: 'auto'}}>
              {NUMPAD.map(k=>(
                <button key={k} onClick={()=>handleNum(k)} style={{aspectRatio: 'var(--pm-numpad-ratio)', fontSize:'var(--pm-font-med)', fontWeight:600, background:'var(--bg-image)', color:'var(--text-strong)', borderRadius:'var(--radius-md)'}}>{k === '←' ? '⌫' : k}</button>
              ))}
            </div>
          ) : (
            <div style={{flex: 1}} />
          )}

          {/* Submit Button */}
          <button onClick={handlePay} disabled={!canPay||loading} style={{
            width:'100%', padding:'var(--pm-btn-pad)', fontSize:'var(--pm-font-tab)', fontWeight:600, marginTop: 'var(--pm-gap)',
            background:canPay?'var(--text-strong)':'var(--bg-image)',
            color:canPay?'var(--bg-panel)':'var(--text-muted)',
            borderRadius:'var(--radius-lg)'
          }}>
            {loading?'Processing...':isOnline?'Confirm Payment':'Save Offline'}
          </button>
        </div>

      </div>
    </div>
  )
}
