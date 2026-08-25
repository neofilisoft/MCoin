'use strict';
const express = require('express');
const userService = require('../../../services/userService');
const authService = require('../../../services/authService');
const { requireUserAuth } = require('../../middleware/userAuth');

const router = express.Router();

/**
 * POST /api/v1/auth/register
 * Register a new user with username, email, password.
 */
router.post('/register', async (req, res) => {
  const { username, email, password, displayName } = req.body;
  try {
    const user = await userService.registerUser({
      username,
      email,
      password,
      displayName,
    });
    const tokens = authService.generateTokens(user);
    res.status(201).json({ success: true, user, tokens });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * POST /api/v1/auth/login
 * Log in with username/email and password.
 */
router.post('/login', async (req, res) => {
  const { username, email, identifier, password } = req.body;
  const loginId = identifier || username || email;

  try {
    const user = await userService.loginUser(loginId, password);
    const tokens = authService.generateTokens(user);
    res.json({ success: true, user, tokens });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * POST /api/v1/auth/refresh
 * Refresh access token using refresh token.
 */
router.post('/refresh', async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return res.status(400).json({ error: 'refreshToken is required' });
  }

  try {
    const tokens = await authService.refreshAccessToken(refreshToken);
    res.json({ success: true, tokens });
  } catch (err) {
    res.status(401).json({ error: err.message });
  }
});

/**
 * GET /api/v1/auth/me
 * Get current authenticated user profile.
 */
router.get('/me', requireUserAuth, async (req, res) => {
  try {
    const user = await userService.getUser(req.user.id);
    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * PATCH /api/v1/auth/profile
 * Update user display name, avatar, email.
 */
router.patch('/profile', requireUserAuth, async (req, res) => {
  const { displayName, avatarUrl, email } = req.body;
  try {
    const user = await userService.updateProfile(req.user.id, { displayName, avatarUrl, email });
    res.json({ success: true, user });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * GET /api/v1/auth/discord/url
 * Get Discord OAuth2 authorization URL.
 */
router.get('/discord/url', (req, res) => {
  const redirectUri = req.query.redirectUri || process.env.DISCORD_REDIRECT_URI || 'http://localhost:5173/auth/callback';
  const state = req.query.state || '';

  try {
    const url = authService.getDiscordOAuthUrl(redirectUri, state);
    res.json({ url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/v1/auth/discord/callback
 * Exchange OAuth2 code for tokens.
 */
router.post('/discord/callback', async (req, res) => {
  const { code, redirectUri } = req.body;
  if (!code) {
    return res.status(400).json({ error: 'code is required' });
  }

  const effectiveRedirectUri = redirectUri || process.env.DISCORD_REDIRECT_URI || 'http://localhost:5173/auth/callback';

  try {
    const { user, tokens } = await authService.handleDiscordCallback(code, effectiveRedirectUri);
    res.json({ success: true, user, tokens });
  } catch (err) {
    res.status(400).json({ error: err.response?.data?.error_description || err.message });
  }
});

/**
 * POST /api/v1/auth/link-discord
 * Link Discord account to logged in user.
 */
router.post('/link-discord', requireUserAuth, async (req, res) => {
  const { discordId, discordUsername, discordAvatar } = req.body;
  if (!discordId) {
    return res.status(400).json({ error: 'discordId is required' });
  }

  try {
    const user = await userService.linkDiscordAccount(req.user.id, discordId, discordUsername, discordAvatar);
    res.json({ success: true, user });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * POST /api/v1/auth/unlink-discord
 * Unlink Discord account from logged in user.
 */
router.post('/unlink-discord', requireUserAuth, async (req, res) => {
  try {
    const user = await userService.unlinkDiscordAccount(req.user.id);
    res.json({ success: true, user });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
