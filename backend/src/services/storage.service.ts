/**
 * Storage Service - Handles Cloud Storage operations
 * Manages file uploads, downloads, and signed URL generation
 */
import { Storage, File } from '@google-cloud/storage';
import { config } from '../config';
import logger from '../utils/logger';
import path from 'path';
import fs from 'fs';

export class StorageService {
  private storage: Storage;
  private bucket: string;

  constructor() {
    this.storage = new Storage({
      projectId: config.gcp.projectId,
      keyFilename: config.gcp.serviceAccountKey,
    });
    this.bucket = config.storage.bucket;
    logger.info('StorageService initialized', { bucket: this.bucket });
  }

  /**
   * Upload a local file to Cloud Storage
   */
  async uploadFile(localPath: string, gcsPath: string): Promise<string> {
    const startTime = Date.now();

    try {
      const bucket = this.storage.bucket(this.bucket);
      const file = bucket.file(gcsPath);

      await bucket.upload(localPath, {
        destination: gcsPath,
        metadata: {
          cacheControl: 'public, max-age=3600',
        },
      });

      const duration = Date.now() - startTime;
      logger.info('File uploaded to GCS', {
        operation: 'upload_file',
        localPath,
        gcsPath,
        duration,
      });

      return `gs://${this.bucket}/${gcsPath}`;
    } catch (error) {
      logger.error('Failed to upload file to GCS', {
        operation: 'upload_file',
        localPath,
        gcsPath,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new Error(`Storage upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Upload a buffer directly to Cloud Storage
   */
  async streamUpload(buffer: Buffer, gcsPath: string, contentType?: string): Promise<string> {
    const startTime = Date.now();

    try {
      const bucket = this.storage.bucket(this.bucket);
      const file = bucket.file(gcsPath);

      await file.save(buffer, {
        metadata: {
          contentType: contentType || 'application/octet-stream',
          cacheControl: 'public, max-age=3600',
        },
      });

      const duration = Date.now() - startTime;
      logger.info('Buffer uploaded to GCS', {
        operation: 'stream_upload',
        gcsPath,
        size: buffer.length,
        duration,
      });

      return `gs://${this.bucket}/${gcsPath}`;
    } catch (error) {
      logger.error('Failed to stream upload to GCS', {
        operation: 'stream_upload',
        gcsPath,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new Error(`Storage stream upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete a file from Cloud Storage
   */
  async deleteFile(gcsPath: string): Promise<void> {
    try {
      const bucket = this.storage.bucket(this.bucket);
      const file = bucket.file(gcsPath);

      await file.delete();

      logger.info('File deleted from GCS', {
        operation: 'delete_file',
        gcsPath,
      });
    } catch (error) {
      logger.error('Failed to delete file from GCS', {
        operation: 'delete_file',
        gcsPath,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new Error(`Storage delete failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete all files with a given prefix (e.g., all files for a video)
   */
  async deleteFolder(prefix: string): Promise<void> {
    try {
      const bucket = this.storage.bucket(this.bucket);
      const [files] = await bucket.getFiles({ prefix });

      await Promise.all(files.map(file => file.delete()));

      logger.info('Folder deleted from GCS', {
        operation: 'delete_folder',
        prefix,
        fileCount: files.length,
      });
    } catch (error) {
      logger.error('Failed to delete folder from GCS', {
        operation: 'delete_folder',
        prefix,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new Error(`Storage folder delete failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate a signed URL for temporary access to a file
   */
  async generateSignedUrl(gcsPath: string, expiresIn: number = config.api.signedUrlExpiryHours * 3600): Promise<string> {
    try {
      const bucket = this.storage.bucket(this.bucket);
      const file = bucket.file(gcsPath);

      const [signedUrl] = await file.getSignedUrl({
        version: 'v4',
        action: 'read',
        expires: Date.now() + expiresIn * 1000,
      });

      logger.debug('Generated signed URL', {
        operation: 'generate_signed_url',
        gcsPath,
        expiresIn,
      });

      return signedUrl;
    } catch (error) {
      logger.error('Failed to generate signed URL', {
        operation: 'generate_signed_url',
        gcsPath,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new Error(`Signed URL generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check if a file exists in Cloud Storage
   */
  async fileExists(gcsPath: string): Promise<boolean> {
    try {
      const bucket = this.storage.bucket(this.bucket);
      const file = bucket.file(gcsPath);
      const [exists] = await file.exists();
      return exists;
    } catch (error) {
      logger.error('Failed to check file existence', {
        operation: 'file_exists',
        gcsPath,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  /**
   * Get GCS path helpers
   */
  getAudioPath(videoId: string): string {
    return `audio/${videoId}.mp3`;
  }

  getScenePath(videoId: string, sceneNumber: number): string {
    const sceneNum = sceneNumber.toString().padStart(3, '0');
    return `scenes/${videoId}/scene_${sceneNum}.mp4`;
  }

  getThumbnailPath(videoId: string, sceneNumber: number): string {
    const sceneNum = sceneNumber.toString().padStart(3, '0');
    return `thumbnails/${videoId}/scene_${sceneNum}.jpg`;
  }

  getVideoPrefix(videoId: string): string {
    return `${videoId}/`;
  }
}
