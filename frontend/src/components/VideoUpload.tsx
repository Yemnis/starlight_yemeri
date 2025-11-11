import { useState, useRef } from 'react';
import { apiService, type UploadProgress, type Video } from '../services/api';
import './VideoUpload.css';

interface VideoUploadProps {
  campaignId: string;
  onUploadComplete?: (videoId: string) => void;
}

export const VideoUpload = ({ campaignId, onUploadComplete }: VideoUploadProps) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [videoId, setVideoId] = useState<string | null>(null);
  const [processingStatus, setProcessingStatus] = useState<Video | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollIntervalRef = useRef<number | null>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file type
      const validTypes = ['video/mp4', 'video/quicktime', 'video/x-msvideo'];
      if (!validTypes.includes(file.type)) {
        setError('Invalid file type. Please upload MP4, MOV, or AVI files.');
        return;
      }

      // Validate file size (500MB limit)
      const maxSize = 500 * 1024 * 1024;
      if (file.size > maxSize) {
        setError('File size exceeds 500MB limit.');
        return;
      }

      setSelectedFile(file);
      setError(null);
    }
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    if (file) {
      const validTypes = ['video/mp4', 'video/quicktime', 'video/x-msvideo'];
      if (!validTypes.includes(file.type)) {
        setError('Invalid file type. Please upload MP4, MOV, or AVI files.');
        return;
      }

      const maxSize = 500 * 1024 * 1024;
      if (file.size > maxSize) {
        setError('File size exceeds 500MB limit.');
        return;
      }

      setSelectedFile(file);
      setError(null);
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  const startProcessingPolling = (id: string) => {
    // Poll every 3 seconds
    pollIntervalRef.current = window.setInterval(async () => {
      try {
        const video = await apiService.getVideo(id);
        console.log('Polling video status:', {
          videoId: id,
          status: video.status,
          progress: video.progress
        });
        setProcessingStatus(video);

        if (video.status === 'completed' || video.status === 'failed') {
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }

          if (video.status === 'completed' && onUploadComplete) {
            onUploadComplete(id);
          }
        }
      } catch (err) {
        console.error('Failed to poll video status:', err);
      }
    }, 3000);
  };

  const handleUpload = async () => {
    if (!selectedFile || !campaignId) return;

    setIsUploading(true);
    setError(null);
    setUploadProgress({ percent: 0, loaded: 0, total: selectedFile.size });

    try {
      const result = await apiService.uploadVideo(
        selectedFile,
        campaignId,
        (progress) => {
          setUploadProgress(progress);
        }
      );

      setVideoId(result.videoId);
      setUploadProgress(null);
      setIsUploading(false);

      // Start polling for processing status
      startProcessingPolling(result.videoId);
    } catch (err) {
      console.error('Upload failed:', err);
      setError(err instanceof Error ? err.message : 'Upload failed');
      setIsUploading(false);
      setUploadProgress(null);
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setUploadProgress(null);
    setIsUploading(false);
    setError(null);
    setVideoId(null);
    setProcessingStatus(null);
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const getProcessingSteps = () => {
    if (!processingStatus) return [];
    
    const { progress } = processingStatus;
    return [
      { name: 'Video Metadata', completed: progress.metadata },
      { name: 'Transcription', completed: progress.transcription },
      { name: 'Scene Detection', completed: progress.sceneDetection },
      { name: 'Scene Analysis', completed: progress.sceneAnalysis },
      { name: 'Embeddings', completed: progress.embeddings },
    ];
  };

  return (
    <div className="video-upload">
      <div className="upload-header">
        <h3>Upload Video</h3>
        <p>Upload a video to analyze for this campaign</p>
      </div>

      {error && (
        <div className="upload-error">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          {error}
        </div>
      )}

      {!videoId && !isUploading && (
        <>
          <div
            className={`upload-dropzone ${selectedFile ? 'has-file' : ''}`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="video/mp4,video/quicktime,video/x-msvideo"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
            />
            
            {selectedFile ? (
              <div className="selected-file">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="23 7 16 12 23 17 23 7"></polygon>
                  <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
                </svg>
                <div className="file-info">
                  <p className="file-name">{selectedFile.name}</p>
                  <p className="file-size">{formatFileSize(selectedFile.size)}</p>
                </div>
              </div>
            ) : (
              <div className="dropzone-placeholder">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="17 8 12 3 7 8"></polyline>
                  <line x1="12" y1="3" x2="12" y2="15"></line>
                </svg>
                <p>Drag & drop a video file here</p>
                <p className="dropzone-hint">or click to browse</p>
                <p className="dropzone-formats">MP4, MOV, AVI (max 500MB)</p>
              </div>
            )}
          </div>

          {selectedFile && (
            <div className="upload-actions">
              <button className="upload-button" onClick={handleUpload}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="17 8 12 3 7 8"></polyline>
                  <line x1="12" y1="3" x2="12" y2="15"></line>
                </svg>
                Upload Video
              </button>
              <button className="cancel-button" onClick={handleReset}>
                Cancel
              </button>
            </div>
          )}
        </>
      )}

      {isUploading && uploadProgress && (
        <div className="upload-progress-container">
          <div className="progress-header">
            <span>Uploading...</span>
            <span>{Math.round(uploadProgress.percent)}%</span>
          </div>
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${uploadProgress.percent}%` }}
            ></div>
          </div>
          <div className="progress-details">
            {formatFileSize(uploadProgress.loaded)} / {formatFileSize(uploadProgress.total)}
          </div>
        </div>
      )}

      {videoId && processingStatus && (
        <div className="processing-status">
          <div className="status-header">
            <h4>
              {processingStatus.status === 'processing' && '⏳ Processing Video'}
              {processingStatus.status === 'completed' && '✅ Video Processed Successfully'}
              {processingStatus.status === 'failed' && '❌ Processing Failed'}
            </h4>
          </div>

          <div className="processing-steps">
            {getProcessingSteps().map((step, index) => (
              <div key={index} className={`processing-step ${step.completed ? 'completed' : ''}`}>
                <div className="step-indicator">
                  {step.completed ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                  ) : (
                    <div className="step-spinner"></div>
                  )}
                </div>
                <span>{step.name}</span>
              </div>
            ))}
          </div>

          {(processingStatus.status === 'completed' || processingStatus.status === 'failed') && (
            <button className="upload-another-button" onClick={handleReset}>
              Upload Another Video
            </button>
          )}
        </div>
      )}
    </div>
  );
};

