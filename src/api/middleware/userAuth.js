'use strict';
const { verifyAccessToken } = require('../../services/authService');
const userQ = require('../../db/queries/user');

/**
 * Middleware to authenticate requests using a User JWT Bearer token.
 * Injects `req.user` with user record.
 */
async function requireUserAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: missing or malformed Bearer token' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = verifyAccessToken(token);
    const user = await userQ.getUserById(payload.userId);

    if (!user || !user.is_active) {
      return res.status(401).json({ error: 'User is inactive or no longer exists' });
    }

    const { password_hash, ...safeUser } = user;
    req.user = safeUser;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized: invalid or expired token' });
  }
}

/**
 * Middleware to require a specific role (e.g. 'admin' or 'teller').
 */
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden: insufficient permissions' });
    }
    next();
  };
}

module.exports = {
  requireUserAuth,
  requireRole,
};
