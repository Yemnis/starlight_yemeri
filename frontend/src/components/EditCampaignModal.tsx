import { useState } from 'react';
import { apiService, type Campaign } from '../services/api';
import './EditCampaignModal.css';

interface EditCampaignModalProps {
  campaign: Campaign;
  onClose: () => void;
  onSave: (updatedCampaign: Campaign) => void;
}

export const EditCampaignModal = ({ campaign, onClose, onSave }: EditCampaignModalProps) => {
  const [name, setName] = useState(campaign.name);
  const [description, setDescription] = useState(campaign.description || '');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      setError('Campaign name is required');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const updatedCampaign = await apiService.updateCampaign(
        campaign.id,
        name.trim(),
        description.trim() || undefined
      );
      onSave(updatedCampaign);
      onClose();
    } catch (err) {
      console.error('Failed to update campaign:', err);
      setError(err instanceof Error ? err.message : 'Failed to update campaign');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="edit-campaign-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Edit Campaign</h2>
          <button className="close-button" onClick={onClose}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label htmlFor="campaign-name">Campaign Name *</label>
            <input
              id="campaign-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter campaign name"
              disabled={isSaving}
              autoFocus
            />
          </div>

          <div className="form-group">
            <label htmlFor="campaign-description">Description</label>
            <textarea
              id="campaign-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter campaign description (optional)"
              rows={3}
              disabled={isSaving}
            />
          </div>

          {error && (
            <div className="error-message">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
              {error}
            </div>
          )}

          <div className="modal-actions">
            <button
              type="button"
              className="cancel-button"
              onClick={onClose}
              disabled={isSaving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="save-button"
              disabled={isSaving || !name.trim()}
            >
              {isSaving ? (
                <>
                  <div className="button-spinner"></div>
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

