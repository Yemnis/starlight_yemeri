import express from 'express';

const router = express.Router();

// Temporary in-memory storage (replace with database later)
const campaigns = [
  {
    id: '1',
    name: 'Summer Collection 2025',
    description: 'Showcase our latest summer collection with vibrant visuals',
    status: 'active',
    createdAt: new Date('2025-01-15'),
    media: [
      {
        id: 'm1',
        type: 'image',
        url: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800',
      },
      {
        id: 'm2',
        type: 'video',
        url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
        thumbnail: 'https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?w=800',
      },
      {
        id: 'm3',
        type: 'image',
        url: 'https://images.unsplash.com/photo-1472851294608-062f824d29cc?w=800',
      },
    ],
  },
];

/**
 * GET /api/campaigns
 * Get all campaigns
 */
router.get('/', async (req, res) => {
  try {
    res.json({
      success: true,
      campaigns,
      count: campaigns.length,
    });
  } catch (error) {
    console.error('❌ Error fetching campaigns:', error);
    res.status(500).json({
      error: 'Failed to fetch campaigns',
      details: error.message,
    });
  }
});

/**
 * GET /api/campaigns/:id
 * Get a specific campaign
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const campaign = campaigns.find(c => c.id === id);

    if (!campaign) {
      return res.status(404).json({
        error: 'Campaign not found',
      });
    }

    res.json({
      success: true,
      campaign,
    });
  } catch (error) {
    console.error('❌ Error fetching campaign:', error);
    res.status(500).json({
      error: 'Failed to fetch campaign',
      details: error.message,
    });
  }
});

/**
 * POST /api/campaigns
 * Create a new campaign
 */
router.post('/', async (req, res) => {
  try {
    const { name, description, media, status } = req.body;

    if (!name || !description) {
      return res.status(400).json({
        error: 'Name and description are required',
      });
    }

    const newCampaign = {
      id: Date.now().toString(),
      name,
      description,
      media: media || [],
      status: status || 'active',
      createdAt: new Date(),
    };

    campaigns.push(newCampaign);

    res.status(201).json({
      success: true,
      campaign: newCampaign,
    });
  } catch (error) {
    console.error('❌ Error creating campaign:', error);
    res.status(500).json({
      error: 'Failed to create campaign',
      details: error.message,
    });
  }
});

export default router;

