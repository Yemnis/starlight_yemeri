/**
 * API service for backend communication
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';

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

class ApiService {
  private conversationId: string | null = null;

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

  getConversationId(): string | null {
    return this.conversationId;
  }

  setConversationId(id: string | null): void {
    this.conversationId = id;
  }
}

export const apiService = new ApiService();

