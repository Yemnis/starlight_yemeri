import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

// Load environment variables from .env file
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Validate required environment variables
const requiredEnvVars = [
  'GCP_PROJECT_ID',
  'GCP_LOCATION',
  'GOOGLE_APPLICATION_CREDENTIALS',
];

const missingEnvVars = requiredEnvVars.filter((envVar) => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  console.error('❌ Missing required environment variables:');
  missingEnvVars.forEach((envVar) => console.error(`   - ${envVar}`));
  console.error('\n💡 Please copy env.example to .env and fill in the values.');
  process.exit(1);
}

// Resolve the path to the service account key file
const serviceAccountPath = resolve(process.cwd(), process.env.GOOGLE_APPLICATION_CREDENTIALS);

export const config = {
  // Server configuration
  port: process.env.PORT || 3001,
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // CORS configuration
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  
  // Google Cloud Platform configuration
  gcp: {
    projectId: process.env.GCP_PROJECT_ID,
    location: process.env.GCP_LOCATION,
    credentials: serviceAccountPath,
  },
  
  // Vertex AI configuration
  vertexAI: {
    model: process.env.VERTEX_AI_MODEL || 'gemini-1.5-pro',
    endpoint: process.env.VERTEX_AI_ENDPOINT || 'us-central1-aiplatform.googleapis.com',
  },
};

// Log configuration on startup (excluding sensitive data)
console.log('✅ Configuration loaded:');
console.log(`   - Environment: ${config.nodeEnv}`);
console.log(`   - Port: ${config.port}`);
console.log(`   - GCP Project: ${config.gcp.projectId}`);
console.log(`   - GCP Location: ${config.gcp.location}`);
console.log(`   - Vertex AI Model: ${config.vertexAI.model}`);
console.log(`   - Service Account: ${serviceAccountPath}`);

