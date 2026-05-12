# Labs Burger POS — Setup Guide

## Option A: Docker (easiest — one command)

```bash
git clone <your-repo>
cd labs-burger

# Start database + backend
docker-compose up -d db backend

# Build and serve frontend
cd frontend
npm install
npm run build
# Serve dist/ with any static server or nginx
npx serve dist
```

---

## Option B: Local dev (recommended for development)

### Prerequisites
- Node.js 18+
- PostgreSQL 14+

### Step 1 — Install dependencies
```bash
npm run setup
# installs backend, frontend, and printer-bridge deps
```

### Step 2 — Configure backend
```bash
cd backend
cp .env.example .env
# Edit .env:
#   DATABASE_URL=postgresql://postgres:yourpassword@localhost:5432/labs_burger
#   JWT_SECRET=any-long-random-string
```

### Step 3 — Create database and run migrations
```bash
createdb labs_burger
npm run migrate
# Creates all tables and seeds default products, ingredients, and users
```

### Step 4 — Run everything

Open 2 terminals:

**Terminal 1 — Backend API**
```bash
cd backend
npm run dev
# Running on http://localhost:3001
```

**Terminal 2 — Frontend**
```bash
cd frontend
npm run dev
# Running on http://localhost:5173
```

**Terminal 3 (optional) — Printer bridge**
```bash
cd printer-bridge
npm install
PRINTER_INTERFACE=tcp://192.168.1.100:9100 npm start
# OR for USB:
# PRINTER_INTERFACE=/dev/usb/lp0 npm start
```

### Step 5 — Open on tablet
Navigate to **http://your-pc-ip:5173** on your Android/iPad tablet.

Install as PWA: tap browser menu → "Add to Home Screen"

---

## Default Login PINs

| User | PIN | Role |
|---|---|---|
| Owner | 0000 | Admin — full access |
| Cashier 1 | 0000 | Cashier — POS only |

> **Change PINs before going live!**
> ```sql
> -- Generate hash: node -e "require('bcrypt').hash('YOUR_PIN',10).then(console.log)"
> UPDATE users SET pin_hash = 'NEW_HASH' WHERE name = 'Owner';
> ```

---

## Printer Setup

### Network printer (most common with thermal printers)
```bash
PRINTER_INTERFACE=tcp://192.168.1.100:9100 node printer-bridge/index.js
```

### USB printer (Linux)
```bash
PRINTER_INTERFACE=/dev/usb/lp0 node printer-bridge/index.js
```

### No physical printer?
The system automatically falls back to a browser print window.
Set `VITE_PRINT_BRIDGE_URL` in `frontend/.env` to point to your bridge if it's on a different machine.

---

## Running Tests

```bash
cd backend

# Must have a test database running
DATABASE_URL=postgresql://postgres:password@localhost:5432/labs_burger_test npm test
```

Tests use transaction rollback isolation — no permanent data is written.

---

## Production Deployment Checklist

- [ ] Change all default PINs
- [ ] Set a strong `JWT_SECRET` (32+ random chars)
- [ ] Set `NODE_ENV=production` in backend
- [ ] Build frontend: `cd frontend && npm run build`
- [ ] Serve `frontend/dist/` behind nginx or a CDN
- [ ] Point nginx `/api/` proxy to backend port 3001
- [ ] Enable HTTPS (required for PWA install)
- [ ] Run printer bridge on local shop network, not on cloud server
- [ ] Set up daily PostgreSQL backup (`pg_dump`)
- [ ] Test offline order flow before opening day

---

## Recommended Hardware (Philippines)

| Item | Suggestion |
|---|---|
| Tablet | Samsung Galaxy Tab A8 or iPad (any) |
| Thermal printer | Epson TM-T82 or Xprinter XP-58 |
| Router | Any stable WiFi router — backend can run on same LAN |
| Mini PC (for backend) | Raspberry Pi 4 or old laptop with Ubuntu |

---

## Daily Operations

1. **Start of day**: Login → system prompts for shift start → enter opening cash
2. **During service**: Cashier uses POS screen only
3. **End of day**: Admin logs in → Admin panel → Shifts → End Shift → count cash → view variance
4. **Restock**: Admin panel → Inventory → tap any ingredient → Restock
5. **Add/edit products**: Admin panel → Inventory → Product Availability or Recipes
