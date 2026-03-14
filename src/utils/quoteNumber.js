const { prepare, exec } = require('../models/db');

function generateQuoteNumber() {
  const year = new Date().getFullYear();
  // Upsert counter row
  const existing = prepare('SELECT seq FROM quote_counter WHERE year = ?').get(year);
  let seq;
  if (!existing) {
    prepare('INSERT INTO quote_counter (year, seq) VALUES (?, 1)').run(year);
    seq = 1;
  } else {
    seq = existing.seq + 1;
    prepare('UPDATE quote_counter SET seq = ? WHERE year = ?').run(seq, year);
  }
  return `QT-${year}-${String(seq).padStart(6, '0')}`;
}

module.exports = { generateQuoteNumber };
