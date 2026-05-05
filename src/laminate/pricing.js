function normalizeMaterialFields(materials = [], structure = {}) {
  const petMic = Number(structure.petMic || 0);
  const polyMic = Number(structure.polyMic || 0);
  const metPetMic = Number(structure.metPet || 0);
  const alFoilMic = Number(structure.alFoil || 0);

  return materials.map((mat) => {
    const name = String(mat.name || '').toLowerCase();
    const density = Number(mat.density || 0);
    let gsm = Number(mat.gsm || 0);

    if (name.includes('polyester')) gsm = petMic * density;
    else if (name.includes('transparent poly')) gsm = polyMic * density;
    else if (name.includes('met pet')) gsm = metPetMic * density;
    else if (name.includes('al foil')) gsm = alFoilMic * density;
    else if (name === 'ink') gsm = mat.inkOptions?.whiteCoating ? 1.6 : 1;

    return { ...mat, gsm: round(gsm, 4), density: round(density, 4) };
  });
}

function calculatePricing(inputs) {
  const {
    width,
    height,
    gussette,
    materials,
    structure,
    contributionRollShape,
    contributionPouching,
    freightPerKg,
    pouchingWastage,
    hasPouchingProcess,
  } = inputs;

  const normalizedMaterials = normalizeMaterialFields(materials, structure);
  const areaM2 = ((width * height * 2) + (width * gussette * 2)) / 1e6;
  const totalGSM = normalizedMaterials.filter(m => m.active).reduce((sum, m) => sum + Number(m.gsm || 0), 0);
  const weightPerPouch = areaM2 * totalGSM;
  const yieldPerKg = weightPerPouch > 0 ? (1000 / weightPerPouch) : 0;

  const materialRowsFinal = normalizedMaterials.map(mat => {
    if (!mat.active) return { ...mat, costPerKg: 0, costPer1000pcs: 0 };
    const gsm = Number(mat.gsm) || 0;
    const baseRatePerKg = Number(mat.ratePerKg) || 0;
    const wastage = Number(mat.wastage) || 0;
    const polyOptions = mat.polyOptions || {};
    const isTransparentPoly = String(mat.name || '').toLowerCase().includes('transparent poly');
    let adjustedRatePerKg = baseRatePerKg;

    if (isTransparentPoly) {
      if (polyOptions.milky) adjustedRatePerKg += 5;
      if (polyOptions.metallocene) {
        adjustedRatePerKg += (Number(polyOptions.metallocenePct || 0) / 10) * 2;
      }
    }

    const gsmShare = totalGSM > 0 ? (gsm / totalGSM) : 0;
    const costPerKg = gsmShare * adjustedRatePerKg * (1 + wastage);
    const costPer1000pcs = yieldPerKg > 0 ? (costPerKg / yieldPerKg) * 1000 : 0;
    return {
      ...mat,
      adjustedRatePerKg: round(adjustedRatePerKg, 4),
      gsmShare: round(gsmShare, 6),
      costPerKg: round(costPerKg, 4),
      costPer1000pcs: round(costPer1000pcs, 4)
    };
  });

  const totalCostPerKg = materialRowsFinal.reduce((s, m) => s + m.costPerKg, 0);
  const totalCostPer1000 = materialRowsFinal.reduce((s, m) => s + m.costPer1000pcs, 0);
  const pouchingWastagePerKg = hasPouchingProcess ? round(totalCostPerKg * pouchingWastage, 6) : 0;
  const pouchingWastagePer1000 = hasPouchingProcess ? round(totalCostPer1000 * pouchingWastage, 6) : 0;
  const subTotalRMCostPerKg = round(totalCostPerKg + pouchingWastagePerKg, 6);
  const subTotalRMCost1000 = round(totalCostPer1000 + pouchingWastagePer1000, 6);

  const contribRollPerKg = Number(contributionRollShape);
  const contribRollPer1000 = yieldPerKg > 0 ? round((contribRollPerKg / yieldPerKg) * 1000, 4) : 0;
  const contribPouchPerKg = Number(contributionPouching);
  const contribPouchPer1000 = yieldPerKg > 0 ? round((contribPouchPerKg / yieldPerKg) * 1000, 4) : 0;
  const freightPerKgVal = Number(freightPerKg);
  const freightPer1000 = yieldPerKg > 0 ? round((freightPerKgVal / yieldPerKg) * 1000, 4) : 0;
  const sspPerKg = round(subTotalRMCostPerKg + contribRollPerKg + contribPouchPerKg + freightPerKgVal, 4);
  const sspPer1000 = round(subTotalRMCost1000 + contribRollPer1000 + contribPouchPer1000 + freightPer1000, 4);
  const netContribPerKg = round(contribRollPerKg + contribPouchPerKg, 4);
  const netContribPer1000 = round(contribRollPer1000 + contribPouchPer1000, 4);
  const sspPerPouch = weightPerPouch > 0 ? round(sspPerKg / (1000 / weightPerPouch), 6) : 0;

  return {
    geometry: {
      areaM2: round(areaM2, 8),
      weightPerPouch: round(weightPerPouch, 5),
      yieldPerKg: round(yieldPerKg, 4),
      totalGSM: round(totalGSM, 4),
    },
    materials: materialRowsFinal,
    totals: {
      totalCostPerKg: round(totalCostPerKg, 4),
      totalCostPer1000: round(totalCostPer1000, 4),
      pouchingWastagePerKg,
      pouchingWastagePer1000,
      subTotalRMCostPerKg,
      subTotalRMCost1000,
    },
    pricing: {
      contributionRollShape: { perKg: contribRollPerKg, per1000: contribRollPer1000 },
      contributionPouching: { perKg: contribPouchPerKg, per1000: contribPouchPer1000 },
      freight: { perKg: freightPerKgVal, per1000: freightPer1000 },
      sspPerKg,
      sspPer1000,
      netContribPerKg,
      netContribPer1000,
      sspPerPouch,
    },
  };
}

function round(val, decimals) {
  const factor = Math.pow(10, decimals);
  return Math.round(val * factor) / factor;
}

module.exports = { calculatePricing, normalizeMaterialFields };
