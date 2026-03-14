'use strict';
/**
 * SQLite via sql.js (pure WebAssembly – zero native compilation).
 *
 * We initialise asynchronously and export a `ready` Promise.
 * app.js awaits it before calling app.listen().
 */
const path      = require('path');
const fs        = require('fs');
const bcrypt    = require('bcryptjs');
const initSqlJs = require('sql.js');

const DB_PATH = path.join(__dirname, '../../data/quotes.db');
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

let _db;   // sql.js Database instance – available after `ready` resolves

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

// ── Public synchronous-style API (safe to call after `ready`) ─────────────
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
];

// ── Async initialisation ──────────────────────────────────────────────────
const ready = (async () => {
  const wasmBinary = fs.readFileSync(
    require.resolve('sql.js/dist/sql-wasm.wasm')
  );
  const SQL = await initSqlJs({ wasmBinary });

  _db = fs.existsSync(DB_PATH)
    ? new SQL.Database(fs.readFileSync(DB_PATH))
    : new SQL.Database();

  SCHEMA.forEach(s => _db.run(s));
  persist();

  if (!prepare('SELECT id FROM users WHERE username = ?').get('admin')) {
    prepare(`INSERT INTO users (username,email,password_hash,full_name,role) VALUES (?,?,?,?,?)`)
      .run('admin','admin@company.com', bcrypt.hashSync('Admin@123',10),'Administrator','admin');
    console.log('✅ Admin created  →  admin / Admin@123');
  }

  console.log('✅ Database ready');
})();

module.exports = { prepare, exec, ready };
