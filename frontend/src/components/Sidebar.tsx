import { useState, useEffect } from 'react';
import { apiService, type Campaign } from '../services/api';
import './Sidebar.css';

interface SidebarProps {
  onSelectCampaign: (campaign: Campaign | null) => void;
  onCreateNew: () => void;
  selectedCampaignId?: string;
}

export const Sidebar = ({ onSelectCampaign, onCreateNew, selectedCampaignId }: SidebarProps) => {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadCampaigns();
  }, []);

  const loadCampaigns = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiService.listCampaigns();
      // Ensure we always have an array, even if the API returns null/undefined
      setCampaigns(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load campaigns:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unable to connect to server';
      setError(errorMessage);
      setCampaigns([]);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    loadCampaigns();
  };

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <h2>Campaigns</h2>
        <button className="refresh-button" onClick={handleRefresh} title="Refresh">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="23 4 23 10 17 10"></polyline>
            <polyline points="1 20 1 14 7 14"></polyline>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
          </svg>
        </button>
      </div>

      <button className="create-campaign-button" onClick={onCreateNew}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
        Create Campaign
      </button>

      <div className="campaigns-list">
        {loading && <div className="loading-text">Loading campaigns...</div>}
        
        {error && (
          <div className="error-message">
            {error}
            <button onClick={handleRefresh}>Try again</button>
          </div>
        )}

        {!loading && !error && campaigns.length === 0 && (
          <div className="empty-state">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="9" y1="9" x2="15" y2="9"></line>
              <line x1="9" y1="15" x2="15" y2="15"></line>
            </svg>
            <p className="empty-title">No campaigns yet</p>
            <p className="empty-hint">Click "Create Campaign" above to create your first campaign and start uploading videos</p>
          </div>
        )}

        {!loading && campaigns.map((campaign) => (
          <div
            key={campaign.id}
            className={`campaign-item ${selectedCampaignId === campaign.id ? 'active' : ''}`}
            onClick={() => onSelectCampaign(campaign)}
          >
            <h3>{campaign.name}</h3>
            {campaign.description && (
              <p className="campaign-description">{campaign.description}</p>
            )}
            <div className="campaign-stats">
              <span>{campaign.videoCount || 0} videos</span>
              {campaign.totalDuration > 0 && (
                <span> · {Math.round(campaign.totalDuration)}s</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

