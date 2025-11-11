/**
 * Scene Service - Handles scene detection, extraction, and analysis with Gemini
 * Detects scene boundaries, extracts clips, generates thumbnails, and analyzes with Gemini AI
 */
import ffmpeg from 'fluent-ffmpeg';
import { VertexAI } from '@google-cloud/vertexai';
import { config } from '../config';
import logger from '../utils/logger';
import { SceneTimestamp, SceneAnalysis, Transcription } from '../types';
import { StorageService } from './storage.service';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { promisify } from 'util';
import https from 'https';
import http from 'http';

const unlink = promisify(fs.unlink);
const mkdir = promisify(fs.mkdir);

export class SceneService {
  private vertexai: VertexAI;
  private storageService: StorageService;
  private generativeModel: any;

  constructor(storageService: StorageService) {
    this.storageService = storageService;
    this.vertexai = new VertexAI({
      project: config.gcp.projectId,
      location: config.vertexai.location,
    });
    this.generativeModel = this.vertexai.getGenerativeModel({
      model: config.vertexai.geminiNanoBananaModel,
    });
    logger.info('SceneService initialized');
  }

  /**
   * Detect scene boundaries in video using FFmpeg
   */
  async detectScenes(videoPath: string): Promise<SceneTimestamp[]> {
    const startTime = Date.now();
    const tempSceneFile = path.join(os.tmpdir(), `scenes_${Date.now()}.txt`);

    return new Promise((resolve, reject) => {
      let sceneData = '';

      ffmpeg(videoPath)
        .outputOptions([
          '-vf',
          `select='gt(scene,${config.api.sceneDetectionThreshold})',showinfo`,
          '-f',
          'null',
        ])
        .output('-')
        .on('start', (commandLine) => {
          logger.debug('FFmpeg scene detection started', {
            operation: 'detect_scenes',
            command: commandLine,
          });
        })
        .on('stderr', (stderrLine) => {
          // Parse scene detection output
          if (stderrLine.includes('pts_time:')) {
            const match = stderrLine.match(/pts_time:([\d.]+)/);
            if (match) {
              sceneData += match[1] + '\n';
            }
          }
        })
        .on('end', () => {
          const times = sceneData
            .split('\n')
            .filter(line => line.trim())
            .map(time => parseFloat(time))
            .sort((a, b) => a - b);

          // Create scene timestamps with boundaries
          const scenes: SceneTimestamp[] = [];
          for (let i = 0; i < times.length; i++) {
            scenes.push({
              sceneNumber: i,
              startTime: i === 0 ? 0 : times[i - 1],
              endTime: times[i],
              duration: times[i] - (i === 0 ? 0 : times[i - 1]),
            });
          }

          // Limit scenes if needed
          const limitedScenes = scenes.slice(0, config.api.maxScenesPerVideo);

          const duration = Date.now() - startTime;
          logger.info('Scene detection completed', {
            operation: 'detect_scenes',
            videoPath,
            sceneCount: limitedScenes.length,
            duration,
          });

          resolve(limitedScenes);
        })
        .on('error', (err) => {
          logger.error('Scene detection failed', {
            operation: 'detect_scenes',
            videoPath,
            error: err.message,
          });
          reject(new Error(`Scene detection failed: ${err.message}`));
        })
        .run();
    });
  }

  /**
   * Extract individual scene clips from video
   */
  async extractSceneClip(
    videoPath: string,
    scene: SceneTimestamp,
    outputPath: string
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .setStartTime(scene.startTime)
        .setDuration(scene.duration)
        .output(outputPath)
        .videoCodec('libx264')
        .audioCodec('aac')
        .on('end', () => {
          logger.debug('Scene clip extracted', {
            operation: 'extract_scene_clip',
            sceneNumber: scene.sceneNumber,
            outputPath,
          });
          resolve(outputPath);
        })
        .on('error', (err) => {
          logger.error('Failed to extract scene clip', {
            operation: 'extract_scene_clip',
            sceneNumber: scene.sceneNumber,
            error: err.message,
          });
          reject(new Error(`Scene clip extraction failed: ${err.message}`));
        })
        .run();
    });
  }

  /**
   * Generate thumbnail from scene at midpoint
   */
  async generateThumbnail(videoPath: string, timestamp: number, outputPath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .screenshots({
          timestamps: [timestamp],
          filename: path.basename(outputPath),
          folder: path.dirname(outputPath),
          size: config.ffmpeg.thumbnailSize,
        })
        .on('end', () => {
          logger.debug('Thumbnail generated', {
            operation: 'generate_thumbnail',
            timestamp,
            outputPath,
          });
          resolve(outputPath);
        })
        .on('error', (err) => {
          logger.error('Failed to generate thumbnail', {
            operation: 'generate_thumbnail',
            timestamp,
            error: err.message,
          });
          reject(new Error(`Thumbnail generation failed: ${err.message}`));
        });
    });
  }

  /**
   * Analyze scene using Gemini 2.5 Flash with vision capabilities
   */
  async analyzeScene(thumbnailUrl: string, transcript: string, retryCount: number = 0): Promise<SceneAnalysis> {
    const startTime = Date.now();
    const maxRetries = 2;

    try {
      const prompt = `Analyze this ad scene. Transcript: "${transcript}"

Return JSON with:
- description: brief 1-2 sentence summary
- visualElements: key visible objects/people (max 5)
- actions: main activities (max 3)
- mood: tone (energetic/calm/professional/playful)
- composition: shot type
- product: name if visible, else null
- cta: call-to-action text if present, else null
- colors: 2-3 dominant colors
- confidence: 0.0-1.0

Keep descriptions concise. Focus on key advertising elements.`;

      // Determine if URL is gs:// or https:// and construct the appropriate request
      let imagePart: any;
      
      if (thumbnailUrl.startsWith('gs://')) {
        // Use fileUri for GCS URIs
        imagePart = {
          fileData: {
            mimeType: 'image/jpeg',
            fileUri: thumbnailUrl,
          },
        };
      } else {
        // For HTTPS URLs (signed URLs), fetch and use inlineData with base64
        const imageBase64 = await this.fetchImageAsBase64(thumbnailUrl);
        imagePart = {
          inlineData: {
            mimeType: 'image/jpeg',
            data: imageBase64,
          },
        };
      }

      const request = {
        contents: [
          {
            role: 'user',
            parts: [
              imagePart,
              {
                text: prompt,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.3,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 1024, // Increased to ensure completion
          responseMimeType: 'application/json',
          // Define strict response schema to enforce complete JSON structure
          responseSchema: {
            type: 'object',
            properties: {
              description: { type: 'string' },
              visualElements: { 
                type: 'array',
                items: { type: 'string' }
              },
              actions: { 
                type: 'array',
                items: { type: 'string' }
              },
              mood: { type: 'string' },
              composition: { type: 'string' },
              product: { 
                type: ['string', 'null'],
                nullable: true
              },
              cta: { 
                type: ['string', 'null'],
                nullable: true
              },
              colors: { 
                type: 'array',
                items: { type: 'string' }
              },
              confidence: { 
                type: 'number',
                minimum: 0,
                maximum: 1
              }
            },
            required: ['description', 'visualElements', 'actions', 'mood', 'composition', 'colors', 'confidence']
          }
        },
      };

      const response = await this.generativeModel.generateContent(request);
      
      // Check for safety filters or incomplete responses
      const candidate = response.response.candidates[0];
      if (!candidate || !candidate.content || !candidate.content.parts || !candidate.content.parts[0]) {
        logger.error('Incomplete response from Gemini', {
          operation: 'analyze_scene',
          finishReason: candidate?.finishReason,
          safetyRatings: candidate?.safetyRatings,
        });
        throw new Error(`Incomplete response: ${candidate?.finishReason || 'Unknown reason'}`);
      }
      
      const resultText = candidate.content.parts[0].text;
      
      // Log finish reason for debugging truncation issues
      if (candidate.finishReason && candidate.finishReason !== 'STOP') {
        logger.warn('Non-standard finish reason detected', {
          operation: 'analyze_scene',
          finishReason: candidate.finishReason,
          responseLength: resultText.length,
        });
      }
      
      // Parse with robust error handling
      const analysis = this.parseSceneAnalysis(resultText);

      // Validate required fields
      if (!analysis.visualElements || !analysis.mood || !analysis.composition) {
        throw new Error('Invalid analysis response from Gemini - missing required fields');
      }

      const duration = Date.now() - startTime;
      logger.info('Scene analysis completed', {
        operation: 'analyze_scene',
        confidence: analysis.confidence,
        duration,
        retryCount,
      });

      return analysis;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      logger.error('Scene analysis failed', {
        operation: 'analyze_scene',
        thumbnailUrl: thumbnailUrl.substring(0, 100), // Truncate long signed URL
        error: errorMessage,
        retryCount,
      });

      // Retry with exponential backoff for transient errors
      if (retryCount < maxRetries && this.isRetryableError(errorMessage)) {
        const backoffMs = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s
        logger.info(`Retrying scene analysis after ${backoffMs}ms`, {
          operation: 'analyze_scene_retry',
          retryCount: retryCount + 1,
        });
        
        await new Promise(resolve => setTimeout(resolve, backoffMs));
        return this.analyzeScene(thumbnailUrl, transcript, retryCount + 1);
      }

      // Return fallback analysis after exhausting retries
      logger.warn('Returning fallback analysis', {
        operation: 'analyze_scene',
        retryCount,
      });
      
      return {
        description: 'Scene analysis unavailable',
        visualElements: [],
        actions: [],
        mood: 'unknown',
        composition: 'unknown',
        colors: [],
        confidence: 0,
      };
    }
  }

  /**
   * Robust JSON parser that handles common issues with LLM responses
   */
  private parseSceneAnalysis(text: string): SceneAnalysis {
    try {
      // Clean the response text
      let cleanedText = text.trim();
      
      // Remove markdown code blocks if present
      cleanedText = cleanedText.replace(/^```json\s*/i, '').replace(/\s*```$/i, '');
      cleanedText = cleanedText.replace(/^```\s*/i, '').replace(/\s*```$/i, '');
      
      // Try to find JSON object bounds if response includes extra text
      const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        cleanedText = jsonMatch[0];
      }
      
      // Parse the cleaned JSON
      const parsed = JSON.parse(cleanedText);
      
      // Ensure all required fields have valid values
      return {
        description: parsed.description || 'No description available',
        visualElements: Array.isArray(parsed.visualElements) ? parsed.visualElements : [],
        actions: Array.isArray(parsed.actions) ? parsed.actions : [],
        mood: parsed.mood || 'neutral',
        composition: parsed.composition || 'medium shot',
        product: parsed.product || null,
        cta: parsed.cta || null,
        colors: Array.isArray(parsed.colors) ? parsed.colors : [],
        confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.5,
      };
    } catch (parseError) {
      // Log the actual response that failed to parse for debugging
      logger.error('Failed to parse scene analysis JSON', {
        operation: 'parse_scene_analysis',
        error: parseError instanceof Error ? parseError.message : 'Unknown error',
        responsePreview: text.substring(0, 200), // First 200 chars for debugging
        responseLength: text.length,
      });
      
      throw new Error(`JSON parsing failed: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`);
    }
  }

  /**
   * Determine if an error is worth retrying
   */
  private isRetryableError(errorMessage: string): boolean {
    const retryablePatterns = [
      /json/i,
      /parse/i,
      /timeout/i,
      /network/i,
      /503/i,
      /429/i, // Rate limit
      /500/i, // Server error
    ];
    
    return retryablePatterns.some(pattern => pattern.test(errorMessage));
  }

  /**
   * Fetch image from URL and convert to base64
   * This is required for HTTPS URLs since Vertex AI's fileUri only supports gs:// URIs
   */
  private async fetchImageAsBase64(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const client = url.startsWith('https:') ? https : http;
      
      client.get(url, (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(`Failed to fetch image: HTTP ${response.statusCode}`));
          return;
        }

        const chunks: Buffer[] = [];
        
        response.on('data', (chunk: Buffer) => {
          chunks.push(chunk);
        });
        
        response.on('end', () => {
          const buffer = Buffer.concat(chunks);
          const base64 = buffer.toString('base64');
          
          logger.debug('Image fetched and encoded', {
            operation: 'fetch_image_base64',
            url: url.substring(0, 100),
            sizeBytes: buffer.length,
          });
          
          resolve(base64);
        });
        
        response.on('error', (err) => {
          reject(new Error(`Failed to fetch image: ${err.message}`));
        });
      }).on('error', (err) => {
        reject(new Error(`Failed to fetch image: ${err.message}`));
      });
    });
  }

  /**
   * Process all scenes for a video
   */
  async processScenes(
    videoPath: string,
    videoId: string,
    transcription: Transcription
  ): Promise<{
    scenes: SceneTimestamp[];
    clips: string[];
    thumbnails: string[];
  }> {
    // Detect scenes
    const scenes = await this.detectScenes(videoPath);

    // Create temp directory for clips and thumbnails
    const tempDir = path.join(os.tmpdir(), videoId);
    await mkdir(tempDir, { recursive: true });

    const clips: string[] = [];
    const thumbnails: string[] = [];

    // Process each scene
    for (const scene of scenes) {
      const clipPath = path.join(tempDir, `scene_${scene.sceneNumber.toString().padStart(3, '0')}.mp4`);
      const thumbnailPath = path.join(tempDir, `scene_${scene.sceneNumber.toString().padStart(3, '0')}.jpg`);

      // Extract clip
      await this.extractSceneClip(videoPath, scene, clipPath);
      clips.push(clipPath);

      // Generate thumbnail at scene midpoint
      const midpoint = scene.startTime + scene.duration / 2;
      await this.generateThumbnail(videoPath, midpoint, thumbnailPath);
      thumbnails.push(thumbnailPath);
    }

    logger.info('All scenes processed', {
      operation: 'process_scenes',
      videoId,
      sceneCount: scenes.length,
    });

    return { scenes, clips, thumbnails };
  }

  /**
   * Map transcript to scene time range
   */
  mapTranscriptToScene(transcription: Transcription, startTime: number, endTime: number): string {
    const wordsInRange = transcription.words.filter(
      word => word.start >= startTime && word.end <= endTime
    );

    if (wordsInRange.length === 0) {
      return '';
    }

    return wordsInRange.map(w => w.word).join(' ').trim();
  }

  /**
   * Get video metadata using FFmpeg probe
   */
  async getVideoMetadata(videoPath: string): Promise<{
    duration: number;
    resolution: string;
    fps: number;
    codec: string;
  }> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(videoPath, (err, metadata) => {
        if (err) {
          logger.error('Failed to get video metadata', {
            operation: 'get_video_metadata',
            videoPath,
            error: err.message,
          });
          reject(new Error(`Video metadata extraction failed: ${err.message}`));
          return;
        }

        const videoStream = metadata.streams.find(s => s.codec_type === 'video');
        if (!videoStream) {
          reject(new Error('No video stream found'));
          return;
        }

        const result = {
          duration: metadata.format.duration || 0,
          resolution: `${videoStream.width}x${videoStream.height}`,
          fps: eval(videoStream.r_frame_rate || '0') || 0,
          codec: videoStream.codec_name || 'unknown',
        };

        logger.debug('Video metadata extracted', {
          operation: 'get_video_metadata',
          ...result,
        });

        resolve(result);
      });
    });
  }
}
