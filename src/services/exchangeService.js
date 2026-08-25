'use strict';
const pool = require('../db/connection');
const walletQ = require('../db/queries/wallet');
const txQ = require('../db/queries/transaction');
const { getRates, convert } = require('./rateService');
const walletService = require('./walletService');
const { isValidCurrency, parseAmount } = require('../utils/currency');

/**
 * Exchange one currency for another within a user's wallet.
 * Target can be userId, username, email, wallet_address, or discord_id.
 */
async function exchange(userIdentifier, fromCurrency, toCurrency, fromAmount) {
  const from = fromCurrency.toUpperCase();
  const to = toCurrency.toUpperCase();

  if (!isValidCurrency(from)) throw new Error(`Invalid source currency: ${fromCurrency}`);
  if (!isValidCurrency(to)) throw new Error(`Invalid destination currency: ${toCurrency}`);
  if (from === to) throw new Error('Cannot exchange a currency for itself');

  const amt = parseAmount(fromAmount);
  if (!amt) throw new Error('Amount must be a positive number');

  const wallet = await walletService.getWalletByIdentifier(userIdentifier);
  if (!wallet) throw new Error(`Wallet not found for "${userIdentifier}"`);

  const rates = await getRates();
  const { toAmount, rate } = convert(amt, from, to, rates);

  if (toAmount <= 0) throw new Error('Conversion result is too small');

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Deduct from source currency (throws if insufficient)
    await walletQ.adjustBalance(conn, wallet.user_id || wallet.discord_id, from, -amt);

    // Credit destination currency
    await walletQ.adjustBalance(conn, wallet.user_id || wallet.discord_id, to, toAmount);

    // Record exchange transaction
    const txid = await txQ.insertTransaction(conn, {
      userId: wallet.user_id || null,
      discordId: wallet.discord_id || null,
      type: 'exchange',
      currency: to,
      amount: toAmount,
      fromCurrency: from,
      fromAmount: amt,
      rate,
      note: `Swap ${amt} ${from} -> ${toAmount.toFixed(4)} ${to}`,
    });

    await conn.commit();
    return { txid, toAmount, rate, fromAmount: amt, fromCurrency: from, toCurrency: to };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = { exchange };
