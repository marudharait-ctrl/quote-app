# WovenBag Quote Management System

A full-featured Node.js web application for generating and managing woven bag pricing quotes, built directly from your Excel pricing automation sheet.

## Quick Start

```bash
npm install
npm start
# Open http://localhost:3000
```

**Default admin login:** `admin` / `Admin@123`

---

## Features

- Multi-user login with Admin / User roles
- Live price calculation (click Calculate before saving)
- Auto-generated unique quote numbers: QT-2024-000001
- Full audit trail on every quote
- Status workflow: Draft → Sent → Accepted / Rejected
- Admin dashboard with user management
- Print-friendly quote view

## Raw Material Rates (from Excel)

Update these in `src/utils/pricing.js` → `RM_RATES`:

| Material       | Rate/Kg | Wastage |
|----------------|---------|---------|
| PP H030SG      | Rs.140  | 7%      |
| Filler         | Rs.40   | 7%      |
| BOPP           | Rs.225  | 14%     |
| Metalize       | Rs.245  | 7%      |
| Ink & Solvent  | Rs.1700 | 14%     |
| Lamination     | Rs.165  | 7.5%    |
| Liner F19010   | Rs.160  | 7.5%    |
| Handle         | Rs.240  | 3%      |
| Fabric Conv    | Rs.25   | 0%      |

## Project Structure

```
src/
  app.js                 Express server
  models/db.js           SQLite schema
  routes/auth.js         Login / register
  routes/quotes.js       Quote CRUD + price API
  routes/admin.js        Admin panel
  middleware/auth.js     Session guards
  utils/pricing.js       All Excel formulas in JS
  utils/quoteNumber.js   QT-YYYY-XXXXXX generator
views/
  layout.ejs             Base layout + navbar
  login.ejs / register.ejs
  quotes/list|form|view.ejs
  admin/dashboard|audit.ejs
public/css/style.css
data/                    SQLite DB (auto-created)
```

## Environment Variables

```
PORT=3000
SESSION_SECRET=change-this-in-production
```
