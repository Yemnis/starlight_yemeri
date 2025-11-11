# FFmpeg Setup Guide

The video processing pipeline requires FFmpeg and FFprobe to be installed on your system.

## Error: "Cannot find ffprobe"

If you see this error, it means FFmpeg is not installed or not in your system's PATH.

## Installation Instructions

### Windows

1. **Download FFmpeg:**
   - Go to https://www.gyan.dev/ffmpeg/builds/
   - Download the "ffmpeg-release-essentials.zip" (or "ffmpeg-release-full.zip")
   - Extract the ZIP file to a location like `C:\ffmpeg`

2. **Option A: Add to System PATH (Recommended)**
   - Press `Win + X` and select "System"
   - Click "Advanced system settings" → "Environment Variables"
   - Under "System Variables", find and select "Path", then click "Edit"
   - Click "New" and add: `C:\ffmpeg\bin` (adjust path if you extracted elsewhere)
   - Click "OK" on all dialogs
   - **Restart your terminal/command prompt** for changes to take effect

3. **Option B: Set Path in .env File**
   - Create a `.env` file in the backend directory (copy from `env.example`)
   - Add these lines:
     ```
     FFMPEG_PATH=C:/ffmpeg/bin/ffmpeg.exe
     FFPROBE_PATH=C:/ffmpeg/bin/ffprobe.exe
     ```
   - Adjust the paths to match where you extracted FFmpeg

### macOS

```bash
# Using Homebrew (recommended)
brew install ffmpeg

# Or using MacPorts
sudo port install ffmpeg
```

### Linux (Ubuntu/Debian)

```bash
sudo apt update
sudo apt install ffmpeg
```

### Linux (CentOS/RHEL)

```bash
sudo yum install epel-release
sudo yum install ffmpeg
```

## Verify Installation

After installation, verify FFmpeg is working:

```bash
# Check FFmpeg
ffmpeg -version

# Check FFprobe
ffprobe -version
```

Both commands should display version information. If they do, you're all set!

## Testing the Pipeline

1. Start the backend server:
   ```bash
   cd backend
   npm run dev
   ```

2. Upload a video through the frontend
3. Watch the processing steps in the logs:
   - Step 1/6: Extracting video metadata ✓
   - Step 2/6: Extracting audio and transcribing ✓
   - Step 3/6: Detecting and extracting scenes ✓
   - Step 4/6: Uploading scenes and analyzing ✓
   - Step 5/6: Generating embeddings ✓
   - Step 6/6: Cleaning up temporary files ✓

## Troubleshooting

### Issue: "Cannot find module 'fluent-ffmpeg'"
```bash
cd backend
npm install
```

### Issue: FFmpeg installed but still not found
- Make sure you restarted your terminal after adding to PATH
- Try using absolute paths in the `.env` file (Option B above)

### Issue: Permission denied on Linux/Mac
- Make sure FFmpeg binaries have execute permissions:
  ```bash
  chmod +x /path/to/ffmpeg
  chmod +x /path/to/ffprobe
  ```

### Still having issues?
Check the backend logs for detailed error messages. The system now provides helpful error messages indicating:
- Which step failed
- What the error was
- How to fix it

## Video Processing Pipeline

The system processes videos in 6 steps:

1. **Video Metadata** - Extracts duration, resolution, FPS, codec
2. **Transcription** - Extracts audio and transcribes with Whisper
3. **Scene Detection** - Detects scene changes in the video
4. **Scene Analysis** - Analyzes each scene with Gemini AI
5. **Embeddings** - Generates vector embeddings for search
6. **Cleanup** - Removes temporary files

Each step updates the progress in the frontend, so you can see exactly where the processing is at any time.

