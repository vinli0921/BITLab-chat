const rateLimit = require('express-rate-limit');
const { ViolationTypes } = require('librechat-data-provider');
const { limiterCache, removePorts } = require('@librechat/api');
const { logViolation } = require('~/cache');

const {
  RESEARCH_INGEST_IP_MAX = 120,
  RESEARCH_INGEST_IP_WINDOW = 1,
  RESEARCH_INGEST_VIOLATION_SCORE: score,
} = process.env;
// Lab deployments place many participants behind a single NAT IP, so the per-IP
// ceiling must stay generous to avoid throttling legitimate concurrent ingest.
const windowMs = RESEARCH_INGEST_IP_WINDOW * 60 * 1000;
const max = RESEARCH_INGEST_IP_MAX;
const windowInMinutes = windowMs / 60000;
const message = 'too many research ingest requests';

const handler = async (req, res) => {
  const type = ViolationTypes.RESEARCH_INGEST;
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
  store: limiterCache('research_ingest_limiter'),
};

const ingestLimiter = rateLimit(limiterOptions);

module.exports = ingestLimiter;
