'use strict';
require('dotenv').config();
const jwt = require('jsonwebtoken');
const axios = require('axios');
const userService = require('./userService');

const JWT_SECRET = process.env.JWT_SECRET || 'mcoin_jwt_secret_change_in_production_key_2026';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'mcoin_jwt_refresh_secret_key_2026';
const ACCESS_TOKEN_EXPIRY = process.env.ACCESS_TOKEN_EXPIRY || '1d';
const REFRESH_TOKEN_EXPIRY = process.env.REFRESH_TOKEN_EXPIRY || '7d';

/**
 * Generate Access and Refresh JWT tokens for a user.
 */
function generateTokens(user) {
  const payload = {
    userId: user.id,
    username: user.username,
    role: user.role,
    discordId: user.discord_id || null,
  };

  const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
  const refreshToken = jwt.sign({ userId: user.id }, JWT_REFRESH_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRY });

  return { accessToken, refreshToken, expiresIn: ACCESS_TOKEN_EXPIRY };
}

/**
 * Verify Access Token.
 */
function verifyAccessToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    throw new Error('Invalid or expired token');
  }
}

/**
 * Verify Refresh Token.
 */
function verifyRefreshToken(token) {
  try {
    return jwt.verify(token, JWT_REFRESH_SECRET);
  } catch (err) {
    throw new Error('Invalid or expired refresh token');
  }
}

/**
 * Refresh tokens with a valid refresh token.
 */
async function refreshAccessToken(refreshToken) {
  const decoded = verifyRefreshToken(refreshToken);
  const user = await userService.getUser(decoded.userId);
  if (!user || !user.is_active) {
    throw new Error('User no longer exists or is inactive');
  }
  return generateTokens(user);
}

/**
 * Generate Discord OAuth2 Authorization URL.
 */
function getDiscordOAuthUrl(redirectUri, state = '') {
  const clientId = process.env.DISCORD_CLIENT_ID;
  if (!clientId) throw new Error('DISCORD_CLIENT_ID is not set in environment');

  const scope = encodeURIComponent('identify email');
  const encodedRedirect = encodeURIComponent(redirectUri);
  const encodedState = encodeURIComponent(state);

  return `https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${encodedRedirect}&response_type=code&scope=${scope}&state=${encodedState}`;
}

/**
 * Exchange Discord OAuth2 Code for User Profile & Issue JWT Tokens.
 */
async function handleDiscordCallback(code, redirectUri) {
  const clientId = process.env.DISCORD_CLIENT_ID;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('DISCORD_CLIENT_ID or DISCORD_CLIENT_SECRET is not configured');
  }

  // 1. Exchange code for access token
  const tokenParams = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
  });

  const tokenResp = await axios.post('https://discord.com/api/oauth2/token', tokenParams.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    timeout: 10000,
  });

  const discordAccessToken = tokenResp.data.access_token;

  // 2. Fetch user profile from Discord API
  const userResp = await axios.get('https://discord.com/api/users/@me', {
    headers: { Authorization: `Bearer ${discordAccessToken}` },
    timeout: 10000,
  });

  const discordUser = userResp.data;
  const avatarUrl = discordUser.avatar
    ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`
    : `https://cdn.discordapp.com/embed/avatars/${parseInt(discordUser.discriminator || '0', 10) % 5}.png`;

  // 3. Get or provision user in MCoin
  const user = await userService.getOrCreateUserForDiscord(
    discordUser.id,
    discordUser.global_name || discordUser.username,
    avatarUrl
  );

  // If email was returned from Discord and user has none, save it
  if (discordUser.email && !user.email) {
    await userService.updateProfile(user.id, { email: discordUser.email });
  }

  // 4. Generate JWT tokens
  const tokens = generateTokens(user);

  return {
    user,
    tokens,
  };
}

module.exports = {
  generateTokens,
  verifyAccessToken,
  verifyRefreshToken,
  refreshAccessToken,
  getDiscordOAuthUrl,
  handleDiscordCallback,
};
