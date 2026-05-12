const PRINT_BRIDGE_URL = import.meta.env.VITE_PRINT_BRIDGE_URL || 'http://localhost:3002'

export const printReceipt = async (order) => {
  const lines = formatReceipt(order)
  try {
    await fetch(`${PRINT_BRIDGE_URL}/print`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lines })
    })
    return true
  } catch {
    console.warn('Printer offline — receipt not printed')
    return false
  }
}

const formatReceipt = (order) => {
  const divider = '--------------------------------'
  const lines = [
    { type: 'center', text: 'LABS BURGER', bold: true, size: 'large' },
    { type: 'center', text: 'BUY 1 TAKE 1' },
    { type: 'center', text: 'Tel: 0917-XXX-XXXX' },
    { type: 'divider' },
    { type: 'row', left: `Order: ${order.order_number}`, right: order.dining_type === 'dine_in' ? 'Dine In' : 'Takeout' },
    { type: 'row', left: `Cashier: ${order.cashier_name}`, right: new Date(order.created_at).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' }) },
    { type: 'row', left: new Date(order.created_at).toLocaleDateString('en-PH', { dateStyle: 'medium' }), right: '' },
    { type: 'divider' },
    ...order.items.map(item => ({
      type: 'item',
      name: item.name,
      qty: item.quantity,
      price: item.unit_price,
      notes: item.notes
    })),
    { type: 'divider' },
    { type: 'row', left: 'TOTAL', right: `₱${order.total.toFixed(2)}`, bold: true },
    ...(order.payments || (order.payment ? [order.payment] : [])).flatMap(p => {
      const pLines = [{ type: 'row', left: `Pay (${p.method.toUpperCase()})`, right: `₱${p.amount.toFixed(2)}` }]
      if (p.method === 'cash' && p.change_given > 0) {
        pLines.push({ type: 'row', left: 'Change', right: `₱${p.change_given.toFixed(2)}` })
      }
      if (p.method === 'gcash') {
        pLines.push({ type: 'row', left: 'GCash Ref', right: p.reference_note || 'N/A' })
      }
      return pLines
    }),
    { type: 'divider' },
    { type: 'center', text: 'Thank you for dining with us!' },
    { type: 'center', text: 'Please come again :)' },
    { type: 'feed', lines: 4 },
    { type: 'cut' }
  ]
  return lines
}

// Browser print fallback (when bridge not available)
export const printReceiptBrowser = (order) => {
  const win = window.open('', '_blank', 'width=300,height=600')
  if (!win) return

  const items = order.items.map(i =>
    `<tr><td>${i.name}${i.notes ? `<br><small>${i.notes}</small>` : ''}</td>
     <td style="text-align:center">${i.quantity}</td>
     <td style="text-align:right">₱${(i.unit_price * i.quantity).toFixed(2)}</td></tr>`
  ).join('')

  win.document.write(`
    <html><head><title>Receipt</title>
    <style>
      body{font-family:monospace;font-size:12px;width:280px;margin:0 auto;padding:8px}
      h2,p{text-align:center;margin:4px 0}
      table{width:100%;border-collapse:collapse}
      td{padding:2px 4px;vertical-align:top}
      .divider{border-top:1px dashed #000;margin:6px 0}
      .total{font-weight:bold;font-size:14px}
      @media print{button{display:none}}
    </style></head><body>
    <h2>LABS BURGER</h2>
    <p>BUY 1 TAKE 1</p>
    <div class="divider"></div>
    <p>Order: ${order.order_number} | ${order.dining_type === 'dine_in' ? 'Dine In' : 'Takeout'}</p>
    <p>${new Date(order.created_at).toLocaleString('en-PH')}</p>
    <div class="divider"></div>
    <table><thead><tr><th style="text-align:left">Item</th><th>Qty</th><th style="text-align:right">Price</th></tr></thead>
    <tbody>${items}</tbody></table>
    <div class="divider"></div>
      <tr class="total"><td>TOTAL</td><td></td><td style="text-align:right">₱${order.total.toFixed(2)}</td></tr>
      ${(order.payments || (order.payment ? [order.payment] : [])).map(p => `
        <tr><td>Pay (${p.method.toUpperCase()})</td><td></td><td style="text-align:right">₱${p.amount.toFixed(2)}</td></tr>
        ${p.method === 'cash' && p.change_given > 0 ? `<tr><td>Change</td><td></td><td style="text-align:right">₱${p.change_given.toFixed(2)}</td></tr>` : ''}
        ${p.method === 'gcash' ? `<tr><td>Ref</td><td></td><td style="text-align:right">${p.reference_note || 'N/A'}</td></tr>` : ''}
      `).join('')}
    </table>
    <div class="divider"></div>
    <p>Thank you for dining with us!</p>
    <br><button onclick="window.print()">Print</button>
    <script>setTimeout(()=>window.print(),300)</script>
    </body></html>`)
  win.document.close()
}
