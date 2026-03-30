'use strict';
const express = require('express');
const { prepare: dbPrepare } = require('../models/db');
const db = { prepare: dbPrepare };
const { requireAuth, requireAdmin } = require('../middleware/auth');
const router = express.Router();

function getGroups() {
  const rows = db.prepare(
    'SELECT key, value, label, group_name, sort_order FROM pricing_config ORDER BY group_name, sort_order'
  ).all();
  const groups = {};
  rows.forEach(r => {
    if (!groups[r.group_name]) groups[r.group_name] = [];
    groups[r.group_name].push(r);
  });
  return groups;
}

// ── Master Rate Sheet — all logged-in users can view, admins can edit ─────
router.get('/master', requireAuth, (req, res) => {
  res.render('admin/master_rates', {
    groups: getGroups(),
    user:   req.session,
    saved:  req.query.saved === '1',
    error:  null,
  });
});

// ── Save from master sheet (admin only) ───────────────────────────────────
router.post('/master', requireAdmin, (req, res) => {
  const keys = db.prepare('SELECT key FROM pricing_config').all().map(r => r.key);
  try {
    const upd = db.prepare('UPDATE pricing_config SET value = ? WHERE key = ?');
    keys.forEach(k => {
      const val = parseFloat(req.body[k]);
      if (!isNaN(val)) upd.run(val, k);
    });
    res.redirect('/admin/pricing/master?saved=1');
  } catch (e) {
    res.render('admin/master_rates', {
      groups: getGroups(),
      user:   req.session,
      saved:  false,
      error:  e.message,
    });
  }
});

// ── Old config editor (redirect to master for admins) ─────────────────────
router.get('/', requireAdmin, (req, res) => {
  res.redirect('/admin/pricing/master');
});

module.exports = router;
