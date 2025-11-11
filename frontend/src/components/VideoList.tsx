import { useState, useEffect } from 'react';
import { apiService, type Video } from '../services/api';
import './VideoList.css';

interface VideoListProps {
  campaignId: string;
  refreshTrigger?: number;
}

export const VideoList = ({ campaignId, refreshTrigger }: VideoListProps) => {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadVideos();
  }, [campaignId, refreshTrigger]);

  const loadVideos = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiService.listVideos(campaignId);
      // Ensure we always have an array
      setVideos(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load videos:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unable to load videos';
      setError(errorMessage);
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
    });
  };

  const getStatusBadge = (status: Video['status']) => {
    const badges = {
      processing: { label: 'Processing', color: '#ffa500' },
      completed: { label: 'Completed', color: '#4ade80' },
      failed: { label: 'Failed', color: '#ff4444' },
    };
    
    const badge = badges[status];
    return (
      <span className="status-badge" style={{ color: badge.color }}>
        {badge.label}
      </span>
    );
  };

  const getProgressSummary = (video: Video): string => {
    if (video.status === 'completed') return '100%';
    if (video.status === 'failed') return 'Failed';
    
    const steps = Object.values(video.progress);
    const completed = steps.filter(Boolean).length;
    const total = steps.length;
    return `${Math.round((completed / total) * 100)}%`;
  };

  if (loading) {
    return (
      <div className="video-list-loading">
        <div className="spinner"></div>
        <p>Loading videos...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="video-list-error">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
        <p>{error}</p>
        <button onClick={loadVideos}>Try Again</button>
      </div>
    );
  }

  if (videos.length === 0) {
    return (
      <div className="video-list-empty">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polygon points="23 7 16 12 23 17 23 7"></polygon>
          <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
        </svg>
        <h3>No videos yet</h3>
        <p>Upload your first video to get started with analysis</p>
      </div>
    );
  }

  return (
    <div className="video-list">
      <div className="video-list-header">
        <h3>Videos ({videos.length})</h3>
        <button className="refresh-videos" onClick={loadVideos}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="23 4 23 10 17 10"></polyline>
            <polyline points="1 20 1 14 7 14"></polyline>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
          </svg>
        </button>
      </div>

      <div className="video-grid">
        {videos.map((video) => (
          <div key={video.id} className={`video-card ${video.status}`}>
            <div className="video-card-header">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="23 7 16 12 23 17 23 7"></polygon>
                <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
              </svg>
            </div>

            <div className="video-card-body">
              <h4 className="video-name">{video.fileName}</h4>
              
              <div className="video-meta">
                <span>{video.metadata.resolution}</span>
                {video.duration > 0 && (
                  <>
                    <span>•</span>
                    <span>{formatDuration(video.duration)}</span>
                  </>
                )}
              </div>

              <div className="video-status-row">
                {getStatusBadge(video.status)}
                <span className="progress-text">{getProgressSummary(video)}</span>
              </div>

              <div className="video-date">
                Uploaded {formatDate(video.uploadedAt)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

