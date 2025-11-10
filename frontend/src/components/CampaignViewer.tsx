import { useState } from 'react';
import type { Campaign } from '../types/Campaign';
import './CampaignViewer.css';

interface CampaignViewerProps {
  campaigns: Campaign[];
}

export const CampaignViewer = ({ campaigns }: CampaignViewerProps) => {
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(
    campaigns.length > 0 ? campaigns[0] : null
  );

  return (
    <div className="campaign-viewer">
      <div className="campaign-sidebar">
        <h2>Campaigns</h2>
        <div className="campaign-list">
          {campaigns.map((campaign) => (
            <div
              key={campaign.id}
              className={`campaign-item ${selectedCampaign?.id === campaign.id ? 'active' : ''}`}
              onClick={() => setSelectedCampaign(campaign)}
            >
              <div className="campaign-item-header">
                <h3>{campaign.name}</h3>
                <span className={`status-badge ${campaign.status}`}>
                  {campaign.status}
                </span>
              </div>
              <p className="campaign-description">{campaign.description}</p>
              <div className="media-count">
                {campaign.media.filter(m => m.type === 'image').length} Images,{' '}
                {campaign.media.filter(m => m.type === 'video').length} Videos
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="campaign-content">
        {selectedCampaign ? (
          <>
            <div className="campaign-header">
              <div>
                <h1>{selectedCampaign.name}</h1>
                <p className="campaign-description-full">
                  {selectedCampaign.description}
                </p>
              </div>
              <span className={`status-badge-large ${selectedCampaign.status}`}>
                {selectedCampaign.status}
              </span>
            </div>

            <div className="media-grid">
              {selectedCampaign.media.map((item) => (
                <div key={item.id} className="media-item">
                  {item.type === 'image' ? (
                    <img src={item.url} alt={`Media ${item.id}`} />
                  ) : (
                    <video controls poster={item.thumbnail}>
                      <source src={item.url} type="video/mp4" />
                      Your browser does not support the video tag.
                    </video>
                  )}
                  <div className="media-type-badge">{item.type}</div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="empty-state">
            <p>No campaign selected</p>
          </div>
        )}
      </div>
    </div>
  );
};

