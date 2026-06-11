const express = require('express');
const mongoose = require('mongoose');
const { requireJwtAuth } = require('~/server/middleware');
const { logResearchEvents, MAX_RESEARCH_BATCH } = require('@librechat/api');

const router = express.Router();

function isValidEvent(event) {
  return (
    event != null &&
    typeof event.eventId === 'string' &&
    typeof event.eventType === 'string' &&
    typeof event.tsWall === 'number'
  );
}

router.post('/events', requireJwtAuth, async (req, res) => {
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
        studyId: req.user.experimentAssignment?.studyId ?? 'study-1',
        variant: req.user.experimentAssignment?.variant ?? 'control',
        userId: req.user.id,
      },
      db: mongoose,
    });
    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
