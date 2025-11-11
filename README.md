# Starlight Yemeri - Campaign Manager

A modern campaign management application with an intuitive UI for viewing and managing advertising campaigns.

## Project Structure

```
starlight_yemeri/
├── frontend/          # Vite + React + TypeScript frontend
└── backend/           # Backend (to be implemented)
```

## Frontend

The frontend is built with:
- **Vite** - Fast build tool and development server
- **React 18** - UI library
- **TypeScript** - Type-safe development
- **Modern CSS** - Custom styling with gradients and animations

### Features

1. **Campaign Viewer**
   - View all your advertising campaigns
   - Each campaign supports up to 3 media items (images or videos)
   - Display campaign status (Active, Paused, Completed)
   - Responsive grid layout for media items
   - Side panel for easy campaign navigation

2. **Chat Interface**
   - Interactive chat component at the bottom of the screen
   - Send and receive messages
   - Simulated AI responses (ready for backend integration)
   - Smooth animations and modern design

## Getting Started

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

The application will be available at `http://localhost:5173`

### Build for Production

```bash
cd frontend
npm run build
```

## Backend Setup

The backend uses **Google Cloud Platform Service Account authentication** (recommended by Google) instead of API keys for enhanced security.

### Prerequisites
- FFmpeg installed on your system (required for video processing)
- GCP account with service account configured

```bash
cd backend
npm install

# Create service account in GCP Console
# Download JSON key to ./config/service-account-key.json
# Copy env.example to .env and configure

npm run verify  # Verify setup
npm run dev     # Start server
```

See [backend/README.md](backend/README.md) for detailed setup instructions.

## Future Enhancements

- ✅ Backend API with service account authentication
- ✅ AI chat functionality via Vertex AI
- ✅ Campaign CRUD operations
- Database integration (PostgreSQL/MongoDB)
- User authentication & authorization
- Campaign analytics dashboard
- Media upload and processing
- Real-time updates via WebSockets

