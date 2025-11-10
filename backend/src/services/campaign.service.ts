/**
 * Campaign Service - Manages advertising campaigns
 * Handles campaign CRUD operations and analytics
 */
import { Firestore } from '@google-cloud/firestore';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config';
import logger from '../utils/logger';
import { Campaign } from '../types';

export class CampaignService {
  private firestore: Firestore;

  constructor() {
    this.firestore = new Firestore({
      projectId: config.gcp.projectId,
      databaseId: config.firestore.database,
    });
    logger.info('CampaignService initialized');
  }

  /**
   * Create a new campaign
   */
  async createCampaign(name: string, description?: string): Promise<Campaign> {
    const campaignId = uuidv4();

    const campaign: Campaign = {
      id: campaignId,
      name,
      description,
      createdAt: new Date(),
      updatedAt: new Date(),
      videoCount: 0,
      totalDuration: 0,
      indexName: `campaign_${campaignId}_index`,
      indexEndpoint: config.vectorSearch.indexEndpoint,
    };

    await this.firestore.collection('campaigns').doc(campaignId).set(campaign);

    logger.info('Campaign created', {
      operation: 'create_campaign',
      campaignId,
      name,
    });

    return campaign;
  }

  /**
   * Get campaign by ID
   */
  async getCampaign(campaignId: string): Promise<Campaign | null> {
    try {
      const doc = await this.firestore.collection('campaigns').doc(campaignId).get();
      if (!doc.exists) {
        return null;
      }

      const data = doc.data()!;
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
      } as Campaign;
    } catch (error) {
      logger.error('Failed to get campaign', {
        operation: 'get_campaign',
        campaignId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Update campaign
   */
  async updateCampaign(
    campaignId: string,
    updates: Partial<Pick<Campaign, 'name' | 'description'>>
  ): Promise<Campaign | null> {
    try {
      const campaign = await this.getCampaign(campaignId);
      if (!campaign) {
        return null;
      }

      await this.firestore
        .collection('campaigns')
        .doc(campaignId)
        .update({
          ...updates,
          updatedAt: new Date(),
        });

      logger.info('Campaign updated', {
        operation: 'update_campaign',
        campaignId,
        updates,
      });

      return this.getCampaign(campaignId);
    } catch (error) {
      logger.error('Failed to update campaign', {
        operation: 'update_campaign',
        campaignId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Delete campaign
   */
  async deleteCampaign(campaignId: string): Promise<void> {
    try {
      // Note: In production, should also delete associated videos and scenes
      await this.firestore.collection('campaigns').doc(campaignId).delete();

      logger.info('Campaign deleted', {
        operation: 'delete_campaign',
        campaignId,
      });
    } catch (error) {
      logger.error('Failed to delete campaign', {
        operation: 'delete_campaign',
        campaignId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * List all campaigns
   */
  async listCampaigns(limit: number = 50): Promise<Campaign[]> {
    try {
      const snapshot = await this.firestore
        .collection('campaigns')
        .orderBy('updatedAt', 'desc')
        .limit(limit)
        .get();

      const campaigns: Campaign[] = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        campaigns.push({
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
        } as Campaign);
      });

      return campaigns;
    } catch (error) {
      logger.error('Failed to list campaigns', {
        operation: 'list_campaigns',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Get campaign analytics
   */
  async getCampaignAnalytics(campaignId: string): Promise<any> {
    try {
      const campaign = await this.getCampaign(campaignId);
      if (!campaign) {
        throw new Error('Campaign not found');
      }

      // Get all scenes for this campaign
      const scenesSnapshot = await this.firestore
        .collection('scenes')
        .where('campaignId', '==', campaignId)
        .get();

      const scenes: any[] = [];
      scenesSnapshot.forEach(doc => scenes.push(doc.data()));

      // Calculate analytics
      const totalScenes = scenes.length;
      const averageSceneLength = totalScenes > 0
        ? scenes.reduce((sum, s) => sum + s.duration, 0) / totalScenes
        : 0;

      // Visual elements frequency
      const visualElementsMap = new Map<string, number>();
      scenes.forEach(scene => {
        scene.analysis?.visualElements?.forEach((element: string) => {
          visualElementsMap.set(element, (visualElementsMap.get(element) || 0) + 1);
        });
      });

      const topVisualElements = Array.from(visualElementsMap.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([element, count]) => ({ element, count }));

      // Mood distribution
      const moodMap = new Map<string, number>();
      scenes.forEach(scene => {
        const mood = scene.analysis?.mood || 'unknown';
        moodMap.set(mood, (moodMap.get(mood) || 0) + 1);
      });

      const moodDistribution: Record<string, number> = {};
      moodMap.forEach((count, mood) => {
        moodDistribution[mood] = count;
      });

      // Product mentions
      const productMap = new Map<string, number>();
      scenes.forEach(scene => {
        if (scene.analysis?.product) {
          productMap.set(scene.analysis.product, (productMap.get(scene.analysis.product) || 0) + 1);
        }
      });

      const mostCommonProducts = Array.from(productMap.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([product, count]) => ({ product, count }));

      const analytics = {
        campaignId,
        totalVideos: campaign.videoCount,
        totalScenes,
        totalDuration: campaign.totalDuration,
        averageSceneLength: Math.round(averageSceneLength * 10) / 10,
        topVisualElements,
        moodDistribution,
        mostCommonProducts,
      };

      logger.debug('Campaign analytics generated', {
        operation: 'get_campaign_analytics',
        campaignId,
      });

      return analytics;
    } catch (error) {
      logger.error('Failed to get campaign analytics', {
        operation: 'get_campaign_analytics',
        campaignId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }
}
