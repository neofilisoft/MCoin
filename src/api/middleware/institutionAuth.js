'use strict';
const crypto = require('crypto');
const pool = require('../../../db/connection');

/**
 * Validate an institution API key against its stored hash.
 * Header: X-Institution-Key: <raw_key>
 */
async function requireInstitutionKey(req, res, next) {
  const rawKey = req.headers['x-institution-key'];
  if (!rawKey) return res.status(401).json({ error: 'Missing X-Institution-Key header' });

  const hash = crypto.createHash('sha256').update(rawKey).digest('hex');

  const [[inst]] = await pool.query(
    'SELECT * FROM institutions WHERE api_key_hash = ? AND is_active = 1 LIMIT 1',
    [hash]
  );

  if (!inst) return res.status(401).json({ error: 'Invalid or inactive institution key' });

  req.institution = inst;
  next();
}

module.exports = { requireInstitutionKey };
