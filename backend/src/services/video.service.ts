/**
 * Video Service - Orchestrates the complete video processing pipeline
 * Coordinates transcription, scene detection, analysis, and embedding generation
 */
import { Firestore } from '@google-cloud/firestore';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config';
import logger from '../utils/logger';
import { Video, Scene, VideoProgress } from '../types';
import { StorageService } from './storage.service';
import { TranscriptionService } from './transcription.service';
import { SceneService } from './scene.service';
import { EmbeddingService } from './embedding.service';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { promisify } from 'util';

const unlink = promisify(fs.unlink);
const readdir = promisify(fs.readdir);

export class VideoService {
  private firestore: Firestore;
  private storageService: StorageService;
  private transcriptionService: TranscriptionService;
  private sceneService: SceneService;
  private embeddingService: EmbeddingService;

  constructor(
    storageService: StorageService,
    transcriptionService: TranscriptionService,
    sceneService: SceneService,
    embeddingService: EmbeddingService
  ) {
    this.firestore = new Firestore({
      projectId: config.gcp.projectId,
      databaseId: config.firestore.database,
    });
    this.storageService = storageService;
    this.transcriptionService = transcriptionService;
    this.sceneService = sceneService;
    this.embeddingService = embeddingService;
    logger.info('VideoService initialized');
  }

  /**
   * Create a new video record in Firestore
   */
  async createVideo(campaignId: string, fileName: string, fileSize: number): Promise<string> {
    const videoId = uuidv4();

    const video: Partial<Video> = {
      id: videoId,
      campaignId,
      fileName,
      duration: 0,
      status: 'processing',
      uploadedAt: new Date(),
      progress: {
        metadata: false,
        transcription: false,
        sceneDetection: false,
        sceneAnalysis: false,
        embeddings: false,
      },
      metadata: {
        resolution: '',
        fps: 0,
        codec: '',
        fileSize,
      },
    };

    await this.firestore.collection('videos').doc(videoId).set(video);

    logger.info('Video record created', {
      operation: 'create_video',
      videoId,
      campaignId,
      fileName,
    });

    return videoId;
  }

  /**
   * Update video progress
   */
  async updateProgress(videoId: string, progress: Partial<VideoProgress>): Promise<void> {
    await this.firestore.collection('videos').doc(videoId).update({
      progress,
      updatedAt: new Date(),
    });

    logger.debug('Video progress updated', {
      operation: 'update_progress',
      videoId,
      progress,
    });
  }

  /**
   * Update video status
   */
  async updateStatus(videoId: string, status: 'processing' | 'completed' | 'failed'): Promise<void> {
    const update: any = {
      status,
      updatedAt: new Date(),
    };

    if (status === 'completed') {
      update.processedAt = new Date();
    }

    await this.firestore.collection('videos').doc(videoId).update(update);

    logger.info('Video status updated', {
      operation: 'update_status',
      videoId,
      status,
    });
  }

  /**
   * Process video - complete pipeline
   */
  async processVideo(videoPath: string, videoId: string, campaignId: string): Promise<void> {
    const startTime = Date.now();

    try {
      logger.info('Starting video processing pipeline', {
        operation: 'process_video',
        videoId,
        campaignId,
        videoPath,
      });

      // 1. Extract video metadata
      logger.info('Step 1/6: Extracting video metadata', {
        operation: 'process_video_step',
        step: 'metadata',
        videoId,
      });
      
      try {
        const metadata = await this.sceneService.getVideoMetadata(videoPath);
        await this.firestore.collection('videos').doc(videoId).update({
          duration: metadata.duration,
          'metadata.resolution': metadata.resolution,
          'metadata.fps': metadata.fps,
          'metadata.codec': metadata.codec,
        });
        await this.updateProgress(videoId, { metadata: true });
        
        logger.info('Step 1/6 completed: Video metadata extracted', {
          operation: 'process_video_step',
          step: 'metadata',
          videoId,
          metadata,
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.error('Step 1/6 failed: Video metadata extraction', {
          operation: 'process_video_step',
          step: 'metadata',
          videoId,
          error: errorMessage,
        });
        
        // Check if it's an ffmpeg/ffprobe issue
        if (errorMessage.includes('ffprobe') || errorMessage.includes('ffmpeg')) {
          throw new Error(
            'FFmpeg/FFprobe not found. Please install FFmpeg:\n' +
            'Windows: Download from https://www.gyan.dev/ffmpeg/builds/ and add to PATH\n' +
            'Or set FFMPEG_PATH and FFPROBE_PATH in your .env file'
          );
        }
        throw error;
      }

      // 2. Extract audio and transcribe
      logger.info('Step 2/6: Extracting audio and transcribing', {
        operation: 'process_video_step',
        step: 'transcription',
        videoId,
      });
      
      const { audioUrl, transcription } = await this.transcriptionService.processVideo(videoPath, videoId);
      await this.firestore.collection('videos').doc(videoId).update({
        audioUrl,
        transcription,
      });
      await this.updateProgress(videoId, { transcription: true });
      
      logger.info('Step 2/6 completed: Audio extracted and transcribed', {
        operation: 'process_video_step',
        step: 'transcription',
        videoId,
      });

      // 3. Detect and extract scenes
      logger.info('Step 3/6: Detecting and extracting scenes', {
        operation: 'process_video_step',
        step: 'sceneDetection',
        videoId,
      });
      
      const { scenes, clips, thumbnails } = await this.sceneService.processScenes(
        videoPath,
        videoId,
        transcription
      );
      await this.updateProgress(videoId, { sceneDetection: true });
      
      logger.info('Step 3/6 completed: Scenes detected and extracted', {
        operation: 'process_video_step',
        step: 'sceneDetection',
        videoId,
        sceneCount: scenes.length,
      });

      // 4. Upload scenes and analyze
      logger.info('Step 4/6: Uploading scenes and analyzing with Gemini', {
        operation: 'process_video_step',
        step: 'sceneAnalysis',
        videoId,
        sceneCount: scenes.length,
      });
      
      const sceneRecords: Scene[] = [];

      for (let i = 0; i < scenes.length; i++) {
        const scene = scenes[i];
        const clipPath = clips[i];
        const thumbnailPath = thumbnails[i];

        // Upload clip and thumbnail to GCS
        const clipGcsPath = this.storageService.getScenePath(videoId, scene.sceneNumber);
        const thumbnailGcsPath = this.storageService.getThumbnailPath(videoId, scene.sceneNumber);

        const [clipUrl, thumbnailUrl] = await Promise.all([
          this.storageService.uploadFile(clipPath, clipGcsPath),
          this.storageService.uploadFile(thumbnailPath, thumbnailGcsPath),
        ]);

        // Map transcript to scene
        const sceneTranscript = this.sceneService.mapTranscriptToScene(
          transcription,
          scene.startTime,
          scene.endTime
        );

        // Analyze scene with Gemini
        const analysis = await this.sceneService.analyzeScene(thumbnailUrl, sceneTranscript);

        // Create scene record with analysis
        const sceneRecord: Scene = {
          id: `${videoId}_scene_${scene.sceneNumber}`,
          videoId,
          campaignId,
          sceneNumber: scene.sceneNumber,
          startTime: scene.startTime,
          endTime: scene.endTime,
          duration: scene.duration,
          clipUrl,
          thumbnailUrl,
          transcript: sceneTranscript,
          description: analysis.description,
          analysis,
          createdAt: new Date(),
        };

        // Save scene to Firestore
        await this.firestore.collection('scenes').doc(sceneRecord.id).set(sceneRecord);
        sceneRecords.push(sceneRecord);

        logger.debug(`Scene ${i + 1}/${scenes.length} analyzed`, {
          operation: 'process_scene',
          sceneId: sceneRecord.id,
        });
      }

      await this.updateProgress(videoId, { sceneAnalysis: true });
      
      logger.info('Step 4/6 completed: All scenes analyzed', {
        operation: 'process_video_step',
        step: 'sceneAnalysis',
        videoId,
        sceneCount: sceneRecords.length,
      });

      // 5. Generate and store embeddings
      logger.info('Step 5/6: Generating embeddings', {
        operation: 'process_video_step',
        step: 'embeddings',
        videoId,
      });
      
      const embeddingResults = await this.embeddingService.batchProcessScenes(sceneRecords);

      // Update scenes with embedding IDs
      for (const [sceneId, embeddingId] of embeddingResults.entries()) {
        await this.firestore.collection('scenes').doc(sceneId).update({
          embeddingId,
        });
      }

      await this.updateProgress(videoId, { embeddings: true });
      
      logger.info('Step 5/6 completed: Embeddings generated', {
        operation: 'process_video_step',
        step: 'embeddings',
        videoId,
        embeddingCount: embeddingResults.size,
      });

      // 6. Clean up temporary files
      logger.info('Step 6/6: Cleaning up temporary files', {
        operation: 'process_video_step',
        step: 'cleanup',
        videoId,
      });
      
      await this.cleanupTempFiles(videoPath, videoId);

      // Mark as completed
      await this.updateStatus(videoId, 'completed');

      // Update campaign video count
      await this.updateCampaignStats(campaignId);

      const duration = Date.now() - startTime;
      logger.info('Video processing pipeline completed', {
        operation: 'process_video',
        videoId,
        sceneCount: scenes.length,
        duration,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      logger.error('Video processing pipeline failed', {
        operation: 'process_video',
        videoId,
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
      });

      // Store error message with the video
      await this.firestore.collection('videos').doc(videoId).update({
        status: 'failed',
        errorMessage,
        updatedAt: new Date(),
      });

      throw error;
    }
  }

  /**
   * Get video by ID
   */
  async getVideo(videoId: string): Promise<Video | null> {
    try {
      const doc = await this.firestore.collection('videos').doc(videoId).get();
      if (!doc.exists) {
        return null;
      }

      const data = doc.data()!;
      return {
        id: doc.id,
        ...data,
        uploadedAt: data.uploadedAt?.toDate() || new Date(),
        processedAt: data.processedAt?.toDate(),
      } as Video;
    } catch (error) {
      logger.error('Failed to get video', {
        operation: 'get_video',
        videoId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Get video with all scenes
   */
  async getVideoWithScenes(videoId: string): Promise<{ video: Video; scenes: Scene[] } | null> {
    const video = await this.getVideo(videoId);
    if (!video) {
      return null;
    }

    const scenesSnapshot = await this.firestore
      .collection('scenes')
      .where('videoId', '==', videoId)
      .orderBy('sceneNumber', 'asc')
      .get();

    const scenes: Scene[] = [];
    scenesSnapshot.forEach(doc => {
      const data = doc.data();
      scenes.push({
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate() || new Date(),
      } as Scene);
    });

    return { video, scenes };
  }

  /**
   * Delete video and all associated data
   */
  async deleteVideo(videoId: string): Promise<void> {
    try {
      // Get all scenes for this video
      const scenesSnapshot = await this.firestore
        .collection('scenes')
        .where('videoId', '==', videoId)
        .get();

      // Delete embeddings
      for (const doc of scenesSnapshot.docs) {
        const scene = doc.data() as Scene;
        if (scene.embeddingId) {
          await this.embeddingService.deleteEmbedding(scene.embeddingId);
        }
      }

      // Delete scenes from Firestore
      const batch = this.firestore.batch();
      scenesSnapshot.docs.forEach(doc => batch.delete(doc.ref));
      await batch.commit();

      // Delete files from GCS
      await this.storageService.deleteFolder(`audio/${videoId}`);
      await this.storageService.deleteFolder(`scenes/${videoId}`);
      await this.storageService.deleteFolder(`thumbnails/${videoId}`);

      // Delete video record
      await this.firestore.collection('videos').doc(videoId).delete();

      logger.info('Video and associated data deleted', {
        operation: 'delete_video',
        videoId,
        sceneCount: scenesSnapshot.size,
      });
    } catch (error) {
      logger.error('Failed to delete video', {
        operation: 'delete_video',
        videoId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * List videos for a campaign
   */
  async listVideos(campaignId: string): Promise<Video[]> {
    const snapshot = await this.firestore
      .collection('videos')
      .where('campaignId', '==', campaignId)
      .orderBy('uploadedAt', 'desc')
      .get();

    const videos: Video[] = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      videos.push({
        id: doc.id,
        ...data,
        uploadedAt: data.uploadedAt?.toDate() || new Date(),
        processedAt: data.processedAt?.toDate(),
      } as Video);
    });

    return videos;
  }

  /**
   * Clean up temporary files
   */
  private async cleanupTempFiles(videoPath: string, videoId: string): Promise<void> {
    try {
      // Delete video file
      if (fs.existsSync(videoPath)) {
        await unlink(videoPath);
      }

      // Delete temp directory for scenes
      const tempDir = path.join(os.tmpdir(), videoId);
      if (fs.existsSync(tempDir)) {
        const files = await readdir(tempDir);
        for (const file of files) {
          await unlink(path.join(tempDir, file));
        }
        fs.rmdirSync(tempDir);
      }

      logger.debug('Temporary files cleaned up', {
        operation: 'cleanup_temp_files',
        videoId,
      });
    } catch (error) {
      logger.warn('Failed to clean up some temporary files', {
        operation: 'cleanup_temp_files',
        videoId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Update campaign statistics
   */
  private async updateCampaignStats(campaignId: string): Promise<void> {
    try {
      const videosSnapshot = await this.firestore
        .collection('videos')
        .where('campaignId', '==', campaignId)
        .where('status', '==', 'completed')
        .get();

      let videoCount = 0;
      let totalDuration = 0;

      videosSnapshot.forEach(doc => {
        const video = doc.data() as Video;
        videoCount++;
        totalDuration += video.duration;
      });

      await this.firestore.collection('campaigns').doc(campaignId).update({
        videoCount,
        totalDuration,
        updatedAt: new Date(),
      });

      logger.debug('Campaign stats updated', {
        operation: 'update_campaign_stats',
        campaignId,
        videoCount,
        totalDuration,
      });
    } catch (error) {
      logger.warn('Failed to update campaign stats', {
        operation: 'update_campaign_stats',
        campaignId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}
