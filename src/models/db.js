'use strict';
const path      = require('path');
const fs        = require('fs');
const bcrypt    = require('bcryptjs');
const initSqlJs = require('sql.js');

const DB_PATH = path.join(__dirname, '../../data/quotes.db');
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

let _db;

// ── Helpers ───────────────────────────────────────────────────────────────
function stmtToObj(stmt) {
  const cols = stmt.getColumnNames(), vals = stmt.get(), obj = {};
  cols.forEach((c, i) => { obj[c] = vals[i]; });
  return obj;
}

function flattenParams(args) {
  if (!args.length) return [];
  if (args.length === 1 && args[0] !== null && typeof args[0] === 'object' && !Array.isArray(args[0])) {
    const out = {};
    for (const k of Object.keys(args[0])) {
      out[(k[0]==='@'||k[0]===':'||k[0]==='$') ? k : '@'+k] = args[0][k];
    }
    return out;
  }
  return args.flat();
}

function persist() {
  fs.writeFileSync(DB_PATH, Buffer.from(_db.export()));
}

// ── Public API ────────────────────────────────────────────────────────────
function prepare(sql) {
  return {
    get(...args) {
      const stmt = _db.prepare(sql);
      stmt.bind(flattenParams(args));
      const row = stmt.step() ? stmtToObj(stmt) : undefined;
      stmt.free();
      return row;
    },
    all(...args) {
      const stmt = _db.prepare(sql);
      stmt.bind(flattenParams(args));
      const rows = [];
      while (stmt.step()) rows.push(stmtToObj(stmt));
      stmt.free();
      return rows;
    },
    run(...args) {
      _db.run(sql, flattenParams(args));
      const lastInsertRowid = Number(
        _db.exec('SELECT last_insert_rowid()')[0]?.values[0][0] ?? 0
      );
      persist();
      return { changes: _db.getRowsModified(), lastInsertRowid };
    },
  };
}

function exec(sql) {
  sql.split(';').map(s => s.trim()).filter(Boolean).forEach(s => _db.run(s));
  persist();
}

// ── Schema ────────────────────────────────────────────────────────────────
const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL, email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL, full_name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user', is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')), last_login TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS quote_counter (
    year INTEGER PRIMARY KEY, seq INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS quotes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    quote_number TEXT UNIQUE NOT NULL,
    customer_name TEXT NOT NULL, customer_email TEXT, customer_company TEXT,
    status TEXT NOT NULL DEFAULT 'draft',
    width_value REAL NOT NULL, width_unit TEXT NOT NULL,
    length_value REAL NOT NULL, length_unit TEXT NOT NULL,
    fabric_gsm REAL NOT NULL, fabric_type TEXT NOT NULL DEFAULT 'Grammage',
    filler_pct REAL NOT NULL DEFAULT 35,
    lamination_side TEXT NOT NULL DEFAULT 'Double',
    lamination_gsm REAL NOT NULL DEFAULT 17,
    lamination_included TEXT NOT NULL DEFAULT 'Yes',
    bopp_side TEXT NOT NULL DEFAULT 'Double',
    bopp_micron REAL NOT NULL DEFAULT 12,
    bopp_included TEXT NOT NULL DEFAULT 'Yes',
    bopp_type TEXT NOT NULL DEFAULT 'Double',
    bopp_finish TEXT NOT NULL DEFAULT 'Gloss',
    metalize_side TEXT NOT NULL DEFAULT 'Double',
    metalize_micron REAL NOT NULL DEFAULT 15,
    metalize_included TEXT NOT NULL DEFAULT 'No',
    handle_included TEXT NOT NULL DEFAULT 'Yes',
    liner_width REAL, liner_length REAL,
    liner_thickness REAL NOT NULL DEFAULT 50,
    liner_thickness_unit TEXT NOT NULL DEFAULT 'Micron',
    liner_included TEXT NOT NULL DEFAULT 'Yes',
    bag_style TEXT NOT NULL DEFAULT 'Flexo Bag',
    back_flexo TEXT NOT NULL DEFAULT 'Yes',
    bopp_with_white TEXT NOT NULL DEFAULT 'No',
    perforation TEXT NOT NULL DEFAULT 'No',
    valve TEXT NOT NULL DEFAULT 'No',
    hamming TEXT NOT NULL DEFAULT 'No',
    tuber TEXT NOT NULL DEFAULT 'No',
    ink_gsm REAL NOT NULL DEFAULT 1,
    freight TEXT NOT NULL DEFAULT 'Ex Factory',
    pricing_type TEXT NOT NULL DEFAULT 'Premium',
    discount_pct REAL NOT NULL DEFAULT 0,
    rm_price_per_bag REAL, ssp_rate_per_kg REAL, ssp_rate_per_bag REAL,
    final_price_per_kg REAL, final_price_per_bag REAL, total_weight_gm REAL,
    notes TEXT, created_by INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS quote_audit (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    quote_id INTEGER NOT NULL, quote_number TEXT NOT NULL,
    action TEXT NOT NULL, actor_id INTEGER NOT NULL, actor_name TEXT NOT NULL,
    changes TEXT, ip_address TEXT,
    timestamp TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS sessions (
    sid TEXT PRIMARY KEY, sess TEXT NOT NULL, expired TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS pricing_config (
    key TEXT PRIMARY KEY, value REAL NOT NULL,
    label TEXT NOT NULL, group_name TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0
  )`,
];

const PRICING_DEFAULTS = [
  ['rm_pp_rate',          140,   'PP Fabric Rate (₹/Kg)',         'RM Rates', 1],
  ['rm_pp_wastage',       7,     'PP Fabric Wastage (%)',          'RM Rates', 2],
  ['rm_filler_rate',      40,    'Filler Rate (₹/Kg)',             'RM Rates', 3],
  ['rm_filler_wastage',   7,     'Filler Wastage (%)',             'RM Rates', 4],
  ['rm_bopp_rate',        225,   'BOPP Rate (₹/Kg)',               'RM Rates', 5],
  ['rm_bopp_wastage',     14,    'BOPP Wastage (%)',               'RM Rates', 6],
  ['rm_metalize_rate',    245,   'Metalize Rate (₹/Kg)',           'RM Rates', 7],
  ['rm_metalize_wastage', 7,     'Metalize Wastage (%)',           'RM Rates', 8],
  ['rm_ink_rate',         1700,  'Ink & Solvent Rate (₹/Kg)',      'RM Rates', 9],
  ['rm_ink_wastage',      14,    'Ink & Solvent Wastage (%)',      'RM Rates', 10],
  ['rm_lam_rate',         165,   'Lamination Rate (₹/Kg)',         'RM Rates', 11],
  ['rm_lam_wastage',      7.5,   'Lamination Wastage (%)',         'RM Rates', 12],
  ['rm_liner_rate',       160,   'Liner Rate (₹/Kg)',              'RM Rates', 13],
  ['rm_liner_wastage',    7.5,   'Liner Wastage (%)',              'RM Rates', 14],
  ['rm_handle_rate',      240,   'Handle Rate (₹/Kg)',             'RM Rates', 15],
  ['rm_handle_wastage',   3,     'Handle Wastage (%)',             'RM Rates', 16],
  ['rm_handle_weight',    7,     'Handle Weight (gm/bag)',         'RM Rates', 17],
  ['rm_fabric_conv_rate', 25,    'Fabric Conversion Rate (₹/Kg)',  'RM Rates', 18],
  ['conv_width_lt15',     20,    'Width < 15" Surcharge (₹/Kg)',  'Conversion Charges', 1],
  ['conv_width_eq15',     15,    'Width = 15" Surcharge (₹/Kg)',  'Conversion Charges', 2],
  ['conv_width_lt18',     6,     'Width 15-18" Surcharge (₹/Kg)', 'Conversion Charges', 3],
  ['conv_plain_no_lam',   40,    'Plain Bag (no lam) (₹/Kg)',     'Conversion Charges', 4],
  ['conv_flexo_no_lam',   50,    'Flexo Bag (no lam) (₹/Kg)',     'Conversion Charges', 5],
  ['conv_bopp_double',    35,    'BOPP Double Surcharge (₹/Kg)',  'Conversion Charges', 6],
  ['conv_bopp_single',    20,    'BOPP Single Surcharge (₹/Kg)',  'Conversion Charges', 7],
  ['conv_back_flexo',     5,     'Back Flexo Printing (₹/Kg)',    'Conversion Charges', 8],
  ['conv_mat_finish',     2,     'MAT Finish Surcharge (₹/Kg)',   'Conversion Charges', 9],
  ['conv_metalize_base',  15,    'Metalize Base (₹/Kg)',          'Conversion Charges', 10],
  ['conv_metalize_window',10,    'Metalize Window Wash (₹/Kg)',   'Conversion Charges', 11],
  ['conv_valve',          3,     'Valve (₹/Kg)',                  'Conversion Charges', 12],
  ['conv_hamming',        1,     'Hamming (₹/Kg)',                'Conversion Charges', 13],
  ['conv_tuber',          0.7,   'Tuber (₹/Kg)',                  'Conversion Charges', 14],
  ['conv_handle_conv',    1,     'Handle Conversion (₹/Kg)',      'Conversion Charges', 15],
  ['conv_liner_overhead', 20,    'Liner Overhead (fixed)',         'Conversion Charges', 16],
  ['freight_for_east',    10,    'FOR-East (₹/Kg)',               'Freight', 1],
  ['freight_for_west',    4,     'FOR-West (₹/Kg)',               'Freight', 2],
  ['freight_for_north',   4,     'FOR-North (₹/Kg)',              'Freight', 3],
  ['freight_for_south',   10,    'FOR-South (₹/Kg)',              'Freight', 4],
  ['freight_local',       1.5,   'Local (₹/Kg)',                  'Freight', 5],
  ['freight_ex_factory',  0,     'Ex Factory (₹/Kg)',             'Freight', 6],
];

// ── Async init — everything runs AFTER WASM is loaded ─────────────────────
const ready = (async () => {
  const wasmBinary = fs.readFileSync(require.resolve('sql.js/dist/sql-wasm.wasm'));
  const SQL = await initSqlJs({ wasmBinary });

  _db = fs.existsSync(DB_PATH)
    ? new SQL.Database(fs.readFileSync(DB_PATH))
    : new SQL.Database();

  // Create all tables
  SCHEMA.forEach(s => _db.run(s));
  persist();

  // Seed admin user
  if (!prepare('SELECT id FROM users WHERE username = ?').get('admin')) {
    prepare(`INSERT INTO users (username,email,password_hash,full_name,role) VALUES (?,?,?,?,?)`)
      .run('admin', 'admin@company.com', bcrypt.hashSync('Admin@123', 10), 'Administrator', 'admin');
    console.log('✅ Admin created  →  admin / Admin@123');
  }

  // Seed pricing config defaults
  const cfgCount = prepare('SELECT COUNT(*) as c FROM pricing_config').get();
  if (!cfgCount || cfgCount.c === 0) {
    const ins = prepare('INSERT OR IGNORE INTO pricing_config (key,value,label,group_name,sort_order) VALUES (?,?,?,?,?)');
    PRICING_DEFAULTS.forEach(row => ins.run(...row));
    persist();
    console.log('✅ Pricing config seeded with defaults');
  }

  console.log('✅ Database ready');
})();

module.exports = { prepare, exec, ready };
