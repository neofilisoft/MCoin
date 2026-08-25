'use strict';
const pool = require('../db/connection');
const walletQ = require('../db/queries/wallet');
const userQ = require('../db/queries/user');
const txQ = require('../db/queries/transaction');
const walletService = require('./walletService');
const { isValidCurrency, parseAmount } = require('../utils/currency');

/**
 * Execute a P2P transfer between two users.
 * Sender and receiver can be userId, username, email, wallet_address, or discord_id.
 */
async function transfer(senderIdentifier, receiverIdentifier, currency, amount, note = null) {
  const cur = currency.toUpperCase();
  if (!isValidCurrency(cur)) throw new Error(`Invalid currency: ${currency}`);

  const amt = parseAmount(amount);
  if (!amt) throw new Error('Amount must be a positive number');

  // Resolve sender wallet
  const senderWallet = await walletService.getWalletByIdentifier(senderIdentifier);
  if (!senderWallet) {
    throw new Error(`Sender wallet not found for "${senderIdentifier}"`);
  }

  // Resolve receiver wallet
  let receiverWallet = await walletService.getWalletByIdentifier(receiverIdentifier);
  if (!receiverWallet) {
    // If receiver is a discordId, auto-provision
    if (/^\d{17,20}$/.test(String(receiverIdentifier))) {
      receiverWallet = await walletService.getOrCreateWallet(String(receiverIdentifier));
    } else {
      throw new Error(`Recipient not found for "${receiverIdentifier}"`);
    }
  }

  if (senderWallet.id === receiverWallet.id) {
    throw new Error('Cannot transfer to yourself');
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Deduct from sender (throws if insufficient balance)
    await walletQ.adjustBalance(conn, senderWallet.user_id || senderWallet.discord_id, cur, -amt);

    // Credit receiver
    await walletQ.adjustBalance(conn, receiverWallet.user_id || receiverWallet.discord_id, cur, amt);

    // Record sender tx
    const txidOut = await txQ.insertTransaction(conn, {
      userId: senderWallet.user_id || null,
      discordId: senderWallet.discord_id || null,
      type: 'transfer_out',
      currency: cur,
      amount: amt,
      counterpartId: receiverWallet.discord_id || null,
      counterpartUserId: receiverWallet.user_id || null,
      note,
    });

    // Record receiver tx
    await txQ.insertTransaction(conn, {
      userId: receiverWallet.user_id || null,
      discordId: receiverWallet.discord_id || null,
      type: 'transfer_in',
      currency: cur,
      amount: amt,
      counterpartId: senderWallet.discord_id || null,
      counterpartUserId: senderWallet.user_id || null,
      note,
    });

    await conn.commit();
    return txidOut;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = { transfer };
