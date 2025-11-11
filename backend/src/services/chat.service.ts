/**
 * Chat Service - Handles conversational AI with RAG (Retrieval-Augmented Generation)
 * Manages chat conversations and generates responses using Gemini Pro with retrieved context
 */
import { Firestore } from '@google-cloud/firestore';
import { VertexAI } from '@google-cloud/vertexai';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config';
import logger from '../utils/logger';
import { ChatConversation, ChatMessage, Scene } from '../types';
import { SearchService } from './search.service';

export class ChatService {
  private firestore: Firestore | null = null;
  private vertexai: VertexAI | null = null;
  private generativeModel: any;
  private searchService: SearchService;
  private useInMemoryStore: boolean = false;
  private inMemoryConversations: Map<string, ChatConversation> = new Map();

  constructor(searchService: SearchService) {
    try {
      this.firestore = new Firestore({
        projectId: config.gcp.projectId,
        databaseId: config.firestore.database,
      });
      this.vertexai = new VertexAI({
        project: config.gcp.projectId,
        location: config.vertexai.location,
      });
      this.generativeModel = this.vertexai.getGenerativeModel({
        model: config.vertexai.geminiProModel,
      });
      logger.info('ChatService initialized with Firestore and Vertex AI');
    } catch (error) {
      logger.warn('Failed to initialize GCP services, using in-memory fallback', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      this.useInMemoryStore = true;
      this.firestore = null;
      this.vertexai = null;
    }
    this.searchService = searchService;
    logger.info('ChatService initialized');
  }

  /**
   * Create a new chat conversation
   */
  async createConversation(campaignId?: string): Promise<ChatConversation> {
    const conversation: ChatConversation = {
      id: uuidv4(),
      campaignId,
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    if (this.useInMemoryStore || !this.firestore) {
      // Store in memory
      this.inMemoryConversations.set(conversation.id, conversation);
      logger.info('Chat conversation created (in-memory)', {
        operation: 'create_conversation',
        conversationId: conversation.id,
        campaignId,
      });
    } else {
      // Build document data, excluding undefined fields
      const documentData: any = {
        messages: [],
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt,
      };

      // Only include campaignId if it's defined
      if (campaignId !== undefined) {
        documentData.campaignId = campaignId;
      }

      try {
        await this.firestore.collection('chats').doc(conversation.id).set(documentData);
        logger.info('Chat conversation created (Firestore)', {
          operation: 'create_conversation',
          conversationId: conversation.id,
          campaignId,
        });
      } catch (error) {
        logger.warn('Failed to save to Firestore, falling back to in-memory', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        this.useInMemoryStore = true;
        this.inMemoryConversations.set(conversation.id, conversation);
      }
    }

    return conversation;
  }

  /**
   * Get conversation by ID
   */
  async getConversation(conversationId: string): Promise<ChatConversation | null> {
    if (this.useInMemoryStore || !this.firestore) {
      const conversation = this.inMemoryConversations.get(conversationId);
      return conversation || null;
    }

    try {
      const doc = await this.firestore.collection('chats').doc(conversationId).get();
      if (!doc.exists) {
        return null;
      }

      const data = doc.data()!;
      return {
        id: doc.id,
        campaignId: data.campaignId,
        messages: data.messages || [],
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
      };
    } catch (error) {
      logger.error('Failed to get conversation from Firestore, checking in-memory', {
        operation: 'get_conversation',
        conversationId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      // Fallback to in-memory
      const conversation = this.inMemoryConversations.get(conversationId);
      return conversation || null;
    }
  }

  /**
   * Retrieve relevant context for a user message using RAG
   */
  async retrieveContext(message: string, campaignId?: string): Promise<Scene[]> {
    try {
      const searchResults = await this.searchService.queryScenes(message, {
        campaignId,
        limit: 10,
      });

      const scenes = searchResults.map(result => result.scene);

      logger.debug('Context retrieved for message', {
        operation: 'retrieve_context',
        message,
        sceneCount: scenes.length,
      });

      return scenes;
    } catch (error) {
      logger.error('Failed to retrieve context', {
        operation: 'retrieve_context',
        message,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return [];
    }
  }

  /**
   * Generate AI response using Gemini Pro with RAG
   */
  async generateResponse(
    message: string,
    context: Scene[],
    conversationHistory: ChatMessage[]
  ): Promise<string> {
    const startTime = Date.now();

    // If Vertex AI is not available, return a mock response
    if (!this.generativeModel || !this.vertexai) {
      logger.warn('Vertex AI not available, returning mock response');
      return `I received your message: "${message}". However, AI generation is currently unavailable. Please enable Vertex AI to get intelligent responses.`;
    }

    try {
      // Build the prompt with system instructions, context, and history
      const systemInstruction = `You are an AI assistant helping marketers analyze their advertising videos. You have access to detailed scene-level analysis including visual elements, transcripts, and metadata.

When answering questions:
- Be conversational and helpful
- Reference specific scenes with timestamps when relevant
- Provide actionable insights
- If you don't have information, say so clearly
- Format lists and data clearly`;

      // Format context from retrieved scenes
      const contextText = context
        .map(
          (scene, idx) =>
            `[Scene ${idx + 1}] Video: ${scene.videoId} (${scene.startTime}s-${scene.endTime}s)
Description: ${scene.description}
Visual Elements: ${scene.analysis.visualElements.join(', ')}
Mood: ${scene.analysis.mood}
Transcript: "${scene.transcript}"`
        )
        .join('\n\n');

      // Format conversation history (last 5 messages)
      const historyText = conversationHistory
        .slice(-5)
        .map(msg => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
        .join('\n');

      // Build full prompt
      const prompt = `${systemInstruction}

Context (Retrieved Scenes):
${contextText || 'No relevant scenes found.'}

${historyText ? `Conversation History:\n${historyText}\n` : ''}
Current User Message: ${message}

Instructions: Based on the retrieved scenes and context, provide a helpful, conversational answer. Reference specific scenes by their video ID and timestamp when relevant.`;

      const request = {
        contents: [
          {
            role: 'user',
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 2048,
        },
      };

      const response = await this.generativeModel.generateContent(request);
      const responseText = response.response.candidates[0].content.parts[0].text;

      const duration = Date.now() - startTime;
      logger.info('Response generated', {
        operation: 'generate_response',
        contextScenes: context.length,
        historyLength: conversationHistory.length,
        duration,
      });

      return responseText;
    } catch (error) {
      logger.error('Failed to generate response', {
        operation: 'generate_response',
        message,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      // Return a fallback response instead of throwing
      return `I received your message but encountered an error generating a response. Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  /**
   * Send a message in a conversation
   */
  async sendMessage(conversationId: string, userMessage: string): Promise<ChatMessage> {
    const startTime = Date.now();

    try {
      // Get conversation
      const conversation = await this.getConversation(conversationId);
      if (!conversation) {
        throw new Error('Conversation not found');
      }

      // Create user message
      const userMsg: ChatMessage = {
        id: uuidv4(),
        role: 'user',
        content: userMessage,
        timestamp: new Date(),
      };

      // Retrieve context
      const context = await this.retrieveContext(userMessage, conversation.campaignId);

      // Generate response
      const responseText = await this.generateResponse(
        userMessage,
        context,
        conversation.messages
      );

      // Create assistant message
      const assistantMsg: ChatMessage = {
        id: uuidv4(),
        role: 'assistant',
        content: responseText,
        timestamp: new Date(),
        context: {
          scenes: context,
          videos: [], // Can be populated if needed
        },
      };

      // Update conversation in storage
      conversation.messages.push(userMsg, assistantMsg);
      conversation.updatedAt = new Date();

      if (this.useInMemoryStore || !this.firestore) {
        // Update in memory
        this.inMemoryConversations.set(conversationId, conversation);
      } else {
        try {
          await this.firestore
            .collection('chats')
            .doc(conversationId)
            .update({
              messages: conversation.messages,
              updatedAt: conversation.updatedAt,
            });
        } catch (error) {
          logger.warn('Failed to update Firestore, falling back to in-memory', {
            error: error instanceof Error ? error.message : 'Unknown error',
          });
          this.useInMemoryStore = true;
          this.inMemoryConversations.set(conversationId, conversation);
        }
      }

      const duration = Date.now() - startTime;
      logger.info('Message sent and response generated', {
        operation: 'send_message',
        conversationId,
        messageId: assistantMsg.id,
        contextScenes: context.length,
        duration,
      });

      return assistantMsg;
    } catch (error) {
      logger.error('Failed to send message', {
        operation: 'send_message',
        conversationId,
        userMessage,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Delete a conversation
   */
  async deleteConversation(conversationId: string): Promise<void> {
    if (this.useInMemoryStore || !this.firestore) {
      this.inMemoryConversations.delete(conversationId);
      logger.info('Conversation deleted (in-memory)', {
        operation: 'delete_conversation',
        conversationId,
      });
      return;
    }

    try {
      await this.firestore.collection('chats').doc(conversationId).delete();

      logger.info('Conversation deleted (Firestore)', {
        operation: 'delete_conversation',
        conversationId,
      });
    } catch (error) {
      logger.error('Failed to delete conversation from Firestore', {
        operation: 'delete_conversation',
        conversationId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      // Try deleting from in-memory as fallback
      this.inMemoryConversations.delete(conversationId);
    }
  }

  /**
   * List conversations, optionally filtered by campaign
   */
  async listConversations(campaignId?: string, limit: number = 20): Promise<ChatConversation[]> {
    if (this.useInMemoryStore || !this.firestore) {
      let conversations = Array.from(this.inMemoryConversations.values());

      // Filter by campaignId if provided
      if (campaignId) {
        conversations = conversations.filter(c => c.campaignId === campaignId);
      }

      // Sort by updatedAt desc
      conversations.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

      // Apply limit
      conversations = conversations.slice(0, limit);

      logger.debug('Conversations listed (in-memory)', {
        operation: 'list_conversations',
        campaignId,
        count: conversations.length,
      });

      return conversations;
    }

    try {
      let query = this.firestore
        .collection('chats')
        .orderBy('updatedAt', 'desc')
        .limit(limit);

      if (campaignId) {
        query = query.where('campaignId', '==', campaignId) as any;
      }

      const snapshot = await query.get();
      const conversations: ChatConversation[] = [];

      snapshot.forEach(doc => {
        const data = doc.data();
        conversations.push({
          id: doc.id,
          campaignId: data.campaignId,
          messages: data.messages || [],
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
        });
      });

      logger.debug('Conversations listed (Firestore)', {
        operation: 'list_conversations',
        campaignId,
        count: conversations.length,
      });

      return conversations;
    } catch (error) {
      logger.error('Failed to list conversations from Firestore, trying in-memory', {
        operation: 'list_conversations',
        campaignId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      // Fallback to in-memory
      let conversations = Array.from(this.inMemoryConversations.values());
      if (campaignId) {
        conversations = conversations.filter(c => c.campaignId === campaignId);
      }
      conversations.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
      return conversations.slice(0, limit);
    }
  }
}
