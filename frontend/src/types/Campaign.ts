export interface MediaItem {
  id: string;
  type: 'image' | 'video';
  url: string;
  thumbnail?: string;
}

export interface Campaign {
  id: string;
  name: string;
  description: string;
  media: MediaItem[];
  status: 'active' | 'paused' | 'completed';
  createdAt: Date;
}
