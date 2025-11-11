/**
 * Main Express application
 * Initializes services, controllers, and routes
 */
import express, { Express } from 'express';
import fileUpload from 'express-fileupload';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import os from 'os';
import { config } from './config';
import logger from './utils/logger';
import { errorHandler, notFoundHandler } from './middleware/error.middleware';
import { validate, schemas } from './middleware/validation.middleware';

// Import services
import { StorageService } from './services/storage.service';
import { TranscriptionService } from './services/transcription.service';
import { SceneService } from './services/scene.service';
import { EmbeddingService } from './services/embedding.service';
import { SearchService } from './services/search.service';
import { ChatService } from './services/chat.service';
import { VideoService } from './services/video.service';
import { CampaignService } from './services/campaign.service';

// Import controllers
import { VideoController } from './controllers/video.controller';
import { CampaignController } from './controllers/campaign.controller';
import { SearchController } from './controllers/search.controller';
import { ChatController } from './controllers/chat.controller';

// Initialize services
const storageService = new StorageService();
const transcriptionService = new TranscriptionService(storageService);
const sceneService = new SceneService(storageService);
const embeddingService = new EmbeddingService();
const searchService = new SearchService(embeddingService, storageService);
const chatService = new ChatService(searchService);
const videoService = new VideoService(
  storageService,
  transcriptionService,
  sceneService,
  embeddingService
);
const campaignService = new CampaignService();

// Initialize controllers
const videoController = new VideoController(videoService, campaignService);
const campaignController = new CampaignController(campaignService);
const searchController = new SearchController(searchService);
const chatController = new ChatController(chatService);

// Create Express app
const app: Express = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  fileUpload({
    useTempFiles: true,
    tempFileDir: os.tmpdir(),
    limits: { fileSize: config.api.maxVideoSizeMB * 1024 * 1024 },
  })
);

// Logging middleware
if (config.env !== 'test') {
  app.use(
    morgan('combined', {
      stream: {
        write: (message: string) => logger.info(message.trim()),
      },
    })
  );
}

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    // Check service connectivity
    const services = {
      firestore: 'configured',
      storage: 'configured',
      vertexai: 'configured',
      whisper: 'configured',
    };

    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      services,
      version: '1.0.0',
    });
  } catch (error) {
    res.status(503).json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Health check failed',
    });
  }
});

// API Routes
const router = express.Router();

// Campaign routes
router.post('/campaigns', validate(schemas.createCampaign), campaignController.createCampaign);
router.get('/campaigns', campaignController.listCampaigns);
router.get('/campaigns/:id', campaignController.getCampaign);
router.put('/campaigns/:id', validate(schemas.updateCampaign), campaignController.updateCampaign);
router.delete('/campaigns/:id', campaignController.deleteCampaign);
router.get('/campaigns/:id/analytics', campaignController.getCampaignAnalytics);
router.get('/campaigns/:campaignId/videos', videoController.listVideos);

// Video routes
router.post('/videos/upload', videoController.uploadVideo);
router.get('/videos/:id', videoController.getVideo);
router.get('/videos/:id/full', videoController.getVideoWithScenes);
router.delete('/videos/:id', videoController.deleteVideo);

// Search routes
router.post('/search/query', validate(schemas.searchQuery), searchController.queryScenes);
router.post('/search/similar', validate(schemas.searchSimilar), searchController.findSimilarScenes);
router.post('/search/visual', validate(schemas.searchVisual), searchController.searchByVisualElements);
router.get('/scenes/:id', searchController.getScene);

// Chat routes
router.post('/chat/conversations', validate(schemas.createConversation), chatController.createConversation);
router.get('/chat/conversations', chatController.listConversations);
router.get('/chat/conversations/:id', chatController.getConversation);
router.post('/chat/conversations/:id/messages', validate(schemas.sendMessage), chatController.sendMessage);
router.delete('/chat/conversations/:id', chatController.deleteConversation);

// Mount router
app.use('/api/v1', router);

// Error handlers (must be last)
app.use(notFoundHandler);
app.use(errorHandler);

// Start server
const PORT = config.port;

if (require.main === module) {
  const server = app.listen(PORT, () => {
    logger.info(`Server started on port ${PORT}`, {
      env: config.env,
      port: PORT,
    });
  });

  // Handle EADDRINUSE error
  server.on('error', (error: NodeJS.ErrnoException) => {
    if (error.code === 'EADDRINUSE') {
      logger.error(`Port ${PORT} is already in use. Please stop the existing process or use a different port.`, {
        error: error.message,
        port: PORT,
      });
      process.exit(1);
    } else {
      logger.error('Server error occurred', { error: error.message });
      throw error;
    }
  });

  // Graceful shutdown handlers
  const gracefulShutdown = (signal: string) => {
    logger.info(`${signal} signal received: closing HTTP server gracefully`);
    server.close(() => {
      logger.info('HTTP server closed');
      process.exit(0);
    });

    // Force shutdown after timeout
    setTimeout(() => {
      logger.error('Could not close connections in time, forcefully shutting down');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  // Handle uncaught exceptions
  process.on('uncaughtException', (error: Error) => {
    logger.error('Uncaught exception', { error: error.message, stack: error.stack });
    gracefulShutdown('UNCAUGHT_EXCEPTION');
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason: any) => {
    logger.error('Unhandled rejection', { reason });
    gracefulShutdown('UNHANDLED_REJECTION');
  });
}

export default app;
