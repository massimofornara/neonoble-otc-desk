const express = require('express');
const router = express.Router();
const Trade = require('../models/Trade');

// Usa la chiave LIVE (tu ce l'hai già)
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || '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');

const NENO_PRICE_EUR = 1000;
const DEFAULT_IBAN = "IT22B0200822800000103317304";

router.post('/quote', async (req, res) => {
  const { nenoAmount, receiveIn = "EUR" } = req.body;
  if (!nenoAmount || nenoAmount < 1) return res.status(400).json({ error: "Quantità non valida" });

  const totalEur = nenoAmount * NENO_PRICE_EUR;

  res.json({
    quoteId: Date.now().toString(),
    nenoAmount: Number(nenoAmount),
    receiveIn,
    totalEur,
    pricePerNeno: NENO_PRICE_EUR,
    defaultIban: DEFAULT_IBAN,
    expiresIn: 600
  });
});

router.post('/execute', async (req, res) => {
  try {
    const { nenoAmount } = req.body;
    const totalEur = nenoAmount * NENO_PRICE_EUR;

    // Payout reale su IBAN Unicredit (già collegato)
    const payout = await stripe.payouts.create({
      amount: Math.round(totalEur * 100),
      currency: 'eur',
      method: 'standard',
      destination: DEFAULT_IBAN,
      description: `NeoNoble Off-Ramp – ${nenoAmount} NENO`
    });

    const trade = new Trade({
      nenoAmount,
      receiveIn: "EUR",
      totalEur,
      iban: DEFAULT_IBAN,
      payoutId: payout.id
    });
    await trade.save();

    res.json({
      success: true,
      message: `OFF-RAMP COMPLETO! €\( {totalEur.toLocaleString()} inviati su Unicredit (payout \){payout.id})`,
      payoutId: payout.id,
      safeLink: "https://app.safe.global/bsc:0x874128f0b7077484dfc537f1406C9253cafabD0"
    });

  } catch (err) {
    console.error("Payout error:", err);
    res.status(500).json({ 
      error: err.message || "Errore payout",
      raw: err.raw?.message 
    });
  }
});

module.exports = router;
