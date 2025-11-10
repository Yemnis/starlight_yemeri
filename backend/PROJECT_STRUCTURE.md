# Backend Project Structure

```
backend/
├── src/
│   ├── app.ts                      # Main Express application entry point
│   ├── config/
│   │   └── index.ts                # Environment configuration loader
│   ├── types/
│   │   └── index.ts                # TypeScript type definitions
│   ├── utils/
│   │   └── logger.ts               # Winston logging utility
│   ├── middleware/
│   │   ├── error.middleware.ts     # Error handling and async wrapper
│   │   └── validation.middleware.ts # Joi request validation schemas
│   ├── services/                   # Business logic layer
│   │   ├── storage.service.ts      # Cloud Storage operations
│   │   ├── transcription.service.ts # Whisper API integration
│   │   ├── scene.service.ts        # FFmpeg + Gemini scene processing
│   │   ├── embedding.service.ts    # Vertex AI embeddings
│   │   ├── search.service.ts       # Semantic search with vector DB
│   │   ├── chat.service.ts         # RAG-powered conversational AI
│   │   ├── video.service.ts        # Video processing orchestration
│   │   └── campaign.service.ts     # Campaign management
│   └── controllers/                # API request handlers
│       ├── video.controller.ts     # Video upload and management
│       ├── campaign.controller.ts  # Campaign CRUD operations
│       ├── search.controller.ts    # Search endpoints
│       └── chat.controller.ts      # Chat conversation endpoints
├── scripts/
│   └── setup-gcp.ts                # Automated GCP resource setup
├── .env.example                    # Environment variable template
├── .gitignore                      # Git ignore rules
├── .dockerignore                   # Docker ignore rules
├── Dockerfile                      # Docker container definition
├── package.json                    # Dependencies and scripts
├── tsconfig.json                   # TypeScript configuration
├── README.md                       # Complete documentation
└── PROJECT_STRUCTURE.md            # This file
```

## Service Layer Architecture

### StorageService
- Handles Cloud Storage operations
- Uploads files and generates signed URLs
- Manages video asset lifecycle

### TranscriptionService
- Extracts audio from video using FFmpeg
- Transcribes with OpenAI Whisper API
- Provides word-level timestamps

### SceneService
- Detects scene boundaries with FFmpeg
- Extracts clips and generates thumbnails
- Analyzes scenes with Gemini 2.5 Flash
- Maps transcripts to scene timeframes

### EmbeddingService
- Generates text embeddings from scene data
- Stores vectors in Vertex AI Vector Search
- Manages batch embedding operations

### SearchService
- Performs semantic search across scenes
- Finds similar scenes by vector similarity
- Filters by visual elements and metadata
- Enriches results with signed URLs

### ChatService
- Manages conversational AI with RAG
- Retrieves relevant context from vector store
- Generates responses with Gemini Pro
- Maintains conversation history

### VideoService
- Orchestrates complete video processing pipeline
- Coordinates all other services
- Manages async processing workflow
- Updates progress and status

### CampaignService
- CRUD operations for campaigns
- Aggregates video statistics
- Generates campaign analytics

## API Endpoints

### Campaigns
- `POST /api/v1/campaigns` - Create campaign
- `GET /api/v1/campaigns` - List campaigns
- `GET /api/v1/campaigns/:id` - Get campaign details
- `PUT /api/v1/campaigns/:id` - Update campaign
- `DELETE /api/v1/campaigns/:id` - Delete campaign
- `GET /api/v1/campaigns/:id/analytics` - Get analytics

### Videos
- `POST /api/v1/videos/upload` - Upload and process video
- `GET /api/v1/videos/:id` - Get video status
- `GET /api/v1/videos/:id/full` - Get video with scenes
- `DELETE /api/v1/videos/:id` - Delete video
- `GET /api/v1/campaigns/:campaignId/videos` - List campaign videos

### Search
- `POST /api/v1/search/query` - Semantic search
- `POST /api/v1/search/similar` - Find similar scenes
- `POST /api/v1/search/visual` - Search by visual elements
- `GET /api/v1/scenes/:id` - Get scene details

### Chat
- `POST /api/v1/chat/conversations` - Create conversation
- `GET /api/v1/chat/conversations` - List conversations
- `GET /api/v1/chat/conversations/:id` - Get conversation
- `POST /api/v1/chat/conversations/:id/messages` - Send message
- `DELETE /api/v1/chat/conversations/:id` - Delete conversation

## Processing Pipeline

1. **Upload** → Video file received via multipart form
2. **Metadata** → FFmpeg extracts video properties
3. **Audio** → FFmpeg extracts audio track → Upload to GCS
4. **Transcription** → Whisper API generates transcript
5. **Scene Detection** → FFmpeg detects boundaries
6. **Scene Extraction** → Clips and thumbnails generated
7. **Upload Assets** → All media uploaded to GCS
8. **AI Analysis** → Gemini analyzes each scene
9. **Embeddings** → Vector embeddings generated
10. **Vector Storage** → Stored in Vertex AI index
11. **Completion** → Status updated, temp files cleaned

## Technology Stack

### Core
- **TypeScript** - Type-safe development
- **Node.js 20** - Runtime environment
- **Express** - Web framework

### AI/ML
- **OpenAI Whisper API** - Speech-to-text
- **Vertex AI Gemini 2.5 Flash** - Multimodal analysis
- **Vertex AI Gemini Pro** - Conversational AI
- **Vertex AI Vector Search** - Semantic search

### Storage
- **Cloud Storage** - Video asset storage
- **Firestore** - NoSQL database for metadata

### Media Processing
- **FFmpeg** - Video manipulation and analysis

### Utilities
- **Winston** - Structured logging
- **Joi** - Request validation
- **Helmet** - Security headers
- **Morgan** - HTTP request logging
- **CORS** - Cross-origin support

## Development Scripts

```bash
npm run dev          # Start development server with hot reload
npm run build        # Compile TypeScript to JavaScript
npm start            # Run production build
npm test             # Run test suite
npm run setup:gcp    # Setup GCP resources
```

## Environment Variables

See `.env.example` for complete configuration options.

### Required
- `OPENAI_API_KEY` - OpenAI API key for Whisper
- `GCP_PROJECT_ID` - Google Cloud project ID
- `GCS_BUCKET` - Cloud Storage bucket name

### Optional
- `PORT` - Server port (default: 3000)
- `NODE_ENV` - Environment mode
- `MAX_VIDEO_SIZE_MB` - Upload limit (default: 500)
- `SCENE_DETECTION_THRESHOLD` - FFmpeg sensitivity (default: 0.4)

## Deployment

### Docker
```bash
docker build -t video-analysis-api .
docker run -p 8080:8080 video-analysis-api
```

### Cloud Run
```bash
gcloud run deploy video-analysis-api \
  --image gcr.io/PROJECT_ID/video-analysis-api:latest \
  --region us-central1 \
  --memory 4Gi \
  --timeout 3600
```

## Documentation

- [README.md](./README.md) - Complete setup and usage guide
- [Specification Document](../specs.md) - Original requirements
- API documentation available via endpoints above
