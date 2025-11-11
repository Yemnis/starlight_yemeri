import express from 'express';
import cors from 'cors';
import { config } from './config/env.js';
import { authService } from './services/auth.js';
import { vertexAIService } from './services/vertexAI.js';

// Import routes
import healthRoutes from './routes/health.js';
import chatRoutes from './routes/chat.js';
import campaignRoutes from './routes/campaigns.js';

const app = express();

// Middleware
app.use(cors({
  origin: config.frontendUrl,
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Routes
app.use('/api/health', healthRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/campaigns', campaignRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'Starlight Campaign Manager API',
    version: '1.0.0',
    status: 'running',
    authentication: 'Service Account (GCP)',
    endpoints: {
      health: '/api/health',
      chat: '/api/chat',
      campaigns: '/api/campaigns',
    },
    documentation: 'See README.md for setup instructions',
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Cannot ${req.method} ${req.path}`,
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('💥 Unhandled error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message,
  });
});

// Initialize services and start server
async function startServer() {
  try {
    console.log('\n🚀 Starting Starlight Backend Server...\n');

    // Initialize authentication service
    console.log('🔐 Initializing authentication...');
    await authService.initialize();
    
    // Verify permissions
    const hasPermissions = await authService.verifyPermissions();
    if (!hasPermissions) {
      console.warn('⚠️  Warning: Service account permissions may be insufficient');
    }

    // Initialize Vertex AI
    console.log('🤖 Initializing Vertex AI...');
    await vertexAIService.initialize();

    // Start the server
    app.listen(config.port, () => {
      console.log('\n✅ Server is running!');
      console.log(`   📍 URL: http://localhost:${config.port}`);
      console.log(`   🌍 Environment: ${config.nodeEnv}`);
      console.log(`   🔒 Authentication: Service Account`);
      console.log(`   🤖 AI Model: ${config.vertexAI.model}`);
      console.log('\n📚 Available endpoints:');
      console.log(`   GET  / - API information`);
      console.log(`   GET  /api/health - Health check`);
      console.log(`   GET  /api/health/auth - Authentication status`);
      console.log(`   POST /api/chat/message - Send chat message`);
      console.log(`   POST /api/chat/stream - Stream chat response`);
      console.log(`   GET  /api/campaigns - Get all campaigns`);
      console.log(`   POST /api/campaigns - Create campaign`);
      console.log('\n💡 Ready to accept requests!\n');
    });
  } catch (error) {
    console.error('\n❌ Failed to start server:', error.message);
    console.error('\n💡 Troubleshooting:');
    console.error('   1. Ensure .env file exists with required variables');
    console.error('   2. Verify service account key file exists at the specified path');
    console.error('   3. Check that service account has necessary permissions');
    console.error('   4. Ensure GCP_PROJECT_ID is correct\n');
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('\n👋 SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\n👋 SIGINT received, shutting down gracefully...');
  process.exit(0);
});

// Start the server
startServer();

