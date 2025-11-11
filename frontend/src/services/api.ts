/**
 * API service for backend communication
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api/v1';

export interface Message {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  timestamp: Date;
}

export interface Conversation {
  id: string;
  campaignId?: string;
  messages: Message[];
  createdAt: string;
  updatedAt: string;
}

export type Campaign = {
  id: string;
  name: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
  videoCount: number;
  totalDuration: number;
};

export type Video = {
  id: string;
  campaignId: string;
  fileName: string;
  duration: number;
  status: 'processing' | 'completed' | 'failed';
  uploadedAt: Date;
  processedAt?: Date;
  progress: {
    transcription: boolean;
    sceneDetection: boolean;
    sceneAnalysis: boolean;
    embeddings: boolean;
  };
  metadata: {
    resolution: string;
    fps: number;
    codec: string;
    fileSize: number;
  };
};

export type UploadProgress = {
  percent: number;
  loaded: number;
  total: number;
};

class ApiService {
  private conversationId: string | null = null;

  // Chat methods
  async createConversation(campaignId?: string): Promise<Conversation> {
    const response = await fetch(`${API_BASE_URL}/chat/conversations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ campaignId }),
    });

    if (!response.ok) {
      throw new Error(`Failed to create conversation: ${response.statusText}`);
    }

    const data = await response.json();
    this.conversationId = data.data.id;
    return data.data;
  }

  async sendMessage(conversationId: string, message: string): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/chat/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message }),
    });

    if (!response.ok) {
      throw new Error(`Failed to send message: ${response.statusText}`);
    }

    const data = await response.json();
    return data.data;
  }

  async getConversation(conversationId: string): Promise<Conversation> {
    const response = await fetch(`${API_BASE_URL}/chat/conversations/${conversationId}`);

    if (!response.ok) {
      throw new Error(`Failed to get conversation: ${response.statusText}`);
    }

    const data = await response.json();
    return data.data;
  }

  async listConversations(campaignId?: string, limit: number = 20): Promise<Conversation[]> {
    const params = new URLSearchParams();
    if (campaignId) params.append('campaignId', campaignId);
    params.append('limit', limit.toString());

    const response = await fetch(`${API_BASE_URL}/chat/conversations?${params}`);

    if (!response.ok) {
      throw new Error(`Failed to list conversations: ${response.statusText}`);
    }

    const data = await response.json();
    return data.data;
  }

  // Campaign methods
  async createCampaign(name: string, description?: string): Promise<Campaign> {
    const response = await fetch(`${API_BASE_URL}/campaigns`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name, description }),
    });

    if (!response.ok) {
      throw new Error(`Failed to create campaign: ${response.statusText}`);
    }

    const data = await response.json();
    return data.data;
  }

  async listCampaigns(): Promise<Campaign[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/campaigns`);

      if (!response.ok) {
        if (response.status === 404) {
          return []; // No campaigns found
        }
        throw new Error(`Failed to list campaigns: ${response.statusText}`);
      }

      const data = await response.json();
      // Ensure we return an array even if data.data is null/undefined
      return Array.isArray(data.data) ? data.data : [];
    } catch (err) {
      if (err instanceof TypeError && err.message.includes('fetch')) {
        throw new Error('Unable to connect to server. Please check if the backend is running.');
      }
      throw err;
    }
  }

  async getCampaign(campaignId: string): Promise<Campaign> {
    const response = await fetch(`${API_BASE_URL}/campaigns/${campaignId}`);

    if (!response.ok) {
      throw new Error(`Failed to get campaign: ${response.statusText}`);
    }

    const data = await response.json();
    return data.data;
  }

  async updateCampaign(campaignId: string, name: string, description?: string): Promise<Campaign> {
    const response = await fetch(`${API_BASE_URL}/campaigns/${campaignId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name, description }),
    });

    if (!response.ok) {
      throw new Error(`Failed to update campaign: ${response.statusText}`);
    }

    const data = await response.json();
    return data.data;
  }

  async deleteCampaign(campaignId: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/campaigns/${campaignId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error(`Failed to delete campaign: ${response.statusText}`);
    }
  }

  // Video methods
  async uploadVideo(
    file: File,
    campaignId: string,
    onProgress?: (progress: UploadProgress) => void
  ): Promise<{ videoId: string; status: string; message: string }> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('campaignId', campaignId);

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable && onProgress) {
          onProgress({
            percent: (e.loaded / e.total) * 100,
            loaded: e.loaded,
            total: e.total,
          });
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          const data = JSON.parse(xhr.responseText);
          resolve(data.data);
        } else {
          reject(new Error(`Upload failed: ${xhr.statusText}`));
        }
      });

      xhr.addEventListener('error', () => {
        reject(new Error('Upload failed'));
      });

      xhr.open('POST', `${API_BASE_URL}/videos/upload`);
      xhr.send(formData);
    });
  }

  async getVideo(videoId: string): Promise<Video> {
    const response = await fetch(`${API_BASE_URL}/videos/${videoId}`);

    if (!response.ok) {
      throw new Error(`Failed to get video: ${response.statusText}`);
    }

    const data = await response.json();
    return data.data;
  }

  async listVideos(campaignId: string): Promise<Video[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/campaigns/${campaignId}/videos`);

      if (!response.ok) {
        if (response.status === 404) {
          return []; // No videos found for this campaign
        }
        throw new Error(`Failed to list videos: ${response.statusText}`);
      }

      const data = await response.json();
      // Ensure we return an array even if data.data is null/undefined
      return Array.isArray(data.data) ? data.data : [];
    } catch (err) {
      if (err instanceof TypeError && err.message.includes('fetch')) {
        throw new Error('Unable to connect to server. Please check if the backend is running.');
      }
      throw err;
    }
  }

  async deleteVideo(videoId: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/videos/${videoId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error(`Failed to delete video: ${response.statusText}`);
    }
  }

  getConversationId(): string | null {
    return this.conversationId;
  }

  setConversationId(id: string | null): void {
    this.conversationId = id;
  }
}

export const apiService = new ApiService();

