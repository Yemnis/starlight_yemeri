import { useState, useEffect } from 'react';
import { apiService, type Campaign, type Video } from '../services/api';
import './CampaignDetailModal.css';

interface CampaignDetailModalProps {
  campaign: Campaign;
  onClose: () => void;
}

export const CampaignDetailModal = ({ campaign, onClose }: CampaignDetailModalProps) => {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadVideos();
  }, [campaign.id]);

  const loadVideos = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiService.listVideos(campaign.id);
      setVideos(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load videos:', err);
      setError(err instanceof Error ? err.message : 'Failed to load videos');
      setVideos([]);
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (date: Date): string => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const getStatusIcon = (status: Video['status']) => {
    switch (status) {
      case 'completed':
        return (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        );
      case 'processing':
        return (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ffa500" strokeWidth="2" className="spinning">
            <line x1="12" y1="2" x2="12" y2="6"></line>
            <line x1="12" y1="18" x2="12" y2="22"></line>
            <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line>
            <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line>
            <line x1="2" y1="12" x2="6" y2="12"></line>
            <line x1="18" y1="12" x2="22" y2="12"></line>
            <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line>
            <line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line>
          </svg>
        );
      case 'failed':
        return (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ff4444" strokeWidth="2">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="15" y1="9" x2="9" y2="15"></line>
            <line x1="9" y1="9" x2="15" y2="15"></line>
          </svg>
        );
    }
  };

  const getProgressDetail = (video: Video) => {
    const steps = [
      { key: 'metadata', label: 'Metadata' },
      { key: 'transcription', label: 'Transcription' },
      { key: 'sceneDetection', label: 'Scene Detection' },
      { key: 'sceneAnalysis', label: 'Scene Analysis' },
      { key: 'embeddings', label: 'Embeddings' },
    ];

    return (
      <div className="progress-steps">
        {steps.map(step => (
          <div key={step.key} className={`progress-step ${video.progress[step.key as keyof Video['progress']] ? 'completed' : ''}`}>
            <div className="step-indicator">
              {video.progress[step.key as keyof Video['progress']] ? (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              ) : (
                <div className="step-dot"></div>
              )}
            </div>
            <span className="step-label">{step.label}</span>
          </div>
        ))}
      </div>
    );
  };

  const completedVideos = videos.filter(v => v.status === 'completed').length;
  const processingVideos = videos.filter(v => v.status === 'processing').length;
  const failedVideos = videos.filter(v => v.status === 'failed').length;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="campaign-detail-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="header-content">
            <h2>{campaign.name}</h2>
            {campaign.description && <p className="campaign-description">{campaign.description}</p>}
          </div>
          <button className="close-button" onClick={onClose}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <div className="modal-stats">
          <div className="stat-card">
            <div className="stat-icon video-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="23 7 16 12 23 17 23 7"></polygon>
                <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
              </svg>
            </div>
            <div className="stat-content">
              <div className="stat-value">{videos.length}</div>
              <div className="stat-label">Total Videos</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon completed-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            </div>
            <div className="stat-content">
              <div className="stat-value">{completedVideos}</div>
              <div className="stat-label">Completed</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon processing-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="2" x2="12" y2="6"></line>
                <line x1="12" y1="18" x2="12" y2="22"></line>
                <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line>
                <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line>
                <line x1="2" y1="12" x2="6" y2="12"></line>
                <line x1="18" y1="12" x2="22" y2="12"></line>
                <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line>
                <line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line>
              </svg>
            </div>
            <div className="stat-content">
              <div className="stat-value">{processingVideos}</div>
              <div className="stat-label">Processing</div>
            </div>
          </div>

          {failedVideos > 0 && (
            <div className="stat-card">
              <div className="stat-icon failed-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="8" x2="12" y2="12"></line>
                  <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
              </div>
              <div className="stat-content">
                <div className="stat-value">{failedVideos}</div>
                <div className="stat-label">Failed</div>
              </div>
            </div>
          )}
        </div>

        <div className="modal-body">
          {loading && (
            <div className="loading-state">
              <div className="spinner"></div>
              <p>Loading videos...</p>
            </div>
          )}

          {error && (
            <div className="error-state">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
              <p>{error}</p>
              <button onClick={loadVideos}>Try Again</button>
            </div>
          )}

          {!loading && !error && videos.length === 0 && (
            <div className="empty-state">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="23 7 16 12 23 17 23 7"></polygon>
                <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
              </svg>
              <h3>No videos yet</h3>
              <p>Upload your first video to get started</p>
            </div>
          )}

          {!loading && !error && videos.length > 0 && (
            <div className="videos-table">
              <div className="table-header">
                <div className="col-status">Status</div>
                <div className="col-name">Video Name</div>
                <div className="col-details">Details</div>
                <div className="col-progress">Processing Progress</div>
                <div className="col-date">Uploaded</div>
              </div>
              <div className="table-body">
                {videos.map((video) => (
                  <div key={video.id} className={`video-row ${video.status}`}>
                    <div className="col-status">
                      {getStatusIcon(video.status)}
                    </div>
                    <div className="col-name">
                      <div className="video-name">{video.fileName}</div>
                    </div>
                    <div className="col-details">
                      <div className="video-meta">
                        <span>{video.metadata.resolution}</span>
                        <span>•</span>
                        <span>{formatDuration(video.duration)}</span>
                        <span>•</span>
                        <span>{formatFileSize(video.metadata.fileSize)}</span>
                      </div>
                    </div>
                    <div className="col-progress">
                      {getProgressDetail(video)}
                    </div>
                    <div className="col-date">
                      {formatDate(video.uploadedAt)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

