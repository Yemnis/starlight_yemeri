import express from 'express';
import { authService } from '../services/auth.js';
import { vertexAIService } from '../services/vertexAI.js';

const router = express.Router();

/**
 * GET /api/health
 * Health check endpoint
 */
router.get('/', async (req, res) => {
  try {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        server: 'operational',
        authentication: 'unknown',
        vertexAI: 'unknown',
      },
    };

    // Check authentication service
    try {
      await authService.initialize();
      health.services.authentication = 'operational';
    } catch (error) {
      health.services.authentication = 'error';
      health.status = 'degraded';
    }

    // Check Vertex AI service
    try {
      await vertexAIService.initialize();
      health.services.vertexAI = 'operational';
    } catch (error) {
      health.services.vertexAI = 'error';
      health.status = 'degraded';
    }

    const statusCode = health.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json(health);
  } catch (error) {
    console.error('❌ Health check error:', error);
    res.status(503).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * GET /api/health/auth
 * Check authentication status
 */
router.get('/auth', async (req, res) => {
  try {
    const verified = await authService.verifyPermissions();
    
    res.json({
      authenticated: verified,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      authenticated: false,
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;

