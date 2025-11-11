# Starlight Backend

Node.js backend for the Starlight Campaign Manager with Google Cloud Platform integration using **Service Account authentication**.

## Features

- ✅ RESTful API for campaign management
- ✅ Vertex AI integration for AI-powered chat
- ✅ Service Account authentication (secure, no API keys)
- ✅ Health check endpoints
- ✅ CORS enabled for frontend integration

## Prerequisites

- Node.js 18+ installed
- **FFmpeg** installed on your system (required for video processing)
- Google Cloud Platform account with billing enabled
- GCP project with Vertex AI API enabled

### Install FFmpeg

```bash
# macOS
brew install ffmpeg

# Ubuntu/Debian
sudo apt-get install ffmpeg

# Windows (using Chocolatey)
choco install ffmpeg
```

## Quick Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Create Service Account (GCP Console)

1. Go to [Service Accounts](https://console.cloud.google.com/iam-admin/serviceaccounts)
2. Click **"CREATE SERVICE ACCOUNT"**
3. Name: `starlight-backend`
4. Grant these roles:
   - **Vertex AI User** (for AI/ML operations)
   - **Storage Object Admin** (for Cloud Storage access)
   - **Cloud Datastore User** (for Firestore access)
5. Go to **Keys** tab → **Add Key** → **Create new key** → **JSON**
6. Download the JSON key file

### 3. Create Cloud Storage Bucket

1. Go to [Cloud Storage](https://console.cloud.google.com/storage)
2. Click **"CREATE BUCKET"**
3. Name it (e.g., `starlight-videos`)
4. Choose region: `us-central1` (same as GCP_LOCATION)
5. Leave default settings and click **"CREATE"**

### 4. Get OpenAI API Key

1. Go to https://platform.openai.com/api-keys
2. Sign up or log in
3. Click **"Create new secret key"**
4. Copy the key (starts with `sk-proj-...`)

### 5. Configure Environment

```bash
# Copy template
cp env.example .env

# Place your service account key
mv ~/Downloads/your-project-*.json ./config/service-account-key.json
```

Edit `.env` with your values:

```env
# REQUIRED
OPENAI_API_KEY=sk-proj-your-actual-key
GCP_PROJECT_ID=your-gcp-project-id
GCS_BUCKET=your-bucket-name
GOOGLE_APPLICATION_CREDENTIALS=./config/service-account-key.json

# BASIC CONFIG
PORT=3001
GCP_LOCATION=us-central1
FRONTEND_URL=http://localhost:5173
```

### 6. Enable Required APIs

```bash
gcloud services enable aiplatform.googleapis.com
```

### 7. Verify Setup

```bash
npm run verify
```

### 8. Deploy Firestore Indexes

Firestore requires composite indexes for complex queries. Deploy them using:

**Option 1: One-Click Link (Fastest)**
When you get an index error, the error message includes a direct link. Click it to create the index automatically.

**Option 2: Deploy via Firebase CLI**
```bash
# Install Firebase CLI globally
npm install -g firebase-tools

# Login to Firebase
firebase login

# Deploy indexes (Windows)
cd backend
scripts\deploy-indexes.bat

# Deploy indexes (Mac/Linux)
cd backend
chmod +x scripts/deploy-indexes.sh
./scripts/deploy-indexes.sh
```

Wait 2-5 minutes for indexes to build. Check status at [Firebase Console](https://console.firebase.google.com/project/gen-lang-client-0082081331/firestore/indexes).

### 9. Start Server

```bash
# Development mode
npm run dev

# Production mode
npm start
```

Server runs at `http://localhost:3001`

## API Endpoints

### Health Check
```http
GET /api/health
GET /api/health/auth
```

### Chat (AI)
```http
POST /api/chat/message
Content-Type: application/json

{
  "message": "Your message here",
  "history": []  // optional
}
```

### Campaigns
```http
GET /api/campaigns
GET /api/campaigns/:id
POST /api/campaigns
```

## Service Account Security

⚠️ **IMPORTANT**:
- Never commit `config/service-account-key.json` to version control (already in `.gitignore`)
- Never share your service account key
- Rotate keys every 90 days
- Only grant minimum required permissions

## Troubleshooting

| Error | Solution |
|-------|----------|
| Missing environment variables | Copy `env.example` to `.env` and fill in values |
| Service account key not found | Place JSON key at `./config/service-account-key.json` |
| Permission denied | Grant "Vertex AI User" role to service account in GCP Console |
| API not enabled | Run: `gcloud services enable aiplatform.googleapis.com` |
| **Firestore index error** | Click the link in the error message OR run `scripts/deploy-indexes.bat` |
| FFmpeg not found | Install FFmpeg using the instructions above |

## Project Structure

```
backend/
├── config/
│   └── service-account-key.json  # Your GCP credentials (gitignored)
├── src/
│   ├── config/
│   │   └── env.js                # Environment configuration
│   ├── routes/
│   │   ├── health.js             # Health check endpoints
│   │   ├── chat.js               # AI chat endpoints
│   │   └── campaigns.js          # Campaign CRUD endpoints
│   ├── services/
│   │   ├── auth.js               # GCP authentication
│   │   └── vertexAI.js           # Vertex AI integration
│   └── server.js                 # Main Express server
├── .env                          # Environment config (gitignored)
├── env.example                   # Environment template
└── package.json
```

## Resources

- [Service Accounts](https://cloud.google.com/iam/docs/service-accounts)
- [Vertex AI Documentation](https://cloud.google.com/vertex-ai/docs)
- [Application Default Credentials](https://cloud.google.com/docs/authentication/application-default-credentials)
