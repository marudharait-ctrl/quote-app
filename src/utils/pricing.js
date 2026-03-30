'use strict';
/**
 * Pricing Engine — all rates loaded from DB (admin-configurable)
 * Bugs fixed:
 *   1. Handle weight/cost now correctly zero'd when handle_included = No
 *   2. Metalize weight now correctly zero'd when metalize_included = No
 */

const { prepare } = require('../models/db');

// Load config from DB into a flat object { key: value }
function loadConfig() {
  const rows = prepare('SELECT key, value FROM pricing_config').all();
  const cfg = {};
  rows.forEach(r => { cfg[r.key] = r.value; });
  return cfg;
}

function toInch(value, unit) {
  if (unit === 'MM') return value / 25.4;
  if (unit === 'CM') return value / 2.54;
  return value;
}

function toGrammage(value, unit) {
  if (unit === 'GSM')    return value / 19.685;
  if (unit === 'denier') return value * 20 * 39.37 / 9000 / 19.685;
  return value;
}

function linerThicknessConv(value, unit) {
  if (unit === 'GSM')    return value / 0.92 * 4;
  if (unit === 'Micron') return value * 4;
  return value;
}

function rmCost(weightGm, ratePerKg, wastagePct) {
  return weightGm * (ratePerKg / 1000) * (1 + wastagePct / 100);
}

function calculatePrice(inputs) {
  const cfg = loadConfig();

  // ── Unit conversions ───────────────────────────────────────────────────
  const W  = toInch(inputs.width_value,  inputs.width_unit);
  const L  = toInch(inputs.length_value, inputs.length_unit);
  const GR = toGrammage(inputs.fabric_gsm, inputs.fabric_type);

  const fillerPct = inputs.filler_pct;
  const inkGsm    = inputs.ink_gsm;

  // Inclusion flags — FIX: normalise case properly
  const lamIncl  = (inputs.lamination_included || 'Yes').toLowerCase() === 'yes';
  const boppIncl = (inputs.bopp_included       || 'Yes').toLowerCase() === 'yes';
  const metIncl  = (inputs.metalize_included   || 'No' ).toLowerCase() === 'yes';  // BUG FIX: was calculating metWt even when No
  const hndlIncl = (inputs.handle_included     || 'Yes').toLowerCase() === 'yes';  // BUG FIX: was always using handleWt=7
  const linerIncl= (inputs.liner_included      || 'Yes').toLowerCase() === 'yes';

  const lamSide   = inputs.lamination_side;
  const lamGsm    = inputs.lamination_gsm;
  const lamFinal  = lamSide === 'Single' ? lamGsm : lamGsm * 2;

  const boppSide  = inputs.bopp_side || 'Double';
  const boppMicron= inputs.bopp_micron;
  const boppFinal = boppSide === 'Single' ? boppMicron : boppMicron * 2;

  const metSide   = inputs.metalize_side;
  const metMicron = inputs.metalize_micron;
  const metFinal  = metSide === 'Single' ? metMicron : metMicron * 2;

  const boppWithWhite = (inputs.bopp_with_white || 'No').toLowerCase();

  const linerW   = linerIncl ? toInch(inputs.liner_width   || inputs.width_value,  inputs.width_unit)  : 0;
  const linerL   = linerIncl ? toInch(inputs.liner_length  || inputs.length_value, inputs.length_unit) : 0;
  const linerThk = linerIncl ? linerThicknessConv(inputs.liner_thickness, inputs.liner_thickness_unit) : 0;

  // ── Weight calculations ────────────────────────────────────────────────
  // Base fabric weight (bag body)
  const baseFabricWt = W * L * GR / 39.37;

  // Extra fabric for Tuber strip:
  // When tuber is selected, add an additional strip whose length = bag length (L)
  // and width = 1 inch. We reuse the same formula and units as main fabric.
  const tuberIncl      = (inputs.tuber || 'No').toLowerCase() === 'yes';
  const tuberFabricWt  = tuberIncl ? (1 * L * GR / 39.37) : 0;

  // Final fabric weight used for all downstream calculations
  const fabricWt = baseFabricWt + tuberFabricWt;

  const lamWt    = lamIncl  ? W * lamFinal  / 1549.9969 * L : 0;
  const boppWt   = boppIncl ? W * boppFinal / 1549.9969 * L : 0;
  const metWt    = metIncl  ? W * L * metFinal / 1549.9969 : 0;   // BUG FIX: was always calculated
  const inkWt    = boppIncl
    ? (boppWithWhite === 'no'
        // Ink GSM scales with BOPP side: Double → factor 2, Single → factor 1
        ? (W * L) * (boppSide === 'Single' ? 1 : 2) * inkGsm / 1549.9969
        : (W * L * (boppSide === 'Single' ? 1 : 2)) / 1549.9969 * (inkGsm + 1))
    : 0;
  const handleWt = hndlIncl ? cfg.rm_handle_weight : 0;            // BUG FIX: was always 7, now respects toggle
  const linerWt  = linerIncl ? linerW * linerL * linerThk / 3300 : 0;

  // ── RM Costs per bag ───────────────────────────────────────────────────
  const ppWt       = fabricWt * (1 - fillerPct / 100);
  const fillerWt   = fabricWt * (fillerPct / 100);

  const ppCost         = rmCost(ppWt,     cfg.rm_pp_rate,          cfg.rm_pp_wastage);
  const fillerCost     = rmCost(fillerWt, cfg.rm_filler_rate,       cfg.rm_filler_wastage);
  const boppCost       = boppIncl ? rmCost(boppWt, cfg.rm_bopp_rate,    cfg.rm_bopp_wastage)    : 0;
  const metCost        = metIncl  ? rmCost(metWt,  cfg.rm_metalize_rate,cfg.rm_metalize_wastage) : 0;
  const inkCost        = boppIncl ? rmCost(inkWt,  cfg.rm_ink_rate,     cfg.rm_ink_wastage)      : 0;
  const lamCost        = lamIncl  ? rmCost(lamWt,  cfg.rm_lam_rate,     cfg.rm_lam_wastage)      : 0;
  const linerCost      = linerIncl? rmCost(linerWt,cfg.rm_liner_rate,   cfg.rm_liner_wastage)    : 0;
  const handleCost     = hndlIncl ? rmCost(handleWt,cfg.rm_handle_rate, cfg.rm_handle_wastage)   : 0;
  const fabricConvCost = rmCost(fabricWt, cfg.rm_fabric_conv_rate, 0);

  const ppFabricAmt = ppCost + fillerCost + fabricConvCost;

  // ── Row totals ─────────────────────────────────────────────────────────
  const totalAmtWithLiner    = ppFabricAmt + lamCost + boppCost + inkCost + metCost + handleCost + linerCost;
  const totalWtWithLiner     = fabricWt + lamWt + boppWt + inkWt + metWt + handleWt + linerWt;
  const totalAmtWithoutLiner = totalAmtWithLiner - linerCost;
  const totalWtWithoutLiner  = totalWtWithLiner  - linerWt;

  // Raw material rate per Kg INCLUDING liner (as requested)
  const rmRatePerKg = totalWtWithLiner > 0 ? 1000 / totalWtWithLiner * totalAmtWithLiner : 0;

  // ── Conversion costs ───────────────────────────────────────────────────
  const conv = calcConversions(inputs, W, cfg,
    totalAmtWithLiner, totalWtWithLiner,
    totalAmtWithoutLiner, totalWtWithoutLiner,
    handleWt, linerCost, linerWt);

  const sspRatePerKg  = rmRatePerKg + conv.sum;
  const sspRatePerBag = sspRatePerKg * totalWtWithLiner / 1000;

  const pricingType = inputs.pricing_type || 'Premium';
  const discountPct = inputs.discount_pct || 0;
  let finalRatePerKg = sspRatePerKg;
  if (pricingType === 'Premium')  finalRatePerKg = sspRatePerKg + sspRatePerKg * discountPct / 100;
  if (pricingType === 'Discount') finalRatePerKg = sspRatePerKg - sspRatePerKg * discountPct / 100;

  const finalRatePerBag = finalRatePerKg * totalWtWithLiner / 1000;

  return {
    fabricWt:           +fabricWt.toFixed(4),
    lamWt:              +lamWt.toFixed(4),
    boppWt:             +(boppWt + inkWt).toFixed(4),
    metWt:              +metWt.toFixed(4),
    handleWt:           +handleWt,
    linerWt:            +linerWt.toFixed(4),
    totalWtWithLiner:   +totalWtWithLiner.toFixed(4),
    totalWtWithoutLiner:+totalWtWithoutLiner.toFixed(4),
    ppFabricAmt:        +ppFabricAmt.toFixed(4),
    lamCost:            +lamCost.toFixed(4),
    boppCost:           +(boppCost + inkCost).toFixed(4),
    metCost:            +metCost.toFixed(4),
    handleCost:         +handleCost.toFixed(4),
    linerCost:          +linerCost.toFixed(4),
    totalAmtWithLiner:  +totalAmtWithLiner.toFixed(4),
    rmRatePerKg:        +rmRatePerKg.toFixed(4),
    rmPricePerBag:      +totalAmtWithLiner.toFixed(4),
    convDetails:        conv.details,
    sspRatePerKg:       +sspRatePerKg.toFixed(4),
    sspRatePerBag:      +sspRatePerBag.toFixed(4),
    finalRatePerKg:     +finalRatePerKg.toFixed(4),
    finalRatePerBag:    +finalRatePerBag.toFixed(4),
    discount:           discountPct,
    pricingType,
  };
}

function calcConversions(inputs, W, cfg,
  totalAmtWithLiner, totalWtWithLiner,
  totalAmtWithoutLiner, totalWtWithoutLiner,
  handleWt, linerCost, linerWt) {

  const lamIncl    = (inputs.lamination_included || 'Yes').toLowerCase() === 'yes';
  const boppIncl   = (inputs.bopp_included       || 'Yes').toLowerCase() === 'yes';
  const metIncl    = (inputs.metalize_included   || 'No' ).toLowerCase() === 'yes';
  const hndlIncl   = (inputs.handle_included     || 'Yes').toLowerCase() === 'yes';
  const linerIncl  = (inputs.liner_included      || 'Yes').toLowerCase() === 'yes';
  // We removed BOPP Type from UI; use BOPP Side (Double/Single) to drive conversion
  const boppLevel  = (inputs.bopp_side || inputs.bopp_type || 'Double');
  const boppFinish = inputs.bopp_finish || 'Gloss';
  const bagStyle   = inputs.bag_style   || 'Flexo Bag';
  // Back side flexo is only applicable when BOPP is included
  const backFlexo  = boppIncl && (inputs.back_flexo  || 'Yes').toLowerCase() === 'yes';
  const perforation= (inputs.perforation || 'No' ).toLowerCase() === 'yes';
  const valve      = (inputs.valve       || 'No' ).toLowerCase() === 'yes';
  const hamming    = (inputs.hamming     || 'No' ).toLowerCase() === 'yes';
  const tuber      = (inputs.tuber       || 'No' ).toLowerCase() === 'yes';
  const freight    = inputs.freight || 'Ex Factory';

  const d14 = totalWtWithoutLiner > 0 ? 1000 / totalWtWithoutLiner * totalAmtWithoutLiner : 0;
  const d15 = W < 15 ? cfg.conv_width_lt15 : W === 15 ? cfg.conv_width_eq15 : W < 18 ? cfg.conv_width_lt18 : 0;
  // Bag style conversion only applies when BOPP is NOT included (mutually exclusive)
  const d16 = boppIncl ? 0 : (bagStyle.toLowerCase().includes('plain') ? cfg.conv_plain_no_lam : cfg.conv_flexo_no_lam);
  const d17 = boppIncl ? (boppLevel === 'Double' ? cfg.conv_bopp_double : cfg.conv_bopp_single) : 0;
  const d18 = backFlexo ? cfg.conv_back_flexo : 0;
  const d19 = boppFinish === 'MAT' ? cfg.conv_mat_finish : 0;
  const d20 = metIncl ? cfg.conv_metalize_base : 0;
  const d21 = (metIncl && perforation) ? cfg.conv_metalize_window : 0;
  const d22 = valve  ? cfg.conv_valve   : 0;
  const d23 = (hamming && totalWtWithLiner > 0) ? 1000 / totalWtWithLiner * cfg.conv_hamming : 0;
  const d24 = (tuber  && totalWtWithLiner > 0)  ? 1000 / totalWtWithLiner * cfg.conv_tuber   : 0;
  const d25 = (hndlIncl && totalWtWithLiner > 0) ? 1000 / totalWtWithLiner * cfg.conv_handle_conv : 0;

  const subTotal = d14 + d15 + d16 + d17 + d18 + d19 + d20 + d21 + d22 + d23 + d24 + d25;

  // Base conversion (₹/Kg) excluding liner + freight
  const baseConvNoLiner = d15 + d16 + d17 + d18 + d19 + d20 + d21 + d22 + d23 + d24 + d25;

  // D27: Liner conversion adjustment (weighted average method)
  // Logic requested:
  // - Use baseConvNoLiner (e.g. 40 ₹/Kg on bag weight without liner)
  // - Use conv_liner_overhead as liner conversion (e.g. 20 ₹/Kg on liner weight)
  // - Effective total conversion (ex-freight) =
  //     (baseConvNoLiner * totalWtWithoutLiner + conv_liner_overhead * linerWt) / totalWtWithLiner
  // - d27 is the difference needed so that:
  //     baseConvNoLiner + d27 = effective total conversion
  let d27 = 0;
  if (linerIncl && totalWtWithLiner > 0 && linerWt > 0) {
    const convLinerPerKg = cfg.conv_liner_overhead; // liner conversion rate (₹/Kg) on liner weight
    const effectiveConv = (baseConvNoLiner * totalWtWithoutLiner + convLinerPerKg * linerWt) / totalWtWithLiner;
    d27 = effectiveConv - baseConvNoLiner;
  }

  const freightMap = {
    'for-east': cfg.freight_for_east, 'for-west': cfg.freight_for_west,
    'for-north': cfg.freight_for_north, 'for-south': cfg.freight_for_south,
    'local': cfg.freight_local, 'ex factory': cfg.freight_ex_factory,
  };
  const d28 = freightMap[freight.toLowerCase()] ?? 0;

  const convSum = d15 + d16 + d17 + d18 + d19 + d20 + d21 + d22 + d23 + d24 + d25 + d27 + d28;

  return {
    sum: convSum,
    details: {
      widthSurcharge:  +d15.toFixed(2),
      bagStyle:        +d16.toFixed(2),
      boppType:        +d17.toFixed(2),
      backFlexo:       +d18.toFixed(2),
      finish:          +d19.toFixed(2),
      metalizeBase:    +d20.toFixed(2),
      metalizeWindows: +d21.toFixed(2),
      valve:           +d22.toFixed(2),
      hamming:         +d23.toFixed(2),
      tuber:           +d24.toFixed(2),
      handleConv:      +d25.toFixed(2),
      linerConv:       +d27.toFixed(2),
      freight:         +d28.toFixed(2),
      total:           +convSum.toFixed(2),
    }
  };
}

module.exports = { calculatePrice };
