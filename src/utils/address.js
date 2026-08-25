'use strict';
const crypto = require('crypto');

/**
 * Generate a deterministic-but-unique wallet address from discord_id.
 * Format: mc + 40-hex-char (total 42 chars, similar to Ethereum address style).
 * We add a random salt so two users cannot predict each other's address.
 */
function generateWalletAddress(discordId) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto
    .createHash('sha256')
    .update(`${discordId}:${salt}:${Date.now()}`)
    .digest('hex');
  return 'mc' + hash.slice(0, 40);
}

module.exports = { generateWalletAddress };
