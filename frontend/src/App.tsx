import { useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { Chat } from './components/Chat';
import { CampaignCreate } from './components/CampaignCreate';
import { type Campaign } from './services/api';
import './App.css';

type ViewMode = 'create' | 'campaign';

function App() {
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('create');

  const handleSelectCampaign = (campaign: Campaign | null) => {
    setSelectedCampaign(campaign);
    if (campaign) {
      setViewMode('campaign');
    }
  };

  const handleCreateNew = () => {
    setSelectedCampaign(null);
    setViewMode('create');
  };

  const handleCampaignCreated = (campaign: Campaign) => {
    setSelectedCampaign(campaign);
    setViewMode('campaign');
  };

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <div className="logo">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="23 7 16 12 23 17 23 7"></polygon>
              <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
            </svg>
            <h1>Campaign Manager</h1>
          </div>
          <p>AI-Powered Video Analysis & Scene Search</p>
        </div>
      </header>

      <main className="app-main">
        <aside className="app-sidebar-left">
          <Sidebar
            onSelectCampaign={handleSelectCampaign}
            onCreateNew={handleCreateNew}
            selectedCampaignId={selectedCampaign?.id}
          />
        </aside>

        <section className="app-content">
          <CampaignCreate
            onCampaignCreated={handleCampaignCreated}
            existingCampaign={viewMode === 'campaign' ? selectedCampaign : null}
          />
        </section>

        <aside className="app-sidebar-right">
          <div className="chat-wrapper">
            <div className="chat-header">
              <h2>AI Assistant</h2>
              <p>Ask questions about your campaigns</p>
            </div>
            <Chat />
          </div>
        </aside>
      </main>
    </div>
  );
}

export default App;
