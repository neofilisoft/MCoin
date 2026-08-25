'use strict';
const pool = require('../connection');

/**
 * Get current staking APR from config.
 */
async function getStakingApr() {
  const [[row]] = await pool.query('SELECT apr FROM staking_config WHERE id = 1');
  return parseFloat(row.apr);
}

/**
 * Set staking APR.
 */
async function setStakingApr(apr) {
  await pool.query('UPDATE staking_config SET apr = ? WHERE id = 1', [parseFloat(apr).toFixed(4)]);
}

/**
 * Get active staking position for a user (by userId or discordId).
 */
async function getActiveStaking(identifier) {
  if (!identifier) return null;
  const isUserId = typeof identifier === 'number' || (/^\d+$/.test(identifier) && String(identifier).length < 15);

  let query;
  let params;

  if (isUserId) {
    query = 'SELECT * FROM staking_positions WHERE (user_id = ? OR discord_id = ?) AND is_active = 1 LIMIT 1';
    params = [identifier, String(identifier)];
  } else {
    query = 'SELECT * FROM staking_positions WHERE discord_id = ? AND is_active = 1 LIMIT 1';
    params = [String(identifier)];
  }

  const [rows] = await pool.query(query, params);
  return rows[0] || null;
}

/**
 * Create a staking position within a transaction connection.
 */
async function createStakingPosition(conn, { userId = null, discordId = null }, amount, apr) {
  const [result] = await conn.query(
    `INSERT INTO staking_positions (user_id, discord_id, amount, apr, started_at, last_payout_at)
     VALUES (?, ?, ?, ?, NOW(), NOW())`,
    [
      userId,
      discordId || `user_${userId}`,
      parseFloat(amount).toFixed(8),
      parseFloat(apr).toFixed(4),
    ]
  );
  return result.insertId;
}

/**
 * Deactivate a staking position within a transaction connection.
 */
async function deactivateStaking(conn, positionId) {
  await conn.query(
    'UPDATE staking_positions SET is_active = 0, ended_at = NOW() WHERE id = ?',
    [positionId]
  );
}

/**
 * Update last_payout_at after distributing rewards.
 */
async function updateLastPayout(conn, positionId) {
  await conn.query(
    'UPDATE staking_positions SET last_payout_at = NOW() WHERE id = ?',
    [positionId]
  );
}

/**
 * Get all active staking positions (for scheduler payout).
 */
async function getAllActiveStakings() {
  const [rows] = await pool.query(
    'SELECT * FROM staking_positions WHERE is_active = 1'
  );
  return rows;
}

/**
 * Get custom rates for MBC.
 */
async function getCustomRates() {
  const [rows] = await pool.query('SELECT * FROM custom_rates');
  const map = {};
  for (const r of rows) {
    map[r.currency] = parseFloat(r.rate_in_usd);
  }
  return map;
}

/**
 * Set a custom rate for MBC only.
 * XAU and XAG are fetched from ExchangeRate-API and cannot be set manually.
 */
async function setCustomRate(currency, rateInUsd, updatedBy) {
  const cur = currency.toUpperCase();
  if (!['MBC'].includes(cur)) {
    throw new Error(`${cur} rate is fetched from the exchange rate API and cannot be set manually.`);
  }
  await pool.query(
    `INSERT INTO custom_rates (currency, rate_in_usd, updated_by)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE rate_in_usd = ?, updated_by = ?`,
    [
      cur,
      parseFloat(rateInUsd).toFixed(8),
      updatedBy,
      parseFloat(rateInUsd).toFixed(8),
      updatedBy,
    ]
  );
}

module.exports = {
  getStakingApr,
  setStakingApr,
  getActiveStaking,
  createStakingPosition,
  deactivateStaking,
  updateLastPayout,
  getAllActiveStakings,
  getCustomRates,
  setCustomRate,
};
