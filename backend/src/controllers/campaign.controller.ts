/**
 * Campaign Controller - Handles campaign management endpoints
 */
import { Request, Response } from 'express';
import { CampaignService } from '../services/campaign.service';
import { AppError, asyncHandler } from '../middleware/error.middleware';

export class CampaignController {
  constructor(private campaignService: CampaignService) {}

  /**
   * Create campaign
   * POST /api/v1/campaigns
   */
  createCampaign = asyncHandler(async (req: Request, res: Response) => {
    const { name, description } = req.body;

    const campaign = await this.campaignService.createCampaign(name, description);

    res.status(201).json({
      success: true,
      data: campaign,
    });
  });

  /**
   * Get campaign details
   * GET /api/v1/campaigns/:id
   */
  getCampaign = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const campaign = await this.campaignService.getCampaign(id);
    if (!campaign) {
      throw new AppError('Campaign not found', 404);
    }

    res.json({
      success: true,
      data: campaign,
    });
  });

  /**
   * Update campaign
   * PUT /api/v1/campaigns/:id
   */
  updateCampaign = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { name, description } = req.body;

    const campaign = await this.campaignService.updateCampaign(id, { name, description });
    if (!campaign) {
      throw new AppError('Campaign not found', 404);
    }

    res.json({
      success: true,
      data: campaign,
    });
  });

  /**
   * Delete campaign
   * DELETE /api/v1/campaigns/:id
   */
  deleteCampaign = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const campaign = await this.campaignService.getCampaign(id);
    if (!campaign) {
      throw new AppError('Campaign not found', 404);
    }

    await this.campaignService.deleteCampaign(id);

    res.json({
      success: true,
      message: 'Campaign deleted',
    });
  });

  /**
   * List all campaigns
   * GET /api/v1/campaigns
   */
  listCampaigns = asyncHandler(async (req: Request, res: Response) => {
    const campaigns = await this.campaignService.listCampaigns();

    res.json({
      success: true,
      data: campaigns,
    });
  });

  /**
   * Get campaign analytics
   * GET /api/v1/campaigns/:id/analytics
   */
  getCampaignAnalytics = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const analytics = await this.campaignService.getCampaignAnalytics(id);

    res.json({
      success: true,
      data: analytics,
    });
  });
}
