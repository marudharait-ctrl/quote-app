const express = require('express');
const path = require('path');
const { prepare: dbPrepare } = require('../models/db');
const db = { prepare: dbPrepare };
const { requireAuth } = require('../middleware/auth');
const { calculatePrice } = require('../utils/pricing');
const { generateQuoteNumber } = require('../utils/quoteNumber');
const PDFDocument = require('pdfkit');
const router = express.Router();
const logoPath = path.join(__dirname, '../../public/logo.png');

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
// NOTE: This endpoint is intentionally left unauthenticated so the front-end
// can always get a JSON response for live calculations. Saving quotes still
// requires login/auth, so security of stored data remains intact.
router.post('/calculate', (req, res) => {
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

router.get('/:id/pdf', requireAuth, (req, res) => {
  const quote = db.prepare('SELECT q.*, u.full_name as creator_name FROM quotes q JOIN users u ON u.id = q.created_by WHERE q.id = ?').get(req.params.id);
  if (!quote) return res.status(404).render('error', { message: 'Quote not found', user: req.session });
  if (req.session.userRole !== 'admin' && quote.created_by !== req.session.userId)
    return res.status(403).render('error', { message: 'Access denied', user: req.session });

  const result = calculatePrice(buildInputsFromQuote(quote));
  const doc = new PDFDocument({ margin: 36, size: 'A4', bufferPages: true });
  const filename = `${quote.quote_number}.pdf`;

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  doc.pipe(res);

  const colors = {
    text: '#111827',
    muted: '#6b7280',
    line: '#e5e7eb',
    accent: '#8b1a1a',
    accentLight: '#fdf2f2',
    dark: '#1f2937',
    success: '#166534'
  };

  function currency(value) {
    return `₹${Number(value || 0).toFixed(2)}`;
  }

  function ensureSpace(height) {
    if (doc.y + height > doc.page.height - 60) {
      doc.addPage();
    }
  }

  function drawHeader() {
    const top = 24;
    if (doc.page.number === 1) {
      doc.save()
        .roundedRect(36, top, doc.page.width - 72, 96, 12)
        .fill(colors.accentLight)
        .restore();

      try {
        doc.image(logoPath, 50, top + 14, { fit: [80, 60], align: 'left' });
      } catch (e) {
        // ignore logo load issues, PDF still renders
      }

      doc.font('Helvetica-Bold').fontSize(22).fillColor(colors.accent)
        .text('Marudhara Polypack Quote', 145, top + 18);
      doc.font('Helvetica').fontSize(10).fillColor(colors.muted)
        .text('Professional woven bag quotation', 145, top + 46);
      doc.font('Helvetica-Bold').fontSize(18).fillColor(colors.dark)
        .text(quote.quote_number, 145, top + 64);
      doc.font('Helvetica').fontSize(9).fillColor(colors.muted)
        .text(`Generated: ${new Date().toLocaleString('en-IN')}`, doc.page.width - 210, top + 22, { width: 160, align: 'right' })
        .text(`Prepared by: ${quote.creator_name}`, doc.page.width - 210, top + 38, { width: 160, align: 'right' })
        .text(`Status: ${String(quote.status || 'draft').toUpperCase()}`, doc.page.width - 210, top + 54, { width: 160, align: 'right' });

      doc.y = 138;
    } else {
      doc.font('Helvetica-Bold').fontSize(12).fillColor(colors.accent)
        .text(`Marudhara Polypack • ${quote.quote_number}`, 36, 24);
      doc.moveTo(36, 42).lineTo(doc.page.width - 36, 42).strokeColor(colors.line).stroke();
      doc.y = 56;
    }
  }

  function drawFooter() {
    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(range.start + i);
      const footerY = doc.page.height - 34;
      doc.moveTo(36, footerY - 8).lineTo(doc.page.width - 36, footerY - 8).strokeColor(colors.line).stroke();
      doc.font('Helvetica').fontSize(8).fillColor(colors.muted)
        .text('Marudhara Polypack', 36, footerY, { width: 200, align: 'left' })
        .text(`Page ${i + 1} of ${range.count}`, 0, footerY, { align: 'center' })
        .text(`Prepared by ${quote.creator_name}`, doc.page.width - 236, footerY, { width: 200, align: 'right' });
    }
  }

  function section(title) {
    ensureSpace(34);
    doc.moveDown(0.6);
    doc.font('Helvetica-Bold').fontSize(12).fillColor(colors.dark).text(title);
    doc.moveTo(36, doc.y + 4).lineTo(doc.page.width - 36, doc.y + 4).strokeColor(colors.line).stroke();
    doc.moveDown(0.6);
  }

  function keyValueGrid(items, columns = 2) {
    const colGap = 16;
    const usableWidth = doc.page.width - 72;
    const colWidth = (usableWidth - colGap * (columns - 1)) / columns;
    const rowHeight = 34;

    for (let i = 0; i < items.length; i += columns) {
      ensureSpace(rowHeight + 8);
      const rowItems = items.slice(i, i + columns);
      const y = doc.y;

      rowItems.forEach((item, index) => {
        const x = 36 + index * (colWidth + colGap);
        doc.font('Helvetica').fontSize(8).fillColor(colors.muted)
          .text(item.label, x, y, { width: colWidth });
        doc.font('Helvetica-Bold').fontSize(10).fillColor(colors.text)
          .text(item.value || '—', x, y + 12, { width: colWidth });
      });

      doc.y = y + rowHeight;
    }
  }

  function metricCards(items) {
    const gap = 12;
    const width = (doc.page.width - 72 - gap) / 2;
    ensureSpace(84);
    const y = doc.y;

    items.forEach((item, index) => {
      const x = 36 + index * (width + gap);
      doc.save()
        .roundedRect(x, y, width, 64, 10)
        .fill(index === 0 ? '#eff6ff' : '#f0fdf4')
        .restore();
      doc.font('Helvetica').fontSize(9).fillColor(colors.muted)
        .text(item.label, x + 14, y + 12, { width: width - 28, align: 'center' });
      doc.font('Helvetica-Bold').fontSize(20).fillColor(index === 0 ? '#1d4ed8' : colors.success)
        .text(item.value, x + 14, y + 28, { width: width - 28, align: 'center' });
    });

    doc.y = y + 76;
  }

  function simpleTable(title, rows) {
    section(title);
    rows.forEach((row) => {
      ensureSpace(24);
      const y = doc.y;
      doc.font('Helvetica').fontSize(9).fillColor(colors.text)
        .text(row.label, 36, y, { width: 300 });
      doc.font('Helvetica-Bold').fontSize(9).fillColor(colors.dark)
        .text(row.value, doc.page.width - 220, y, { width: 184, align: 'right' });
      doc.moveTo(36, y + 16).lineTo(doc.page.width - 36, y + 16).strokeColor('#f3f4f6').stroke();
      doc.y = y + 20;
    });
  }

  drawHeader();

  metricCards([
    { label: 'Final Price per Bag', value: currency(quote.final_price_per_bag) },
    { label: 'Final Price per Kg', value: currency(quote.final_price_per_kg) }
  ]);

  section('Customer Information');
  keyValueGrid([
    { label: 'Customer Name', value: quote.customer_name },
    { label: 'Company', value: quote.customer_company || '—' },
    { label: 'Email', value: quote.customer_email || '—' },
    { label: 'Prepared By', value: quote.creator_name }
  ]);

  section('Quote Summary');
  keyValueGrid([
    { label: 'Quote Number', value: quote.quote_number },
    { label: 'Status', value: String(quote.status || 'draft').toUpperCase() },
    { label: 'Created On', value: new Date(quote.created_at).toLocaleString('en-IN') },
    { label: 'Last Updated', value: quote.updated_at ? new Date(quote.updated_at).toLocaleString('en-IN') : '—' }
  ]);

  section('Product Specifications');
  keyValueGrid([
    { label: 'Size (W × L)', value: `${quote.width_value} × ${quote.length_value} ${quote.width_unit}` },
    { label: 'Bag Style', value: quote.bag_style },
    { label: 'Fabric', value: `${quote.fabric_gsm} ${quote.fabric_type}` },
    { label: 'Filler Content', value: `${quote.filler_pct}%` },
    { label: 'Lamination', value: `${quote.lamination_included} | ${quote.lamination_side} | ${quote.lamination_gsm} GSM` },
    { label: 'BOPP', value: `${quote.bopp_included} | ${quote.bopp_side} | ${quote.bopp_micron} micron` },
    { label: 'BOPP Type / Finish', value: `${quote.bopp_type} / ${quote.bopp_finish}` },
    { label: 'Back Flexo', value: quote.back_flexo },
    { label: 'Metalize', value: quote.metalize_included === 'Yes' ? `${quote.metalize_side} | ${quote.metalize_micron} micron` : quote.metalize_included },
    { label: 'Handle', value: quote.handle_included },
    { label: 'Liner', value: quote.liner_included === 'Yes' ? `${quote.liner_width} × ${quote.liner_length} | ${quote.liner_thickness} ${quote.liner_thickness_unit}` : quote.liner_included },
    { label: 'Freight', value: quote.freight }
  ]);

  if (quote.notes) {
    section('Notes');
    ensureSpace(40);
    doc.font('Helvetica').fontSize(10).fillColor(colors.text)
      .text(quote.notes, 36, doc.y, { width: doc.page.width - 72, lineGap: 3 });
  }

  simpleTable('Pricing Summary', [
    { label: 'Final Price / Bag', value: currency(quote.final_price_per_bag) },
    { label: 'Final Price / Kg', value: currency(quote.final_price_per_kg) },
    { label: 'SSP Rate / Bag', value: currency(result.sspRatePerBag) },
    { label: 'SSP Rate / Kg', value: currency(result.sspRatePerKg) },
    { label: 'Raw Material Total / Bag', value: currency(result.rmPricePerBag) },
    { label: 'Total Weight', value: `${Number(result.totalWtWithLiner || 0).toFixed(2)} gm` },
    { label: 'Average Contribution / Kg', value: currency(((Number(quote.final_price_per_bag || 0) - Number(result.rmPricePerBag || 0)) * 1000) / Number(result.totalWtWithLiner || 1)) },
    { label: 'Pricing Type', value: `${quote.pricing_type} (${quote.discount_pct}%)` }
  ]);

  simpleTable('Raw Material Breakdown', [
    { label: 'PP Fabric + Filler', value: `${currency(result.ppFabricAmt)}/bag | ${Number(result.fabricWt || 0).toFixed(1)} gm` },
    { label: 'Lamination', value: `${currency(result.lamCost)}/bag | ${Number(result.lamWt || 0).toFixed(1)} gm` },
    { label: 'BOPP + Ink', value: `${currency(result.boppCost)}/bag | ${Number(result.boppWt || 0).toFixed(1)} gm` },
    { label: 'Metalize', value: `${currency(result.metCost)}/bag | ${Number(result.metWt || 0).toFixed(1)} gm` },
    { label: 'Handle', value: `${currency(result.handleCost)}/bag` },
    { label: 'Liner', value: `${currency(result.linerCost)}/bag | ${Number(result.linerWt || 0).toFixed(1)} gm` },
    { label: 'Flexo Ink Adjustment', value: `${currency(result.flexoInkAdjPerBag)}/bag | ${currency(result.flexoInkAdjPerKg)}/kg` },
    { label: 'Adhesive Adjustment', value: `${currency(result.adhesiveAdjPerBag)}/bag` }
  ]);

  simpleTable('Conversion Cost Details', [
    { label: 'Width Surcharge', value: currency(result.convDetails.widthSurcharge) },
    { label: 'Bag Style', value: currency(result.convDetails.bagStyle) },
    { label: 'BOPP Type', value: currency(result.convDetails.boppType) },
    { label: 'Back Flexo', value: currency(result.convDetails.backFlexo) },
    { label: 'Finish', value: currency(result.convDetails.finish) },
    { label: 'Metalize', value: currency(result.convDetails.metalizeBase) },
    { label: 'Metalize Window', value: currency(result.convDetails.metalizeWindows) },
    { label: 'Valve', value: currency(result.convDetails.valve) },
    { label: 'Hamming', value: currency(result.convDetails.hamming) },
    { label: 'Tuber', value: currency(result.convDetails.tuber) },
    { label: 'Handle Conversion', value: currency(result.convDetails.handleConv) },
    { label: 'Liner Adjustment', value: currency(result.convDetails.linerConv) },
    { label: 'Freight', value: currency(result.convDetails.freight) },
    { label: 'Total Conversion / Kg', value: currency(result.convDetails.total) }
  ]);

  drawFooter();
  doc.end();
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
