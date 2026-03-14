const express = require('express');
const session = require('express-session');
const path    = require('path');
const fs      = require('fs');

fs.mkdirSync(path.join(__dirname, '../data'), { recursive: true });

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views'));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// ── Inline session store using our sql.js db ──────────────────────────────
function makeSessionStore(session, db) {
  const Store = session.Store;
  class SqlStore extends Store {
    get(sid, cb) {
      try {
        const row = db.prepare('SELECT sess, expired FROM sessions WHERE sid = ?').get(sid);
        if (!row) return cb(null, null);
        if (new Date(row.expired) < new Date()) {
          db.prepare('DELETE FROM sessions WHERE sid = ?').run(sid);
          return cb(null, null);
        }
        cb(null, JSON.parse(row.sess));
      } catch(e) { cb(e); }
    }
    set(sid, sess, cb) {
      try {
        const exp = sess.cookie?.expires
          ? new Date(sess.cookie.expires).toISOString()
          : new Date(Date.now() + 8*60*60*1000).toISOString();
        const exists = db.prepare('SELECT sid FROM sessions WHERE sid = ?').get(sid);
        if (exists) {
          db.prepare('UPDATE sessions SET sess=?, expired=? WHERE sid=?').run(JSON.stringify(sess), exp, sid);
        } else {
          db.prepare('INSERT INTO sessions (sid, sess, expired) VALUES (?,?,?)').run(sid, JSON.stringify(sess), exp);
        }
        cb(null);
      } catch(e) { cb(e); }
    }
    destroy(sid, cb) {
      try { db.prepare('DELETE FROM sessions WHERE sid = ?').run(sid); cb(null); }
      catch(e) { cb(e); }
    }
    touch(sid, sess, cb) { this.set(sid, sess, cb); }
  }
  return SqlStore;
}

// ── Bootstrap: wait for DB then start listening ───────────────────────────
async function start() {
  const db = require('./models/db');
  await db.ready;   // wait for WASM + schema init

  const SqlStore = makeSessionStore(session, db);

  app.use(session({
    store: new SqlStore(),
    secret: process.env.SESSION_SECRET || 'woven-bag-quote-secret-2024',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 8 * 60 * 60 * 1000 },
  }));

  app.use((req, res, next) => { res.locals.session = req.session; next(); });

  app.use('/',       require('./routes/auth'));
  app.use('/quotes', require('./routes/quotes'));
  app.use('/admin',  require('./routes/admin'));

  app.get('/', (req, res) => {
    if (!req.session.userId) return res.redirect('/login');
    res.redirect('/quotes');
  });

  app.use((req, res) => res.status(404).render('error', { message: 'Page not found', user: req.session }));
  app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).render('error', { message: 'Internal server error', user: req.session });
  });

  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`\n🚀  WovenBag Quote System`);
    console.log(`    URL   →  http://localhost:${PORT}`);
    console.log(`    Login →  admin / Admin@123\n`);
  });
}

start().catch(err => {
  console.error('❌ Failed to start:', err.message);
  process.exit(1);
});
