# Frontend-Backend Connection Fix

## Problem
The frontend Chat component was not connecting to the backend when users sent messages. It was only simulating AI responses with `setTimeout` instead of making real API calls.

## Solution Overview
I've implemented proper API integration between the frontend and backend:

1. **Created API Service** (`frontend/src/services/api.ts`)
   - Centralized API communication layer
   - Handles conversation creation and message sending
   - Properly configured to use backend URL from environment variables

2. **Updated Chat Component** (`frontend/src/components/Chat.tsx`)
   - Removed simulated responses
   - Integrated with real backend API
   - Added loading states and error handling
   - Creates a conversation on mount
   - Sends messages through the API service

3. **Added Environment Configuration** (`frontend/.env`)
   - Backend URL: `http://localhost:3000/api/v1`
   - Uses Vite's environment variable system

4. **Enhanced UI/UX**
   - Loading indicator while waiting for AI response
   - Error messages displayed to user
   - Disabled input while processing
   - Better error handling and user feedback

## Files Modified

### Frontend
- ✅ `frontend/src/components/Chat.tsx` - Updated to use real API calls
- ✅ `frontend/src/components/Chat.css` - Added error and loading styles
- ✅ `frontend/src/services/api.ts` - **NEW** - API service layer
- ✅ `frontend/.env` - **NEW** - Environment configuration
- ✅ `frontend/.gitignore` - Added `.env` to prevent committing credentials

### Backend (Already configured)
- ✅ Backend has proper chat endpoints at `/api/v1/chat/conversations`
- ✅ Chat service with RAG (Retrieval-Augmented Generation)
- ✅ Proper error handling and validation

## How to Test

### Prerequisites
Make sure you have the backend properly configured with:
1. GCP credentials in `backend/config/service-account-key.json`
2. Environment variables in `backend/.env` (copy from `backend/env.example`)
3. Required environment variables:
   - `OPENAI_API_KEY` - For Whisper transcription
   - `GCP_PROJECT_ID` - Your GCP project
   - `GCS_BUCKET` - Cloud Storage bucket name

### Step 1: Start the Backend
```bash
cd backend
npm install
npm run dev
```

The backend should start on `http://localhost:3000` (or the port specified in your `.env` file).

### Step 2: Start the Frontend
```bash
cd frontend
npm install
npm run dev
```

The frontend should start on `http://localhost:5173`.

### Step 3: Test the Chat
1. Open your browser to `http://localhost:5173`
2. You should see the Chat interface on the right side
3. Type a message in the chat input
4. Press Enter or click the send button
5. You should see:
   - Your message appear immediately
   - A "Thinking..." indicator while the AI processes
   - An AI response from the backend using Gemini Pro

### Expected Behavior

**On Page Load:**
- Frontend creates a new conversation with the backend
- Console should show: `Conversation created: <conversation-id>`
- If backend is not running, you'll see an error: "Failed to connect to the server. Please check if the backend is running."

**When Sending a Message:**
1. Your message appears in the chat
2. Input is disabled with "Thinking..." indicator
3. Backend retrieves relevant context from your video scenes
4. Backend generates AI response using Gemini Pro
5. AI response appears in the chat
6. Input is re-enabled for next message

**Error Handling:**
- Connection errors show red error banner at top of chat
- Failed messages display an error message in the chat
- Console logs provide debugging information

## API Endpoints Used

The frontend now uses these backend endpoints:

1. **Create Conversation**
   - `POST /api/v1/chat/conversations`
   - Creates a new chat session
   - Can optionally be scoped to a campaign

2. **Send Message**
   - `POST /api/v1/chat/conversations/:id/messages`
   - Sends user message and receives AI response
   - Uses RAG to retrieve relevant video scenes
   - Generates contextual responses with Gemini Pro

3. **Get Conversation** (available but not yet used)
   - `GET /api/v1/chat/conversations/:id`
   - Retrieves conversation history

4. **List Conversations** (available but not yet used)
   - `GET /api/v1/chat/conversations`
   - Lists all conversations

## Troubleshooting

### "Failed to connect to the server"
- Ensure backend is running on port 3000
- Check `frontend/.env` has correct `VITE_API_URL`
- Verify no CORS issues in browser console

### "Failed to get response from AI"
- Check backend logs for errors
- Verify GCP credentials are valid
- Ensure Firestore is accessible
- Check Vertex AI API is enabled in GCP

### Backend returns 500 errors
- Check backend has valid `.env` configuration
- Verify GCP service account has necessary permissions
- Check Firestore database exists
- Ensure Vertex AI location is correct

### No response from chat
1. Open browser DevTools (F12)
2. Check Network tab for API calls
3. Look for errors in Console tab
4. Check backend terminal for error logs

## Architecture

```
Frontend (React)
    ↓
API Service (api.ts)
    ↓ HTTP POST
Backend (Express)
    ↓
Chat Controller
    ↓
Chat Service
    ├→ Search Service (RAG - retrieves relevant scenes)
    └→ Vertex AI (Gemini Pro - generates response)
    ↓
Firestore (stores conversation)
```

## Future Enhancements

Potential improvements:
1. **Streaming responses** - Use the `/api/v1/chat/stream` endpoint for real-time responses
2. **Conversation persistence** - Load previous conversations from Firestore
3. **Campaign context** - Scope conversations to specific campaigns
4. **Message history** - Display full conversation history
5. **Typing indicators** - More sophisticated loading states
6. **Message retry** - Allow users to retry failed messages
7. **Context display** - Show which video scenes were used for context

## Notes

- The backend uses Retrieval-Augmented Generation (RAG) to provide contextually relevant responses based on your uploaded video content
- Messages are stored in Firestore for conversation history
- The chat service uses Gemini Pro (via Vertex AI) for generating responses
- All API calls include proper error handling and user feedback

