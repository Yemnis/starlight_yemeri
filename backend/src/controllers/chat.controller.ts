/**
 * Chat Controller - Handles conversational AI endpoints
 */
import { Request, Response } from 'express';
import { ChatService } from '../services/chat.service';
import { AppError, asyncHandler } from '../middleware/error.middleware';

export class ChatController {
  constructor(private chatService: ChatService) {}

  /**
   * Create a new chat conversation
   * POST /api/v1/chat/conversations
   */
  createConversation = asyncHandler(async (req: Request, res: Response) => {
    const { campaignId } = req.body;

    const conversation = await this.chatService.createConversation(campaignId);

    res.status(201).json({
      success: true,
      data: conversation,
    });
  });

  /**
   * Get conversation by ID
   * GET /api/v1/chat/conversations/:id
   */
  getConversation = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const conversation = await this.chatService.getConversation(id);
    if (!conversation) {
      throw new AppError('Conversation not found', 404);
    }

    res.json({
      success: true,
      data: conversation,
    });
  });

  /**
   * Send a message in a conversation
   * POST /api/v1/chat/conversations/:id/messages
   */
  sendMessage = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { message } = req.body;

    const conversation = await this.chatService.getConversation(id);
    if (!conversation) {
      throw new AppError('Conversation not found', 404);
    }

    const response = await this.chatService.sendMessage(id, message);

    res.json({
      success: true,
      data: {
        messageId: response.id,
        response: response.content,
        context: response.context,
        timestamp: response.timestamp,
      },
    });
  });

  /**
   * List conversations
   * GET /api/v1/chat/conversations
   */
  listConversations = asyncHandler(async (req: Request, res: Response) => {
    const { campaignId, limit } = req.query;

    const conversations = await this.chatService.listConversations(
      campaignId as string | undefined,
      limit ? parseInt(limit as string) : 20
    );

    res.json({
      success: true,
      data: conversations,
    });
  });

  /**
   * Delete conversation
   * DELETE /api/v1/chat/conversations/:id
   */
  deleteConversation = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const conversation = await this.chatService.getConversation(id);
    if (!conversation) {
      throw new AppError('Conversation not found', 404);
    }

    await this.chatService.deleteConversation(id);

    res.json({
      success: true,
      message: 'Conversation deleted',
    });
  });
}
