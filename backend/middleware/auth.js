// middleware/auth.js — JWT authentication middleware
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'govbill_fallback_secret';

/**
 * Protects routes — requires a valid Bearer JWT in the Authorization header.
 * Attaches req.user = { id, email, name } on success.
 */
function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized — no token provided.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload; // { id, email, name }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized — invalid or expired token.' });
  }
}

module.exports = authMiddleware;
