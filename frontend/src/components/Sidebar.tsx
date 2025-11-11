import { useState, useEffect } from 'react';
import { apiService, type Campaign } from '../services/api';
import { CampaignDetailModal } from './CampaignDetailModal';
import { EditCampaignModal } from './EditCampaignModal';
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
  const [detailCampaign, setDetailCampaign] = useState<Campaign | null>(null);
  const [editCampaign, setEditCampaign] = useState<Campaign | null>(null);
  const [deletingCampaignId, setDeletingCampaignId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

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

  const handleCampaignClick = (campaign: Campaign) => {
    setDetailCampaign(campaign);
  };

  const handleEdit = (campaign: Campaign, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditCampaign(campaign);
  };

  const handleDelete = async (campaign: Campaign, e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmDeleteId(campaign.id);
  };

  const confirmDelete = async (campaignId: string) => {
    try {
      setDeletingCampaignId(campaignId);
      await apiService.deleteCampaign(campaignId);
      // Remove from local state
      setCampaigns(campaigns.filter(c => c.id !== campaignId));
      // Clear selection if this campaign was selected
      if (selectedCampaignId === campaignId) {
        onSelectCampaign(null);
      }
      setConfirmDeleteId(null);
    } catch (err) {
      console.error('Failed to delete campaign:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete campaign');
    } finally {
      setDeletingCampaignId(null);
    }
  };

  const handleEditSave = (updatedCampaign: Campaign) => {
    // Update in local state
    setCampaigns(campaigns.map(c => c.id === updatedCampaign.id ? updatedCampaign : c));
    // If this campaign is selected, update it
    if (selectedCampaignId === updatedCampaign.id) {
      onSelectCampaign(updatedCampaign);
    }
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
          >
            <div className="campaign-content" onClick={() => handleCampaignClick(campaign)}>
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
            <div className="campaign-actions">
              <button
                className="action-button edit-button"
                onClick={(e) => handleEdit(campaign, e)}
                title="Edit campaign"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                </svg>
              </button>
              <button
                className="action-button delete-button"
                onClick={(e) => handleDelete(campaign, e)}
                title="Delete campaign"
                disabled={deletingCampaignId === campaign.id}
              >
                {deletingCampaignId === campaign.id ? (
                  <div className="button-spinner-small"></div>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                  </svg>
                )}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Modals */}
      {detailCampaign && (
        <CampaignDetailModal
          campaign={detailCampaign}
          onClose={() => setDetailCampaign(null)}
        />
      )}

      {editCampaign && (
        <EditCampaignModal
          campaign={editCampaign}
          onClose={() => setEditCampaign(null)}
          onSave={handleEditSave}
        />
      )}

      {/* Delete Confirmation */}
      {confirmDeleteId && (
        <div className="modal-overlay" onClick={() => setConfirmDeleteId(null)}>
          <div className="confirm-delete-modal" onClick={(e) => e.stopPropagation()}>
            <div className="confirm-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
            </div>
            <h3>Delete Campaign?</h3>
            <p>Are you sure you want to delete this campaign? This action cannot be undone and will delete all associated videos.</p>
            <div className="confirm-actions">
              <button
                className="cancel-button"
                onClick={() => setConfirmDeleteId(null)}
                disabled={deletingCampaignId === confirmDeleteId}
              >
                Cancel
              </button>
              <button
                className="delete-confirm-button"
                onClick={() => confirmDelete(confirmDeleteId)}
                disabled={deletingCampaignId === confirmDeleteId}
              >
                {deletingCampaignId === confirmDeleteId ? (
                  <>
                    <div className="button-spinner"></div>
                    Deleting...
                  </>
                ) : (
                  'Delete Campaign'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

