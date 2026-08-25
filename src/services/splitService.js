'use strict';
const pool = require('../db/connection');
const walletQ = require('../db/queries/wallet');
const userQ = require('../db/queries/user');
const txQ = require('../db/queries/transaction');
const walletService = require('./walletService');
const { isValidCurrency, parseAmount } = require('../utils/currency');

/**
 * Create a split bill session.
 * Supports memberIdentifiers as array of userIds, usernames, emails, or discordIds.
 */
async function createSplitBill(initiatorIdentifier, memberIdentifiers, currency, totalAmount, description = null, shares = null) {
  const cur = currency.toUpperCase();
  if (!isValidCurrency(cur)) throw new Error(`Invalid currency: ${currency}`);

  const total = parseAmount(totalAmount);
  if (!total) throw new Error('Total amount must be a positive number');

  // Resolve initiator wallet
  const initiatorWallet = await walletService.getWalletByIdentifier(initiatorIdentifier);
  if (!initiatorWallet) throw new Error(`Initiator wallet not found for "${initiatorIdentifier}"`);

  // Resolve all member wallets
  const resolvedMembers = [];
  const rawList = Array.isArray(memberIdentifiers) ? memberIdentifiers : [memberIdentifiers];
  const uniqueIdentifiers = [...new Set([initiatorIdentifier, ...rawList])];

  for (const iden of uniqueIdentifiers) {
    let w = await walletService.getWalletByIdentifier(iden);
    if (!w && /^\d{17,20}$/.test(String(iden))) {
      w = await walletService.getOrCreateWallet(String(iden));
    }
    if (w && !resolvedMembers.some((m) => m.id === w.id)) {
      resolvedMembers.push(w);
    }
  }

  if (resolvedMembers.length < 2) {
    throw new Error('Need at least 2 distinct members to split a bill');
  }

  // Calculate shares
  let memberShares = [];
  if (shares && Array.isArray(shares) && shares.length === resolvedMembers.length) {
    const shareSum = shares.reduce((a, b) => a + parseFloat(b), 0);
    if (Math.abs(shareSum - total) > 0.001) throw new Error('Sum of shares must equal total amount');
    memberShares = resolvedMembers.map((w, i) => ({ wallet: w, share: parseFloat(parseFloat(shares[i]).toFixed(8)) }));
  } else {
    // Even split
    const perPerson = parseFloat((total / resolvedMembers.length).toFixed(8));
    const remainder = parseFloat((total - perPerson * resolvedMembers.length).toFixed(8));
    memberShares = resolvedMembers.map((w) => ({ wallet: w, share: perPerson }));
    // Add remainder to initiator
    const initIdx = memberShares.findIndex((m) => m.wallet.id === initiatorWallet.id);
    if (initIdx >= 0) {
      memberShares[initIdx].share = parseFloat((memberShares[initIdx].share + remainder).toFixed(8));
    } else {
      memberShares[0].share = parseFloat((memberShares[0].share + remainder).toFixed(8));
    }
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // 1. Insert split_bills row
    const [billResult] = await conn.query(
      `INSERT INTO split_bills (initiator_user_id, initiator_id, currency, total_amount, description, status)
       VALUES (?, ?, ?, ?, ?, 'completed')`,
      [
        initiatorWallet.user_id || null,
        initiatorWallet.discord_id || `user_${initiatorWallet.user_id}`,
        cur,
        total.toFixed(8),
        description || null,
      ]
    );
    const splitId = billResult.insertId;

    let collected = 0;

    // 2. Process each member
    for (const m of memberShares) {
      const isInitiator = m.wallet.id === initiatorWallet.id;

      await conn.query(
        `INSERT INTO split_bill_members (split_id, user_id, discord_id, share_amount, paid, paid_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          splitId,
          m.wallet.user_id || null,
          m.wallet.discord_id || `user_${m.wallet.user_id}`,
          m.share.toFixed(8),
          1, // Settled immediately
          new Date(),
        ]
      );

      if (!isInitiator && m.share > 0) {
        // Deduct from member
        await walletQ.adjustBalance(conn, m.wallet.user_id || m.wallet.discord_id, cur, -m.share);

        // Member outgoing transaction
        await txQ.insertTransaction(conn, {
          userId: m.wallet.user_id || null,
          discordId: m.wallet.discord_id || null,
          type: 'split_out',
          currency: cur,
          amount: m.share,
          counterpartId: initiatorWallet.discord_id || null,
          counterpartUserId: initiatorWallet.user_id || null,
          refId: splitId,
          note: description ? `Split bill: ${description}` : 'Split bill payment',
        });

        collected += m.share;
      }
    }

    // 3. Credit initiator with collected shares
    if (collected > 0) {
      await walletQ.adjustBalance(conn, initiatorWallet.user_id || initiatorWallet.discord_id, cur, collected);

      await txQ.insertTransaction(conn, {
        userId: initiatorWallet.user_id || null,
        discordId: initiatorWallet.discord_id || null,
        type: 'split_in',
        currency: cur,
        amount: collected,
        refId: splitId,
        note: description ? `Split bill collected: ${description}` : 'Split bill shares collected',
      });
    }

    await conn.commit();
    return getSplitBill(splitId);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/**
 * Get split bill details with members.
 */
async function getSplitBill(splitId) {
  const [billRows] = await pool.query(
    `SELECT sb.*,
            iu.username AS initiator_username,
            iu.display_name AS initiator_name
     FROM split_bills sb
     LEFT JOIN users iu ON iu.id = sb.initiator_user_id
     WHERE sb.id = ? LIMIT 1`,
    [splitId]
  );
  if (!billRows[0]) return null;

  const [members] = await pool.query(
    `SELECT sbm.*,
            u.username,
            u.display_name,
            u.avatar_url
     FROM split_bill_members sbm
     LEFT JOIN users u ON u.id = sbm.user_id
     WHERE sbm.split_id = ?
     ORDER BY sbm.id`,
    [splitId]
  );

  return { bill: billRows[0], members };
}

/**
 * Get all split bills for a user.
 */
async function getUserSplits(userId) {
  const [rows] = await pool.query(
    `SELECT DISTINCT sb.*,
            iu.username AS initiator_username,
            iu.display_name AS initiator_name
     FROM split_bills sb
     LEFT JOIN users iu ON iu.id = sb.initiator_user_id
     LEFT JOIN split_bill_members sbm ON sbm.split_id = sb.id
     WHERE sb.initiator_user_id = ? OR sbm.user_id = ?
     ORDER BY sb.created_at DESC`,
    [userId, userId]
  );
  return rows;
}

module.exports = {
  createSplitBill,
  getSplitBill,
  getUserSplits,
};
