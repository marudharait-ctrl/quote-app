const express = require('express');
const { calculatePrice } = require('../utils/pricing');
const router = express.Router();

// WhatsApp Quote API - Simple endpoint for external integration
// POST /api/whatsapp/quote
// Body: { bagType, width, height, quantity, gsm, customerName, customerPhone }
router.post('/quote', (req, res) => {
  try {
    const { bagType, width, height, quantity, gsm, customerName, customerPhone } = req.body;
    
    // Validate required fields
    if (!width || !height || !quantity) {
      return res.status(400).json({ 
        error: 'Missing required fields: width, height, quantity' 
      });
    }

    // Build inputs for pricing calculation
    const inputs = {
      width_value: parseFloat(width),
      width_unit: 'CM',
      length_value: parseFloat(height),
      length_unit: 'CM',
      fabric_gsm: parseFloat(gsm) || 120,
      fabric_type: 'GSM',
      filler_pct: 0,
      lamination_included: 'No',
      lamination_side: 'Single',
      lamination_gsm: 0,
      bopp_included: 'No',
      bopp_side: 'Single',
      bopp_micron: 0,
      bopp_type: 'Transparent',
      bopp_finish: 'Glossy',
      metalize_included: 'No',
      metalize_side: 'Single',
      metalize_micron: 0,
      handle_included: 'No',
      liner_included: 'No',
      liner_width: parseFloat(width),
      liner_length: parseFloat(height),
      liner_thickness: 0,
      liner_thickness_unit: 'GSM',
      bag_style: 'Standard',
      back_flexo: 'No',
      bopp_with_white: 'No',
      perforation: 'No',
      valve: 'No',
      hamming: 'No',
      tuber: 'No',
      ink_gsm: 0,
      freight: 0,
      pricing_type: 'standard',
      discount_pct: 0,
      customer_name: customerName || 'WhatsApp Customer',
      customer_email: '',
      customer_company: '',
      notes: `WhatsApp inquiry from ${customerPhone || 'unknown'}. Bag type: ${bagType || 'Standard'}`
    };

    // Calculate price
    const result = calculatePrice(inputs);
    
    // Format response
    const response = {
      success: true,
      quote: {
        customer: customerName || 'WhatsApp Customer',
        bagDetails: {
          type: bagType || 'PP Woven Bag',
          dimensions: `${width}cm x ${height}cm`,
          gsm: gsm || 120,
          quantity: parseInt(quantity)
        },
        pricing: {
          pricePerBag: result.finalRatePerBag.toFixed(2),
          pricePerKg: result.finalRatePerKg.toFixed(2),
          totalWeight: (result.totalWtWithLiner * parseInt(quantity) / 1000).toFixed(2) + ' kg',
          estimatedTotal: (result.finalRatePerBag * parseInt(quantity)).toFixed(2)
        },
        breakdown: {
          fabricWeight: result.fabricWt.toFixed(2) + ' gm',
          totalWeightPerBag: result.totalWtWithLiner.toFixed(2) + ' gm',
          rawMaterialCost: result.rmPricePerBag.toFixed(2)
        }
      }
    };

    res.json(response);
  } catch (e) {
    console.error('WhatsApp quote error:', e);
    res.status(500).json({ 
      error: 'Failed to calculate quote: ' + e.message 
    });
  }
});

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'whatsapp-quote-api' });
});

module.exports = router;
