import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma, DocumentType, ParsingStatus } from '@carecompanion/database';
import { ApiError } from '../middleware/error';
import { ErrorCodes } from '@carecompanion/shared';
import { AuthRequest } from '../types';
import { s3Service } from '../services/s3.service';
import { config } from '../config';
import { openAiService } from '../services/ai/openai.service';
import { logger } from '../utils/logger';
import { extractFactsFromParsedDocument } from '../services/factExtraction.service';

// Validation schemas
const getUploadUrlSchema = z.object({
  fileName: z.string().min(1).max(255),
  fileType: z.string().min(1),
  fileSize: z.number().positive().max(config.upload.maxFileSize),
});

const createDocumentSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  type: z.enum(['medical_record', 'financial', 'legal', 'insurance', 'other']),
  key: z.string().min(1), // S3 object key
  tags: z.array(z.string()).default([]),
});

const updateDocumentSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).optional(),
  type: z.enum(['medical_record', 'financial', 'legal', 'insurance', 'other']).optional(),
  tags: z.array(z.string()).optional(),
});

export class DocumentController {
  // Stream AI parsing of a document (images supported in MVP)
  async parseDocument(req: AuthRequest, res: Response) {
    const { documentId } = req.params;

    // Set up SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    const sse = (payload: any) => {
      try {
        res.write(`data: ${JSON.stringify(payload)}\n\n`);
      } catch (e) {
        // Ignore write errors (client may have disconnected)
      }
    };

    try {
      if (!req.auth?.userId) {
        throw new ApiError(ErrorCodes.UNAUTHORIZED, 'Authentication required', 401);
      }

      if (!config.openaiApiKey) {
        throw new ApiError(ErrorCodes.SERVICE_UNAVAILABLE, 'OpenAI is not configured', 503);
      }

      // Load user and family for access control
      const user = await prisma.user.findUnique({
        where: { clerkId: req.auth.userId },
        include: { familyMembers: { where: { isActive: true } } },
      });
      if (!user || user.familyMembers.length === 0) {
        throw new ApiError(ErrorCodes.NOT_FOUND, 'No family found', 404);
      }

      const doc = await prisma.document.findUnique({ where: { id: documentId } });
      if (!doc) {
        throw new ApiError(ErrorCodes.NOT_FOUND, 'Document not found', 404);
      }

      const canAccess = user.familyMembers.some((fm) => fm.familyId === doc.familyId);
      if (!canAccess) {
        throw new ApiError(ErrorCodes.FORBIDDEN, 'Access denied', 403);
      }

      // Mark as processing
      await prisma.document.update({
        where: { id: documentId },
        data: { parsingStatus: ParsingStatus.PROCESSING },
      });

      sse({ type: 'status', status: 'processing', step: 'init' });

      // Prepare S3 details
      const key = s3Service.extractKeyFromUrl(doc.url);
      if (!key) {
        throw new ApiError(ErrorCodes.VALIDATION_ERROR, 'Invalid document URL', 400);
      }
      const meta = await s3Service.getObjectMetadata(key);
      const contentType = meta.contentType || '';
      const downloadUrl = await s3Service.getPresignedDownloadUrl(key);

      sse({ type: 'status', status: 'downloading', contentType });

      let parsedResult: any = null;
      if (contentType.startsWith('image/')) {
        // Stream from OpenAI Vision (image)
        try {
          parsedResult = await openAiService.streamParseImageDocument(
            { imageUrl: downloadUrl, docDomainType: doc.type },
            (evt) => sse(evt)
          );
        } catch (err: any) {
          logger.error('OpenAI image parsing failed', { error: err?.message || err });
          throw new ApiError(
            ErrorCodes.INTERNAL_ERROR,
            err?.message || 'Failed to parse image document with AI',
            500
          );
        }
      } else if (contentType === 'application/pdf') {
        // PDF: download and try text extraction; if none, fall back to file-upload analysis
        try {
          sse({ type: 'status', status: 'extracting_text' });
          const resp = await fetch(downloadUrl);
          if (!resp.ok) {
            throw new Error(`Failed to download PDF: ${resp.status}`);
          }
          const arrayBuffer = await resp.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          // Use CommonJS require to avoid pdf-parse self-test path (module.parent detection)
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          const pdfParse = require('pdf-parse');
          const data = await pdfParse(buffer);
          const text = (data.text || '').trim();
          if (text.length >= 50) {
            sse({ type: 'status', status: 'analyzing' });
            parsedResult = await openAiService.streamParsePdfText(
              { text, docDomainType: doc.type },
              (evt) => sse(evt)
            );
          } else {
            // Fallback: upload whole PDF to OpenAI and analyze
            sse({ type: 'status', status: 'no_text_fallback' });
            parsedResult = await openAiService.streamParsePdfFileUpload(
              { buffer, docDomainType: doc.type },
              (evt) => sse(evt)
            );
          }
        } catch (err: any) {
          logger.error('PDF parsing failed', { error: err?.message || err });
          // As a last resort, try file-upload-based analysis once more if we didn't already
          try {
            sse({ type: 'status', status: 'analyzing_file_retry' });
            const resp2 = await fetch(downloadUrl);
            const buf2 = Buffer.from(await resp2.arrayBuffer());
            parsedResult = await openAiService.streamParsePdfFileUpload(
              { buffer: buf2, docDomainType: doc.type },
              (evt) => sse(evt)
            );
          } catch (err2: any) {
            throw new ApiError(
              ErrorCodes.INTERNAL_ERROR,
              err2?.message || 'Failed to parse PDF document',
              500
            );
          }
        }
      } else {
        throw new ApiError(
          ErrorCodes.VALIDATION_ERROR,
          `Unsupported file type for parsing: ${contentType || 'unknown'}`,
          400
        );
      }

      // Persist parsed data
      const saved = await prisma.document.update({
        where: { id: documentId },
        data: { parsedData: parsedResult, parsingStatus: ParsingStatus.COMPLETED },
      });

      // Extract proposed facts from parsed document (non-blocking best-effort)
      try {
        await extractFactsFromParsedDocument(documentId);
      } catch (e) {
        logger.warn('Fact extraction failed', { error: (e as any)?.message || e, documentId });
      }

      sse({ type: 'status', status: 'completed' });
      sse({ type: 'done' });
      res.end();
    } catch (error: any) {
      try {
        // Attempt to mark failed if we can
        if (req.params.documentId) {
          await prisma.document.update({
            where: { id: req.params.documentId },
            data: { parsingStatus: ParsingStatus.FAILED },
          });
        }
      } catch (_) {}

      // Graceful fallback: emit an empty structured JSON with a warning so UI can render shape
      const fallback = {
        patient: { name: null, dateOfBirth: null, mrn: null },
        visit: {
          dateOfService: null,
          facility: null,
          provider: { name: null, specialty: null, phone: null },
          followUp: null,
          nextAppointment: null,
        },
        diagnoses: [],
        medications: [],
        allergies: [],
        procedures: [],
        recommendations: [],
        warnings: [
          'Parsing failed or no extractable content found. This file may be a scanned PDF without text. Try uploading as an image or a text-based PDF.',
        ],
      };

      sse({ type: 'status', status: 'failed' });
      sse({ type: 'result', parsed: fallback });
      sse({ type: 'error', message: error?.message || 'Failed to parse document' });
      sse({ type: 'done' });
      res.end();
    }
  }
  // Get presigned URL for upload
  async getUploadUrl(req: AuthRequest, res: Response) {
    const validation = getUploadUrlSchema.safeParse(req.body);
    if (!validation.success) {
      throw new ApiError(ErrorCodes.VALIDATION_ERROR, 'Invalid input', 400, validation.error.errors);
    }

    const userId = req.auth!.userId;
    const { fileName, fileType, fileSize } = validation.data;

    // Validate file type
    if (!config.upload.allowedMimeTypes.includes(fileType)) {
      throw new ApiError(
        ErrorCodes.VALIDATION_ERROR,
        `File type ${fileType} is not allowed. Allowed types: ${config.upload.allowedMimeTypes.join(', ')}`,
        400
      );
    }

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

    // Generate presigned URL
    const { url, key } = await s3Service.getPresignedUploadUrl(
      familyId,
      fileName,
      fileType
    );

    res.json({
      uploadUrl: url,
      key,
      expiresIn: 3600,
    });
  }

  // Create document metadata after upload
  async createDocument(req: AuthRequest, res: Response) {
    const validation = createDocumentSchema.safeParse(req.body);
    if (!validation.success) {
      throw new ApiError(ErrorCodes.VALIDATION_ERROR, 'Invalid input', 400, validation.error.errors);
    }

    const userId = req.auth!.userId;
    const { title, description, type, key, tags } = validation.data;

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

    // Verify the file exists in S3
    const exists = await s3Service.fileExists(key);
    if (!exists) {
      throw new ApiError(ErrorCodes.NOT_FOUND, 'File not found in storage', 404);
    }

    // Generate the full URL from the key
    const url = s3Service.getPublicUrl(key);

    // Create document record
    const document = await prisma.document.create({
      data: {
        familyId,
        title,
        description,
        type: type.toUpperCase() as DocumentType,
        url,
        uploadedById: user.id,
        parsingStatus: ParsingStatus.PENDING,
        tags,
      },
      include: {
        uploadedBy: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    // TODO: Queue document processing job here
    // await jobQueue.add('processDocument', { documentId: document.id, familyId });

    res.status(201).json({ document });
  }

  // Get all documents for family
  async getDocuments(req: AuthRequest, res: Response) {
    const userId = req.auth!.userId;
    const { type } = req.query;

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

    // Build query
    const where: any = { familyId };
    if (type) {
      where.type = (type as string).toUpperCase() as DocumentType;
    }

    const documents = await prisma.document.findMany({
      where,
      include: {
        uploadedBy: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ documents });
  }

  // Get single document
  async getDocument(req: AuthRequest, res: Response) {
    const { documentId } = req.params;
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

    // Get document
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      include: {
        uploadedBy: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!document) {
      throw new ApiError(ErrorCodes.NOT_FOUND, 'Document not found', 404);
    }

    // Check access
    const hasAccess = user.familyMembers.some(fm => fm.familyId === document.familyId);
    if (!hasAccess) {
      throw new ApiError(ErrorCodes.FORBIDDEN, 'Access denied', 403);
    }

    res.json({ document });
  }

  // Get download URL for document
  async getDownloadUrl(req: AuthRequest, res: Response) {
    const { documentId } = req.params;
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

    // Get document
    const document = await prisma.document.findUnique({
      where: { id: documentId },
    });

    if (!document) {
      throw new ApiError(ErrorCodes.NOT_FOUND, 'Document not found', 404);
    }

    // Check access
    const hasAccess = user.familyMembers.some(fm => fm.familyId === document.familyId);
    if (!hasAccess) {
      throw new ApiError(ErrorCodes.FORBIDDEN, 'Access denied', 403);
    }

    // Extract key from URL and generate download URL
    const key = s3Service.extractKeyFromUrl(document.url);
    if (!key) {
      throw new ApiError(ErrorCodes.VALIDATION_ERROR, 'Invalid document URL', 400);
    }

    const downloadUrl = await s3Service.getPresignedDownloadUrl(key);

    res.json({ downloadUrl, expiresIn: 3600 });
  }

  // Update document metadata
  async updateDocument(req: AuthRequest, res: Response) {
    const { documentId } = req.params;
    const validation = updateDocumentSchema.safeParse(req.body);
    if (!validation.success) {
      throw new ApiError(ErrorCodes.VALIDATION_ERROR, 'Invalid input', 400, validation.error.errors);
    }

    const userId = req.auth!.userId;
    const updates = validation.data;

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

    // Get document
    const document = await prisma.document.findUnique({
      where: { id: documentId },
    });

    if (!document) {
      throw new ApiError(ErrorCodes.NOT_FOUND, 'Document not found', 404);
    }

    // Check access
    const hasAccess = user.familyMembers.some(
      fm => fm.familyId === document.familyId && ['primary_caregiver', 'caregiver'].includes(fm.role)
    );
    if (!hasAccess) {
      throw new ApiError(ErrorCodes.FORBIDDEN, 'Access denied', 403);
    }

    // Update document
    const updatedDocument = await prisma.document.update({
      where: { id: documentId },
      data: {
        ...updates,
        type: updates.type ? (updates.type.toUpperCase() as DocumentType) : undefined,
      },
      include: {
        uploadedBy: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    res.json({ document: updatedDocument });
  }

  // Delete document
  async deleteDocument(req: AuthRequest, res: Response) {
    const { documentId } = req.params;
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

    // Get document
    const document = await prisma.document.findUnique({
      where: { id: documentId },
    });

    if (!document) {
      throw new ApiError(ErrorCodes.NOT_FOUND, 'Document not found', 404);
    }

    // Check access - only uploader or primary caregiver can delete
    const hasAccess =
      document.uploadedById === user.id ||
      user.familyMembers.some(
        fm => fm.familyId === document.familyId && fm.role === 'primary_caregiver'
      );

    if (!hasAccess) {
      throw new ApiError(ErrorCodes.FORBIDDEN, 'Access denied', 403);
    }

    // Delete from S3
    const key = s3Service.extractKeyFromUrl(document.url);
    if (key) {
      try {
        await s3Service.deleteFile(key);
      } catch (error) {
        // Log error but continue with database deletion
        console.error('Failed to delete file from S3:', error);
      }
    }

    // Delete from database
    await prisma.document.delete({
      where: { id: documentId },
    });

    res.json({ message: 'Document deleted successfully' });
  }
}

export const documentController = new DocumentController();
