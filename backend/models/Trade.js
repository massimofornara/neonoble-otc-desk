const mongoose = require('mongoose');

const tradeSchema = new mongoose.Schema({
  quoteId: String,
  nenoAmount: Number,
  receiveIn: String,
  totalEur: Number,
  iban: String,
  walletAddress: String,
  status: { type: String, default: 'completed' },
  payoutId: String,
  withdrawTxId: String,
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Trade', tradeSchema);
