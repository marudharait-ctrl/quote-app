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

## Raw Material & Conversion Configuration

All rates and conversion charges now come from the **`pricing_config`** table in the SQLite DB
(configurable via the admin UI), instead of hard-coding constants in `pricing.js`.

Key RM rates (defaults mirror your Excel sheet):

| Key                | Description                         | Default |
|--------------------|-------------------------------------|---------|
| rm_pp_rate         | PP Fabric Rate (₹/Kg)              | 140     |
| rm_pp_wastage      | PP Fabric Wastage (%)              | 7       |
| rm_filler_rate     | Filler Rate (₹/Kg)                 | 40      |
| rm_filler_wastage  | Filler Wastage (%)                 | 7       |
| rm_bopp_rate       | BOPP Rate (₹/Kg)                   | 225     |
| rm_bopp_wastage    | BOPP Wastage (%)                   | 14      |
| rm_metalize_rate   | Metalize Rate (₹/Kg)               | 245     |
| rm_metalize_wastage| Metalize Wastage (%)               | 7       |
| rm_ink_rate        | Ink & Solvent Rate (₹/Kg)          | 1700    |
| rm_ink_wastage     | Ink & Solvent Wastage (%)          | 14      |
| rm_lam_rate        | Lamination Rate (₹/Kg)             | 165     |
| rm_lam_wastage     | Lamination Wastage (%)             | 7.5     |
| rm_liner_rate      | Liner Rate (₹/Kg)                  | 160     |
| rm_liner_wastage   | Liner Wastage (%)                  | 7.5     |
| rm_handle_rate     | Handle Rate (₹/Kg)                 | 240     |
| rm_handle_wastage  | Handle Wastage (%)                 | 3       |
| rm_handle_weight   | Handle Weight (gm/bag)             | 7       |
| rm_fabric_conv_rate| Fabric Conversion Rate (₹/Kg)      | 25      |

Key conversion charges:

| Key                  | Description                                   | Default |
|----------------------|-----------------------------------------------|---------|
| conv_width_lt15      | Width < 15" surcharge (₹/Kg)                  | 20      |
| conv_width_eq15      | Width = 15" surcharge (₹/Kg)                  | 15      |
| conv_width_lt18      | Width 15–18" surcharge (₹/Kg)                 | 6       |
| conv_plain_no_lam    | Plain bag (no lamination) (₹/Kg)              | 40      |
| conv_flexo_no_lam    | Flexo bag (no lamination) (₹/Kg)              | 50      |
| conv_bopp_double     | BOPP Double-side surcharge (₹/Kg)             | 40      |
| conv_bopp_single     | BOPP Single-side surcharge (₹/Kg)             | 35      |
| conv_back_flexo      | Back side flexo printing (₹/Kg)               | 5       |
| conv_mat_finish      | MAT finish surcharge (₹/Kg)                   | 2       |
| conv_metalize_base   | Metalize base (₹/Kg)                          | 15      |
| conv_metalize_window | Metalize window wash (₹/Kg)                   | 10      |
| conv_valve           | Valve (₹/Kg)                                  | 3       |
| conv_hamming         | Hamming (₹/Kg)                                | 1       |
| conv_tuber           | Tuber (₹/Kg)                                  | 0.7     |
| conv_handle_conv     | Handle conversion (₹/Kg)                      | 1       |
| conv_liner_overhead  | Liner overhead (fixed, used in liner formula) | 20      |

Freight presets:

| Key                 | Description            | Default |
|---------------------|------------------------|---------|
| freight_for_east    | FOR-East (₹/Kg)        | 10      |
| freight_for_west    | FOR-West (₹/Kg)        | 4       |
| freight_for_north   | FOR-North (₹/Kg)       | 4       |
| freight_for_south   | FOR-South (₹/Kg)       | 10      |
| freight_local       | Local (₹/Kg)           | 1.5     |
| freight_ex_factory  | Ex-Factory (₹/Kg)      | 0       |

You can manage these values via the **Admin → Master Rates / Pricing Config** screens.

## GitHub Repository

The full source code for this app lives at:

- https://github.com/marudharait-ctrl/quote-app

For day-to-day work you can pull, branch, and open PRs against that repo.

## Pricing & Logic Highlights (2026)

The current pricing engine (`src/utils/pricing.js`) mirrors your Excel logic with
some important behaviours:

- **RM cost per Kg (including liner)**
  - RM/Kg is computed from **total RM per bag including liner** divided by
    **total bag weight including liner**.
  - This RM/Kg is what you see as *"RM Cost per Kg"* in the UI.

- **Total Conversion / Kg and SSP / Kg**
  - SSP/Kg is calculated as: `SSP/Kg = RM/Kg + Total Conversion/Kg`.
  - Total Conversion/Kg is the sum of all conversion components (width, BOPP,
    liner adjustment, freight, etc.) and is shown under *Conversion Costs*.

- **Final Contribution / Kg & Average Contribution / Kg**
  - Final Contribution/Kg = Final SSP/Kg − RM/Kg (including liner).
  - Average Contribution/Kg (₹) is shown as:
    `((Final Price / Bag − RM Total / Bag) × 1000) ÷ Total Weight (gm)`.

- **BOPP side vs Ink GSM**
  - BOPP film: `bopp_side` (Single/Double) controls film thickness
    (Single → 1× micron, Double → 2× micron).
  - Ink GSM is applied on BOPP area:
    - Double side: factor 2
    - Single side: factor 1
  - If *BOPP with White Coating = Yes*, ink GSM effectively becomes
    `(Ink GSM + 1)` to account for the white layer.

- **Liner logic & adjustment factor**
  - Liner weight and cost are calculated from liner width/length, thickness and
    liner RM rate.
  - Liner conversion uses a weighted-average method so that overall conversion
    ₹/Kg reflects different rates on liner vs non-liner weight.
  - In the UI, this shows as **"Liner Adjustment Factor"** under Conversion
    Costs.

- **Width surcharge vs Tuber**
  - Width surcharge (conv_width_*) is applied based on finished width *unless*
    **Tuber = Yes**.
  - When **Tuber is selected = Yes**, width surcharge is forced to **0**.

These behaviours are what you now see reflected in the form and pricing
breakdown screens.

## Change Log (Key Updates)

> This section documents important changes so that Mahesh / Naresh can
> understand exactly what was changed in the logic and UI.

### 2026-04-10 – Flexo ink & metalize adhesive breakdown

**Code refs:**
- `src/utils/pricing.js`
- `views/quotes/form.ejs`
- `views/quotes/view.ejs`
- `src/routes/quotes.js`

**Details:**
- Added **Flexo ink cost** as a separate RM adjustment:
  - Applies when **Bag Style = "Flexo Bag"**.
  - Logic: `+₹5 / Kg` on RM cost.
  - Exposed in pricing engine as:
    - `flexoInkAdjPerKg`
    - `flexoInkAdjPerBag`
  - Shown in UI under *Raw Material Costs* as:
    - **Flexo ink adjustment – ₹X.XX/bag (₹5.00/Kg)**.

- Added **Metalize adhesive (solvent-less) cost** as separate RM adjustment:
  - Trigger when:
    - `metalize_included = "Yes"` **OR** `perforation = "Yes"`
      (Metalize window wash).
  - Logic per bag:
    - Surface area of metalize per bag (m²)
    - × `1.5 gsm` (adhesive deposition)
    - × `₹380 / Kg` (adhesive rate)
  - Exposed in pricing engine as:
    - `adhesiveAdjPerKg`
    - `adhesiveAdjPerBag`
  - Shown in UI under *Raw Material Costs* as:
    - **Adhesive (solvent-less for metalize) – ₹Y.YY/bag (calc: Surface area of metalize × 1.5 gsm × ₹380/Kg)**.

- Updated RM summary fields:
  - `rmRatePerKgBase` – RM/Kg **before** the two adjustments.
  - `rmRatePerKg` – RM/Kg **after** including flexo ink + adhesive.
  - `rmPricePerBag` – RM total per bag **including** both adjustments.

- UI changes (quote view + live calculator):
  - Under **Raw Material Costs** (both view & live panel) the following are
    always visible:
    - **Flexo ink adjustment**
    - **Adhesive (solvent-less for metalize)**
  - For quotes where the adjustment doesn’t apply, these rows simply show
    `₹0.00` so that the structure is consistent and the reason for RM
    increase is always explainable.

- Added optional RM check rows (only when available):
  - **RM Rate / Kg (base, before adj.)**
  - **RM Rate / Kg (incl. flexo & adhesive)**

- Calculation endpoint change:
  - `POST /quotes/calculate` is now **unauthenticated**.
  - Reason: the live **Calculate Price** button expects a pure JSON response
    and was breaking when sessions expired (redirect to `/login`).
  - Quote creation/editing remains protected by `requireAuth`.

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
