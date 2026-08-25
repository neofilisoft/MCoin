'use strict';
const pool = require('../db/connection');
const walletQ = require('../db/queries/wallet');
const txQ = require('../db/queries/transaction');
const escrowQ = require('../db/queries/escrow');
const walletService = require('./walletService');
const { isValidCurrency, parseAmount } = require('../utils/currency');

const DEFAULT_TIMEOUT_MS = parseInt(process.env.ESCROW_TIMEOUT_MS || '300000', 10); // 5 minutes

/**
 * Create a new escrow. Locks funds from sender immediately.
 */
async function createEscrow(senderIdentifier, receiverIdentifier, currency, amount, note = null, durationMs = DEFAULT_TIMEOUT_MS) {
  const cur = currency.toUpperCase();
  if (!isValidCurrency(cur)) throw new Error(`Invalid currency: ${currency}`);

  const amt = parseAmount(amount);
  if (!amt) throw new Error('Amount must be a positive number');

  // Resolve sender wallet
  const senderWallet = await walletService.getWalletByIdentifier(senderIdentifier);
  if (!senderWallet) throw new Error(`Sender wallet not found for "${senderIdentifier}"`);

  // Resolve receiver wallet
  let receiverWallet = await walletService.getWalletByIdentifier(receiverIdentifier);
  if (!receiverWallet) {
    if (/^\d{17,20}$/.test(String(receiverIdentifier))) {
      receiverWallet = await walletService.getOrCreateWallet(String(receiverIdentifier));
    } else {
      throw new Error(`Receiver not found for "${receiverIdentifier}"`);
    }
  }

  if (senderWallet.id === receiverWallet.id) {
    throw new Error('Cannot create an escrow to yourself');
  }

  const expiresAt = new Date(Date.now() + (durationMs || DEFAULT_TIMEOUT_MS));

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Lock funds from sender
    await walletQ.adjustBalance(conn, senderWallet.user_id || senderWallet.discord_id, cur, -amt);

    // Create escrow record
    const escrowId = await escrowQ.createEscrow(conn, {
      senderUserId: senderWallet.user_id || null,
      receiverUserId: receiverWallet.user_id || null,
      senderId: senderWallet.discord_id || `user_${senderWallet.user_id}`,
      receiverId: receiverWallet.discord_id || `user_${receiverWallet.user_id}`,
      currency: cur,
      amount: amt,
      note,
      expiresAt,
    });

    // Record lock transaction
    await txQ.insertTransaction(conn, {
      userId: senderWallet.user_id || null,
      discordId: senderWallet.discord_id || null,
      type: 'escrow_lock',
      currency: cur,
      amount: amt,
      counterpartId: receiverWallet.discord_id || null,
      counterpartUserId: receiverWallet.user_id || null,
      refId: escrowId,
      note: note ? `Escrow lock: ${note}` : 'Escrow contract locked',
    });

    await conn.commit();
    return escrowId;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/**
 * Check if actor matches the receiver.
 */
function isReceiver(escrow, actorIdentifier) {
  if (!escrow || !actorIdentifier) return false;
  const actorStr = String(actorIdentifier);
  if (escrow.receiver_user_id && String(escrow.receiver_user_id) === actorStr) return true;
  if (escrow.receiver_id && String(escrow.receiver_id) === actorStr) return true;
  return false;
}

/**
 * Check if actor matches the sender.
 */
function isSender(escrow, actorIdentifier) {
  if (!escrow || !actorIdentifier) return false;
  const actorStr = String(actorIdentifier);
  if (escrow.sender_user_id && String(escrow.sender_user_id) === actorStr) return true;
  if (escrow.sender_id && String(escrow.sender_id) === actorStr) return true;
  return false;
}

/**
 * Accept an escrow - release funds to receiver.
 */
async function acceptEscrow(escrowId, actorIdentifier) {
  const escrow = await escrowQ.getEscrow(escrowId);
  if (!escrow) throw new Error('Escrow not found');
  if (escrow.status !== 'pending') throw new Error(`Escrow is already ${escrow.status}`);
  if (!isReceiver(escrow, actorIdentifier)) throw new Error('You are not the receiver of this escrow');
  if (new Date() > new Date(escrow.expires_at)) throw new Error('Escrow has expired');

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Release to receiver
    await walletQ.adjustBalance(conn, escrow.receiver_user_id || escrow.receiver_id, escrow.currency, escrow.amount);

    // Mark escrow complete
    await escrowQ.updateEscrowStatus(conn, escrowId, 'completed');

    // Record release tx for receiver
    await txQ.insertTransaction(conn, {
      userId: escrow.receiver_user_id || null,
      discordId: escrow.receiver_id || null,
      type: 'escrow_release',
      currency: escrow.currency,
      amount: escrow.amount,
      counterpartId: escrow.sender_id || null,
      counterpartUserId: escrow.sender_user_id || null,
      refId: escrowId,
      note: 'Escrow released to receiver',
    });

    // Record for sender
    await txQ.insertTransaction(conn, {
      userId: escrow.sender_user_id || null,
      discordId: escrow.sender_id || null,
      type: 'escrow_release',
      currency: escrow.currency,
      amount: escrow.amount,
      counterpartId: escrow.receiver_id || null,
      counterpartUserId: escrow.receiver_user_id || null,
      refId: escrowId,
      note: 'Escrow completed',
    });

    await conn.commit();
    return escrowQ.getEscrow(escrowId);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/**
 * Reject an escrow - refund sender.
 */
async function rejectEscrow(escrowId, actorIdentifier) {
  const escrow = await escrowQ.getEscrow(escrowId);
  if (!escrow) throw new Error('Escrow not found');
  if (escrow.status !== 'pending') throw new Error(`Escrow is already ${escrow.status}`);
  if (!isReceiver(escrow, actorIdentifier)) throw new Error('You are not the receiver of this escrow');

  await _cancelAndRefund(escrowId, escrow, 'cancelled');
  return escrowQ.getEscrow(escrowId);
}

/**
 * Cancel an escrow by the sender - refund sender.
 */
async function cancelEscrow(escrowId, actorIdentifier) {
  const escrow = await escrowQ.getEscrow(escrowId);
  if (!escrow) throw new Error('Escrow not found');
  if (escrow.status !== 'pending') throw new Error(`Escrow is already ${escrow.status}`);
  if (!isSender(escrow, actorIdentifier)) throw new Error('You are not the sender of this escrow');

  await _cancelAndRefund(escrowId, escrow, 'cancelled');
  return escrowQ.getEscrow(escrowId);
}

/**
 * Process all expired pending escrows (called by scheduler).
 */
async function processExpiredEscrows() {
  const expired = await escrowQ.getExpiredPendingEscrows();
  for (const escrow of expired) {
    try {
      await _cancelAndRefund(escrow.id, escrow, 'timeout');
      console.log(`[Escrow] Timed out escrow #${escrow.id}, refunded ${escrow.amount} ${escrow.currency}`);
    } catch (err) {
      console.error(`[Escrow] Failed to timeout escrow #${escrow.id}:`, err);
    }
  }
}

/**
 * Internal: cancel escrow and refund sender.
 */
async function _cancelAndRefund(escrowId, escrow, status) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Refund sender
    await walletQ.adjustBalance(conn, escrow.sender_user_id || escrow.sender_id, escrow.currency, escrow.amount);

    // Update escrow status
    await escrowQ.updateEscrowStatus(conn, escrowId, status);

    // Record cancellation tx
    await txQ.insertTransaction(conn, {
      userId: escrow.sender_user_id || null,
      discordId: escrow.sender_id || null,
      type: 'escrow_cancel',
      currency: escrow.currency,
      amount: escrow.amount,
      counterpartId: escrow.receiver_id || null,
      counterpartUserId: escrow.receiver_user_id || null,
      refId: escrowId,
      note: status === 'timeout' ? 'Escrow timed out - refunded' : 'Escrow rejected or cancelled - refunded',
    });

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/**
 * Get escrow details.
 */
async function getEscrow(escrowId) {
  return escrowQ.getEscrow(escrowId);
}

/**
 * Get escrows for a user.
 */
async function getUserEscrows(userId, opts = {}) {
  return escrowQ.getUserEscrows(userId, opts);
}

module.exports = {
  createEscrow,
  acceptEscrow,
  rejectEscrow,
  cancelEscrow,
  processExpiredEscrows,
  getEscrow,
  getUserEscrows,
};
