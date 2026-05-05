const express = require('express');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { calculatePricing } = require('../laminate/pricing');
const { ensureLaminateTables, getLaminateDefaults, saveLaminateDefaults, getLaminateRates, saveLaminateRates } = require('../laminate/service');

const router = express.Router();
ensureLaminateTables();

router.get('/laminate', requireAuth, (req, res) => {
  res.render('laminate/index', { user: req.session, session: req.session });
});

router.get('/laminate/rates', requireAuth, (req, res) => {
  res.render('laminate/rates', { user: req.session, session: req.session });
});

router.get('/api/laminate/defaults', requireAuth, (req, res) => {
  res.json(getLaminateDefaults());
});

router.get('/api/laminate/rates', requireAuth, (req, res) => {
  res.json({ success: true, rates: getLaminateRates() });
});

router.post('/api/laminate/rates', requireAuth, requireAdmin, (req, res) => {
  try {
    saveLaminateRates(req.body?.rates || []);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/api/laminate/calculate', requireAuth, (req, res) => {
  try {
    const result = calculatePricing(req.body);
    res.json({ success: true, result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.post('/api/laminate/save-defaults', requireAuth, (req, res) => {
  try {
    saveLaminateDefaults(req.body);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
