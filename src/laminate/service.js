const { prepare } = require('../models/db');

function ensureLaminateTables() {
  prepare(`CREATE TABLE IF NOT EXISTS laminate_materials (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    active INTEGER NOT NULL DEFAULT 1,
    gsm REAL NOT NULL DEFAULT 0,
    density REAL NOT NULL DEFAULT 0,
    rate_per_kg REAL NOT NULL DEFAULT 0,
    wastage REAL NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 0,
    poly_natural_active INTEGER NOT NULL DEFAULT 1,
    poly_milky_active INTEGER NOT NULL DEFAULT 0,
    poly_metallocene_active INTEGER NOT NULL DEFAULT 0,
    poly_metallocene_pct REAL NOT NULL DEFAULT 0,
    ink_white_coating INTEGER NOT NULL DEFAULT 0
  )`).run();

  const materialColumns = prepare(`PRAGMA table_info(laminate_materials)`).all().map(r => r.name);
  if (!materialColumns.includes('poly_natural_active')) {
    prepare('ALTER TABLE laminate_materials ADD COLUMN poly_natural_active INTEGER NOT NULL DEFAULT 1').run();
  }
  if (!materialColumns.includes('poly_milky_active')) {
    prepare('ALTER TABLE laminate_materials ADD COLUMN poly_milky_active INTEGER NOT NULL DEFAULT 0').run();
  }
  if (!materialColumns.includes('poly_metallocene_active')) {
    prepare('ALTER TABLE laminate_materials ADD COLUMN poly_metallocene_active INTEGER NOT NULL DEFAULT 0').run();
  }
  if (!materialColumns.includes('poly_metallocene_pct')) {
    prepare('ALTER TABLE laminate_materials ADD COLUMN poly_metallocene_pct REAL NOT NULL DEFAULT 0').run();
  }
  if (!materialColumns.includes('ink_white_coating')) {
    prepare('ALTER TABLE laminate_materials ADD COLUMN ink_white_coating INTEGER NOT NULL DEFAULT 0').run();
  }

  prepare(`CREATE TABLE IF NOT EXISTS laminate_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    product_name TEXT NOT NULL DEFAULT 'Laminate Pouch',
    product_type TEXT NOT NULL DEFAULT 'laminate-roll-shape',
    pouch_type TEXT NOT NULL DEFAULT 'normal-pouch',
    specification TEXT NOT NULL DEFAULT '210MM x 245MM',
    width REAL NOT NULL DEFAULT 150,
    height REAL NOT NULL DEFAULT 260,
    gussette REAL NOT NULL DEFAULT 0,
    pet_mic REAL NOT NULL DEFAULT 12,
    poly_mic REAL NOT NULL DEFAULT 100,
    met_pet REAL NOT NULL DEFAULT 12,
    al_foil REAL NOT NULL DEFAULT 0,
    contribution_roll_shape REAL NOT NULL DEFAULT 50,
    contribution_pouching REAL NOT NULL DEFAULT 10,
    freight_per_kg REAL NOT NULL DEFAULT 5,
    pouching_wastage REAL NOT NULL DEFAULT 0.05,
    has_pouching_process INTEGER NOT NULL DEFAULT 1,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`).run();

  const settingColumns = prepare(`PRAGMA table_info(laminate_settings)`).all().map(r => r.name);
  if (!settingColumns.includes('al_foil')) {
    prepare('ALTER TABLE laminate_settings ADD COLUMN al_foil REAL NOT NULL DEFAULT 0').run();
  }
  if (!settingColumns.includes('product_type')) {
    prepare("ALTER TABLE laminate_settings ADD COLUMN product_type TEXT NOT NULL DEFAULT 'laminate-roll-shape'").run();
  }
  if (!settingColumns.includes('pouch_type')) {
    prepare("ALTER TABLE laminate_settings ADD COLUMN pouch_type TEXT NOT NULL DEFAULT 'normal-pouch'").run();
  }

  const settingsCount = prepare('SELECT COUNT(*) as c FROM laminate_settings').get();
  if (!settingsCount || settingsCount.c === 0) {
    prepare(`INSERT INTO laminate_settings (
      id, product_name, product_type, pouch_type, specification, width, height, gussette, pet_mic, poly_mic, met_pet, al_foil,
      contribution_roll_shape, contribution_pouching, freight_per_kg, pouching_wastage, has_pouching_process
    ) VALUES (1,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run('Laminate Pouch', 'laminate-roll-shape', 'normal-pouch', '210MM x 245MM', 150, 260, 0, 12, 100, 12, 0, 50, 10, 5, 0.05, 1);
  }

  const count = prepare('SELECT COUNT(*) as c FROM laminate_materials').get();
  if (!count || count.c === 0) {
    const defaults = [
      ['Polyester cc', 1, 16.92, 1.41, 145, 0.14, 1],
      ['Transparent Polyethelene', 1, 91, 0.91, 163, 0.08, 2],
      ['MET Pet', 1, 16.92, 1.41, 185, 0.05, 3],
      ['Al Foil', 0, 0, 2.7, 470, 0.07, 4],
      ['Ink', 1, 3, 0, 1500, 0.10, 5],
      ['Adhesive (Lamination 1)', 1, 1.5, 0, 350, 0.10, 6],
      ['Solvent', 0, 0, 0, 0, 7.2295, 7],
      ['Adhesive (Lamination 2)', 0, 0, 0, 340, 0.10, 8]
    ];
    const ins = prepare('INSERT INTO laminate_materials (name, active, gsm, density, rate_per_kg, wastage, sort_order) VALUES (?,?,?,?,?,?,?)');
    defaults.forEach(row => ins.run(...row));
  }
}

const { normalizeMaterialFields } = require('./pricing');

function getLaminateDefaults() {
  ensureLaminateTables();
  const settings = prepare('SELECT * FROM laminate_settings WHERE id = 1').get();
  const materials = prepare('SELECT * FROM laminate_materials ORDER BY sort_order, id').all();
  const data = {
    productName: settings.product_name,
    productType: settings.product_type || 'laminate-roll-shape',
    pouchType: settings.pouch_type || 'normal-pouch',
    specification: settings.specification,
    width: settings.width,
    height: settings.height,
    gussette: settings.gussette,
    structure: {
      petMic: settings.pet_mic,
      polyMic: settings.poly_mic,
      metPet: settings.met_pet,
      alFoil: settings.al_foil,
    },
    contributionRollShape: settings.contribution_roll_shape,
    contributionPouching: settings.contribution_pouching,
    freightPerKg: settings.freight_per_kg,
    pouchingWastage: settings.pouching_wastage,
    hasPouchingProcess: !!settings.has_pouching_process,
    materials: materials.map(m => ({
      id: m.id,
      name: m.name,
      active: !!m.active,
      gsm: m.gsm,
      density: m.density,
      ratePerKg: m.rate_per_kg,
      wastage: m.wastage,
      polyOptions: {
        natural: !!m.poly_natural_active,
        milky: !!m.poly_milky_active,
        metallocene: !!m.poly_metallocene_active,
        metallocenePct: m.poly_metallocene_pct || 0,
      },
      inkOptions: {
        whiteCoating: !!m.ink_white_coating,
      },
    }))
  };
  data.materials = normalizeMaterialFields(data.materials, data.structure);
  return data;
}

function saveLaminateDefaults(body) {
  ensureLaminateTables();
  prepare(`UPDATE laminate_settings SET
    product_name = ?, product_type = ?, pouch_type = ?, specification = ?, width = ?, height = ?, gussette = ?,
    pet_mic = ?, poly_mic = ?, met_pet = ?, al_foil = ?, contribution_roll_shape = ?,
    contribution_pouching = ?, freight_per_kg = ?, pouching_wastage = ?,
    has_pouching_process = ?, updated_at = datetime('now')
    WHERE id = 1`).run(
    body.productName,
    body.productType || 'laminate-roll-shape',
    body.pouchType || 'normal-pouch',
    body.specification,
    body.width,
    body.height,
    body.gussette,
    body.structure?.petMic || 0,
    body.structure?.polyMic || 0,
    body.structure?.metPet || 0,
    body.structure?.alFoil || 0,
    body.contributionRollShape,
    body.contributionPouching,
    body.freightPerKg,
    body.pouchingWastage,
    body.hasPouchingProcess ? 1 : 0
  );

  const existing = prepare('SELECT id FROM laminate_materials').all().map(r => r.id);
  const seen = [];
  for (const [idx, m] of (body.materials || []).entries()) {
    if (m.id && existing.includes(m.id)) {
      const existingRow = prepare('SELECT rate_per_kg, wastage FROM laminate_materials WHERE id = ?').get(m.id) || {};
      prepare('UPDATE laminate_materials SET name=?, active=?, gsm=?, density=?, rate_per_kg=?, wastage=?, sort_order=?, poly_natural_active=?, poly_milky_active=?, poly_metallocene_active=?, poly_metallocene_pct=?, ink_white_coating=? WHERE id=?')
        .run(
          m.name,
          m.active ? 1 : 0,
          m.gsm,
          m.density,
          existingRow.rate_per_kg ?? 0,
          existingRow.wastage ?? 0,
          idx + 1,
          m.polyOptions?.natural === false ? 0 : 1,
          m.polyOptions?.milky ? 1 : 0,
          m.polyOptions?.metallocene ? 1 : 0,
          m.polyOptions?.metallocenePct || 0,
          m.inkOptions?.whiteCoating ? 1 : 0,
          m.id
        );
      seen.push(m.id);
    } else {
      const ins = prepare('INSERT INTO laminate_materials (name, active, gsm, density, rate_per_kg, wastage, sort_order, poly_natural_active, poly_milky_active, poly_metallocene_active, poly_metallocene_pct, ink_white_coating) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)')
        .run(
          m.name,
          m.active ? 1 : 0,
          m.gsm,
          m.density,
          m.ratePerKg,
          m.wastage,
          idx + 1,
          m.polyOptions?.natural === false ? 0 : 1,
          m.polyOptions?.milky ? 1 : 0,
          m.polyOptions?.metallocene ? 1 : 0,
          m.polyOptions?.metallocenePct || 0,
          m.inkOptions?.whiteCoating ? 1 : 0
        );
      seen.push(ins.lastInsertRowid);
    }
  }
  existing.filter(id => !seen.includes(id)).forEach(id => prepare('DELETE FROM laminate_materials WHERE id = ?').run(id));
}

function getLaminateRates() {
  ensureLaminateTables();
  return prepare('SELECT id, name, rate_per_kg, wastage, sort_order FROM laminate_materials ORDER BY sort_order, id').all().map(r => ({
    id: r.id,
    name: r.name,
    ratePerKg: r.rate_per_kg,
    wastage: r.wastage,
    sortOrder: r.sort_order,
  }));
}

function saveLaminateRates(rates = []) {
  ensureLaminateTables();
  for (const rate of rates) {
    if (!rate.id) continue;
    prepare('UPDATE laminate_materials SET rate_per_kg = ?, wastage = ? WHERE id = ?')
      .run(rate.ratePerKg || 0, rate.wastage || 0, rate.id);
  }
}

module.exports = { ensureLaminateTables, getLaminateDefaults, saveLaminateDefaults, getLaminateRates, saveLaminateRates };
