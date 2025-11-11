import { VertexAI } from '@google-cloud/vertexai';
import { config } from '../config/env.js';

/**
 * Vertex AI Service
 * Handles all interactions with Google Cloud Vertex AI using service account authentication
 */
class VertexAIService {
  constructor() {
    this.initialized = false;
    this.vertexAI = null;
    this.model = null;
  }

  /**
   * Initialize Vertex AI with service account credentials
   * The credentials are automatically loaded from GOOGLE_APPLICATION_CREDENTIALS
   */
  async initialize() {
    if (this.initialized) {
      return;
    }

    try {
      console.log('🔧 Initializing Vertex AI with service account authentication...');
      
      // Initialize Vertex AI
      // Authentication happens automatically via Application Default Credentials (ADC)
      // The SDK will use GOOGLE_APPLICATION_CREDENTIALS environment variable
      this.vertexAI = new VertexAI({
        project: config.gcp.projectId,
        location: config.gcp.location,
      });

      // Initialize the generative model
      this.model = this.vertexAI.getGenerativeModel({
        model: config.vertexAI.model,
      });

      this.initialized = true;
      console.log('✅ Vertex AI initialized successfully');
      console.log(`   - Using service account from: ${config.gcp.credentials}`);
      console.log(`   - Project: ${config.gcp.projectId}`);
      console.log(`   - Model: ${config.vertexAI.model}`);
    } catch (error) {
      console.error('❌ Failed to initialize Vertex AI:', error.message);
      throw new Error(`Vertex AI initialization failed: ${error.message}`);
    }
  }

  /**
   * Generate content using Vertex AI
   * @param {string} prompt - The prompt to send to the model
   * @returns {Promise<string>} - The generated response
   */
  async generateContent(prompt) {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const request = {
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
      };

      const response = await this.model.generateContent(request);
      const result = response.response.candidates[0].content.parts[0].text;
      
      return result;
    } catch (error) {
      console.error('❌ Error generating content:', error.message);
      throw new Error(`Content generation failed: ${error.message}`);
    }
  }

  /**
   * Generate streaming content using Vertex AI
   * @param {string} prompt - The prompt to send to the model
   * @returns {AsyncGenerator<string>} - Streaming response
   */
  async *generateContentStream(prompt) {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const request = {
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
      };

      const streamingResponse = await this.model.generateContentStream(request);

      for await (const chunk of streamingResponse.stream) {
        const text = chunk.candidates[0].content.parts[0].text;
        yield text;
      }
    } catch (error) {
      console.error('❌ Error streaming content:', error.message);
      throw new Error(`Content streaming failed: ${error.message}`);
    }
  }

  /**
   * Chat with context
   * @param {Array} messages - Array of message objects with role and content
   * @returns {Promise<string>} - The chat response
   */
  async chat(messages) {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      // Convert messages to Vertex AI format
      const contents = messages.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }],
      }));

      const request = { contents };
      const response = await this.model.generateContent(request);
      const result = response.response.candidates[0].content.parts[0].text;
      
      return result;
    } catch (error) {
      console.error('❌ Error in chat:', error.message);
      throw new Error(`Chat failed: ${error.message}`);
    }
  }
}

// Export a singleton instance
export const vertexAIService = new VertexAIService();

