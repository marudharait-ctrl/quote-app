const express = require('express');
const bcrypt  = require('bcryptjs');
const { prepare: dbPrepare } = require('../models/db');
const db = { prepare: dbPrepare };
const router  = express.Router();

router.get('/login', (req, res) => {
  if (req.session.userId) return res.redirect('/');
  res.render('login', { error: null, next: req.query.next || '/', user: req.session, registered: req.query.registered });
});

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  const next = req.body.next || '/';
  const user = db.prepare('SELECT * FROM users WHERE username = ? AND is_active = 1').get(username);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.render('login', { error: 'Invalid username or password', next, user: req.session, registered: false });
  }
  db.prepare("UPDATE users SET last_login = datetime('now') WHERE id = ?").run(user.id);
  req.session.userId   = user.id;
  req.session.username = user.username;
  req.session.fullName = user.full_name;
  req.session.userRole = user.role;
  res.redirect(next);
});

router.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

router.get('/register', (req, res) => {
  if (req.session.userId) return res.redirect('/');
  res.render('register', { error: null, user: req.session });
});

router.post('/register', (req, res) => {
  const { username, email, full_name, password, confirm_password } = req.body;
  if (password !== confirm_password)
    return res.render('register', { error: 'Passwords do not match', user: req.session });
  if (password.length < 6)
    return res.render('register', { error: 'Password must be at least 6 characters', user: req.session });
  try {
    const hash = bcrypt.hashSync(password, 10);
    db.prepare(`INSERT INTO users (username, email, full_name, password_hash, role) VALUES (?,?,?,?,'user')`)
      .run(username.trim(), email.trim().toLowerCase(), full_name.trim(), hash);
    res.redirect('/login?registered=1');
  } catch (e) {
    const msg = e.message.includes('UNIQUE') ? 'Username or email already exists' : 'Registration failed';
    res.render('register', { error: msg, user: req.session });
  }
});

module.exports = router;
