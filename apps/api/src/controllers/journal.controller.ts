import { Request, Response } from 'express';
import { z} from 'zod';
import { prisma, JournalSentiment } from '@carecompanion/database';
import { ApiError } from '../middleware/error';
import { ErrorCodes } from '@carecompanion/shared';
import { AuthRequest } from '../types';
import { logger } from '../utils/logger';
import { auditService, AuditActions, ResourceTypes } from '../services/audit.service';
import { startOfDay, endOfDay, subDays } from 'date-fns';
import OpenAI from 'openai';
import { toFile } from 'openai/uploads';
import { Readable } from 'stream';
import { config } from '../config';

// Validation schemas
const createJournalEntrySchema = z.object({
  content: z.string().min(1).max(5000),
  isPrivate: z.boolean().optional().default(false),
  attachmentUrls: z.array(z.string().url()).optional().default([]),
});

const updateJournalEntrySchema = z.object({
  content: z.string().min(1).max(5000).optional(),
  isPrivate: z.boolean().optional(),
  sentiment: z.enum(['positive', 'neutral', 'concerned', 'urgent']).optional(),
});

const openai = new OpenAI({
  apiKey: config.openaiApiKey,
});

export class JournalController {
  // Create a new journal entry
  async createEntry(req: AuthRequest, res: Response) {
    const validation = createJournalEntrySchema.safeParse(req.body);
    if (!validation.success) {
      throw new ApiError(ErrorCodes.VALIDATION_ERROR, 'Invalid input', 400, validation.error.errors);
    }

    const userId = req.auth!.userId;
    const { content, isPrivate, attachmentUrls } = validation.data;

    // Get user's family
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      include: {
        familyMembers: {
          where: { isActive: true },
          include: {
            family: true,
          },
        },
      },
    });

    if (!user || user.familyMembers.length === 0) {
      throw new ApiError(ErrorCodes.NOT_FOUND, 'No family found', 404);
    }

    const familyId = user.familyMembers[0].familyId;

    // Analyze sentiment (basic implementation - can be enhanced with AI later)
    const sentiment = this.analyzeSentiment(content);

    // Create the journal entry
    const entry = await prisma.journalEntry.create({
      data: {
        familyId,
        userId: user.id,
        content,
        sentiment,
        isPrivate,
        attachmentUrls,
      },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    // Audit log
    await auditService.logFromRequest({
      req,
      action: AuditActions.CREATE_JOURNAL,
      resourceType: ResourceTypes.JOURNAL,
      resourceId: entry.id,
      metadata: { sentiment, isPrivate },
      familyId,
      userId: user.id,
    });

    res.status(201).json({ entry });
  }

  // Get journal entries for the family
  async getEntries(req: AuthRequest, res: Response) {
    const userId = req.auth!.userId;
    const { days = 30 } = req.query;

    // Get user's family and role
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      include: {
        familyMembers: {
          where: { isActive: true },
          include: {
            family: true,
          },
        },
      },
    });

    if (!user || user.familyMembers.length === 0) {
      throw new ApiError(ErrorCodes.NOT_FOUND, 'No family found', 404);
    }

    const familyId = user.familyMembers[0].familyId;
    const userRole = user.familyMembers[0].role;

    // Build query conditions
    const where: any = {
      familyId,
      createdAt: {
        gte: subDays(new Date(), Number(days)),
      },
    };

    // Always filter private entries - they should only be visible to the author
    where.OR = [
      { isPrivate: false }, // Show all public entries
      { 
        AND: [
          { isPrivate: true },
          { userId: user.id } // Only show private entries authored by the current user
        ]
      }
    ];

    const entries = await prisma.journalEntry.findMany({
      where,
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ entries });
  }

  // Get a single journal entry
  async getEntry(req: AuthRequest, res: Response) {
    const { entryId } = req.params;
    const userId = req.auth!.userId;

    // Get user
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      include: {
        familyMembers: {
          where: { isActive: true },
        },
      },
    });

    if (!user) {
      throw new ApiError(ErrorCodes.NOT_FOUND, 'User not found', 404);
    }

    // Get the entry
    const entry = await prisma.journalEntry.findUnique({
      where: { id: entryId },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!entry) {
      throw new ApiError(ErrorCodes.NOT_FOUND, 'Entry not found', 404);
    }

    // Check access
    const hasAccess = user.familyMembers.some(fm => fm.familyId === entry.familyId);
    if (!hasAccess) {
      throw new ApiError(ErrorCodes.FORBIDDEN, 'Access denied', 403);
    }

    // Check private entry access - private entries are only visible to the author
    if (entry.isPrivate && entry.userId !== user.id) {
      throw new ApiError(ErrorCodes.FORBIDDEN, 'Private entries can only be viewed by their author', 403);
    }

    res.json({ entry });
  }

  // Update a journal entry
  async updateEntry(req: AuthRequest, res: Response) {
    const { entryId } = req.params;
    const validation = updateJournalEntrySchema.safeParse(req.body);
    if (!validation.success) {
      throw new ApiError(ErrorCodes.VALIDATION_ERROR, 'Invalid input', 400, validation.error.errors);
    }

    const userId = req.auth!.userId;
    const updates = validation.data;

    // Get user
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
    });

    if (!user) {
      throw new ApiError(ErrorCodes.NOT_FOUND, 'User not found', 404);
    }

    // Get the entry
    const entry = await prisma.journalEntry.findUnique({
      where: { id: entryId },
    });

    if (!entry) {
      throw new ApiError(ErrorCodes.NOT_FOUND, 'Entry not found', 404);
    }

    // Only the author can update their entry
    if (entry.userId !== user.id) {
      throw new ApiError(ErrorCodes.FORBIDDEN, 'Only the author can update this entry', 403);
    }

    // Update sentiment if content changed
    if (updates.content) {
      updates.sentiment = this.analyzeSentiment(updates.content);
    }

    const updatedEntry = await prisma.journalEntry.update({
      where: { id: entryId },
      data: updates,
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    // Audit log
    await auditService.logFromRequest({
      req,
      action: AuditActions.UPDATE_JOURNAL,
      resourceType: ResourceTypes.JOURNAL,
      resourceId: entryId,
      metadata: { updates },
      familyId: entry.familyId,
      userId: user.id,
    });

    res.json({ entry: updatedEntry });
  }

  // Delete a journal entry
  async deleteEntry(req: AuthRequest, res: Response) {
    const { entryId } = req.params;
    const userId = req.auth!.userId;

    // Get user
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      include: {
        familyMembers: {
          where: { isActive: true },
        },
      },
    });

    if (!user) {
      throw new ApiError(ErrorCodes.NOT_FOUND, 'User not found', 404);
    }

    // Get the entry
    const entry = await prisma.journalEntry.findUnique({
      where: { id: entryId },
    });

    if (!entry) {
      throw new ApiError(ErrorCodes.NOT_FOUND, 'Entry not found', 404);
    }

    // Check permissions - only author or primary caregiver can delete
    const canDelete = entry.userId === user.id || 
      user.familyMembers.some(fm => 
        fm.familyId === entry.familyId && fm.role === 'primary_caregiver'
      );

    if (!canDelete) {
      throw new ApiError(ErrorCodes.FORBIDDEN, 'Insufficient permissions to delete', 403);
    }

    // Audit log BEFORE deletion
    await auditService.logFromRequest({
      req,
      action: AuditActions.DELETE_JOURNAL,
      resourceType: ResourceTypes.JOURNAL,
      resourceId: entryId,
      metadata: { sentiment: entry.sentiment, isPrivate: entry.isPrivate },
      familyId: entry.familyId,
      userId: user.id,
    });

    await prisma.journalEntry.delete({
      where: { id: entryId },
    });

    res.json({ message: 'Entry deleted successfully' });
  }

  // Get journal insights (summary for dashboard)
  async getInsights(req: AuthRequest, res: Response) {
    const userId = req.auth!.userId;
    const { days = 7 } = req.query;

    // Get user's family
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      include: {
        familyMembers: {
          where: { isActive: true },
        },
      },
    });

    if (!user || user.familyMembers.length === 0) {
      throw new ApiError(ErrorCodes.NOT_FOUND, 'No family found', 404);
    }

    const familyId = user.familyMembers[0].familyId;

    // Get entries from the last N days
    const entries = await prisma.journalEntry.findMany({
      where: {
        familyId,
        createdAt: {
          gte: subDays(new Date(), Number(days)),
        },
        isPrivate: false, // Only public entries for insights
      },
      select: {
        sentiment: true,
        createdAt: true,
        content: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Calculate sentiment distribution
    const sentimentCounts = entries.reduce((acc, entry) => {
      if (entry.sentiment) {
        acc[entry.sentiment] = (acc[entry.sentiment] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);

    // Get recent concerns
    const concerns = entries
      .filter(e => e.sentiment === 'concerned' || e.sentiment === 'urgent')
      .slice(0, 3)
      .map(e => ({
        content: e.content.substring(0, 100) + (e.content.length > 100 ? '...' : ''),
        sentiment: e.sentiment,
        createdAt: e.createdAt,
      }));

    res.json({
      insights: {
        totalEntries: entries.length,
        sentimentDistribution: sentimentCounts,
        recentConcerns: concerns,
        averageEntriesPerDay: (entries.length / Number(days)).toFixed(1),
      },
    });
  }

  // Transcribe audio to text
  async transcribeAudio(req: AuthRequest, res: Response) {
    try {
      if (!req.file) {
        throw new ApiError(ErrorCodes.VALIDATION_ERROR, 'No audio file provided', 400);
      }

      const userId = req.auth!.userId;

      // Get user and patient info for context
      const user = await prisma.user.findUnique({
        where: { clerkId: userId },
        include: {
          familyMembers: {
            where: { isActive: true },
            include: {
              family: {
                include: {
                  patient: true,
                },
              },
            },
          },
        },
      });

      if (!user || user.familyMembers.length === 0) {
        throw new ApiError(ErrorCodes.NOT_FOUND, 'No family found', 404);
      }

      const patient = user.familyMembers[0].family.patient;
      const patientName = patient ? `${patient.firstName} ${patient.lastName}` : 'the patient';

      // Get recent medications for context
      let medicationContext = '';
      if (patient) {
        const medications = await prisma.medication.findMany({
          where: {
            patientId: patient.id,
            isActive: true,
          },
          select: {
            name: true,
          },
          take: 10,
        });
        
        if (medications.length > 0) {
          medicationContext = `Common medications: ${medications.map(m => m.name).join(', ')}.`;
        }
      }

      // Create a prompt for better transcription accuracy
      const prompt = `This is a caregiver's journal entry about ${patientName}. ${medicationContext} Medical terms and medication names should be transcribed accurately. Include natural speech patterns and pauses.`;

      // Set up SSE headers for streaming
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no', // Disable nginx buffering
      });

      try {
        // Convert buffer to File-like object for OpenAI SDK
        const file = await toFile(
          req.file!.buffer,
          req.file!.originalname || 'audio.webm',
          { type: req.file!.mimetype }
        );

        // Try regular transcription first (streaming is not yet supported for transcriptions)
        const transcription = await openai.audio.transcriptions.create({
          file: file,
          model: 'whisper-1', // Use whisper-1 for now as gpt-4o models might not be available yet
          prompt,
          response_format: 'text',
        });

        // Send the transcription as a single chunk
        res.write(`data: ${JSON.stringify({ text: transcription })}\n\n`);
        res.write('data: [DONE]\n\n');
        res.end();
      } catch (transcriptionError: any) {
        logger.error('Transcription failed:', transcriptionError);
        throw transcriptionError;
      }
    } catch (error: any) {
      logger.error('Transcription error:', error);
      
      // If headers haven't been sent yet, send error normally
      if (!res.headersSent) {
        throw new ApiError(
          ErrorCodes.INTERNAL_ERROR,
          error.message || 'Failed to transcribe audio',
          500
        );
      } else {
        // If streaming has started, send error in SSE format
        res.write(`data: ${JSON.stringify({ error: error.message || 'Failed to transcribe audio' })}\n\n`);
        res.end();
      }
    }
  }

  // Basic sentiment analysis (can be replaced with AI later)
  private analyzeSentiment(content: string): JournalSentiment {
    const lowerContent = content.toLowerCase();
    
    // Keywords for different sentiments
    const urgentKeywords = ['emergency', 'urgent', 'immediate', 'critical', 'severe', 'hospital', '911'];
    const concernedKeywords = ['worried', 'concern', 'anxious', 'confused', 'frustrated', 'difficult', 'struggle', 'pain', 'worse'];
    const positiveKeywords = ['good', 'great', 'excellent', 'happy', 'better', 'improved', 'wonderful', 'smile', 'laugh', 'joy'];
    
    // Check for urgent keywords
    if (urgentKeywords.some(keyword => lowerContent.includes(keyword))) {
      return 'urgent';
    }
    
    // Check for concerned keywords
    if (concernedKeywords.some(keyword => lowerContent.includes(keyword))) {
      return 'concerned';
    }
    
    // Check for positive keywords
    if (positiveKeywords.some(keyword => lowerContent.includes(keyword))) {
      return 'positive';
    }
    
    return 'neutral';
  }
}

export const journalController = new JournalController();