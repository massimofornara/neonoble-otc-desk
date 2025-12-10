const express = require('express');
const router = express.Router();
const Trade = require('../models/Trade');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY); // ← chiave live presa da .env
const fetch = require('node-fetch');
const CryptoJS = require('crypto-js');

const NENO_PRICE_EUR = 1000;
const DEFAULT_IBAN = "IT22B0200822800000103317304";
const SAFE_ADDRESS = process.env.SAFE_ADDRESS;

// MEXC withdraw automatico
const mexcWithdraw = async (coin, address, amount) => {
  const params = { coin, address, amount: amount.toFixed(6), timestamp: Date.now() };
  const query = new URLSearchParams(params).toString();
  const signature = CryptoJS.HmacSHA256(query, process.env.MEXC_SECRET_KEY).toString(CryptoJS.enc.Hex);
  const res = await fetch(`https://api.mexc.com/api/v3/capital/withdraw?\( {query}&sign= \){signature}`, {
    method: 'POST',
    headers: { 'X-MEXC-APIKEY': process.env.MEXC_API_KEY }
  });
  return await res.json();
};

router.post('/quote', async (req, res) => {
  const { nenoAmount, receiveIn = "EUR" } = req.body;
  if (!nenoAmount || nenoAmount < 1) return res.status(400).json({ error: "Quantità non valida" });

  const totalEur = nenoAmount * NENO_PRICE_EUR;

  if (receiveIn === "EUR") {
    return res.json({
      quoteId: Date.now().toString(),
      nenoAmount,
      receiveIn: "EUR",
      totalEur,
      pricePerNeno: NENO_PRICE_EUR,
      defaultIban: DEFAULT_IBAN,
      expiresIn: 600
    });
  }

  // Crypto on-ramp (prezzo live)
  const price = await (await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${{BTC:"bitcoin",ETH:"ethereum",BNB:"binancecoin",USDT:"tether",USDC:"usd-coin",DAI:"dai",SOL:"solana"}[receiveIn]}&vs_currencies=eur`)).json();
  const cryptoAmount = totalEur / (price[Object.keys(price)[0]]?.eur || 1);

  res.json({
    quoteId: Date.now().toString(),
    nenoAmount,
    receiveIn,
    cryptoAmount: Number(cryptoAmount.toFixed(8)),
    totalEur,
    pricePerNeno: NENO_PRICE_EUR,
    expiresIn: 600
  });
});

router.post('/execute', async (req, res) => {
  try {
    const { nenoAmount, receiveIn = "EUR", iban = DEFAULT_IBAN, walletAddress } = req.body;
    const totalEur = nenoAmount * NENO_PRICE_EUR;

    let payoutId = null;
    let withdrawId = null;

    // OFF-RAMP FIAT → Unicredit
    if (receiveIn === "EUR") {
      const payout = await stripe.payouts.create({
        amount: Math.round(totalEur * 100),
        currency: 'eur',
        method: 'standard',
        destination: iban,
        description: `NeoNoble Off-Ramp – ${nenoAmount} NENO`
      });
      payoutId = payout.id;
    }

    // ON-RAMP CRYPTO → MEXC
    if (["BTC","ETH","BNB","USDT","USDC","DAI","SOL"].includes(receiveIn) && walletAddress) {
      const cryptoAmount = totalEur / await (await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${{BTC:"bitcoin",ETH:"ethereum",BNB:"binancecoin",USDT:"tether",USDC:"usd-coin",DAI:"dai",SOL:"solana"}[receiveIn]}&vs_currencies=eur`)).json()[Object.keys(...)[0]]?.eur || 1;
      const result = await mexcWithdraw(receiveIn, walletAddress, cryptoAmount);
      withdrawId = result.id || "pending";
    }

    const trade = new Trade({ nenoAmount, receiveIn, totalEur, iban, walletAddress, payoutId, withdrawId });
    await trade.save();

    res.json({
      success: true,
      message: `OFF/ON-RAMP COMPLETO! \( {receiveIn==="EUR"?`€ \){totalEur.toLocaleString()} inviati su Unicredit`:`\( {cryptoAmount.toFixed(6)} \){receiveIn} inviati`}`,
      safeLink: `https://app.safe.global/bsc:${SAFE_ADDRESS}`,
      instruction: "Rilascia NENO dal Safe con 2 firme",
      tradeId: trade._id
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

