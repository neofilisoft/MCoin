'use strict';
const pool = require('../connection');

/**
 * Create a new escrow record.
 */
async function createEscrow(conn, { senderUserId = null, receiverUserId = null, senderId, receiverId, currency, amount, note, expiresAt }) {
  const [result] = await conn.query(
    `INSERT INTO escrows (sender_user_id, receiver_user_id, sender_id, receiver_id, currency, amount, note, status, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
    [
      senderUserId,
      receiverUserId,
      String(senderId),
      String(receiverId),
      currency.toUpperCase(),
      parseFloat(amount).toFixed(8),
      note || null,
      expiresAt,
    ]
  );
  return result.insertId;
}

/**
 * Get an escrow by ID with user details.
 */
async function getEscrow(escrowId) {
  const [rows] = await pool.query(
    `SELECT e.*,
            su.username AS sender_username,
            su.display_name AS sender_name,
            ru.username AS receiver_username,
            ru.display_name AS receiver_name
     FROM escrows e
     LEFT JOIN users su ON su.id = e.sender_user_id
     LEFT JOIN users ru ON ru.id = e.receiver_user_id
     WHERE e.id = ? LIMIT 1`,
    [escrowId]
  );
  return rows[0] || null;
}

/**
 * Update escrow status within a transaction connection.
 */
async function updateEscrowStatus(conn, escrowId, status) {
  await conn.query(
    'UPDATE escrows SET status = ? WHERE id = ?',
    [status, escrowId]
  );
}

/**
 * Get all pending escrows that have expired (for scheduler).
 */
async function getExpiredPendingEscrows() {
  const [rows] = await pool.query(
    `SELECT * FROM escrows WHERE status = 'pending' AND expires_at <= NOW()`
  );
  return rows;
}

/**
 * Get all active pending escrows for a user (by discord_id or user_id).
 */
async function getUserPendingEscrows(identifier) {
  const isUserId = typeof identifier === 'number' || (/^\d+$/.test(identifier) && String(identifier).length < 15);
  let query;
  let params;

  if (isUserId) {
    query = `SELECT * FROM escrows
             WHERE status = 'pending' AND (sender_user_id = ? OR receiver_user_id = ?)
             ORDER BY created_at DESC`;
    params = [identifier, identifier];
  } else {
    query = `SELECT * FROM escrows
             WHERE status = 'pending' AND (sender_id = ? OR receiver_id = ?)
             ORDER BY created_at DESC`;
    params = [identifier, identifier];
  }

  const [rows] = await pool.query(query, params);
  return rows;
}

/**
 * Get all escrows for a user with status & role filter.
 */
async function getUserEscrows(userId, opts = {}) {
  const { filter = 'all', status = null } = opts;
  let where = [];
  let params = [];

  if (filter === 'sender') {
    where.push('e.sender_user_id = ?');
    params.push(userId);
  } else if (filter === 'receiver') {
    where.push('e.receiver_user_id = ?');
    params.push(userId);
  } else {
    where.push('(e.sender_user_id = ? OR e.receiver_user_id = ?)');
    params.push(userId, userId);
  }

  if (status) {
    where.push('e.status = ?');
    params.push(status);
  }

  const whereClause = `WHERE ${where.join(' AND ')}`;

  const [rows] = await pool.query(
    `SELECT e.*,
            su.username AS sender_username,
            su.display_name AS sender_name,
            ru.username AS receiver_username,
            ru.display_name AS receiver_name
     FROM escrows e
     LEFT JOIN users su ON su.id = e.sender_user_id
     LEFT JOIN users ru ON ru.id = e.receiver_user_id
     ${whereClause}
     ORDER BY e.created_at DESC`,
    params
  );
  return rows;
}

module.exports = {
  createEscrow,
  getEscrow,
  updateEscrowStatus,
  getExpiredPendingEscrows,
  getUserPendingEscrows,
  getUserEscrows,
};
