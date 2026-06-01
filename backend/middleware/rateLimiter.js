// middleware/rateLimiter.js — Rate limiting configurations
const rateLimit = require('express-rate-limit');

/**
 * General API rate limiter — 100 requests per 15 minutes per IP.
 * Applied globally to all /api/* routes.
 */
const generalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX) || 100,
  standardHeaders: true,  // Return RateLimit-* headers
  legacyHeaders: false,
  message: {
    error: 'Too many requests from this IP. Please try again later.',
  },
  skipSuccessfulRequests: false,
});

/**
 * Auth route limiter — strict 10 requests per 15 minutes.
 * Prevents brute-force attacks on login/register.
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many authentication attempts. Please try again in 15 minutes.',
  },
  skipSuccessfulRequests: true, // Don't count successful logins against limit
});

/**
 * Strict limiter — 5 requests per 15 minutes.
 * For highly sensitive endpoints.
 */
const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Request limit exceeded. Please try again later.',
  },
});

module.exports = { generalLimiter, authLimiter, strictLimiter };
