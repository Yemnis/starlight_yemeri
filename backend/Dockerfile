FROM node:20-alpine

# Install FFmpeg and dependencies
RUN apk add --no-cache ffmpeg python3 make g++

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application source
COPY src ./src

# Build TypeScript
RUN npm run build

# Copy GCP credentials if available
COPY key.json ./key.json 2>/dev/null || :

# Set environment
ENV NODE_ENV=production
ENV PORT=8080

# Create logs directory
RUN mkdir -p logs

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Expose port
EXPOSE 8080

# Start application
CMD ["node", "dist/app.js"]
