/**
 * Search Service - Handles semantic search and scene retrieval
 * Performs vector similarity search and enriches results with metadata
 */
import { Firestore } from '@google-cloud/firestore';
import { config } from '../config';
import logger from '../utils/logger';
import { Scene, SearchOptions, SearchResult, Video } from '../types';
import { EmbeddingService } from './embedding.service';
import { StorageService } from './storage.service';

export class SearchService {
  private firestore: Firestore;
  private embeddingService: EmbeddingService;
  private storageService: StorageService;

  constructor(embeddingService: EmbeddingService, storageService: StorageService) {
    this.firestore = new Firestore({
      projectId: config.gcp.projectId,
      databaseId: config.firestore.database,
    });
    this.embeddingService = embeddingService;
    this.storageService = storageService;
    logger.info('SearchService initialized');
  }

  /**
   * Perform semantic search across scenes using vector similarity
   */
  async queryScenes(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    const startTime = Date.now();

    try {
      // Analyze query to determine search strategy
      const searchStrategy = this.analyzeQuery(query);
      
      logger.info('Query analyzed', {
        operation: 'query_scenes',
        query,
        strategy: searchStrategy.type,
        useVectorSearch: searchStrategy.useVectorSearch,
      });

      let scenes: Scene[] = [];

      if (searchStrategy.useVectorSearch) {
        // Use vector similarity search for semantic queries
        scenes = await this.performVectorSearch(query, options);
      } else {
        // Use traditional Firestore query for simple/filtered queries
        scenes = await this.performTraditionalSearch(query, options);
      }

      // Enrich results with video metadata and signed URLs
      const results = await this.enrichResults(scenes, query);

      const duration = Date.now() - startTime;
      logger.info('Scene query completed', {
        operation: 'query_scenes',
        query,
        strategy: searchStrategy.type,
        resultCount: results.length,
        duration,
      });

      return results;
    } catch (error) {
      logger.error('Scene query failed', {
        operation: 'query_scenes',
        query,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new Error(`Search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Analyze query to determine optimal search strategy
   */
  private analyzeQuery(query: string): { type: string; useVectorSearch: boolean } {
    const queryLower = query.toLowerCase();
    
    // Keywords that indicate semantic/conceptual search
    const semanticKeywords = [
      'like', 'similar', 'showing', 'with', 'about', 'featuring',
      'scene', 'video', 'moment', 'part', 'feel', 'mood', 'vibe',
      'happy', 'sad', 'energetic', 'calm', 'exciting', 'emotional'
    ];

    // Keywords that indicate specific filter search
    const filterKeywords = ['exact', 'id:', 'campaign:', 'product:'];

    // Check for filter keywords (prefer traditional search)
    const hasFilterKeywords = filterKeywords.some(kw => queryLower.includes(kw));
    if (hasFilterKeywords) {
      return { type: 'filtered', useVectorSearch: false };
    }

    // Check for semantic keywords or longer descriptive queries
    const hasSemanticKeywords = semanticKeywords.some(kw => queryLower.includes(kw));
    const isDescriptive = query.split(/\s+/).length > 3; // More than 3 words
    
    if (hasSemanticKeywords || isDescriptive) {
      return { type: 'semantic', useVectorSearch: true };
    }

    // Short queries without specific intent - use vector search for better results
    return { type: 'general', useVectorSearch: true };
  }

  /**
   * Perform vector similarity search
   */
  private async performVectorSearch(query: string, options: SearchOptions): Promise<Scene[]> {
    // Generate query embedding
    const queryEmbedding = await this.embeddingService.generateEmbedding(query);

    // Search for similar embeddings
    const similarEmbeddings = await this.embeddingService.searchSimilarEmbeddings(
      queryEmbedding,
      options.limit || 20,
      options.campaignId,
      0.0 // minimum similarity threshold - show all results for debugging
    );

    // Fetch scene documents
    const scenes: Scene[] = [];
    for (const result of similarEmbeddings) {
      try {
        const sceneDoc = await this.firestore.collection('scenes').doc(result.sceneId).get();
        if (sceneDoc.exists) {
          const sceneData = sceneDoc.data();
          const scene = {
            id: sceneDoc.id,
            ...sceneData,
            createdAt: sceneData?.createdAt?.toDate() || new Date(),
            vectorSimilarity: result.similarity, // Add similarity score for ranking
          } as Scene & { vectorSimilarity?: number };
          scenes.push(scene);
        }
      } catch (err) {
        logger.warn('Failed to fetch scene from vector search result', {
          sceneId: result.sceneId,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }

    // Apply additional filters
    return this.applyFilters(scenes, options);
  }

  /**
   * Perform traditional Firestore search with filters
   */
  private async performTraditionalSearch(query: string, options: SearchOptions): Promise<Scene[]> {
    let scenesQuery = this.firestore.collection('scenes').limit(options.limit || 10);

    if (options.campaignId) {
      scenesQuery = scenesQuery.where('campaignId', '==', options.campaignId) as any;
    }

    if (options.filters?.mood) {
      scenesQuery = scenesQuery.where('analysis.mood', '==', options.filters.mood) as any;
    }

    if (options.filters?.product) {
      scenesQuery = scenesQuery.where('analysis.product', '==', options.filters.product) as any;
    }

    const snapshot = await scenesQuery.get();
    const scenes: Scene[] = [];

    snapshot.forEach(doc => {
      const data = doc.data();
      scenes.push({
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate() || new Date(),
      } as Scene);
    });

    return this.applyFilters(scenes, options);
  }

  /**
   * Apply filters to scene results
   */
  private applyFilters(scenes: Scene[], options: SearchOptions): Scene[] {
    let filtered = scenes;

    // Filter by confidence if specified
    if (options.filters?.minConfidence) {
      filtered = filtered.filter(
        scene => scene.analysis.confidence >= options.filters!.minConfidence!
      );
    }

    // Filter by visual elements if specified
    if (options.filters?.visualElements && options.filters.visualElements.length > 0) {
      filtered = filtered.filter(scene =>
        options.filters!.visualElements!.some(element =>
          scene.analysis.visualElements.includes(element)
        )
      );
    }

    return filtered;
  }

  /**
   * Find scenes similar to a given scene
   */
  async findSimilarScenes(sceneId: string, limit: number = 5, campaignId?: string): Promise<SearchResult[]> {
    const startTime = Date.now();

    try {
      // Get the source scene
      const sceneDoc = await this.firestore.collection('scenes').doc(sceneId).get();
      if (!sceneDoc.exists) {
        throw new Error('Scene not found');
      }

      const sourceScene = {
        id: sceneDoc.id,
        ...sceneDoc.data(),
      } as Scene;

      // Use the scene's description and metadata to find similar scenes
      const searchText = this.embeddingService.createEmbeddingText(sourceScene);

      // Query for similar scenes
      const results = await this.queryScenes(searchText, {
        campaignId,
        limit: limit + 1, // +1 to exclude source scene
      });

      // Filter out the source scene
      const similarScenes = results.filter(result => result.scene.id !== sceneId).slice(0, limit);

      const duration = Date.now() - startTime;
      logger.info('Similar scenes found', {
        operation: 'find_similar_scenes',
        sceneId,
        resultCount: similarScenes.length,
        duration,
      });

      return similarScenes;
    } catch (error) {
      logger.error('Failed to find similar scenes', {
        operation: 'find_similar_scenes',
        sceneId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Search scenes by visual elements
   */
  async searchByElements(
    elements: string[],
    campaignId?: string,
    matchAll: boolean = false,
    limit: number = 20
  ): Promise<SearchResult[]> {
    const startTime = Date.now();

    try {
      let query = this.firestore.collection('scenes').limit(limit);

      if (campaignId) {
        query = query.where('campaignId', '==', campaignId) as any;
      }

      const snapshot = await query.get();
      const scenes: Scene[] = [];

      snapshot.forEach(doc => {
        const data = doc.data();
        const scene = {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate() || new Date(),
        } as Scene;

        // Filter by visual elements
        const hasElements = matchAll
          ? elements.every(element => scene.analysis.visualElements.includes(element))
          : elements.some(element => scene.analysis.visualElements.includes(element));

        if (hasElements) {
          scenes.push(scene);
        }
      });

      // Enrich results
      const results = await this.enrichResults(scenes, elements.join(', '));

      const duration = Date.now() - startTime;
      logger.info('Visual element search completed', {
        operation: 'search_by_elements',
        elements,
        matchAll,
        resultCount: results.length,
        duration,
      });

      return results;
    } catch (error) {
      logger.error('Visual element search failed', {
        operation: 'search_by_elements',
        elements,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Enrich search results with video metadata and signed URLs
   */
  private async enrichResults(scenes: Scene[], query: string): Promise<SearchResult[]> {
    const results: SearchResult[] = [];

    for (const scene of scenes) {
      try {
        // Get video metadata
        const videoDoc = await this.firestore.collection('videos').doc(scene.videoId).get();
        if (!videoDoc.exists) {
          logger.warn('Video not found for scene', { sceneId: scene.id, videoId: scene.videoId });
          continue;
        }

        const video = videoDoc.data() as Video;

        // Generate signed URLs for clip and thumbnail
        const [clipUrl, thumbnailUrl] = await Promise.all([
          this.storageService.generateSignedUrl(
            this.storageService.getScenePath(scene.videoId, scene.sceneNumber)
          ),
          this.storageService.generateSignedUrl(
            this.storageService.getThumbnailPath(scene.videoId, scene.sceneNumber)
          ),
        ]);

        // Update URLs in scene
        scene.clipUrl = clipUrl;
        scene.thumbnailUrl = thumbnailUrl;

        // Calculate relevance score (placeholder - would use actual vector similarity)
        const score = this.calculateRelevanceScore(scene, query);

        // Extract highlights
        const highlights = this.extractHighlights(scene, query);

        results.push({
          scene,
          video: {
            id: video.id,
            fileName: video.fileName,
            duration: video.duration,
          },
          score,
          highlights,
        });
      } catch (error) {
        logger.warn('Failed to enrich scene result', {
          sceneId: scene.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // Sort by score descending
    return results.sort((a, b) => b.score - a.score);
  }

  /**
   * Calculate relevance score for a scene based on query
   * Uses vector similarity when available, otherwise falls back to keyword matching
   */
  private calculateRelevanceScore(scene: Scene & { vectorSimilarity?: number }, query: string): number {
    // If we have vector similarity score, use it as primary score
    if (scene.vectorSimilarity !== undefined) {
      return scene.vectorSimilarity;
    }

    // Fall back to keyword-based scoring
    const queryLower = query.toLowerCase();
    let score = scene.analysis.confidence * 0.5; // Base confidence score

    // Boost score if query terms appear in description
    if (scene.description.toLowerCase().includes(queryLower)) {
      score += 0.2;
    }

    // Boost if in transcript
    if (scene.transcript.toLowerCase().includes(queryLower)) {
      score += 0.15;
    }

    // Boost if in visual elements
    const queryWords = queryLower.split(/\s+/);
    for (const word of queryWords) {
      if (scene.analysis.visualElements.some(el => el.toLowerCase().includes(word))) {
        score += 0.1;
      }
    }

    return Math.min(score, 1.0);
  }

  /**
   * Extract relevant highlights from scene based on query
   */
  private extractHighlights(scene: Scene, query: string): string[] {
    const highlights: string[] = [];
    const queryWords = query.toLowerCase().split(/\s+/);

    // Add matching visual elements
    for (const element of scene.analysis.visualElements) {
      if (queryWords.some(word => element.toLowerCase().includes(word))) {
        highlights.push(element);
      }
    }

    // Add mood if relevant
    if (queryWords.some(word => scene.analysis.mood.toLowerCase().includes(word))) {
      highlights.push(scene.analysis.mood);
    }

    // Add product if relevant and exists
    if (scene.analysis.product) {
      if (queryWords.some(word => scene.analysis.product!.toLowerCase().includes(word))) {
        highlights.push(scene.analysis.product);
      }
    }

    return [...new Set(highlights)]; // Remove duplicates
  }

  /**
   * Get scene by ID with enriched data
   */
  async getScene(sceneId: string): Promise<SearchResult | null> {
    try {
      const sceneDoc = await this.firestore.collection('scenes').doc(sceneId).get();
      if (!sceneDoc.exists) {
        return null;
      }

      const scene = {
        id: sceneDoc.id,
        ...sceneDoc.data(),
        createdAt: sceneDoc.data()?.createdAt?.toDate() || new Date(),
      } as Scene;

      const results = await this.enrichResults([scene], '');
      return results[0] || null;
    } catch (error) {
      logger.error('Failed to get scene', {
        operation: 'get_scene',
        sceneId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }
}
