// middleware/validate.js — Reusable validation middleware using express-validator
const { validationResult } = require('express-validator');

/**
 * Runs express-validator checks and returns a standardized 400 response
 * if any validation errors are found.
 * 
 * Usage:
 *   router.post('/', [body('name').notEmpty()], validate, handler)
 */
function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const messages = errors.array().map(e => e.msg);
    return res.status(400).json({
      error: messages[0],          // First error as main message
      errors: messages,            // All errors for frontend consumption
    });
  }
  next();
}

// ─── Common GSTIN validator ───────────────────────────────────────────────────
// GSTIN: 15-char alphanumeric, format: 2 digits + 10-char PAN + 1 digit + Z/default + check
const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
const isValidGSTIN = (value) => {
  if (!value) return true; // Optional field — skip if empty
  return GSTIN_REGEX.test(value.trim().toUpperCase());
};

// ─── Common PAN validator ─────────────────────────────────────────────────────
// PAN: 10-char alphanumeric, format: 5 letters + 4 digits + 1 letter
const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
const isValidPAN = (value) => {
  if (!value) return true;
  return PAN_REGEX.test(value.trim().toUpperCase());
};

module.exports = { validate, isValidGSTIN, isValidPAN, GSTIN_REGEX, PAN_REGEX };
