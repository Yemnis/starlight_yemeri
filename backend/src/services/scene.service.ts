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
import { promisify } from 'util';

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
    const tempSceneFile = path.join('/tmp', `scenes_${Date.now()}.txt`);

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
  async analyzeScene(thumbnailUrl: string, transcript: string): Promise<SceneAnalysis> {
    const startTime = Date.now();

    try {
      const prompt = `Analyze this advertising video scene. Transcript: "${transcript}"

Provide detailed JSON analysis:
{
  "description": "2-3 sentences describing what's visible and happening",
  "visualElements": ["array", "of", "visible", "objects"],
  "actions": ["array", "of", "activities"],
  "mood": "emotional tone (energetic/calm/professional/playful)",
  "composition": "shot type and camera angle",
  "product": "product name if visible, else null",
  "cta": "call to action text if present, else null",
  "colors": ["dominant", "color", "palette"],
  "confidence": 0.0-1.0
}

Be specific and detailed. Focus on advertising-relevant elements.`;

      const request = {
        contents: [
          {
            role: 'user',
            parts: [
              {
                fileData: {
                  mimeType: 'image/jpeg',
                  fileUri: thumbnailUrl,
                },
              },
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
          maxOutputTokens: 500,
          responseMimeType: 'application/json',
        },
      };

      const response = await this.generativeModel.generateContent(request);
      const resultText = response.response.candidates[0].content.parts[0].text;
      const analysis: SceneAnalysis = JSON.parse(resultText);

      // Validate required fields
      if (!analysis.visualElements || !analysis.mood || !analysis.composition) {
        throw new Error('Invalid analysis response from Gemini');
      }

      const duration = Date.now() - startTime;
      logger.info('Scene analysis completed', {
        operation: 'analyze_scene',
        confidence: analysis.confidence,
        duration,
      });

      return analysis;
    } catch (error) {
      logger.error('Scene analysis failed', {
        operation: 'analyze_scene',
        thumbnailUrl,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      // Return fallback analysis
      return {
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
    const tempDir = path.join('/tmp', videoId);
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
