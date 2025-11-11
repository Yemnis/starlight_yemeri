/**
 * Core type definitions for the video analysis system
 */

export type VideoStatus = 'processing' | 'completed' | 'failed';

export interface VideoProgress {
  transcription: boolean;
  sceneDetection: boolean;
  sceneAnalysis: boolean;
  embeddings: boolean;
}

export interface VideoMetadata {
  resolution: string;
  fps: number;
  codec: string;
  fileSize: number;
}

export interface Video {
  id: string;
  campaignId: string;
  fileName: string;
  duration: number;
  status: VideoStatus;
  uploadedAt: Date;
  processedAt?: Date;
  audioUrl?: string;
  progress: VideoProgress;
  transcription?: Transcription;
  metadata: VideoMetadata;
}

export interface Word {
  word: string;
  start: number;
  end: number;
  probability: number;
}

export interface TranscriptSegment {
  id: number;
  start: number;
  end: number;
  text: string;
}

export interface Transcription {
  text: string;
  language: string;
  segments: TranscriptSegment[];
  words: Word[];
}

export interface SceneAnalysis {
  description: string;
  visualElements: string[];
  actions: string[];
  mood: string;
  composition: string;
  product?: string;
  cta?: string;
  colors: string[];
  confidence: number;
}

export interface Scene {
  id: string;
  videoId: string;
  campaignId: string;
  sceneNumber: number;
  startTime: number;
  endTime: number;
  duration: number;
  clipUrl: string;
  thumbnailUrl: string;
  transcript: string;
  description: string;
  analysis: SceneAnalysis;
  embeddingId?: string;
  createdAt: Date;
}

export interface Campaign {
  id: string;
  name: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
  videoCount: number;
  totalDuration: number;
  indexName: string;
  indexEndpoint: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  context?: {
    scenes: Scene[];
    videos: Video[];
  };
}

export interface ChatConversation {
  id: string;
  campaignId?: string;
  messages: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
}

export interface SceneTimestamp {
  sceneNumber: number;
  startTime: number;
  endTime: number;
  duration: number;
}

export interface SearchOptions {
  campaignId?: string;
  limit?: number;
  filters?: {
    mood?: string;
    product?: string;
    minConfidence?: number;
    visualElements?: string[];
  };
}

export interface SearchResult {
  scene: Scene;
  video: Pick<Video, 'id' | 'fileName' | 'duration'>;
  score: number;
  highlights?: string[];
}

export interface VectorMetadata {
  videoId: string;
  campaignId: string;
  sceneNumber: number;
  startTime: number;
  endTime: number;
  description: string;
  transcript: string;
  visualElements: string[];
  product?: string;
  mood: string;
}

export interface EmbeddingData {
  id: string;
  embedding: number[];
  metadata: VectorMetadata;
}
