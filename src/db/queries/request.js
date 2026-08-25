'use strict';
const pool = require('../connection');

/**
 * Create a new payment request within a connection.
 */
async function createPaymentRequest(conn, { requesterUserId, targetUserId, currency, amount, note }) {
  const [result] = await conn.query(
    `INSERT INTO payment_requests (requester_user_id, target_user_id, currency, amount, note, status)
     VALUES (?, ?, ?, ?, ?, 'pending')`,
    [
      requesterUserId,
      targetUserId,
      currency.toUpperCase(),
      parseFloat(amount).toFixed(8),
      note || null,
    ]
  );
  return result.insertId;
}

/**
 * Get payment request by ID.
 */
async function getPaymentRequest(id) {
  const [rows] = await pool.query(
    `SELECT r.*,
            req.username AS requester_username,
            req.display_name AS requester_name,
            req.avatar_url AS requester_avatar,
            tgt.username AS target_username,
            tgt.display_name AS target_name,
            tgt.avatar_url AS target_avatar
     FROM payment_requests r
     JOIN users req ON req.id = r.requester_user_id
     JOIN users tgt ON tgt.id = r.target_user_id
     WHERE r.id = ? LIMIT 1`,
    [id]
  );
  return rows[0] || null;
}

/**
 * Get all payment requests for a user (incoming, outgoing, or both).
 */
async function getUserPaymentRequests(userId, opts = {}) {
  const { filter = 'all', status = null } = opts;
  let where = [];
  let params = [];

  if (filter === 'incoming') {
    where.push('r.target_user_id = ?');
    params.push(userId);
  } else if (filter === 'outgoing') {
    where.push('r.requester_user_id = ?');
    params.push(userId);
  } else {
    where.push('(r.requester_user_id = ? OR r.target_user_id = ?)');
    params.push(userId, userId);
  }

  if (status) {
    where.push('r.status = ?');
    params.push(status);
  }

  const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

  const [rows] = await pool.query(
    `SELECT r.*,
            req.username AS requester_username,
            req.display_name AS requester_name,
            tgt.username AS target_username,
            tgt.display_name AS target_name
     FROM payment_requests r
     JOIN users req ON req.id = r.requester_user_id
     JOIN users tgt ON tgt.id = r.target_user_id
     ${whereClause}
     ORDER BY r.created_at DESC`,
    params
  );
  return rows;
}

/**
 * Update request status within a connection.
 */
async function updatePaymentRequestStatus(conn, id, status) {
  await conn.query('UPDATE payment_requests SET status = ? WHERE id = ?', [status, id]);
}

module.exports = {
  createPaymentRequest,
  getPaymentRequest,
  getUserPaymentRequests,
  updatePaymentRequestStatus,
};
