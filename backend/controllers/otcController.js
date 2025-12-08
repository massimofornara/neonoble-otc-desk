const Trade = require('../models/Trade');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const fetch = require('node-fetch');
const CryptoJS = require('crypto-js');
const { ethers } = require('ethers');

const provider = new ethers.JsonRpcProvider(process.env.BSC_RPC_URL);
const NENO_ABI = ["function transfer(address to, uint256 amount) returns (bool)"];
const NENO_CONTRACT = new ethers.Contract(process.env.NENO_CONTRACT, NENO_ABI, provider);

const NENO_PRICE_EUR = 1000;
const SAFE_ADDRESS = process.env.SAFE_ADDRESS;
const DEFAULT_IBAN = process.env.DEFAULT_IBAN;
const MEXC_API_KEY = process.env.MEXC_API_KEY;
const MEXC_SECRET_KEY = process.env.MEXC_SECRET_KEY;
const MEXC_BASE_URL = 'https://api.mexc.com/api/v3';

async function mexcWithdraw(asset, address, amount) {
  const params = {
    coin: asset,
    address,
    amount: amount.toString(),
    timestamp: Date.now()
  };
  const query = new URLSearchParams(params).toString();
  const signature = CryptoJS.HmacSHA256(query, MEXC_SECRET_KEY).toString(CryptoJS.enc.Hex);
  const res = await fetch(`\( {MEXC_BASE_URL}/capital/withdraw? \){query}&sign=${signature}`, {
    method: 'POST',
    headers: { 'X-MEXC-APIKEY': MEXC_API_KEY }
  });
  return await res.json();
}

const getCryptoPriceEur = async (crypto) => {
  const map = {
    BTC: "bitcoin", ETH: "ethereum", BNB: "binancecoin",
    USDT: "tether", USDC: "usd-coin", DAI: "dai", SOL: "solana"
  };
  const id = map[crypto] || "tether";
  const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=eur`);
  const data = await res.json();
  return data[id]?.eur || 1;
};

exports.getQuote = async (req, res) => {
  try {
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
        expiresIn: 600,
        defaultIban: DEFAULT_IBAN
      });
    }

    const cryptoPrice = await getCryptoPriceEur(receiveIn);
    const cryptoAmount = totalEur / cryptoPrice;

    res.json({
      quoteId: Date.now().toString(),
      nenoAmount: Number(nenoAmount),
      receiveIn,
      cryptoAmount: Number(cryptoAmount.toFixed(8)),
      totalEur,
      pricePerNeno: NENO_PRICE_EUR,
      expiresIn: 600
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.executeOffRamp = async (req, res) => {
  try {
    const { quoteId, nenoAmount, receiveIn, iban = DEFAULT_IBAN, walletAddress } = req.body;
    const totalEur = nenoAmount * NENO_PRICE_EUR;

    let payoutId = null, withdrawTxId = null;

    // Fiat off-ramp su IBAN Unicredit
    if (receiveIn === "EUR") {
      const payout = await stripe.payouts.create({
        amount: Math.round(totalEur * 100),
        currency: 'eur',
        method: 'standard',
        destination: iban,
        description: `NeoNoble Off-Ramp – ${nenoAmount} NENO (€1000/unit)`
      });
      payoutId = payout.id;
    } else if (walletAddress && ["BTC","ETH","BNB","USDT","USDC","DAI","SOL"].includes(receiveIn)) {
      // Crypto off-ramp automatico con MEXC withdraw
      const cryptoAmount = totalEur / await getCryptoPriceEur(receiveIn);
      const withdrawRes = await mexcWithdraw(receiveIn, walletAddress, cryptoAmount);
      withdrawTxId = withdrawRes?.id || 'pending';
    }

    const trade = new Trade({
      quoteId,
      nenoAmount,
      receiveIn,
      totalEur,
      iban,
      walletAddress,
      payoutId,
      withdrawTxId
    });
    await trade.save();

    res.json({
      success: true,
      message: `Off-ramp eseguito! €\( {totalEur.toLocaleString()} inviati su \){iban || walletAddress}.`,
      safeLink: `https://app.safe.global/bsc:${SAFE_ADDRESS}`,
      instruction: "Rilascia NENO manualmente dal Safe con 2 firme.",
      tradeId: trade._id
    });

  } catch (err) {
    console.error("Errore off-ramp:", err);
    res.status(500).json({ error: err.message });
  }
};
