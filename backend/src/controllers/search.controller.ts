/**
 * Search Controller - Handles search and retrieval endpoints
 */
import { Request, Response } from 'express';
import { SearchService } from '../services/search.service';
import { AppError, asyncHandler } from '../middleware/error.middleware';

export class SearchController {
  constructor(private searchService: SearchService) {}

  /**
   * Semantic search across scenes
   * POST /api/v1/search/query
   */
  queryScenes = asyncHandler(async (req: Request, res: Response) => {
    const { query, campaignId, limit, filters } = req.body;

    const startTime = Date.now();
    const results = await this.searchService.queryScenes(query, {
      campaignId,
      limit,
      filters,
    });
    const processingTime = (Date.now() - startTime) / 1000;

    res.json({
      success: true,
      data: {
        query,
        results,
        count: results.length,
        processingTime,
      },
    });
  });

  /**
   * Find similar scenes
   * POST /api/v1/search/similar
   */
  findSimilarScenes = asyncHandler(async (req: Request, res: Response) => {
    const { sceneId, limit, campaignId } = req.body;

    const sourceScene = await this.searchService.getScene(sceneId);
    if (!sourceScene) {
      throw new AppError('Scene not found', 404);
    }

    const similarScenes = await this.searchService.findSimilarScenes(
      sceneId,
      limit || 5,
      campaignId
    );

    res.json({
      success: true,
      data: {
        sourceScene,
        similarScenes,
      },
    });
  });

  /**
   * Search by visual elements
   * POST /api/v1/search/visual
   */
  searchByVisualElements = asyncHandler(async (req: Request, res: Response) => {
    const { elements, campaignId, matchAll, limit } = req.body;

    const results = await this.searchService.searchByElements(
      elements,
      campaignId,
      matchAll || false,
      limit || 20
    );

    res.json({
      success: true,
      data: {
        elements,
        matchAll: matchAll || false,
        results,
        count: results.length,
      },
    });
  });

  /**
   * Get scene by ID
   * GET /api/v1/scenes/:id
   */
  getScene = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const scene = await this.searchService.getScene(id);
    if (!scene) {
      throw new AppError('Scene not found', 404);
    }

    res.json({
      success: true,
      data: scene,
    });
  });
}
