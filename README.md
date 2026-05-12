# 🍔 Labs Burger POS

Production-ready Point of Sale system. React PWA + Node.js + PostgreSQL. Offline-first with automatic background sync.

---

## Quick Start

### 1. Prerequisites
- Node.js 18+
- PostgreSQL 14+

### 2. Backend setup

```bash
cd backend
cp .env.example .env        # Edit DATABASE_URL and JWT_SECRET
npm install
createdb labs_burger
npm run migrate             # Creates all tables + seeds data
npm run dev                 # Starts on port 3001
```

### 3. Frontend setup

```bash
cd frontend
npm install
npm run dev                 # Starts on port 5173
```

Open **http://localhost:5173** on your tablet browser.

### 4. Printer bridge (optional)

```bash
cd printer-bridge
npm install
PRINTER_INTERFACE=tcp://192.168.1.100:9100 npm start   # Network printer
# OR
PRINTER_INTERFACE=/dev/usb/lp0 npm start               # USB printer
```

If no printer bridge is running, the app falls back to a browser print window.

---

## Default Login

| User | PIN | Role |
|---|---|---|
| Owner | 0000 | Admin |
| Cashier 1 | 0000 | Cashier |

> ⚠️ Change PINs in the database before going live.

---

## Project Structure

```
labs-burger/
├── backend/src/
│   ├── db/
│   │   ├── index.js          PostgreSQL pool + transaction helper
│   │   └── migrate.js        All 15 tables, indexes, seed data
│   ├── middleware/
│   │   └── auth.js           JWT validation, role guard
│   ├── routes/
│   │   ├── auth.js           PIN login / logout
│   │   ├── orders.js         Create, list, void orders
│   │   ├── sync.js           Bulk offline flush + snapshot
│   │   ├── inventory.js      Ingredients, restock, BOM recipes
│   │   └── reports.js        Shifts, sales reports, stock movements
│   ├── services/
│   │   └── bom.js            Bill of Materials deduction engine
│   └── index.js              Express app entry point
│
├── frontend/src/
│   ├── components/
│   │   ├── auth/             LoginScreen (PIN pad)
│   │   ├── pos/              POSScreen, CartPanel
│   │   ├── payment/          PaymentModal (cash + GCash)
│   │   └── admin/            AdminDashboard, SalesReport,
│   │                         InventoryPanel, ShiftPanel
│   ├── db/                   IndexedDB (offline store)
│   ├── hooks/                useOnlineStatus
│   ├── stores/               Zustand: auth, cart
│   └── utils/
│       ├── apiClient.js      All API calls
│       ├── syncEngine.js     Background sync + retry
│       └── printer.js        ESC/POS bridge + browser fallback
│
└── printer-bridge/
    └── index.js              Local print server (port 3002)
```

---

## How Offline Works

1. Cashier places order → **saved to IndexedDB immediately** (synced = false)
2. Receipt prints from local data
3. Cart clears — ready for next order in under 3 seconds
4. Background sync engine detects connection → **flushes queue to backend**
5. BOM deduction and stock update happen on backend after sync
6. Duplicate UUIDs are safe — idempotent by design

---

## GCash Setup

No API integration needed. Post your GCash QR code at the counter. Cashier:
1. Selects "GCash" payment method
2. Optionally types sender name for reconciliation
3. Confirms — records as GCash payment

---

## Payment

**Cash** — numpad with quick amounts (₱20, ₱50, ₱100...), auto-calculates change.

**GCash** — record-only, no API. Optional sender name field for end-of-day reconciliation.

---

## Admin Features

- **Sales Report** — revenue, order count, cash vs GCash, hourly chart, top products
- **Inventory** — live stock levels with low-stock alerts, restock form, product availability toggle
- **Recipes (BOM)** — edit ingredient deduction per product
- **Shifts** — open/close shift with opening/closing cash, variance report

---

## Seed Data

**Products**: Classic Burger ₱89 · Cheeseburger ₱99 · Double Patty ₱129 · Classic Combo ₱149 · Cheese Combo ₱169 · Coke ₱39 · Iced Tea ₱35 · Fries ₱59

**Ingredients tracked**: Beef Patty · Burger Bun · Cheddar Cheese · Lettuce · Tomato · French Fries · Soft Drink Cup · Sauce Packet

---

## Production Deployment

```bash
# Frontend build
cd frontend && npm run build   # outputs dist/

# Backend (Railway, Render, or any Node host)
# Set env vars: DATABASE_URL, JWT_SECRET, NODE_ENV=production, PORT, FRONTEND_URL

# Printer bridge runs locally on the shop network — not on the cloud server
```
