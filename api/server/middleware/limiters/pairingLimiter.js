const rateLimit = require('express-rate-limit');
const { ViolationTypes } = require('librechat-data-provider');
const { limiterCache, removePorts } = require('@librechat/api');
const { logViolation } = require('~/cache');

const { PAIRING_WINDOW = 15, PAIRING_MAX = 10, PAIRING_VIOLATION_SCORE: score } = process.env;
const windowMs = PAIRING_WINDOW * 60 * 1000;
const max = PAIRING_MAX;
const windowInMinutes = windowMs / 60000;
const message = 'too many pairing attempts';

const handler = async (req, res) => {
  const type = ViolationTypes.PAIRING;
  const errorMessage = {
    type,
    max,
    windowInMinutes,
  };

  await logViolation(req, res, type, errorMessage, score);
  return res.status(429).json({ error: message });
};

const limiterOptions = {
  windowMs,
  max,
  handler,
  keyGenerator: removePorts,
  store: limiterCache('pairing_limiter'),
};

const pairingLimiter = rateLimit(limiterOptions);

module.exports = pairingLimiter;
