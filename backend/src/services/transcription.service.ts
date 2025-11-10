/**
 * Transcription Service - Handles audio extraction and transcription with Whisper API
 * Extracts audio from video, uploads to GCS, and transcribes using OpenAI Whisper
 */
import OpenAI from 'openai';
import ffmpeg from 'fluent-ffmpeg';
import { config } from '../config';
import logger from '../utils/logger';
import { Transcription, Word, TranscriptSegment } from '../types';
import { StorageService } from './storage.service';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';

const unlink = promisify(fs.unlink);

export class TranscriptionService {
  private openai: OpenAI;
  private storageService: StorageService;

  constructor(storageService: StorageService) {
    this.openai = new OpenAI({
      apiKey: config.openai.apiKey,
    });
    this.storageService = storageService;
    logger.info('TranscriptionService initialized');
  }

  /**
   * Extract audio from video file using FFmpeg
   */
  async extractAudio(videoPath: string, outputPath: string): Promise<string> {
    const startTime = Date.now();

    return new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .noVideo()
        .audioCodec('libmp3lame')
        .audioBitrate(config.ffmpeg.audioBitrate)
        .audioFrequency(config.ffmpeg.sampleRate)
        .output(outputPath)
        .on('start', (commandLine) => {
          logger.debug('FFmpeg audio extraction started', {
            operation: 'extract_audio',
            command: commandLine,
          });
        })
        .on('end', () => {
          const duration = Date.now() - startTime;
          logger.info('Audio extracted successfully', {
            operation: 'extract_audio',
            videoPath,
            outputPath,
            duration,
          });
          resolve(outputPath);
        })
        .on('error', (err) => {
          logger.error('Failed to extract audio', {
            operation: 'extract_audio',
            videoPath,
            error: err.message,
          });
          reject(new Error(`Audio extraction failed: ${err.message}`));
        })
        .run();
    });
  }

  /**
   * Transcribe audio file using OpenAI Whisper API
   */
  async transcribe(audioPath: string): Promise<Transcription> {
    const startTime = Date.now();

    try {
      const audioFile = fs.createReadStream(audioPath);

      logger.info('Starting Whisper transcription', {
        operation: 'transcribe',
        audioPath,
      });

      const response = await this.openai.audio.transcriptions.create({
        file: audioFile,
        model: 'whisper-1',
        response_format: 'verbose_json',
        timestamp_granularities: ['word', 'segment'],
      });

      const duration = Date.now() - startTime;

      // Parse the response into our Transcription type
      const transcription: Transcription = {
        text: response.text,
        language: response.language || 'en',
        segments: (response.segments || []).map((seg: any) => ({
          id: seg.id,
          start: seg.start,
          end: seg.end,
          text: seg.text,
        })),
        words: (response.words || []).map((word: any) => ({
          word: word.word,
          start: word.start,
          end: word.end,
          probability: 1.0, // Whisper doesn't provide probability in API response
        })),
      };

      logger.info('Transcription completed', {
        operation: 'transcribe',
        audioPath,
        language: transcription.language,
        wordCount: transcription.words.length,
        segmentCount: transcription.segments.length,
        duration,
      });

      return transcription;
    } catch (error) {
      logger.error('Transcription failed', {
        operation: 'transcribe',
        audioPath,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new Error(`Transcription failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Process video: extract audio, upload to GCS, and transcribe
   */
  async processVideo(videoPath: string, videoId: string): Promise<{ audioUrl: string; transcription: Transcription }> {
    const tempAudioPath = path.join('/tmp', `${videoId}.mp3`);

    try {
      // Extract audio from video
      await this.extractAudio(videoPath, tempAudioPath);

      // Upload audio to Cloud Storage
      const audioGcsPath = this.storageService.getAudioPath(videoId);
      const audioUrl = await this.storageService.uploadFile(tempAudioPath, audioGcsPath);

      // Transcribe audio
      const transcription = await this.transcribe(tempAudioPath);

      // Clean up temp audio file
      await unlink(tempAudioPath);

      logger.info('Video audio processing completed', {
        operation: 'process_video',
        videoId,
        audioUrl,
      });

      return { audioUrl, transcription };
    } catch (error) {
      // Clean up temp file on error
      try {
        if (fs.existsSync(tempAudioPath)) {
          await unlink(tempAudioPath);
        }
      } catch (cleanupError) {
        logger.warn('Failed to clean up temp audio file', {
          operation: 'process_video_cleanup',
          tempAudioPath,
        });
      }

      throw error;
    }
  }

  /**
   * Map transcript words to a specific time range
   * Used to extract transcript for individual scenes
   */
  mapTranscriptToTimeRange(transcription: Transcription, startTime: number, endTime: number): string {
    const wordsInRange = transcription.words.filter(
      word => word.start >= startTime && word.end <= endTime
    );

    if (wordsInRange.length === 0) {
      return '';
    }

    return wordsInRange.map(w => w.word).join(' ').trim();
  }
}
