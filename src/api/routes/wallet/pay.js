'use strict';
const express = require('express');
const walletService = require('../../../services/walletService');
const transferService = require('../../../services/transferService');
const txQ = require('../../../db/queries/transaction');
const { isValidCurrency, parseAmount } = require('../../../utils/currency');

const router = express.Router();

/**
 * POST /wallet/pay
 * Send MBC (or any currency) from one wallet address to another via external API.
 * Body: { fromAddress, toAddress, currency, amount, note? }
 */
router.post('/pay', async (req, res) => {
  const { fromAddress, toAddress, currency, amount, note } = req.body;

  if (!fromAddress || !toAddress) {
    return res.status(400).json({ error: 'fromAddress and toAddress are required' });
  }
  if (!currency || !isValidCurrency(currency)) {
    return res.status(400).json({ error: 'Invalid or missing currency' });
  }
  const parsedAmount = parseAmount(amount);
  if (!parsedAmount) {
    return res.status(400).json({ error: 'Invalid or missing amount' });
  }

  try {
    const fromWallet = await walletService.getWalletByAddress(fromAddress);
    if (!fromWallet) return res.status(404).json({ error: 'Sender wallet not found' });

    const toWallet = await walletService.getWalletByAddress(toAddress);
    if (!toWallet) return res.status(404).json({ error: 'Recipient wallet not found' });

    if (fromWallet.discord_id === toWallet.discord_id) {
      return res.status(400).json({ error: 'Cannot send to yourself' });
    }

    const txid = await transferService.transfer(
      fromWallet.discord_id,
      toWallet.discord_id,
      currency,
      parsedAmount,
      note || 'External wallet transfer'
    );

    res.json({
      success: true,
      txid,
      from: fromAddress,
      to: toAddress,
      currency: currency.toUpperCase(),
      amount: parsedAmount,
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * GET /wallet/tx/:txid
 * Look up a transaction by its txid.
 */
router.get('/tx/:txid', async (req, res) => {
  try {
    const tx = await txQ.getTransaction(req.params.txid);
    if (!tx) return res.status(404).json({ error: 'Transaction not found' });
    res.json({ transaction: tx });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
