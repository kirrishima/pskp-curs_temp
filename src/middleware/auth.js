const { verifyAccessToken } = require('../services/token');

/**
 * Express middleware that extracts a Bearer token from the Authorization
 * header, verifies it (including token-version check), and attaches
 * `req.user` for downstream handlers.
 */
async function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid Authorization header' });
    }

    const token = header.split(' ')[1];
    const { user } = await verifyAccessToken(token);

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: err.message || 'Authentication failed' });
  }
}

module.exports = { authenticate };
