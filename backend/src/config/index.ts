/**
 * Configuration module - loads and validates environment variables
 */
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config();

interface Config {
  env: string;
  port: number;
  openai: {
    apiKey: string;
  };
  gcp: {
    projectId: string;
    location: string;
    serviceAccountKey: string;
  };
  storage: {
    bucket: string;
  };
  vertexai: {
    location: string;
    geminiNanoBananaModel: string;
    geminiProModel: string;
    embeddingModel: string;
  };
  vectorSearch: {
    indexId: string;
    indexEndpoint: string;
  };
  firestore: {
    database: string;
  };
  api: {
    maxVideoSizeMB: number;
    signedUrlExpiryHours: number;
    maxScenesPerVideo: number;
    sceneDetectionThreshold: number;
  };
  ffmpeg: {
    audioBitrate: string;
    sampleRate: number;
    thumbnailSize: string;
  };
}

const getConfig = (): Config => {
  const requiredEnvVars = [
    'OPENAI_API_KEY',
    'GCP_PROJECT_ID',
    'GCS_BUCKET',
  ];

  // Validate required environment variables
  const missing = requiredEnvVars.filter(envVar => !process.env[envVar]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  return {
    env: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT || '3000', 10),
    openai: {
      apiKey: process.env.OPENAI_API_KEY!,
    },
    gcp: {
      projectId: process.env.GCP_PROJECT_ID!,
      location: process.env.GCP_LOCATION || 'us-central1',
      serviceAccountKey: process.env.GCP_SERVICE_ACCOUNT_KEY || './key.json',
    },
    storage: {
      bucket: process.env.GCS_BUCKET!,
    },
    vertexai: {
      location: process.env.VERTEX_AI_LOCATION || 'us-central1',
      geminiNanoBananaModel: process.env.GEMINI_NANO_BANANA_MODEL || 'gemini-2.5-flash',
      geminiProModel: process.env.GEMINI_PRO_MODEL || 'gemini-1.5-pro',
      embeddingModel: process.env.EMBEDDING_MODEL || 'text-embedding-004',
    },
    vectorSearch: {
      indexId: process.env.VECTOR_INDEX_ID || '',
      indexEndpoint: process.env.VECTOR_INDEX_ENDPOINT || '',
    },
    firestore: {
      database: process.env.FIRESTORE_DATABASE || '(default)',
    },
    api: {
      maxVideoSizeMB: parseInt(process.env.MAX_VIDEO_SIZE_MB || '500', 10),
      signedUrlExpiryHours: parseInt(process.env.SIGNED_URL_EXPIRY_HOURS || '1', 10),
      maxScenesPerVideo: parseInt(process.env.MAX_SCENES_PER_VIDEO || '20', 10),
      sceneDetectionThreshold: parseFloat(process.env.SCENE_DETECTION_THRESHOLD || '0.4'),
    },
    ffmpeg: {
      audioBitrate: process.env.FFMPEG_AUDIO_BITRATE || '128k',
      sampleRate: parseInt(process.env.FFMPEG_SAMPLE_RATE || '16000', 10),
      thumbnailSize: process.env.FFMPEG_THUMBNAIL_SIZE || '1024x1024',
    },
  };
};

export const config = getConfig();
