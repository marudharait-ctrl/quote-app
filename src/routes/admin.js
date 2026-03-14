const express = require('express');
const bcrypt  = require('bcryptjs');
const { prepare: dbPrepare } = require('../models/db');
const db = { prepare: dbPrepare };
const { requireAdmin } = require('../middleware/auth');
const router = express.Router();

// ── Dashboard ────────────────────────────────────────────────────────────
router.get('/', requireAdmin, (req, res) => {
  const users = db.prepare('SELECT id, username, email, full_name, role, is_active, created_at, last_login FROM users ORDER BY created_at DESC').all();
  const stats = {
    totalQuotes:    db.prepare('SELECT COUNT(*) as c FROM quotes').get().c,
    draftQuotes:    db.prepare("SELECT COUNT(*) as c FROM quotes WHERE status='draft'").get().c,
    sentQuotes:     db.prepare("SELECT COUNT(*) as c FROM quotes WHERE status='sent'").get().c,
    acceptedQuotes: db.prepare("SELECT COUNT(*) as c FROM quotes WHERE status='accepted'").get().c,
    totalUsers:     users.length,
  };
  res.render('admin/dashboard', { users, stats, user: req.session, error: null, success: null });
});

// ── Create user ───────────────────────────────────────────────────────────
router.post('/users/create', requireAdmin, (req, res) => {
  const { username, email, full_name, password, role } = req.body;
  const users = db.prepare('SELECT id, username, email, full_name, role, is_active, created_at, last_login FROM users ORDER BY created_at DESC').all();
  const stats = {
    totalQuotes:    db.prepare('SELECT COUNT(*) as c FROM quotes').get().c,
    draftQuotes:    db.prepare("SELECT COUNT(*) as c FROM quotes WHERE status='draft'").get().c,
    sentQuotes:     db.prepare("SELECT COUNT(*) as c FROM quotes WHERE status='sent'").get().c,
    acceptedQuotes: db.prepare("SELECT COUNT(*) as c FROM quotes WHERE status='accepted'").get().c,
    totalUsers:     users.length,
  };

  if (!username || !email || !full_name || !password) {
    return res.render('admin/dashboard', { users, stats, user: req.session, error: 'All fields are required', success: null });
  }
  if (password.length < 6) {
    return res.render('admin/dashboard', { users, stats, user: req.session, error: 'Password must be at least 6 characters', success: null });
  }

  try {
    const hash = bcrypt.hashSync(password, 10);
    db.prepare(`INSERT INTO users (username, email, full_name, password_hash, role) VALUES (?, ?, ?, ?, ?)`)
      .run(username.trim(), email.trim().toLowerCase(), full_name.trim(), hash, role === 'admin' ? 'admin' : 'user');

    // Re-fetch updated users list
    const updatedUsers = db.prepare('SELECT id, username, email, full_name, role, is_active, created_at, last_login FROM users ORDER BY created_at DESC').all();
    stats.totalUsers = updatedUsers.length;
    res.render('admin/dashboard', { users: updatedUsers, stats, user: req.session, error: null, success: `User "${username}" created successfully!` });
  } catch (e) {
    const msg = e.message.includes('UNIQUE') ? 'Username or email already exists' : 'Failed to create user: ' + e.message;
    res.render('admin/dashboard', { users, stats, user: req.session, error: msg, success: null });
  }
});

// ── Reset password ────────────────────────────────────────────────────────
router.post('/users/:id/password', requireAdmin, (req, res) => {
  const { password } = req.body;
  if (!password || password.length < 6) return res.json({ error: 'Password must be at least 6 characters' });
  const hash = bcrypt.hashSync(password, 10);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, req.params.id);
  res.json({ ok: true });
});

// ── Toggle active ─────────────────────────────────────────────────────────
router.post('/users/:id/toggle', requireAdmin, (req, res) => {
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!u) return res.json({ error: 'Not found' });
  if (u.id === req.session.userId) return res.json({ error: 'Cannot deactivate yourself' });
  db.prepare('UPDATE users SET is_active = ? WHERE id = ?').run(u.is_active ? 0 : 1, u.id);
  res.json({ ok: true, is_active: u.is_active ? 0 : 1 });
});

// ── Change role ───────────────────────────────────────────────────────────
router.post('/users/:id/role', requireAdmin, (req, res) => {
  const { role } = req.body;
  if (!['admin', 'user'].includes(role)) return res.json({ error: 'Invalid role' });
  db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, req.params.id);
  res.json({ ok: true });
});

// ── Audit log ─────────────────────────────────────────────────────────────
router.get('/audit', requireAdmin, (req, res) => {
  const logs = db.prepare(`
    SELECT a.*, u.username FROM quote_audit a
    JOIN users u ON u.id = a.actor_id
    ORDER BY a.timestamp DESC LIMIT 500
  `).all();
  res.render('admin/audit', { logs, user: req.session });
});

module.exports = router;
