import { useState, useRef, useEffect } from 'react';
import { apiService } from '../services/api';
import './Chat.css';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  timestamp: Date;
}

export const Chat = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: 'Hello! I\'m your AI assistant. Ask me anything about your campaigns, videos, or scenes once you upload some content!',
      sender: 'ai',
      timestamp: new Date(),
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!inputValue.trim()) return;
    
    const userMessage: Message = {
      id: Date.now().toString(),
      text: inputValue,
      sender: 'user',
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    const currentInput = inputValue;
    setInputValue('');
    setIsLoading(true);
    setError(null);

    try {
      // Create conversation if it doesn't exist yet
      let activeConversationId = conversationId;
      if (!activeConversationId && !isInitializing) {
        setIsInitializing(true);
        try {
          const conversation = await apiService.createConversation();
          activeConversationId = conversation.id;
          setConversationId(activeConversationId);
          console.log('Conversation created:', activeConversationId);
        } catch (convErr) {
          console.error('Failed to create conversation:', convErr);
          throw new Error('Unable to connect to chat service. Please check if the backend is running.');
        } finally {
          setIsInitializing(false);
        }
      }

      if (!activeConversationId) {
        throw new Error('No active conversation available.');
      }

      // Send message to backend
      const response = await apiService.sendMessage(activeConversationId, currentInput);
      
      const aiMessage: Message = {
        id: response.messageId || (Date.now() + 1).toString(),
        text: response.response,
        sender: 'ai',
        timestamp: new Date(response.timestamp || new Date()),
      };
      
      setMessages((prev) => [...prev, aiMessage]);
    } catch (err) {
      console.error('Failed to send message:', err);
      const errorMsg = err instanceof Error ? err.message : 'Failed to get response from AI. Please try again.';
      setError(errorMsg);
      
      // Add error message to chat
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: `Sorry, I encountered an error: ${errorMsg}`,
        sender: 'ai',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="chat-container">
      {error && (
        <div className="chat-error">
          <span>{error}</span>
          <button 
            className="error-dismiss"
            onClick={() => setError(null)}
            title="Dismiss"
          >
            ✕
          </button>
        </div>
      )}
      <div className="chat-messages">
        {messages.map((message) => (
          <div key={message.id} className={`message ${message.sender}`}>
            <div className="message-content">
              <p>{message.text}</p>
              <span className="message-timestamp">
                {message.timestamp.toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="message ai">
            <div className="message-content">
              <p className="loading-indicator">Thinking...</p>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="chat-input-container">
        <input
          type="text"
          className="chat-input"
          placeholder="Type your message..."
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyPress={handleKeyPress}
          disabled={isLoading}
        />
        <button 
          className="send-button" 
          onClick={handleSend}
          disabled={isLoading}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="22" y1="2" x2="11" y2="13"></line>
            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
          </svg>
        </button>
      </div>
    </div>
  );
};

