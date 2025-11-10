/**
 * Video Controller - Handles video upload and management endpoints
 */
import { Request, Response } from 'express';
import { UploadedFile } from 'express-fileupload';
import { VideoService } from '../services/video.service';
import { CampaignService } from '../services/campaign.service';
import { AppError, asyncHandler } from '../middleware/error.middleware';
import { config } from '../config';
import logger from '../utils/logger';
import path from 'path';
import fs from 'fs';

export class VideoController {
  constructor(
    private videoService: VideoService,
    private campaignService: CampaignService
  ) {}

  /**
   * Upload and process video
   * POST /api/v1/videos/upload
   */
  uploadVideo = asyncHandler(async (req: Request, res: Response) => {
    if (!req.files || !req.files.file) {
      throw new AppError('No file uploaded', 400);
    }

    const { campaignId } = req.body;
    if (!campaignId) {
      throw new AppError('Campaign ID is required', 400);
    }

    // Verify campaign exists
    const campaign = await this.campaignService.getCampaign(campaignId);
    if (!campaign) {
      throw new AppError('Campaign not found', 404);
    }

    const file = req.files.file as UploadedFile;

    // Validate file size
    const maxSize = config.api.maxVideoSizeMB * 1024 * 1024;
    if (file.size > maxSize) {
      throw new AppError(`File size exceeds ${config.api.maxVideoSizeMB}MB limit`, 400);
    }

    // Validate file type
    const allowedTypes = ['video/mp4', 'video/quicktime', 'video/x-msvideo'];
    if (!allowedTypes.includes(file.mimetype)) {
      throw new AppError('Invalid file type. Only MP4, MOV, and AVI are supported', 400);
    }

    // Create video record
    const videoId = await this.videoService.createVideo(campaignId, file.name, file.size);

    // Save file temporarily
    const tempPath = path.join('/tmp', `${videoId}${path.extname(file.name)}`);
    await file.mv(tempPath);

    // Start async processing (don't await)
    this.videoService.processVideo(tempPath, videoId, campaignId).catch(err => {
      logger.error('Video processing failed', {
        operation: 'upload_video_async',
        videoId,
        error: err.message,
      });
    });

    res.status(202).json({
      success: true,
      data: {
        videoId,
        status: 'processing',
        message: 'Video processing started',
      },
    });
  });

  /**
   * Get video progress
   * GET /api/v1/videos/:id
   */
  getVideo = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const video = await this.videoService.getVideo(id);
    if (!video) {
      throw new AppError('Video not found', 404);
    }

    res.json({
      success: true,
      data: video,
    });
  });

  /**
   * Get video with all scenes
   * GET /api/v1/videos/:id/full
   */
  getVideoWithScenes = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const result = await this.videoService.getVideoWithScenes(id);
    if (!result) {
      throw new AppError('Video not found', 404);
    }

    res.json({
      success: true,
      data: result,
    });
  });

  /**
   * Delete video
   * DELETE /api/v1/videos/:id
   */
  deleteVideo = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const video = await this.videoService.getVideo(id);
    if (!video) {
      throw new AppError('Video not found', 404);
    }

    await this.videoService.deleteVideo(id);

    res.json({
      success: true,
      message: 'Video and all associated data deleted',
    });
  });

  /**
   * List videos for a campaign
   * GET /api/v1/campaigns/:campaignId/videos
   */
  listVideos = asyncHandler(async (req: Request, res: Response) => {
    const { campaignId } = req.params;

    const videos = await this.videoService.listVideos(campaignId);

    res.json({
      success: true,
      data: videos,
    });
  });
}
