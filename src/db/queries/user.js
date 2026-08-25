'use strict';
const pool = require('../connection');

/**
 * Get user by internal user ID.
 */
async function getUserById(id) {
  const [rows] = await pool.query('SELECT * FROM users WHERE id = ? LIMIT 1', [id]);
  return rows[0] || null;
}

/**
 * Get user by username (case-insensitive).
 */
async function getUserByUsername(username) {
  const [rows] = await pool.query('SELECT * FROM users WHERE LOWER(username) = LOWER(?) LIMIT 1', [username]);
  return rows[0] || null;
}

/**
 * Get user by email.
 */
async function getUserByEmail(email) {
  if (!email) return null;
  const [rows] = await pool.query('SELECT * FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1', [email]);
  return rows[0] || null;
}

/**
 * Get user by Discord ID.
 */
async function getUserByDiscordId(discordId) {
  if (!discordId) return null;
  const [rows] = await pool.query('SELECT * FROM users WHERE discord_id = ? LIMIT 1', [discordId]);
  return rows[0] || null;
}

/**
 * Create a new user.
 */
async function createUser(userData) {
  const {
    username,
    email = null,
    passwordHash = null,
    discordId = null,
    displayName = null,
    avatarUrl = null,
    role = 'user',
  } = userData;

  const [result] = await pool.query(
    `INSERT INTO users (username, email, password_hash, discord_id, display_name, avatar_url, role)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      username,
      email || null,
      passwordHash || null,
      discordId || null,
      displayName || username,
      avatarUrl || null,
      role || 'user',
    ]
  );

  return getUserById(result.insertId);
}

/**
 * Link Discord account to an existing user.
 */
async function linkDiscordAccount(userId, discordId) {
  await pool.query('UPDATE users SET discord_id = ? WHERE id = ?', [discordId, userId]);
  return getUserById(userId);
}

/**
 * Unlink Discord account from a user.
 */
async function unlinkDiscordAccount(userId) {
  await pool.query('UPDATE users SET discord_id = NULL WHERE id = ?', [userId]);
  return getUserById(userId);
}

/**
 * Update user profile details.
 */
async function updateUserProfile(userId, { displayName, avatarUrl, email }) {
  const fields = [];
  const params = [];

  if (displayName !== undefined) {
    fields.push('display_name = ?');
    params.push(displayName);
  }
  if (avatarUrl !== undefined) {
    fields.push('avatar_url = ?');
    params.push(avatarUrl);
  }
  if (email !== undefined) {
    fields.push('email = ?');
    params.push(email || null);
  }

  if (fields.length === 0) return getUserById(userId);

  params.push(userId);
  await pool.query(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, params);
  return getUserById(userId);
}

/**
 * Search user by query string (matches username, email, discord_id, or wallet_address).
 */
async function findUserByQuery(query) {
  if (!query) return null;
  const q = String(query).trim();

  // Try by ID if purely numeric
  if (/^\d+$/.test(q) && q.length < 15) {
    const user = await getUserById(parseInt(q, 10));
    if (user) return user;
  }

  // Try by Discord ID
  if (/^\d{17,20}$/.test(q)) {
    const user = await getUserByDiscordId(q);
    if (user) return user;
  }

  // Try by email
  if (q.includes('@')) {
    const user = await getUserByEmail(q);
    if (user) return user;
  }

  // Try by wallet address (starts with mc and 40 hex chars)
  if (q.startsWith('mc') && q.length >= 40) {
    const [rows] = await pool.query(
      `SELECT u.* FROM users u
       JOIN wallets w ON w.user_id = u.id
       WHERE w.wallet_address = ? LIMIT 1`,
      [q]
    );
    if (rows[0]) return rows[0];
  }

  // Try by username
  const cleanUsername = q.startsWith('@') ? q.slice(1) : q;
  return getUserByUsername(cleanUsername);
}

module.exports = {
  getUserById,
  getUserByUsername,
  getUserByEmail,
  getUserByDiscordId,
  createUser,
  linkDiscordAccount,
  unlinkDiscordAccount,
  updateUserProfile,
  findUserByQuery,
};
