import express from 'express';
import { vertexAIService } from '../services/vertexAI.js';

const router = express.Router();

/**
 * POST /api/chat/message
 * Send a message and get AI response
 */
router.post('/message', async (req, res) => {
  try {
    const { message, history } = req.body;

    if (!message) {
      return res.status(400).json({
        error: 'Message is required',
      });
    }

    console.log('📨 Received chat message:', message.substring(0, 50) + '...');

    let response;

    if (history && Array.isArray(history) && history.length > 0) {
      // Chat with context
      const messages = [
        ...history.map(msg => ({
          role: msg.sender === 'user' ? 'user' : 'assistant',
          content: msg.text,
        })),
        { role: 'user', content: message },
      ];
      
      response = await vertexAIService.chat(messages);
    } else {
      // Simple generation without context
      response = await vertexAIService.generateContent(message);
    }

    console.log('✅ Generated response');

    res.json({
      success: true,
      message: response,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('❌ Error in chat endpoint:', error);
    res.status(500).json({
      error: 'Failed to generate response',
      details: error.message,
    });
  }
});

/**
 * POST /api/chat/stream
 * Stream AI response
 */
router.post('/stream', async (req, res) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({
        error: 'Message is required',
      });
    }

    console.log('📨 Streaming chat message:', message.substring(0, 50) + '...');

    // Set headers for Server-Sent Events
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Stream the response
    for await (const chunk of vertexAIService.generateContentStream(message)) {
      res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error) {
    console.error('❌ Error in streaming endpoint:', error);
    res.status(500).json({
      error: 'Failed to stream response',
      details: error.message,
    });
  }
});

export default router;

