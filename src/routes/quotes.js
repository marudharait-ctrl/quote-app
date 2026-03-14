const express = require('express');
const { prepare: dbPrepare } = require('../models/db');
const db = { prepare: dbPrepare };
const { requireAuth } = require('../middleware/auth');
const { calculatePrice } = require('../utils/pricing');
const { generateQuoteNumber } = require('../utils/quoteNumber');
const router = express.Router();

// ─── List quotes ────────────────────────────────────────────────────────────
router.get('/', requireAuth, (req, res) => {
  const isAdmin = req.session.userRole === 'admin';
  const { status, search } = req.query;

  let sql = `SELECT q.*, u.full_name as creator_name FROM quotes q
             JOIN users u ON u.id = q.created_by`;
  const params = [];
  const where = [];

  if (!isAdmin) { where.push('q.created_by = ?'); params.push(req.session.userId); }
  if (status)   { where.push('q.status = ?'); params.push(status); }
  if (search)   { where.push('(q.quote_number LIKE ? OR q.customer_name LIKE ? OR q.customer_company LIKE ?)');
                  params.push(`%${search}%`, `%${search}%`, `%${search}%`); }

  if (where.length) sql += ' WHERE ' + where.join(' AND ');
  sql += ' ORDER BY q.created_at DESC';

  const quotes = db.prepare(sql).all(...params);
  res.render('quotes/list', { quotes, user: req.session, status, search });
});

// ─── New quote form ──────────────────────────────────────────────────────────
router.get('/new', requireAuth, (req, res) => {
  res.render('quotes/form', { quote: null, result: null, user: req.session, error: null });
});

// ─── Calculate preview (AJAX) ────────────────────────────────────────────────
router.post('/calculate', requireAuth, (req, res) => {
  try {
    const result = calculatePrice(buildInputs(req.body));
    res.json({ ok: true, result });
  } catch (e) {
    res.json({ ok: false, error: e.message });
  }
});

// ─── Create quote ────────────────────────────────────────────────────────────
router.post('/', requireAuth, (req, res) => {
  try {
    const inputs = buildInputs(req.body);
    const result = calculatePrice(inputs);
    const qn = generateQuoteNumber();

    const insert = db.prepare(`INSERT INTO quotes (
      quote_number, customer_name, customer_email, customer_company, status,
      width_value, width_unit, length_value, length_unit,
      fabric_gsm, fabric_type, filler_pct,
      lamination_side, lamination_gsm, lamination_included,
      bopp_side, bopp_micron, bopp_included, bopp_type, bopp_finish,
      metalize_side, metalize_micron, metalize_included,
      handle_included,
      liner_width, liner_length, liner_thickness, liner_thickness_unit, liner_included,
      bag_style, back_flexo, bopp_with_white, perforation, valve, hamming, tuber, ink_gsm,
      freight, pricing_type, discount_pct,
      rm_price_per_bag, ssp_rate_per_kg, ssp_rate_per_bag, final_price_per_kg, final_price_per_bag,
      total_weight_gm, notes, created_by
    ) VALUES (
      @quote_number,@customer_name,@customer_email,@customer_company,@status,
      @width_value,@width_unit,@length_value,@length_unit,
      @fabric_gsm,@fabric_type,@filler_pct,
      @lamination_side,@lamination_gsm,@lamination_included,
      @bopp_side,@bopp_micron,@bopp_included,@bopp_type,@bopp_finish,
      @metalize_side,@metalize_micron,@metalize_included,
      @handle_included,
      @liner_width,@liner_length,@liner_thickness,@liner_thickness_unit,@liner_included,
      @bag_style,@back_flexo,@bopp_with_white,@perforation,@valve,@hamming,@tuber,@ink_gsm,
      @freight,@pricing_type,@discount_pct,
      @rm_price_per_bag,@ssp_rate_per_kg,@ssp_rate_per_bag,@final_price_per_kg,@final_price_per_bag,
      @total_weight_gm,@notes,@created_by
    )`);

    const info = insert.run({
      ...inputs,
      quote_number: qn,
      status: 'draft',
      rm_price_per_bag:   result.rmPricePerBag,
      ssp_rate_per_kg:    result.sspRatePerKg,
      ssp_rate_per_bag:   result.sspRatePerBag,
      final_price_per_kg: result.finalRatePerKg,
      final_price_per_bag:result.finalRatePerBag,
      total_weight_gm:    result.totalWtWithLiner,
      notes: req.body.notes || null,
      created_by: req.session.userId,
    });

    auditLog(info.lastInsertRowid, qn, 'created', req);
    res.redirect('/quotes/' + info.lastInsertRowid);
  } catch (e) {
    console.error(e);
    res.render('quotes/form', { quote: null, result: null, user: req.session, error: e.message });
  }
});

// ─── View quote ──────────────────────────────────────────────────────────────
router.get('/:id', requireAuth, (req, res) => {
  const quote = db.prepare('SELECT q.*, u.full_name as creator_name FROM quotes q JOIN users u ON u.id = q.created_by WHERE q.id = ?').get(req.params.id);
  if (!quote) return res.status(404).render('error', { message: 'Quote not found', user: req.session });
  if (req.session.userRole !== 'admin' && quote.created_by !== req.session.userId)
    return res.status(403).render('error', { message: 'Access denied', user: req.session });

  const audit = db.prepare('SELECT * FROM quote_audit WHERE quote_id = ? ORDER BY timestamp DESC').all(quote.id);
  const result = calculatePrice(buildInputsFromQuote(quote));
  res.render('quotes/view', { quote, audit, result, user: req.session });
});

// ─── Edit quote ──────────────────────────────────────────────────────────────
router.get('/:id/edit', requireAuth, (req, res) => {
  const quote = db.prepare('SELECT * FROM quotes WHERE id = ?').get(req.params.id);
  if (!quote) return res.status(404).render('error', { message: 'Quote not found', user: req.session });
  if (req.session.userRole !== 'admin' && quote.created_by !== req.session.userId)
    return res.status(403).render('error', { message: 'Access denied', user: req.session });
  const result = calculatePrice(buildInputsFromQuote(quote));
  res.render('quotes/form', { quote, result, user: req.session, error: null });
});

router.post('/:id/edit', requireAuth, (req, res) => {
  const quote = db.prepare('SELECT * FROM quotes WHERE id = ?').get(req.params.id);
  if (!quote) return res.status(404).render('error', { message: 'Quote not found', user: req.session });
  if (req.session.userRole !== 'admin' && quote.created_by !== req.session.userId)
    return res.status(403).render('error', { message: 'Access denied', user: req.session });

  try {
    const inputs = buildInputs(req.body);
    const result = calculatePrice(inputs);

    db.prepare(`UPDATE quotes SET
      customer_name=@customer_name, customer_email=@customer_email, customer_company=@customer_company,
      width_value=@width_value, width_unit=@width_unit, length_value=@length_value, length_unit=@length_unit,
      fabric_gsm=@fabric_gsm, fabric_type=@fabric_type, filler_pct=@filler_pct,
      lamination_side=@lamination_side, lamination_gsm=@lamination_gsm, lamination_included=@lamination_included,
      bopp_side=@bopp_side, bopp_micron=@bopp_micron, bopp_included=@bopp_included, bopp_type=@bopp_type, bopp_finish=@bopp_finish,
      metalize_side=@metalize_side, metalize_micron=@metalize_micron, metalize_included=@metalize_included,
      handle_included=@handle_included,
      liner_width=@liner_width, liner_length=@liner_length, liner_thickness=@liner_thickness,
      liner_thickness_unit=@liner_thickness_unit, liner_included=@liner_included,
      bag_style=@bag_style, back_flexo=@back_flexo, bopp_with_white=@bopp_with_white,
      perforation=@perforation, valve=@valve, hamming=@hamming, tuber=@tuber, ink_gsm=@ink_gsm,
      freight=@freight, pricing_type=@pricing_type, discount_pct=@discount_pct,
      rm_price_per_bag=@rm_price_per_bag, ssp_rate_per_kg=@ssp_rate_per_kg,
      ssp_rate_per_bag=@ssp_rate_per_bag, final_price_per_kg=@final_price_per_kg,
      final_price_per_bag=@final_price_per_bag, total_weight_gm=@total_weight_gm,
      notes=@notes, updated_at=datetime('now')
      WHERE id = @id`).run({
        ...inputs,
        rm_price_per_bag:    result.rmPricePerBag,
        ssp_rate_per_kg:     result.sspRatePerKg,
        ssp_rate_per_bag:    result.sspRatePerBag,
        final_price_per_kg:  result.finalRatePerKg,
        final_price_per_bag: result.finalRatePerBag,
        total_weight_gm:     result.totalWtWithLiner,
        notes: req.body.notes || null,
        id: quote.id,
      });

    auditLog(quote.id, quote.quote_number, 'updated', req);
    res.redirect('/quotes/' + quote.id);
  } catch (e) {
    const result = calculatePrice(buildInputsFromQuote(quote));
    res.render('quotes/form', { quote, result, user: req.session, error: e.message });
  }
});

// ─── Update status ───────────────────────────────────────────────────────────
router.post('/:id/status', requireAuth, (req, res) => {
  const quote = db.prepare('SELECT * FROM quotes WHERE id = ?').get(req.params.id);
  if (!quote) return res.status(404).json({ error: 'Not found' });
  if (req.session.userRole !== 'admin' && quote.created_by !== req.session.userId)
    return res.status(403).json({ error: 'Denied' });

  const { status } = req.body;
  const allowed = ['draft', 'sent', 'accepted', 'rejected'];
  if (!allowed.includes(status)) return res.status(400).json({ error: 'Invalid status' });

  db.prepare("UPDATE quotes SET status=?, updated_at=datetime('now') WHERE id=?").run(status, quote.id);
  auditLog(quote.id, quote.quote_number, `status → ${status}`, req);
  res.json({ ok: true });
});

// ─── Audit log helper ────────────────────────────────────────────────────────
function auditLog(quoteId, quoteNumber, action, req) {
  db.prepare(`INSERT INTO quote_audit (quote_id, quote_number, action, actor_id, actor_name, ip_address)
              VALUES (?, ?, ?, ?, ?, ?)`).run(
    quoteId, quoteNumber, action,
    req.session.userId, req.session.fullName,
    req.ip || 'unknown'
  );
}

// ─── Input builder from form body ───────────────────────────────────────────
function buildInputs(body) {
  return {
    customer_name:    body.customer_name    || '',
    customer_email:   body.customer_email   || '',
    customer_company: body.customer_company || '',
    width_value:      parseFloat(body.width_value)  || 19,
    width_unit:       body.width_unit       || 'Inch',
    length_value:     parseFloat(body.length_value) || 33,
    length_unit:      body.length_unit      || 'Inch',
    fabric_gsm:       parseFloat(body.fabric_gsm)   || 3.5,
    fabric_type:      body.fabric_type      || 'Grammage',
    filler_pct:       parseFloat(body.filler_pct)   || 35,
    lamination_included: body.lamination_included || 'Yes',
    lamination_side:  body.lamination_side  || 'Double',
    lamination_gsm:   parseFloat(body.lamination_gsm) || 17,
    bopp_included:    body.bopp_included    || 'Yes',
    bopp_side:        body.bopp_side        || 'Double',
    bopp_micron:      parseFloat(body.bopp_micron)  || 12,
    bopp_type:        body.bopp_type        || 'Double',
    bopp_finish:      body.bopp_finish      || 'Gloss',
    metalize_included:body.metalize_included|| 'No',
    metalize_side:    body.metalize_side    || 'Double',
    metalize_micron:  parseFloat(body.metalize_micron) || 15,
    handle_included:  body.handle_included  || 'Yes',
    liner_included:   body.liner_included   || 'Yes',
    liner_width:      parseFloat(body.liner_width)  || parseFloat(body.width_value)  || 19,
    liner_length:     parseFloat(body.liner_length) || parseFloat(body.length_value) || 36,
    liner_thickness:  parseFloat(body.liner_thickness) || 50,
    liner_thickness_unit: body.liner_thickness_unit || 'Micron',
    bag_style:        body.bag_style        || 'Flexo Bag',
    back_flexo:       body.back_flexo       || 'Yes',
    bopp_with_white:  body.bopp_with_white  || 'No',
    perforation:      body.perforation      || 'No',
    valve:            body.valve            || 'No',
    hamming:          body.hamming          || 'No',
    tuber:            body.tuber            || 'No',
    ink_gsm:          parseFloat(body.ink_gsm) || 1,
    freight:          body.freight          || 'Ex Factory',
    pricing_type:     body.pricing_type     || 'Premium',
    discount_pct:     parseFloat(body.discount_pct) || 0,
  };
}

function buildInputsFromQuote(q) {
  return {
    customer_name: q.customer_name, customer_email: q.customer_email, customer_company: q.customer_company,
    width_value: q.width_value, width_unit: q.width_unit,
    length_value: q.length_value, length_unit: q.length_unit,
    fabric_gsm: q.fabric_gsm, fabric_type: q.fabric_type, filler_pct: q.filler_pct,
    lamination_included: q.lamination_included, lamination_side: q.lamination_side, lamination_gsm: q.lamination_gsm,
    bopp_included: q.bopp_included, bopp_side: q.bopp_side, bopp_micron: q.bopp_micron,
    bopp_type: q.bopp_type, bopp_finish: q.bopp_finish,
    metalize_included: q.metalize_included, metalize_side: q.metalize_side, metalize_micron: q.metalize_micron,
    handle_included: q.handle_included, liner_included: q.liner_included,
    liner_width: q.liner_width, liner_length: q.liner_length,
    liner_thickness: q.liner_thickness, liner_thickness_unit: q.liner_thickness_unit,
    bag_style: q.bag_style, back_flexo: q.back_flexo, bopp_with_white: q.bopp_with_white,
    perforation: q.perforation, valve: q.valve, hamming: q.hamming, tuber: q.tuber, ink_gsm: q.ink_gsm,
    freight: q.freight, pricing_type: q.pricing_type, discount_pct: q.discount_pct,
  };
}

module.exports = router;
