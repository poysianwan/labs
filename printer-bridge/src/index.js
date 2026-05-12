import express from 'express'
import cors from 'cors'
import ThermalPrinter from 'node-thermal-printer'

const { printer: Printer, types: PrinterTypes } = ThermalPrinter

const app = express()
app.use(cors())
app.use(express.json())

// Configure your printer here
const PRINTER_INTERFACE = process.env.PRINTER_INTERFACE || 'tcp://192.168.1.100:9100'
const PRINTER_TYPE = PrinterTypes.EPSON

let printer = null

const getOrCreatePrinter = () => {
  if (!printer) {
    printer = new Printer({
      type: PRINTER_TYPE,
      interface: PRINTER_INTERFACE,
      characterSet: 'PC852_LATIN2',
      removeSpecialCharacters: false,
      lineCharacter: '-',
      options: { timeout: 3000 }
    })
  }
  return printer
}

// Health check
app.get('/health', (req, res) => res.json({ ok: true, printer: PRINTER_INTERFACE }))

// Print endpoint — receives structured lines from frontend
app.post('/print', async (req, res) => {
  const { lines } = req.body
  if (!lines?.length) return res.status(400).json({ error: 'No lines provided' })

  try {
    const p = getOrCreatePrinter()
    const isConnected = await p.isPrinterConnected()
    if (!isConnected) {
      printer = null
      return res.status(503).json({ error: 'PRINTER_OFFLINE', message: 'Printer not connected' })
    }

    for (const line of lines) {
      switch (line.type) {
        case 'center':
          p.alignCenter()
          if (line.size === 'large') p.setTextDoubleHeight()
          if (line.bold) p.bold(true)
          p.println(line.text)
          if (line.bold) p.bold(false)
          if (line.size === 'large') p.setTextNormal()
          p.alignLeft()
          break

        case 'divider':
          p.drawLine()
          break

        case 'row':
          if (line.bold) p.bold(true)
          p.leftRight(line.left || '', line.right || '')
          if (line.bold) p.bold(false)
          break

        case 'item':
          p.println(`${line.qty}x ${line.name}`)
          if (line.notes) {
            p.alignRight()
            p.println(`  * ${line.notes}`)
            p.alignLeft()
          }
          p.alignRight()
          p.println(`₱${(line.price * line.qty).toFixed(2)}`)
          p.alignLeft()
          break

        case 'feed':
          for (let i = 0; i < (line.lines || 3); i++) p.newLine()
          break

        case 'cut':
          p.cut()
          break
      }
    }

    await p.execute()
    p.clear()
    res.json({ ok: true })
  } catch (err) {
    console.error('Print error:', err)
    printer = null
    res.status(500).json({ error: 'PRINT_FAILED', message: err.message })
  }
})

// Raw text print (fallback)
app.post('/print-raw', async (req, res) => {
  const { text } = req.body
  if (!text) return res.status(400).json({ error: 'No text provided' })

  try {
    const p = getOrCreatePrinter()
    p.println(text)
    p.cut()
    await p.execute()
    p.clear()
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: 'PRINT_FAILED', message: err.message })
  }
})

const PORT = process.env.PORT || 3002
app.listen(PORT, () => {
  console.log(`🖨️  Labs Burger Print Bridge on port ${PORT}`)
  console.log(`   Printer: ${PRINTER_INTERFACE}`)
  console.log(`   Set PRINTER_INTERFACE env var to change (e.g. tcp://192.168.1.100:9100 or /dev/usb/lp0)`)
})
