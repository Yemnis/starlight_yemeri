import { useState } from 'react';
import { apiService, type Campaign } from '../services/api';
import { VideoUpload } from './VideoUpload';
import { VideoList } from './VideoList';
import './CampaignCreate.css';

interface CampaignCreateProps {
  onCampaignCreated: (campaign: Campaign) => void;
  existingCampaign?: Campaign | null;
}

export const CampaignCreate = ({ onCampaignCreated, existingCampaign }: CampaignCreateProps) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdCampaign, setCreatedCampaign] = useState<Campaign | null>(existingCampaign || null);
  const [videoRefreshTrigger, setVideoRefreshTrigger] = useState(0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      setError('Campaign name is required');
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      const campaign = await apiService.createCampaign(name.trim(), description.trim() || undefined);
      setCreatedCampaign(campaign);
      onCampaignCreated(campaign);
      setName('');
      setDescription('');
    } catch (err) {
      console.error('Failed to create campaign:', err);
      setError(err instanceof Error ? err.message : 'Failed to create campaign');
    } finally {
      setIsCreating(false);
    }
  };

  const handleUploadComplete = () => {
    // Trigger video list refresh
    setVideoRefreshTrigger(prev => prev + 1);
  };

  if (createdCampaign) {
    return (
      <div className="campaign-detail">
        <div className="campaign-detail-header">
          <div>
            <h1>{createdCampaign.name}</h1>
            {createdCampaign.description && (
              <p className="campaign-detail-description">{createdCampaign.description}</p>
            )}
          </div>
          <div className="campaign-stats-badges">
            <div className="stat-badge">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="23 7 16 12 23 17 23 7"></polygon>
                <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
              </svg>
              <span>{createdCampaign.videoCount || 0} videos</span>
            </div>
          </div>
        </div>

        <VideoUpload
          campaignId={createdCampaign.id}
          onUploadComplete={handleUploadComplete}
        />

        <VideoList
          campaignId={createdCampaign.id}
          refreshTrigger={videoRefreshTrigger}
        />
      </div>
    );
  }

  return (
    <div className="campaign-create">
      <div className="campaign-create-header">
        <h1>Create New Campaign</h1>
        <p>Set up a new advertising campaign to organize and analyze your videos</p>
      </div>

      {error && (
        <div className="campaign-create-error">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          {error}
        </div>
      )}

      <form className="campaign-form" onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="name">Campaign Name *</label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Summer Collection 2025"
            disabled={isCreating}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="description">Description</label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the goals and target audience of this campaign..."
            rows={4}
            disabled={isCreating}
          />
        </div>

        <div className="form-actions">
          <button
            type="submit"
            className="create-button"
            disabled={isCreating || !name.trim()}
          >
            {isCreating ? (
              <>
                <div className="button-spinner"></div>
                Creating...
              </>
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="12" y1="5" x2="12" y2="19"></line>
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
                Create Campaign
              </>
            )}
          </button>
        </div>
      </form>

      <div className="campaign-create-info">
        <h3>What happens next?</h3>
        <div className="info-steps">
          <div className="info-step">
            <div className="step-number">1</div>
            <div className="step-content">
              <h4>Upload Videos</h4>
              <p>Upload your advertising videos to analyze</p>
            </div>
          </div>
          <div className="info-step">
            <div className="step-number">2</div>
            <div className="step-content">
              <h4>Automatic Analysis</h4>
              <p>Our AI will transcribe, detect scenes, and analyze content</p>
            </div>
          </div>
          <div className="info-step">
            <div className="step-number">3</div>
            <div className="step-content">
              <h4>Search & Chat</h4>
              <p>Search for specific scenes and chat with AI about your content</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

