const express = require('express');
const router = express.Router();
const Trade = require('../models/Trade');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const NENO_PRICE_EUR = 1000;
const DEFAULT_IBAN = "IT22B0200822800000103317304";
const STRIPE_IBAN_ID = "ba_1QEXAMPLE1234567890"; // ← verrà creato automaticamente se manca

// Crea o recupera l'account bancario Unicredit
async function getOrCreateBankAccount() {
  try {
    return await stripe.accounts.externalAccounts.retrieve(STRIPE_IBAN_ID);
  } catch (err) {
    // Se non esiste, crealo
    const bankAccount = await stripe.accounts.externalAccounts.create({
      external_account: {
        object: "bank_account",
        country: "IT",
        currency: "eur",
        account_holder_name: "Massimo Fornara",
        account_holder_type: "individual",
        routing_number: "02008", // Unicredit
        account_number: "22800000103317304"
      },
      metadata: { purpose: "NeoNoble OTC Desk" }
    });
    console.log("IBAN Unicredit creato su Stripe:", bankAccount.id);
    return bankAccount;
  }
}

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
    const { nenoAmount, receiveIn = "EUR" } = req.body;
    const totalEur = nenoAmount * NENO_PRICE_EUR;

    let payoutId = null;

    if (receiveIn === "EUR") {
      const bankAccount = await getOrCreateBankAccount();

      const payout = await stripe.payouts.create({
        amount: Math.round(totalEur * 100),
        currency: 'eur',
        method: 'standard',
        destination: bankAccount.id,
        description: `NeoNoble Off-Ramp – ${nenoAmount} NENO`
      });

      payoutId = payout.id;
    }

    const trade = new Trade({
      nenoAmount,
      receiveIn,
      totalEur,
      payoutId
    });
    await trade.save();

    res.json({
      success: true,
      message: `OFF-RAMP COMPLETO! €${totalEur.toLocaleString()} inviati su Unicredit`,
      payoutId,
      tradeId: trade._id
    });

  } catch (err) {
    console.error("Errore payout:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
