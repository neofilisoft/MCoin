'use strict';
const pool = require('../db/connection');
const requestQ = require('../db/queries/request');
const walletQ = require('../db/queries/wallet');
const txQ = require('../db/queries/transaction');
const userQ = require('../db/queries/user');
const { isValidCurrency, parseAmount } = require('../utils/currency');

/**
 * Create a new payment request.
 */
async function createRequest(requesterUserId, targetQuery, currency, amount, note = null) {
  const cur = currency.toUpperCase();
  if (!isValidCurrency(cur)) throw new Error(`Invalid currency: ${currency}`);

  const amt = parseAmount(amount);
  if (!amt) throw new Error('Amount must be a positive number');

  const targetUser = await userQ.findUserByQuery(targetQuery);
  if (!targetUser) throw new Error(`Target user not found for "${targetQuery}"`);

  if (targetUser.id === requesterUserId) {
    throw new Error('Cannot request payment from yourself');
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const requestId = await requestQ.createPaymentRequest(conn, {
      requesterUserId,
      targetUserId: targetUser.id,
      currency: cur,
      amount: amt,
      note,
    });

    await conn.commit();
    return requestQ.getPaymentRequest(requestId);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/**
 * Pay / fulfill a pending payment request.
 */
async function payRequest(requestId, payerUserId) {
  const request = await requestQ.getPaymentRequest(requestId);
  if (!request) throw new Error('Payment request not found');

  if (request.target_user_id !== payerUserId) {
    throw new Error('You are not authorized to pay this request');
  }

  if (request.status !== 'pending') {
    throw new Error(`This payment request is already ${request.status}`);
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // 1. Deduct from payer
    await walletQ.adjustBalance(conn, payerUserId, request.currency, -request.amount);

    // 2. Credit requester
    await walletQ.adjustBalance(conn, request.requester_user_id, request.currency, request.amount);

    // 3. Mark request as paid
    await requestQ.updatePaymentRequestStatus(conn, requestId, 'paid');

    // 4. Record outgoing transaction for payer
    const txidOut = await txQ.insertTransaction(conn, {
      userId: payerUserId,
      discordId: request.target_discord_id || null,
      type: 'transfer_out',
      currency: request.currency,
      amount: request.amount,
      counterpartUserId: request.requester_user_id,
      refId: requestId,
      note: request.note ? `Paid request: ${request.note}` : 'Paid payment request',
    });

    // 5. Record incoming transaction for requester
    await txQ.insertTransaction(conn, {
      userId: request.requester_user_id,
      discordId: request.requester_discord_id || null,
      type: 'transfer_in',
      currency: request.currency,
      amount: request.amount,
      counterpartUserId: payerUserId,
      refId: requestId,
      note: request.note ? `Received payment for request: ${request.note}` : 'Payment request fulfilled',
    });

    await conn.commit();
    return { success: true, txid: txidOut, request: await requestQ.getPaymentRequest(requestId) };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/**
 * Decline a payment request.
 */
async function declineRequest(requestId, targetUserId) {
  const request = await requestQ.getPaymentRequest(requestId);
  if (!request) throw new Error('Payment request not found');

  if (request.target_user_id !== targetUserId) {
    throw new Error('You are not authorized to decline this request');
  }

  if (request.status !== 'pending') {
    throw new Error(`Request is already ${request.status}`);
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await requestQ.updatePaymentRequestStatus(conn, requestId, 'declined');
    await conn.commit();
    return requestQ.getPaymentRequest(requestId);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/**
 * Cancel a payment request by the requester.
 */
async function cancelRequest(requestId, requesterUserId) {
  const request = await requestQ.getPaymentRequest(requestId);
  if (!request) throw new Error('Payment request not found');

  if (request.requester_user_id !== requesterUserId) {
    throw new Error('You are not authorized to cancel this request');
  }

  if (request.status !== 'pending') {
    throw new Error(`Request is already ${request.status}`);
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await requestQ.updatePaymentRequestStatus(conn, requestId, 'cancelled');
    await conn.commit();
    return requestQ.getPaymentRequest(requestId);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/**
 * Get all requests for a user.
 */
async function getUserRequests(userId, opts = {}) {
  return requestQ.getUserPaymentRequests(userId, opts);
}

/**
 * Get request by ID.
 */
async function getRequest(requestId) {
  return requestQ.getPaymentRequest(requestId);
}

module.exports = {
  createRequest,
  payRequest,
  declineRequest,
  cancelRequest,
  getUserRequests,
  getRequest,
};
