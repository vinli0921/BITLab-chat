const express = require('express');
const mongoose = require('mongoose');
const { requireJwtAuth } = require('~/server/middleware');
const { getAdContext, logAdEvent } = require('@librechat/api');

const router = express.Router();

router.use(requireJwtAuth);

router.post('/ad-context', async (req, res) => {
  try {
    const { messageText, conversationId, messageId } = req.body;
    const variant = req.user.experimentAssignment?.variant ?? 'control';

    if (!messageText || !conversationId || !messageId) {
      return res.status(400).json({ error: 'messageText, conversationId, and messageId required' });
    }

    const result = await getAdContext({
      userId: req.user.id,
      variant,
      conversationId,
      messageId,
      messageText,
      db: mongoose,
    });
    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.post('/ad-event', async (req, res) => {
  try {
    const {
      eventType,
      productSource,
      productId,
      productName,
      conversationId,
      messageId,
      queryText,
      dwellTimeMs,
      hoverTimeMs,
      scrollDepthPercent,
      linkUrl,
    } = req.body;
    const variant = req.user.experimentAssignment?.variant ?? 'control';
    const studyId = req.user.experimentAssignment?.studyId ?? 'study-1';

    if (!eventType || !productSource || !conversationId || !messageId) {
      return res
        .status(400)
        .json({ error: 'eventType, productSource, conversationId, messageId required' });
    }

    await logAdEvent({
      userId: req.user.id,
      conversationId,
      messageId,
      studyId,
      variant,
      eventType,
      productSource,
      productId,
      productName,
      queryText,
      dwellTimeMs,
      hoverTimeMs,
      scrollDepthPercent,
      linkUrl,
      db: mongoose,
    });

    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
