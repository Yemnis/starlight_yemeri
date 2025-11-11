/**
 * Embedding Service - Handles text embeddings and vector storage with Vertex AI
 * Generates embeddings from scene data and stores in Firestore for vector search
 */
import { VertexAI } from '@google-cloud/vertexai';
import { Firestore } from '@google-cloud/firestore';
import { GoogleAuth } from 'google-auth-library';
import { config } from '../config';
import logger from '../utils/logger';
import { Scene, VectorMetadata, EmbeddingData } from '../types';

export class EmbeddingService {
  private vertexai: VertexAI;
  private firestore: Firestore;
  private auth: GoogleAuth;
  private lastEmbeddingRequestTime: number = 0;
  private minDelayBetweenRequests: number = 1000; // Start with 1 second between requests
  private consecutiveRateLimitErrors: number = 0;

  constructor() {
    this.vertexai = new VertexAI({
      project: config.gcp.projectId,
      location: config.vertexai.location,
    });
    this.firestore = new Firestore({
      projectId: config.gcp.projectId,
      databaseId: config.firestore.database,
    });
    this.auth = new GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    });
    logger.info('EmbeddingService initialized');
  }

  /**
   * Generate embedding for a single text string using Vertex AI Text Embeddings
   * with automatic rate limiting and retry logic
   */
  async generateEmbedding(text: string, retryCount: number = 0): Promise<number[]> {
    const maxRetries = 3;
    const startTime = Date.now();

    // Implement rate limiting: ensure minimum delay between requests
    const timeSinceLastRequest = Date.now() - this.lastEmbeddingRequestTime;
    if (timeSinceLastRequest < this.minDelayBetweenRequests) {
      const waitTime = this.minDelayBetweenRequests - timeSinceLastRequest;
      logger.debug('Rate limiting: waiting before embedding request', {
        operation: 'rate_limit',
        waitTime,
        minDelay: this.minDelayBetweenRequests,
      });
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    this.lastEmbeddingRequestTime = Date.now();

    try {
      // Use the REST API directly to call the embeddings endpoint
      // This bypasses the GenerateContent API that has stricter quotas
      const client = await this.auth.getClient();
      const accessToken = await client.getAccessToken();

      // Map model names: text-embedding-004 -> textembedding-gecko@003 (the actual API model name)
      // Reference: https://cloud.google.com/vertex-ai/generative-ai/docs/model-reference/text-embeddings-api
      const modelMap: Record<string, string> = {
        'text-embedding-004': 'text-embedding-004',
        'textembedding-gecko': 'textembedding-gecko@003',
        'textembedding-gecko@001': 'textembedding-gecko@001',
        'textembedding-gecko@002': 'textembedding-gecko@002',
        'textembedding-gecko@003': 'textembedding-gecko@003',
        'text-multilingual-embedding-002': 'text-multilingual-embedding-002',
      };

      const apiModel = modelMap[config.vertexai.embeddingModel] || config.vertexai.embeddingModel;
      const endpoint = `https://${config.vertexai.location}-aiplatform.googleapis.com/v1/projects/${config.gcp.projectId}/locations/${config.vertexai.location}/publishers/google/models/${apiModel}:predict`;

      logger.debug('Calling embedding API', {
        operation: 'embedding_api_call',
        model: apiModel,
        endpoint: endpoint.replace(config.gcp.projectId, 'PROJECT_ID'), // Hide project ID in logs
      });

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          instances: [
            {
              content: text,
              task_type: 'RETRIEVAL_QUERY', // For search queries
            }
          ],
          parameters: {
            autoTruncate: true,
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Embedding API error: ${response.status} ${errorText}`);
      }

      const data = await response.json() as {
        predictions?: Array<{
          embeddings?: {
            values?: number[];
            statistics?: {
              token_count?: number;
              truncated?: boolean;
            };
          };
        }>;
      };

      // Extract embedding from response
      const embeddingVector = data.predictions?.[0]?.embeddings?.values;

      if (!embeddingVector || embeddingVector.length === 0) {
        throw new Error('No embedding in response');
      }

      // Success! Reset rate limit error counter and reduce delay if it was increased
      this.consecutiveRateLimitErrors = 0;
      if (this.minDelayBetweenRequests > 1000) {
        this.minDelayBetweenRequests = Math.max(1000, this.minDelayBetweenRequests * 0.9);
        logger.debug('Reduced embedding rate limit delay', {
          operation: 'rate_limit_decrease',
          newDelay: this.minDelayBetweenRequests,
        });
      }

      const duration = Date.now() - startTime;
      logger.debug('Embedding generated', {
        operation: 'generate_embedding',
        textLength: text.length,
        embeddingDim: embeddingVector.length,
        duration,
        retryCount,
      });

      return embeddingVector;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const is429 = errorMessage.includes('429') || errorMessage.includes('Too Many Requests') || errorMessage.includes('RESOURCE_EXHAUSTED');

      if (is429) {
        this.consecutiveRateLimitErrors++;

        // Increase delay for future requests (adaptive rate limiting)
        this.minDelayBetweenRequests = Math.min(10000, this.minDelayBetweenRequests * 2);

        logger.warn('Rate limit hit, increasing delay', {
          operation: 'rate_limit_increase',
          newDelay: this.minDelayBetweenRequests,
          consecutiveErrors: this.consecutiveRateLimitErrors,
        });

        // Retry with exponential backoff if we haven't exceeded max retries
        if (retryCount < maxRetries) {
          const backoffMs = Math.pow(2, retryCount) * 3000; // 3s, 6s, 12s
          logger.info(`Retrying embedding generation after ${backoffMs}ms`, {
            operation: 'embedding_retry',
            retryCount: retryCount + 1,
          });

          await new Promise(resolve => setTimeout(resolve, backoffMs));
          return this.generateEmbedding(text, retryCount + 1);
        }
      }

      logger.error('Failed to generate embedding, using fallback', {
        operation: 'generate_embedding',
        textLength: text.length,
        error: errorMessage,
        retryCount,
      });

      // Use fallback embedding generation
      return this.generateFallbackEmbedding(text);
    }
  }

  /**
   * Generate a simple fallback embedding using text features
   * This creates a 768-dimensional vector based on text characteristics
   */
  private generateFallbackEmbedding(text: string): number[] {
    const dimension = 768;
    const embedding = new Array(dimension).fill(0);
    
    // Use text characteristics to create a pseudo-embedding
    const words = text.toLowerCase().split(/\s+/);
    const uniqueWords = new Set(words);
    
    // Hash each word and update corresponding dimensions
    words.forEach((word, idx) => {
      const hash = this.simpleHash(word);
      for (let i = 0; i < 10; i++) {
        const pos = (hash + i * 97) % dimension;
        embedding[pos] += 1.0 / (idx + 1); // Weight by position
      }
    });
    
    // Normalize the vector
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    return embedding.map(val => magnitude > 0 ? val / magnitude : 0);
  }

  /**
   * Simple string hash function
   */
  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Generate embeddings for multiple texts in batch
   * Processes sequentially to respect rate limits
   */
  async batchGenerateEmbeddings(texts: string[]): Promise<number[][]> {
    const startTime = Date.now();

    try {
      // Process sequentially - rate limiting is handled in generateEmbedding()
      const embeddings: number[][] = [];
      for (const text of texts) {
        const embedding = await this.generateEmbedding(text);
        embeddings.push(embedding);
      }

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
   * Store embedding in Firestore for vector search
   * Stores the embedding vector along with metadata for efficient retrieval
   */
  async storeEmbedding(
    sceneId: string,
    embedding: number[],
    metadata: VectorMetadata
  ): Promise<string> {
    const startTime = Date.now();

    try {
      const embeddingId = `emb_${sceneId}`;
      
      // Store embedding in Firestore
      await this.firestore.collection('embeddings').doc(embeddingId).set({
        sceneId,
        embedding,
        metadata,
        dimension: embedding.length,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const duration = Date.now() - startTime;
      logger.debug('Embedding stored in Firestore', {
        operation: 'store_embedding',
        embeddingId,
        sceneId,
        embeddingDim: embedding.length,
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
   * Delete embedding from Firestore
   */
  async deleteEmbedding(embeddingId: string): Promise<void> {
    try {
      await this.firestore.collection('embeddings').doc(embeddingId).delete();
      
      logger.info('Embedding deleted from Firestore', {
        operation: 'delete_embedding',
        embeddingId,
      });
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
   * Calculate cosine similarity between two vectors
   */
  cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Vectors must have the same length');
    }

    let dotProduct = 0;
    let magnitudeA = 0;
    let magnitudeB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      magnitudeA += a[i] * a[i];
      magnitudeB += b[i] * b[i];
    }

    magnitudeA = Math.sqrt(magnitudeA);
    magnitudeB = Math.sqrt(magnitudeB);

    if (magnitudeA === 0 || magnitudeB === 0) {
      return 0;
    }

    return dotProduct / (magnitudeA * magnitudeB);
  }

  /**
   * Search for similar embeddings using cosine similarity
   */
  async searchSimilarEmbeddings(
    queryEmbedding: number[],
    limit: number = 10,
    campaignId?: string,
    minSimilarity: number = 0.5
  ): Promise<Array<{ sceneId: string; similarity: number; metadata: VectorMetadata }>> {
    const startTime = Date.now();

    try {
      // Fetch all embeddings from Firestore
      let query = this.firestore.collection('embeddings').select('sceneId', 'embedding', 'metadata');
      
      // Apply campaign filter if provided
      if (campaignId) {
        query = query.where('metadata.campaignId', '==', campaignId) as any;
      }

      const snapshot = await query.get();
      const results: Array<{ sceneId: string; similarity: number; metadata: VectorMetadata }> = [];

      // Calculate similarity for each embedding
      const allSimilarities: Array<{ sceneId: string; similarity: number; description: string }> = [];

      snapshot.forEach(doc => {
        const data = doc.data();
        const similarity = this.cosineSimilarity(queryEmbedding, data.embedding);

        allSimilarities.push({
          sceneId: data.sceneId,
          similarity,
          description: data.metadata?.description?.substring(0, 50) || 'No description',
        });

        if (similarity >= minSimilarity) {
          results.push({
            sceneId: data.sceneId,
            similarity,
            metadata: data.metadata,
          });
        }
      });

      // Log top 5 similarities for debugging
      const topSimilarities = allSimilarities
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, 5);

      logger.debug('Top similarity scores', {
        operation: 'search_similar_embeddings',
        topScores: topSimilarities,
        threshold: minSimilarity,
      });

      // Sort by similarity descending and limit results
      results.sort((a, b) => b.similarity - a.similarity);
      const topResults = results.slice(0, limit);

      const duration = Date.now() - startTime;
      logger.debug('Similar embeddings found', {
        operation: 'search_similar_embeddings',
        totalEmbeddings: snapshot.size,
        matchingResults: results.length,
        topResults: topResults.length,
        duration,
      });

      return topResults;
    } catch (error) {
      logger.error('Failed to search similar embeddings', {
        operation: 'search_similar_embeddings',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new Error(`Similarity search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
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

      // Prepare metadata - filter out undefined values for Firestore
      const metadata: VectorMetadata = {
        videoId: scene.videoId,
        campaignId: scene.campaignId,
        sceneNumber: scene.sceneNumber,
        startTime: scene.startTime,
        endTime: scene.endTime,
        description: scene.description,
        transcript: scene.transcript,
        visualElements: scene.analysis.visualElements,
        mood: scene.analysis.mood,
      };

      // Only add product if it's defined (Firestore doesn't allow undefined)
      if (scene.analysis.product !== undefined && scene.analysis.product !== null) {
        metadata.product = scene.analysis.product;
      }

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
   * Process multiple scenes in batch with adaptive rate limiting
   * Rate limiting is now handled automatically in generateEmbedding()
   */
  async batchProcessScenes(scenes: Scene[]): Promise<Map<string, string>> {
    const startTime = Date.now();
    const results = new Map<string, string>();

    try {
      logger.info('Starting batch embedding generation', {
        operation: 'batch_process_scenes',
        count: scenes.length,
        initialDelay: this.minDelayBetweenRequests,
      });

      // Process scenes sequentially - rate limiting is handled in generateEmbedding()
      for (let i = 0; i < scenes.length; i++) {
        const scene = scenes[i];
        const { embeddingId } = await this.processScene(scene);
        results.set(scene.id, embeddingId);
      }

      const duration = Date.now() - startTime;
      const avgTimePerScene = duration / scenes.length;
      
      logger.info('Batch scene embeddings processed', {
        operation: 'batch_process_scenes',
        count: scenes.length,
        duration,
        avgTimePerScene: Math.round(avgTimePerScene),
        finalDelay: this.minDelayBetweenRequests,
        rateLimitErrors: this.consecutiveRateLimitErrors,
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
