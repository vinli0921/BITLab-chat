const express = require('express');
const mongoose = require('mongoose');
const { requireJwtAuth } = require('~/server/middleware');
const { pairingLimiter } = require('~/server/middleware/limiters');
const {
  logResearchEvents,
  processExtensionBatch,
  createPairingCode,
  redeemPairingCode,
  MAX_RESEARCH_BATCH,
  STUDY_ID,
} = require('@librechat/api');

const router = express.Router();

function hasValidStudyKey(req) {
  const configured = process.env.RESEARCH_STUDY_KEY;
  const provided = req.get('x-study-key');
  return Boolean(configured) && provided === configured;
}

function isValidEvent(event) {
  return (
    event != null &&
    typeof event.eventId === 'string' &&
    typeof event.eventType === 'string' &&
    typeof event.tsWall === 'number'
  );
}

function isValidExtensionEvent(event) {
  return event != null && typeof event.type === 'string';
}

router.post('/events', (req, res) => {
  if (hasValidStudyKey(req)) {
    return handleExtensionEvents(req, res);
  }
  if (req.get('x-study-key') != null) {
    return res.status(401).json({ error: 'invalid study key' });
  }
  return requireJwtAuth(req, res, () => handleAppEvents(req, res));
});

async function handleAppEvents(req, res) {
  try {
    const { events } = req.body;
    if (!Array.isArray(events) || events.length === 0 || !events.every(isValidEvent)) {
      return res.status(400).json({ error: 'events must be a non-empty array of envelopes' });
    }
    if (events.length > MAX_RESEARCH_BATCH) {
      return res.status(400).json({ error: `batch exceeds ${MAX_RESEARCH_BATCH} events` });
    }
    const result = await logResearchEvents({
      events,
      context: {
        source: 'app-client',
        studyId: req.user.experimentAssignment?.studyId ?? STUDY_ID,
        variant: req.user.experimentAssignment?.variant ?? 'control',
        userId: req.user.id,
      },
      db: mongoose,
    });
    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

async function handleExtensionEvents(req, res) {
  try {
    const { participantId, sessionId, events } = req.body;
    if (typeof participantId !== 'string' || participantId.length === 0) {
      return res.status(400).json({ error: 'participantId required' });
    }
    // Empty batches are allowed here (unlike the app path): an extension flushing an
    // empty queue is a no-op, not a client error.
    if (!Array.isArray(events) || !events.every(isValidExtensionEvent)) {
      return res.status(400).json({ error: 'events must be an array of extension events' });
    }
    if (events.length > MAX_RESEARCH_BATCH) {
      return res.status(400).json({ error: `batch exceeds ${MAX_RESEARCH_BATCH} events` });
    }
    const result = await processExtensionBatch({
      participantId,
      sessionId,
      events,
      studyId: STUDY_ID,
      db: mongoose,
    });
    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

router.post('/pairing-code', requireJwtAuth, async (req, res) => {
  try {
    const result = await createPairingCode({
      userId: req.user.id,
      studyId: req.user.experimentAssignment?.studyId ?? STUDY_ID,
      db: mongoose,
    });
    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.post('/pair', pairingLimiter, async (req, res) => {
  try {
    if (!hasValidStudyKey(req)) {
      return res.status(401).json({ error: 'invalid study key' });
    }
    const { code } = req.body;
    if (typeof code !== 'string' || code.length === 0) {
      return res.status(400).json({ error: 'code required' });
    }
    const result = await redeemPairingCode({ code, db: mongoose });
    if (result == null) {
      return res.status(404).json({ error: 'code invalid, expired, or already used' });
    }
    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
