'use strict';

/**
 * Middleware to validate API key from X-Admin-Key or X-Wallet-Key header.
 * Pass the expected key as a string.
 */
function requireApiKey(envVar) {
  return (req, res, next) => {
    const expectedKey = process.env[envVar];
    if (!expectedKey) {
      console.error(`[Auth] ${envVar} is not set in environment.`);
      return res.status(500).json({ error: 'Server misconfiguration: API key not set.' });
    }

    const provided = req.headers['x-admin-key'] || req.headers['x-api-key'] || req.query.apiKey;
    if (!provided || provided !== expectedKey) {
      return res.status(401).json({ error: 'Unauthorized: invalid or missing API key.' });
    }

    next();
  };
}

module.exports = { requireApiKey };
