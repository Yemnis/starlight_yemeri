/**
 * Chat Service - Handles conversational AI with RAG (Retrieval-Augmented Generation)
 * Manages chat conversations and generates responses using Gemini Pro with function calling
 */
import { Firestore } from '@google-cloud/firestore';
import { VertexAI, FunctionDeclarationSchemaType } from '@google-cloud/vertexai';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config';
import logger from '../utils/logger';
import { ChatConversation, ChatMessage, Scene } from '../types';
import { SearchService } from './search.service';
import { CampaignService } from './campaign.service';

export class ChatService {
  private firestore: Firestore | null = null;
  private vertexai: VertexAI | null = null;
  private generativeModel: any;
  private searchService: SearchService;
  private campaignService: CampaignService;
  private useInMemoryStore: boolean = false;
  private inMemoryConversations: Map<string, ChatConversation> = new Map();

  constructor(searchService: SearchService, campaignService: CampaignService) {
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
    this.campaignService = campaignService;
    logger.info('ChatService initialized');
  }

  /**
   * Define function declarations for Gemini function calling
   */
  private getFunctionDeclarations() {
    return [
      {
        name: 'count_campaigns',
        description: 'Get the total number of campaigns in the system',
        parameters: {
          type: FunctionDeclarationSchemaType.OBJECT,
          properties: {},
          required: [],
        },
      },
      {
        name: 'list_campaigns',
        description: 'Get a list of all campaigns with their names and metadata',
        parameters: {
          type: FunctionDeclarationSchemaType.OBJECT,
          properties: {
            limit: {
              type: FunctionDeclarationSchemaType.NUMBER,
              description: 'Maximum number of campaigns to return (default: 50)',
            },
          },
          required: [],
        },
      },
      {
        name: 'get_campaign_details',
        description: 'Get detailed information about a specific campaign including stats',
        parameters: {
          type: FunctionDeclarationSchemaType.OBJECT,
          properties: {
            campaignId: {
              type: FunctionDeclarationSchemaType.STRING,
              description: 'The ID of the campaign to get details for',
            },
          },
          required: ['campaignId'],
        },
      },
      {
        name: 'get_campaign_analytics',
        description: 'Get analytics and statistics for a campaign (scenes, moods, products, visual elements)',
        parameters: {
          type: FunctionDeclarationSchemaType.OBJECT,
          properties: {
            campaignId: {
              type: FunctionDeclarationSchemaType.STRING,
              description: 'The ID of the campaign to analyze',
            },
          },
          required: ['campaignId'],
        },
      },
      {
        name: 'search_scenes',
        description: 'Search for video scenes by content, visual elements, or semantic meaning',
        parameters: {
          type: FunctionDeclarationSchemaType.OBJECT,
          properties: {
            query: {
              type: FunctionDeclarationSchemaType.STRING,
              description: 'The search query describing what scenes to find',
            },
            campaignId: {
              type: FunctionDeclarationSchemaType.STRING,
              description: 'Optional campaign ID to limit search to specific campaign',
            },
            limit: {
              type: FunctionDeclarationSchemaType.NUMBER,
              description: 'Maximum number of scenes to return (default: 10)',
            },
          },
          required: ['query'],
        },
      },
      {
        name: 'count_videos',
        description: 'Count total number of videos across all campaigns or in a specific campaign',
        parameters: {
          type: FunctionDeclarationSchemaType.OBJECT,
          properties: {
            campaignId: {
              type: FunctionDeclarationSchemaType.STRING,
              description: 'Optional campaign ID to count videos for specific campaign',
            },
          },
          required: [],
        },
      },
      {
        name: 'count_scenes',
        description: 'Count total number of scenes across all campaigns or in a specific campaign',
        parameters: {
          type: FunctionDeclarationSchemaType.OBJECT,
          properties: {
            campaignId: {
              type: FunctionDeclarationSchemaType.STRING,
              description: 'Optional campaign ID to count scenes for specific campaign',
            },
          },
          required: [],
        },
      },
    ];
  }

  /**
   * Execute a function call from Gemini
   */
  private async executeFunction(functionName: string, args: any): Promise<any> {
    logger.info('Executing function', {
      operation: 'execute_function',
      functionName,
      args,
    });

    try {
      switch (functionName) {
        case 'count_campaigns': {
          const campaigns = await this.campaignService.listCampaigns(1000);
          return { count: campaigns.length };
        }

        case 'list_campaigns': {
          const limit = args.limit || 50;
          const campaigns = await this.campaignService.listCampaigns(limit);
          return {
            campaigns: campaigns.map(c => ({
              id: c.id,
              name: c.name,
              description: c.description,
              videoCount: c.videoCount,
              totalDuration: c.totalDuration,
              createdAt: c.createdAt.toISOString(),
            })),
          };
        }

        case 'get_campaign_details': {
          if (!args.campaignId) {
            throw new Error('campaignId is required');
          }
          const campaign = await this.campaignService.getCampaign(args.campaignId);
          if (!campaign) {
            throw new Error(`Campaign ${args.campaignId} not found`);
          }
          return {
            id: campaign.id,
            name: campaign.name,
            description: campaign.description,
            videoCount: campaign.videoCount,
            totalDuration: campaign.totalDuration,
            createdAt: campaign.createdAt.toISOString(),
            updatedAt: campaign.updatedAt.toISOString(),
          };
        }

        case 'get_campaign_analytics': {
          if (!args.campaignId) {
            throw new Error('campaignId is required');
          }
          const analytics = await this.campaignService.getCampaignAnalytics(args.campaignId);
          return analytics;
        }

        case 'search_scenes': {
          if (!args.query) {
            throw new Error('query is required');
          }
          const searchResults = await this.searchService.queryScenes(args.query, {
            campaignId: args.campaignId,
            limit: args.limit || 10,
          });
          return {
            scenes: searchResults.map(r => ({
              sceneId: r.scene.id,
              videoId: r.scene.videoId,
              campaignId: r.scene.campaignId,
              startTime: r.scene.startTime,
              endTime: r.scene.endTime,
              description: r.scene.description,
              transcript: r.scene.transcript,
              visualElements: r.scene.analysis.visualElements,
              mood: r.scene.analysis.mood,
              product: r.scene.analysis.product,
              score: r.score,
            })),
          };
        }

        case 'count_videos': {
          if (!this.firestore) {
            throw new Error('Firestore not available');
          }
          let query = this.firestore.collection('videos');
          if (args.campaignId) {
            query = query.where('campaignId', '==', args.campaignId) as any;
          }
          const snapshot = await query.count().get();
          return { count: snapshot.data().count };
        }

        case 'count_scenes': {
          if (!this.firestore) {
            throw new Error('Firestore not available');
          }
          let query = this.firestore.collection('scenes');
          if (args.campaignId) {
            query = query.where('campaignId', '==', args.campaignId) as any;
          }
          const snapshot = await query.count().get();
          return { count: snapshot.data().count };
        }

        default:
          throw new Error(`Unknown function: ${functionName}`);
      }
    } catch (error) {
      logger.error('Function execution failed', {
        operation: 'execute_function',
        functionName,
        args,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
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
   * Generate AI response using Gemini Pro with function calling
   */
  async generateResponse(
    message: string,
    context: Scene[],
    conversationHistory: ChatMessage[]
  ): Promise<string> {
    const startTime = Date.now();

    // If Vertex AI is not available, throw error
    if (!this.generativeModel || !this.vertexai) {
      throw new Error('Vertex AI not initialized');
    }

    try {
      // System instruction for the AI
      const systemInstruction = `You are an AI assistant helping marketers analyze their advertising videos.

You have access to these functions to gather information:
- count_campaigns: Get total number of campaigns
- list_campaigns: Get list of all campaigns with details
- get_campaign_details: Get details about a specific campaign
- get_campaign_analytics: Get analytics for a campaign (moods, products, visual elements)
- search_scenes: Search for video scenes by content or visual elements
- count_videos: Count videos in the system or campaign
- count_scenes: Count scenes in the system or campaign

When answering questions:
- Use function calls to retrieve accurate, real-time data
- Be conversational and helpful
- Reference specific data points from function results
- If you need information, call the appropriate function first
- Format lists and data clearly
- Provide actionable insights`;

      // Format conversation history (last 5 messages)
      const historyParts = conversationHistory
        .slice(-5)
        .map(msg => ({
          role: msg.role,
          parts: [{ text: msg.content }],
        }));

      // Build the request with function declarations
      const tools = {
        functionDeclarations: this.getFunctionDeclarations(),
      };

      let contents = [
        ...historyParts,
        {
          role: 'user',
          parts: [{ text: message }],
        },
      ];

      // Function calling loop - max 5 iterations to prevent infinite loops
      const maxIterations = 5;
      let iteration = 0;
      let finalResponse = '';

      while (iteration < maxIterations) {
        iteration++;

        logger.debug('Sending request to Gemini', {
          operation: 'generate_response',
          iteration,
          messageCount: contents.length,
        });

        const request = {
          contents,
          tools: [tools],
          generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 2048,
          },
        };

        const response = await this.generativeModel.generateContent(request);
        const candidate = response.response.candidates[0];

        if (!candidate) {
          throw new Error('No response candidate from Gemini');
        }

        // Check if the model wants to call a function
        const functionCall = candidate.content.parts.find((part: any) => part.functionCall);

        if (functionCall) {
          // Model wants to call a function
          const funcName = functionCall.functionCall.name;
          const funcArgs = functionCall.functionCall.args || {};

          logger.info('Gemini requested function call', {
            operation: 'function_call_request',
            function: funcName,
            args: funcArgs,
          });

          // Execute the function
          const functionResult = await this.executeFunction(funcName, funcArgs);

          logger.info('Function executed successfully', {
            operation: 'function_call_result',
            function: funcName,
            result: functionResult,
          });

          // Add the function call and response to the conversation
          contents.push({
            role: 'model',
            parts: [{ functionCall: functionCall.functionCall } as any],
          } as any);

          contents.push({
            role: 'function',
            parts: [
              {
                functionResponse: {
                  name: funcName,
                  response: functionResult,
                },
              } as any,
            ],
          } as any);

          // Continue the loop to get the next response
          continue;
        }

        // No function call - we have the final text response
        const textPart = candidate.content.parts.find((part: any) => part.text);
        if (textPart) {
          finalResponse = textPart.text;
          break;
        }

        // No function call and no text - something went wrong
        throw new Error('No function call or text in response');
      }

      if (iteration >= maxIterations && !finalResponse) {
        throw new Error('Maximum function call iterations reached');
      }

      const duration = Date.now() - startTime;
      logger.info('Response generated with function calling', {
        operation: 'generate_response',
        iterations: iteration,
        duration,
      });

      return finalResponse;
    } catch (error) {
      logger.error('Failed to generate response', {
        operation: 'generate_response',
        message,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
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
