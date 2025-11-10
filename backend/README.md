# Starlight Video Analysis API

A production-ready video ingestion and retrieval system that processes advertising videos, extracts multimodal metadata, enables semantic search, and provides conversational Q&A capabilities.

## Features

- **Video Processing**: Upload and process videos with automatic scene detection
- **Audio Transcription**: OpenAI Whisper API integration for word-level transcription
- **AI Scene Analysis**: Gemini 2.5 Flash for multimodal video/image understanding
- **Semantic Search**: Vector embeddings with Vertex AI for intelligent scene retrieval
- **Conversational AI**: RAG-powered chat interface using Gemini Pro
- **Cloud Storage**: GCS for video artifacts with signed URL access
- **Metadata Storage**: Firestore for structured data persistence

## Tech Stack

- **Runtime**: Node.js 20 + TypeScript
- **Framework**: Express.js
- **AI Services**:
  - OpenAI Whisper API (transcription)
  - GCP Vertex AI Gemini 2.5 Flash (scene analysis)
  - GCP Vertex AI Gemini Pro (conversational AI)
  - Vertex AI Vector Search (embeddings)
- **Storage**: GCP Cloud Storage, Firestore
- **Media Processing**: FFmpeg
- **Deployment**: Docker, Cloud Run

## Prerequisites

- Node.js 20 LTS or higher
- FFmpeg 6.0+
- GCP Account with billing enabled
- OpenAI API account
- Git

## Installation

### 1. Clone Repository

```bash
git clone <repository-url>
cd backend
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment

Copy the example environment file:

```bash
cp .env.example .env.local
```

Edit `.env.local` with your credentials:

```env
# Node Environment
NODE_ENV=development
PORT=3000

# OpenAI Whisper API
OPENAI_API_KEY=sk-proj-your-key-here

# GCP Configuration
GCP_PROJECT_ID=your-project-id
GCP_LOCATION=us-central1
GCP_SERVICE_ACCOUNT_KEY=./key.json

# Cloud Storage
GCS_BUCKET=your-project-id-video-assets

# Vertex AI
VERTEX_AI_LOCATION=us-central1
GEMINI_NANO_BANANA_MODEL=gemini-2.5-flash
GEMINI_PRO_MODEL=gemini-1.5-pro
EMBEDDING_MODEL=text-embedding-004

# Vector Search (create these via GCP Console)
VECTOR_INDEX_ID=projects/.../indexes/...
VECTOR_INDEX_ENDPOINT=projects/.../indexEndpoints/...
```

### 4. GCP Setup

Download your GCP service account key:

```bash
# Via GCP Console:
# 1. Go to IAM & Admin > Service Accounts
# 2. Create or select a service account
# 3. Create a key (JSON format)
# 4. Save as key.json in the backend directory
```

Run the automated setup script:

```bash
npm run setup:gcp
```

This will:
- Create Cloud Storage bucket
- Configure CORS and lifecycle policies
- Verify Firestore connection
- Test Vertex AI access

### 5. Create Vector Search Index

Follow the [Vertex AI documentation](https://cloud.google.com/vertex-ai/docs/matching-engine/create-manage-index) to create a vector search index:

```bash
# Example using gcloud CLI
gcloud ai index-endpoints create \
  --display-name=video-scenes-endpoint \
  --project=your-project-id \
  --region=us-central1
```

Update `VECTOR_INDEX_ID` and `VECTOR_INDEX_ENDPOINT` in your `.env.local` file.

## Development

### Run Development Server

```bash
npm run dev
```

Server will start on `http://localhost:3000`

### Build for Production

```bash
npm run build
```

### Run Tests

```bash
npm test
```

## API Documentation

### Base URL

```
http://localhost:3000/api/v1
```

### Campaigns

#### Create Campaign
```http
POST /campaigns
Content-Type: application/json

{
  "name": "Summer 2025 Campaign",
  "description": "Beach lifestyle products"
}
```

#### Get Campaign
```http
GET /campaigns/:id
```

#### Get Campaign Analytics
```http
GET /campaigns/:id/analytics
```

### Videos

#### Upload Video
```http
POST /videos/upload
Content-Type: multipart/form-data

{
  "file": <video file>,
  "campaignId": "uuid"
}
```

#### Get Video Status
```http
GET /videos/:id
```

#### Get Video with Scenes
```http
GET /videos/:id/full
```

### Search

#### Semantic Search
```http
POST /search/query
Content-Type: application/json

{
  "query": "product reveal with energetic mood",
  "campaignId": "uuid",
  "limit": 10,
  "filters": {
    "mood": "energetic",
    "minConfidence": 0.7
  }
}
```

#### Find Similar Scenes
```http
POST /search/similar
Content-Type: application/json

{
  "sceneId": "video_uuid_scene_3",
  "limit": 5
}
```

#### Search by Visual Elements
```http
POST /search/visual
Content-Type: application/json

{
  "elements": ["product", "person", "outdoor"],
  "matchAll": false,
  "limit": 20
}
```

### Chat

#### Create Conversation
```http
POST /chat/conversations
Content-Type: application/json

{
  "campaignId": "uuid"
}
```

#### Send Message
```http
POST /chat/conversations/:id/messages
Content-Type: application/json

{
  "message": "Show me all scenes with product reveals"
}
```

## Video Processing Pipeline

1. **Upload**: Client uploads video file
2. **Metadata Extraction**: FFmpeg extracts video properties
3. **Audio Extraction**: FFmpeg extracts audio track
4. **Transcription**: Whisper API generates word-level transcript
5. **Scene Detection**: FFmpeg detects scene boundaries
6. **Scene Extraction**: Individual clips and thumbnails generated
7. **AI Analysis**: Gemini analyzes each scene with visual + transcript
8. **Embedding Generation**: Creates vector embeddings for search
9. **Storage**: Uploads all assets to Cloud Storage
10. **Completion**: Updates status and campaign statistics

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   Express API Server                         │
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Video      │  │   Search     │  │    Chat      │      │
│  │  Controller  │  │  Controller  │  │  Controller  │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
│         │                  │                  │              │
│         ▼                  ▼                  ▼              │
│  ┌─────────────────────────────────────────────────┐        │
│  │              Service Layer                       │        │
│  │  VideoService | TranscriptionService             │        │
│  │  SceneService | EmbeddingService                 │        │
│  │  SearchService | ChatService                     │        │
│  │  StorageService                                  │        │
│  └─────────────────────────────────────────────────┘        │
└────────────────────────┬────────────────────────────────────┘
                         │
         ┌───────────────┼───────────────┬───────────────┐
         ▼               ▼               ▼               ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐ ┌────────┐
│   Whisper    │  │Gemini 2.5    │  │  Vertex AI   │ │ Gemini │
│     API      │  │    Flash     │  │Vector Search │ │  Pro   │
│  (OpenAI)    │  │  (Analysis)  │  │    (GCP)     │ │ (Chat) │
└──────────────┘  └──────────────┘  └──────────────┘ └────────┘

┌─────────────────────────────────────────────────────────────┐
│                      Data Layer (GCP)                        │
│  ┌──────────────┐  ┌──────────────┐                         │
│  │  Firestore   │  │Cloud Storage │                         │
│  │  (Metadata)  │  │  (Assets)    │                         │
│  └──────────────┘  └──────────────┘                         │
└─────────────────────────────────────────────────────────────┘
```

## Deployment

### Docker

Build image:
```bash
docker build -t video-analysis-api .
```

Run container:
```bash
docker run -p 8080:8080 \
  -e GCP_PROJECT_ID=your-project \
  -e OPENAI_API_KEY=your-key \
  -e GCS_BUCKET=your-bucket \
  -v /path/to/key.json:/app/key.json \
  video-analysis-api
```

### Cloud Run

Deploy to Cloud Run:
```bash
gcloud run deploy video-analysis-api \
  --image gcr.io/PROJECT_ID/video-analysis-api:latest \
  --platform managed \
  --region us-central1 \
  --memory 4Gi \
  --cpu 2 \
  --timeout 3600 \
  --max-instances 5 \
  --service-account video-analysis-sa@PROJECT_ID.iam.gserviceaccount.com \
  --allow-unauthenticated
```

## Monitoring

### Health Check

```bash
curl http://localhost:3000/health
```

Response:
```json
{
  "status": "ok",
  "timestamp": "2025-11-10T12:00:00Z",
  "services": {
    "firestore": "configured",
    "storage": "configured",
    "vertexai": "configured",
    "whisper": "configured"
  },
  "version": "1.0.0"
}
```

### Logs

Logs are written to:
- Console (all environments)
- `logs/error.log` (production only)
- `logs/combined.log` (production only)

## Cost Estimation

### Development/Testing (100 videos/month)
- Whisper API: ~$0.45
- Gemini Analysis: ~$2.00
- Vertex AI: ~$5.10
- Storage & Compute: ~$2.50
- **Total: ~$10/month**

### Production (500 videos/month)
- Whisper API: ~$2.25
- Gemini Analysis: ~$10.00
- Vertex AI: ~$16.00
- Storage & Compute: ~$28.00
- **Total: ~$57/month**

## Troubleshooting

### FFmpeg not found
```bash
# macOS
brew install ffmpeg

# Ubuntu
sudo apt-get install ffmpeg

# Windows
choco install ffmpeg
```

### GCP Authentication Error
```bash
# Set environment variable
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json

# Or use gcloud auth
gcloud auth application-default login
```

### Video Processing Stuck
- Check FFmpeg is installed and accessible
- Verify video file is in supported format (MP4, MOV, AVI)
- Check file size is under limit (500MB default)
- Review logs for detailed error messages

## Contributing

1. Create a feature branch
2. Make your changes
3. Add tests
4. Submit a pull request

## License

MIT

## Support

For issues and questions, please open an issue on GitHub or contact the team.
