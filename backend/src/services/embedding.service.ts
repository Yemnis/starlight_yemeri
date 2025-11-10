/**
 * Embedding Service - Handles text embeddings and vector storage with Vertex AI
 * Generates embeddings from scene data and stores in Vertex AI Vector Search
 */
import { VertexAI } from '@google-cloud/vertexai';
import { config } from '../config';
import logger from '../utils/logger';
import { Scene, VectorMetadata, EmbeddingData } from '../types';

export class EmbeddingService {
  private vertexai: VertexAI;

  constructor() {
    this.vertexai = new VertexAI({
      project: config.gcp.projectId,
      location: config.vertexai.location,
    });
    logger.info('EmbeddingService initialized');
  }

  /**
   * Generate embedding for a single text string
   */
  async generateEmbedding(text: string): Promise<number[]> {
    const startTime = Date.now();

    try {
      const model = this.vertexai.preview.getGenerativeModel({
        model: config.vertexai.embeddingModel,
      });

      const request = {
        contents: [{ role: 'user', parts: [{ text }] }],
      };

      const response = await model.generateContent(request);

      // Extract embedding from response
      // Note: The actual response structure may vary based on the embedding model
      const embedding = response.response.candidates[0].content.parts[0].text;
      const embeddingVector = JSON.parse(embedding);

      const duration = Date.now() - startTime;
      logger.debug('Embedding generated', {
        operation: 'generate_embedding',
        textLength: text.length,
        embeddingDim: embeddingVector.length,
        duration,
      });

      return embeddingVector;
    } catch (error) {
      logger.error('Failed to generate embedding', {
        operation: 'generate_embedding',
        textLength: text.length,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new Error(`Embedding generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate embeddings for multiple texts in batch
   */
  async batchGenerateEmbeddings(texts: string[]): Promise<number[][]> {
    const startTime = Date.now();

    try {
      const embeddings = await Promise.all(
        texts.map(text => this.generateEmbedding(text))
      );

      const duration = Date.now() - startTime;
      logger.info('Batch embeddings generated', {
        operation: 'batch_generate_embeddings',
        count: texts.length,
        duration,
      });

      return embeddings;
    } catch (error) {
      logger.error('Failed to generate batch embeddings', {
        operation: 'batch_generate_embeddings',
        count: texts.length,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Create embedding text from scene data
   * Combines description, transcript, and analysis into a rich text representation
   */
  createEmbeddingText(scene: Scene): string {
    const parts = [
      `Scene ${scene.sceneNumber} (${scene.startTime}s - ${scene.endTime}s):`,
      scene.description,
      '',
      `Transcript: ${scene.transcript}`,
      '',
      `Visual elements: ${scene.analysis.visualElements.join(', ')}`,
      `Actions: ${scene.analysis.actions.join(', ')}`,
      `Mood: ${scene.analysis.mood}`,
    ];

    if (scene.analysis.product) {
      parts.push(`Product: ${scene.analysis.product}`);
    }

    if (scene.analysis.cta) {
      parts.push(`Call to action: ${scene.analysis.cta}`);
    }

    parts.push(`Colors: ${scene.analysis.colors.join(', ')}`);

    return parts.join('\n').trim();
  }

  /**
   * Store embedding in Vertex AI Vector Search
   * Note: This is a placeholder. Actual implementation requires setting up
   * Vertex AI Matching Engine index and using the appropriate client
   */
  async storeEmbedding(
    sceneId: string,
    embedding: number[],
    metadata: VectorMetadata
  ): Promise<string> {
    const startTime = Date.now();

    try {
      // TODO: Implement actual Vertex AI Vector Search storage
      // This requires:
      // 1. Creating/using a Matching Engine Index
      // 2. Using the MatchingEngineIndexEndpoint client
      // 3. Upserting the embedding with metadata

      // For now, we'll log and return a placeholder ID
      logger.info('Embedding stored (placeholder)', {
        operation: 'store_embedding',
        sceneId,
        embeddingDim: embedding.length,
        metadata,
      });

      // In production, this would use:
      // const indexEndpoint = aiplatform.MatchingEngineIndexEndpoint(endpoint_name);
      // await indexEndpoint.upsertDatapoints(datapoints);

      const embeddingId = `emb_${sceneId}`;
      const duration = Date.now() - startTime;

      logger.debug('Embedding storage completed', {
        operation: 'store_embedding',
        embeddingId,
        duration,
      });

      return embeddingId;
    } catch (error) {
      logger.error('Failed to store embedding', {
        operation: 'store_embedding',
        sceneId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new Error(`Embedding storage failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete embedding from vector index
   */
  async deleteEmbedding(embeddingId: string): Promise<void> {
    try {
      // TODO: Implement actual deletion from Vertex AI Vector Search
      logger.info('Embedding deleted (placeholder)', {
        operation: 'delete_embedding',
        embeddingId,
      });

      // In production:
      // const indexEndpoint = aiplatform.MatchingEngineIndexEndpoint(endpoint_name);
      // await indexEndpoint.removeDatapoints(datapoint_ids);
    } catch (error) {
      logger.error('Failed to delete embedding', {
        operation: 'delete_embedding',
        embeddingId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new Error(`Embedding deletion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Process scene and generate embedding
   */
  async processScene(scene: Scene): Promise<{ embeddingId: string; embeddingText: string }> {
    try {
      // Create embedding text
      const embeddingText = this.createEmbeddingText(scene);

      // Generate embedding
      const embedding = await this.generateEmbedding(embeddingText);

      // Prepare metadata
      const metadata: VectorMetadata = {
        videoId: scene.videoId,
        campaignId: scene.campaignId,
        sceneNumber: scene.sceneNumber,
        startTime: scene.startTime,
        endTime: scene.endTime,
        description: scene.description,
        transcript: scene.transcript,
        visualElements: scene.analysis.visualElements,
        product: scene.analysis.product,
        mood: scene.analysis.mood,
      };

      // Store in vector index
      const embeddingId = await this.storeEmbedding(scene.id, embedding, metadata);

      logger.info('Scene embedding processed', {
        operation: 'process_scene',
        sceneId: scene.id,
        embeddingId,
      });

      return { embeddingId, embeddingText };
    } catch (error) {
      logger.error('Failed to process scene embedding', {
        operation: 'process_scene',
        sceneId: scene.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Process multiple scenes in batch
   */
  async batchProcessScenes(scenes: Scene[]): Promise<Map<string, string>> {
    const startTime = Date.now();
    const results = new Map<string, string>();

    try {
      for (const scene of scenes) {
        const { embeddingId } = await this.processScene(scene);
        results.set(scene.id, embeddingId);
      }

      const duration = Date.now() - startTime;
      logger.info('Batch scene embeddings processed', {
        operation: 'batch_process_scenes',
        count: scenes.length,
        duration,
      });

      return results;
    } catch (error) {
      logger.error('Failed to batch process scene embeddings', {
        operation: 'batch_process_scenes',
        count: scenes.length,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }
}
