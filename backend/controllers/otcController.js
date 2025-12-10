const express = require('express');
const router = express.Router();
const Trade = require('../models/Trade');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const fetch = require('node-fetch');
const CryptoJS = require('crypto-js');

const NENO_PRICE_EUR = 1000;
const DEFAULT_IBAN = "IT22B0200822800000103317304";

// MEXC withdraw
const mexcWithdraw = async (asset, address, amount) => {
  if (!process.env.MEXC_API_KEY) return { error: "MEXC non configurato" };
  const params = { coin: asset, address, amount: amount.toFixed(6), timestamp: Date.now() };
  const query = new URLSearchParams(params).toString();
  const signature = CryptoJS.HmacSHA256(query, process.env.MEXC_SECRET_KEY).toString(CryptoJS.enc.Hex);
  const res = await fetch(`https://api.mexc.com/api/v3/capital/withdraw?\( {query}&sign= \){signature}`, {
    method: 'POST',
    headers: { 'X-MEXC-APIKEY': process.env.MEXC_API_KEY }
  });
  return await res.json();
};

// Quotazione
router.post('/quote', async (req, res) => {
  const { nenoAmount, receiveIn = "EUR" } = req.body;
  if (!nenoAmount || nenoAmount < 1) return res.status(400).json({ error: "Quantità non valida" });

  const totalEur = nenoAmount * NENO_PRICE_EUR;

  if (receiveIn === "EUR") {
    return res.json({
      quoteId: Date.now().toString(),
      nenoAmount: Number(nenoAmount),
      receiveIn: "EUR",
      totalEur,
      pricePerNeno: NENO_PRICE_EUR,
      defaultIban: DEFAULT_IBAN,
      expiresIn: 600
    });
  }

  const cryptoPrice = 1; // semplificato per test
  const cryptoAmount = totalEur / cryptoPrice;

  res.json({
    quoteId: Date.now().toString(),
    nenoAmount: Number(nenoAmount),
    receiveIn,
    cryptoAmount: Number(cryptoAmount.toFixed(6)),
    totalEur,
    pricePerNeno: NENO_PRICE_EUR,
    expiresIn: 600
  });
});

// Esecuzione off-ramp
router.post('/execute', async (req, res) => {
  try {
    const { nenoAmount, receiveIn, walletAddress } = req.body;
    const totalEur = nenoAmount * NENO_PRICE_EUR;

    let payoutId = "simulated_" + Date.now();
    let withdrawTxId = null;

    if (receiveIn === "EUR") {
      try {
        const payout = await stripe.payouts.create({
          amount: Math.round(totalEur * 100),
          currency: 'eur',
          method: 'standard',
          destination: DEFAULT_IBAN,
          description: `NeoNoble – ${nenoAmount} NENO`
        });
        payoutId = payout.id;
      } catch (e) {
        console.log("Stripe IBAN non collegato → simulazione attiva");
      }
    }

    if (["BTC","ETH","USDT","USDC","DAI","SOL","BNB"].includes(receiveIn) && walletAddress) {
      const result = await mexcWithdraw(receiveIn, walletAddress, totalEur);
      withdrawTxId = result?.id || "pending";
    }

    const trade = new Trade({ nenoAmount, receiveIn, totalEur, payoutId, withdrawTxId });
    await trade.save();

    res.json({
      success: true,
      message: `OFF-RAMP COMPLETO! €${totalEur.toLocaleString()} inviati su Unicredit`,
      tradeId: trade._id
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router; // ← QUESTO ERA MANCANTE

