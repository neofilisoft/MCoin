'use strict';
const bcrypt = require('bcryptjs');
const userQ = require('../db/queries/user');
const walletQ = require('../db/queries/wallet');
const { generateWalletAddress } = require('../utils/address');

const SALT_ROUNDS = 10;

/**
 * Register a new user with email and password.
 */
async function registerUser({ username, email, password, displayName = null, avatarUrl = null }) {
  if (!username || !password) {
    throw new Error('Username and password are required');
  }

  const cleanUsername = username.trim().toLowerCase();
  if (cleanUsername.length < 3 || cleanUsername.length > 30) {
    throw new Error('Username must be between 3 and 30 characters');
  }
  if (!/^[a-z0-9_-]+$/.test(cleanUsername)) {
    throw new Error('Username can only contain letters, numbers, hyphens, and underscores');
  }

  // Check username uniqueness
  const existingUser = await userQ.getUserByUsername(cleanUsername);
  if (existingUser) {
    throw new Error('Username is already taken');
  }

  // Check email uniqueness if provided
  if (email) {
    const cleanEmail = email.trim().toLowerCase();
    const existingEmail = await userQ.getUserByEmail(cleanEmail);
    if (existingEmail) {
      throw new Error('Email is already registered');
    }
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  // Create user
  const user = await userQ.createUser({
    username: cleanUsername,
    email: email ? email.trim().toLowerCase() : null,
    passwordHash,
    displayName: displayName || cleanUsername,
    avatarUrl,
    role: 'user',
  });

  // Create wallet for user
  const walletAddress = generateWalletAddress(`user_${user.id}`);
  await walletQ.createWalletForUser(user.id, walletAddress, null);

  const { password_hash, ...safeUser } = user;
  return safeUser;
}

/**
 * Login user with username/email and password.
 */
async function loginUser(identifier, password) {
  if (!identifier || !password) {
    throw new Error('Username/Email and password are required');
  }

  const cleanIdentifier = identifier.trim().toLowerCase();
  let user = await userQ.getUserByUsername(cleanIdentifier);
  if (!user && cleanIdentifier.includes('@')) {
    user = await userQ.getUserByEmail(cleanIdentifier);
  }

  if (!user) {
    throw new Error('Invalid credentials');
  }

  if (!user.is_active) {
    throw new Error('Account has been deactivated');
  }

  if (!user.password_hash) {
    throw new Error('This account was registered via Discord OAuth. Please log in with Discord.');
  }

  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) {
    throw new Error('Invalid credentials');
  }

  const { password_hash, ...safeUser } = user;
  return safeUser;
}

/**
 * Get or create a user when interacted from Discord Bot.
 */
async function getOrCreateUserForDiscord(discordId, discordUsername = null, discordAvatar = null) {
  if (!discordId) throw new Error('Discord ID is required');

  let user = await userQ.getUserByDiscordId(discordId);
  if (!user) {
    // Determine base username
    let baseUsername = discordUsername ? discordUsername.toLowerCase().replace(/[^a-z0-9_-]/g, '') : `discord_${discordId.slice(-6)}`;
    if (baseUsername.length < 3) baseUsername = `dc_${discordId.slice(-6)}`;

    let username = baseUsername;
    let counter = 1;
    while (await userQ.getUserByUsername(username)) {
      username = `${baseUsername}_${counter++}`;
    }

    user = await userQ.createUser({
      username,
      discordId,
      displayName: discordUsername || username,
      avatarUrl: discordAvatar || null,
      role: 'user',
    });

    // Check if a legacy wallet exists with this discord_id
    const legacyWallet = await walletQ.getWallet(discordId);
    if (legacyWallet && !legacyWallet.user_id) {
      await walletQ.linkWalletToUser(legacyWallet.id, user.id);
    } else if (!legacyWallet) {
      const walletAddress = generateWalletAddress(discordId);
      await walletQ.createWalletForUser(user.id, walletAddress, discordId);
    }
  }

  return user;
}

/**
 * Link Discord account to an existing user.
 */
async function linkDiscordAccount(userId, discordId, discordUsername = null, discordAvatar = null) {
  const existing = await userQ.getUserByDiscordId(discordId);
  if (existing && existing.id !== userId) {
    throw new Error('This Discord account is already linked to another MCoin account.');
  }

  await userQ.linkDiscordAccount(userId, discordId);

  // If user wallet didn't have discord_id set, update it
  const wallet = await walletQ.getWalletByUserId(userId);
  if (wallet && !wallet.discord_id) {
    const pool = require('../db/connection');
    await pool.query('UPDATE wallets SET discord_id = ? WHERE id = ?', [discordId, wallet.id]);
  }

  return userQ.getUserById(userId);
}

/**
 * Unlink Discord account from a user.
 */
async function unlinkDiscordAccount(userId) {
  const user = await userQ.getUserById(userId);
  if (!user) throw new Error('User not found');
  if (!user.password_hash) {
    throw new Error('Cannot unlink Discord account without setting a password first.');
  }

  await userQ.unlinkDiscordAccount(userId);
  return userQ.getUserById(userId);
}

/**
 * Find user by query.
 */
async function findUser(query) {
  return userQ.findUserByQuery(query);
}

/**
 * Get user by ID.
 */
async function getUser(userId) {
  const user = await userQ.getUserById(userId);
  if (!user) return null;
  const { password_hash, ...safeUser } = user;
  return safeUser;
}

/**
 * Update user profile.
 */
async function updateProfile(userId, data) {
  const updated = await userQ.updateUserProfile(userId, data);
  const { password_hash, ...safeUser } = updated;
  return safeUser;
}

module.exports = {
  registerUser,
  loginUser,
  getOrCreateUserForDiscord,
  linkDiscordAccount,
  unlinkDiscordAccount,
  findUser,
  getUser,
  updateProfile,
};
