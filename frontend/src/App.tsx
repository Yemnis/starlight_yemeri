import { CampaignViewer } from './components/CampaignViewer';
import { Chat } from './components/Chat';
import type { Campaign } from './types/Campaign';
import './App.css';

// Sample data for demonstration
const sampleCampaigns: Campaign[] = [
  {
    id: '1',
    name: 'Summer Collection 2025',
    description: 'Showcase our latest summer collection with vibrant visuals',
    status: 'active',
    createdAt: new Date('2025-01-15'),
    media: [
      {
        id: 'm1',
        type: 'image',
        url: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800',
      },
      {
        id: 'm2',
        type: 'video',
        url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
        thumbnail: 'https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?w=800',
      },
      {
        id: 'm3',
        type: 'image',
        url: 'https://images.unsplash.com/photo-1472851294608-062f824d29cc?w=800',
      },
    ],
  },
  {
    id: '2',
    name: 'Product Launch Campaign',
    description: 'Introducing our revolutionary new product line',
    status: 'active',
    createdAt: new Date('2025-02-01'),
    media: [
      {
        id: 'm4',
        type: 'video',
        url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
        thumbnail: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800',
      },
      {
        id: 'm5',
        type: 'image',
        url: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800',
      },
      {
        id: 'm6',
        type: 'video',
        url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
        thumbnail: 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=800',
      },
    ],
  },
  {
    id: '3',
    name: 'Holiday Special',
    description: 'Festive campaign for the holiday season',
    status: 'paused',
    createdAt: new Date('2024-12-01'),
    media: [
      {
        id: 'm7',
        type: 'image',
        url: 'https://images.unsplash.com/photo-1607083206869-4c7672e72a8a?w=800',
      },
      {
        id: 'm8',
        type: 'image',
        url: 'https://images.unsplash.com/photo-1512428559087-560fa5ceab42?w=800',
      },
      {
        id: 'm9',
        type: 'image',
        url: 'https://images.unsplash.com/photo-1608559625597-bf7e6eb2b08c?w=800',
      },
    ],
  },
  {
    id: '4',
    name: 'Brand Awareness Q1',
    description: 'Building brand recognition across multiple channels',
    status: 'completed',
    createdAt: new Date('2024-10-15'),
    media: [
      {
        id: 'm10',
        type: 'video',
        url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
        thumbnail: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800',
      },
      {
        id: 'm11',
        type: 'video',
        url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
        thumbnail: 'https://images.unsplash.com/photo-1560769629-975ec94e6a86?w=800',
      },
      {
        id: 'm12',
        type: 'video',
        url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4',
        thumbnail: 'https://images.unsplash.com/photo-1556906781-9cba4a5e9e0e?w=800',
      },
    ],
  },
];

function App() {
  return (
    <div className="app">
      <header className="app-header">
        <h1>Campaign Manager</h1>
        <p>Manage and view your advertising campaigns</p>
      </header>

      <main className="app-main">
        <div className="campaign-section">
          <CampaignViewer campaigns={sampleCampaigns} />
        </div>

        <div className="chat-section">
          <Chat />
        </div>
      </main>
    </div>
  );
}

export default App;
