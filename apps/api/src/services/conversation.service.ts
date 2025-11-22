import { prisma } from '@carecompanion/database';
import { MessageRole } from '@prisma/client';

export interface CreateConversationParams {
  familyId: string;
  userId: string;
  title?: string;
}

export interface AddMessageParams {
  conversationId: string;
  role: MessageRole;
  content: string;
  citations?: any;
  tokenCount?: number;
}

export interface GetConversationsParams {
  familyId: string;
  userId: string;
  limit?: number;
  offset?: number;
}

export interface GetMessagesParams {
  conversationId: string;
  limit?: number;
  beforeId?: string;
}

class ConversationService {
  /**
   * Create a new conversation
   */
  async createConversation(params: CreateConversationParams) {
    const { familyId, userId, title } = params;

    const conversation = await prisma.conversation.create({
      data: {
        familyId,
        userId,
        title: title || null,
      },
    });

    return conversation;
  }

  /**
   * Get a conversation by ID with authorization check
   */
  async getConversation(conversationId: string, familyId: string) {
    const conversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        familyId,
      },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
          take: 50, // Limit to most recent 50 messages
        },
      },
    });

    return conversation;
  }

  /**
   * List conversations for a user
   */
  async listConversations(params: GetConversationsParams) {
    const { familyId, userId, limit = 20, offset = 0 } = params;

    const conversations = await prisma.conversation.findMany({
      where: {
        familyId,
        userId,
      },
      orderBy: { updatedAt: 'desc' },
      take: limit,
      skip: offset,
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1, // Just get the last message for preview
        },
        _count: {
          select: { messages: true },
        },
      },
    });

    return conversations;
  }

  /**
   * Add a message to a conversation
   */
  async addMessage(params: AddMessageParams) {
    const { conversationId, role, content, citations, tokenCount } = params;

    // Add the message
    const message = await prisma.chatMessage.create({
      data: {
        conversationId,
        role,
        content,
        citations: citations || null,
        tokenCount: tokenCount || null,
      },
    });

    // Update conversation timestamp and auto-generate title if needed
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (conversation && !conversation.title && role === 'USER') {
      // Auto-generate title from first user message (truncated)
      const title = content.length > 50
        ? content.substring(0, 47) + '...'
        : content;

      await prisma.conversation.update({
        where: { id: conversationId },
        data: { title },
      });
    } else {
      // Just update timestamp
      await prisma.conversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
      });
    }

    return message;
  }

  /**
   * Get messages from a conversation with pagination
   */
  async getMessages(params: GetMessagesParams) {
    const { conversationId, limit = 50, beforeId } = params;

    const where: any = { conversationId };

    if (beforeId) {
      const beforeMessage = await prisma.chatMessage.findUnique({
        where: { id: beforeId },
        select: { createdAt: true },
      });
      if (beforeMessage) {
        where.createdAt = { lt: beforeMessage.createdAt };
      }
    }

    const messages = await prisma.chatMessage.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    // Return in chronological order
    return messages.reverse();
  }

  /**
   * Get recent messages for context (for multi-turn memory)
   */
  async getRecentMessagesForContext(conversationId: string, limit: number = 10) {
    const messages = await prisma.chatMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        role: true,
        content: true,
      },
    });

    // Return in chronological order
    return messages.reverse();
  }

  /**
   * Delete a conversation and all its messages
   */
  async deleteConversation(conversationId: string, familyId: string) {
    const conversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        familyId,
      },
    });

    if (!conversation) {
      return null;
    }

    await prisma.conversation.delete({
      where: { id: conversationId },
    });

    return { deleted: true };
  }

  /**
   * Update conversation title
   */
  async updateTitle(conversationId: string, familyId: string, title: string) {
    const conversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        familyId,
      },
    });

    if (!conversation) {
      return null;
    }

    return prisma.conversation.update({
      where: { id: conversationId },
      data: { title },
    });
  }
}

export const conversationService = new ConversationService();
