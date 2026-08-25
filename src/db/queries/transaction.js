'use strict';
const crypto = require('crypto');
const pool = require('../connection');

/**
 * Generate a unique transaction ID (txid).
 */
function generateTxId() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Insert a transaction record within an existing connection (transaction context).
 */
async function insertTransaction(conn, data) {
  const {
    userId = null,
    discordId = null,
    type,
    currency,
    amount,
    fromCurrency = null,
    fromAmount = null,
    rate = null,
    counterpartId = null,
    counterpartUserId = null,
    refId = null,
    note = null,
  } = data;

  const txid = generateTxId();

  await conn.query(
    `INSERT INTO transactions
      (txid, user_id, discord_id, type, currency, amount, from_currency, from_amount, rate, counterpart_id, counterpart_user_id, ref_id, note)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      txid,
      userId,
      discordId,
      type,
      currency.toUpperCase(),
      parseFloat(amount).toFixed(8),
      fromCurrency ? fromCurrency.toUpperCase() : null,
      fromAmount != null ? parseFloat(fromAmount).toFixed(8) : null,
      rate != null ? parseFloat(rate).toFixed(8) : null,
      counterpartId,
      counterpartUserId,
      refId,
      note,
    ]
  );

  return txid;
}

/**
 * Get paginated transaction history for a user (by userId or discordId).
 * @param {number|string} userIdentifier - userId or discordId
 * @param {object} opts - { currency, type, page, pageSize }
 */
async function getHistory(userIdentifier, opts = {}) {
  const { currency = null, type = null, page = 1, pageSize = 10 } = opts;
  const offset = (page - 1) * pageSize;

  let where = [];
  let params = [];

  if (typeof userIdentifier === 'number' || (/^\d+$/.test(userIdentifier) && String(userIdentifier).length < 15)) {
    where.push('(t.user_id = ? OR t.discord_id = ?)');
    params.push(userIdentifier, String(userIdentifier));
  } else {
    where.push('t.discord_id = ?');
    params.push(String(userIdentifier));
  }

  if (currency) {
    where.push('t.currency = ?');
    params.push(currency.toUpperCase());
  }

  if (type) {
    where.push('t.type = ?');
    params.push(type);
  }

  const whereClause = `WHERE ${where.join(' AND ')}`;

  const [rows] = await pool.query(
    `SELECT t.*,
            u.username AS user_username,
            cu.username AS counterpart_username
     FROM transactions t
     LEFT JOIN users u ON u.id = t.user_id
     LEFT JOIN users cu ON cu.id = t.counterpart_user_id
     ${whereClause}
     ORDER BY t.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, pageSize, offset]
  );

  const [[countRow]] = await pool.query(
    `SELECT COUNT(*) AS total FROM transactions t ${whereClause}`,
    params
  );

  return {
    rows,
    total: countRow.total,
    page,
    pageSize,
    totalPages: Math.ceil(countRow.total / pageSize) || 1,
  };
}

/**
 * Get a single transaction by txid.
 */
async function getTransaction(txid) {
  const [rows] = await pool.query(
    `SELECT t.*,
            u.username AS user_username,
            cu.username AS counterpart_username
     FROM transactions t
     LEFT JOIN users u ON u.id = t.user_id
     LEFT JOIN users cu ON cu.id = t.counterpart_user_id
     WHERE t.txid = ? LIMIT 1`,
    [txid]
  );
  return rows[0] || null;
}

module.exports = {
  generateTxId,
  insertTransaction,
  getHistory,
  getTransaction,
};
