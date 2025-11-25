import { prisma } from '@carecompanion/database';
import { DocumentType } from '@prisma/client';
import { logger } from '../utils/logger';
import { claudeDocumentService, ParsedMedicalRecord } from './ai/claudeDocument.service';
import { documentProcessingService } from './documentProcessing.service';
import { s3Service } from './s3.service';

export interface ChatAttachmentDocumentResult {
  documentId: string;
  title: string;
  type: DocumentType;
  parsingStatus: 'COMPLETED' | 'FAILED' | 'PENDING';
  parsedData?: ParsedMedicalRecord;
  processingResult?: {
    providerId: string | null;
    journalEntryId: string | null;
    recommendationCount: number;
  };
  error?: string;
}

/**
 * Service to handle automatic document creation and parsing from chat attachments
 */
class ChatAttachmentDocumentService {
  /**
   * Create a Document record from a chat attachment and parse it
   * Returns the document ID and parsing result
   */
  async createAndParseDocument(params: {
    familyId: string;
    userId: string;
    attachmentUrl: string;
    attachmentName: string;
    mimeType: string;
  }): Promise<ChatAttachmentDocumentResult> {
    const { familyId, userId, attachmentUrl, attachmentName, mimeType } = params;

    logger.info('Creating document from chat attachment', { familyId, attachmentName, mimeType });

    try {
      // Extract S3 key from URL
      const key = s3Service.extractKeyFromUrl(attachmentUrl);

      // Generate a title from the filename
      const title = this.generateTitle(attachmentName);

      // Create initial document record with PENDING status
      const document = await prisma.document.create({
        data: {
          familyId,
          title,
          description: `Uploaded via CeeCee chat`,
          type: 'OTHER', // Will be updated after parsing
          url: attachmentUrl,
          uploadedById: userId,
          parsingStatus: 'PENDING',
          tags: ['chat-upload'],
        },
      });

      logger.info('Document record created', { documentId: document.id, title });

      // Update to PROCESSING status
      await prisma.document.update({
        where: { id: document.id },
        data: { parsingStatus: 'PROCESSING' },
      });

      // Parse the document based on type
      let parsedData: ParsedMedicalRecord | null = null;
      let parsingError: string | null = null;

      try {
        parsedData = await this.parseAttachment({
          url: attachmentUrl,
          mimeType,
          documentId: document.id,
        });
      } catch (parseErr: any) {
        parsingError = parseErr.message || 'Parsing failed';
        logger.error('Failed to parse chat attachment', { documentId: document.id, error: parsingError });
      }

      if (parsedData) {
        // Determine document type from parsed data
        const documentType = this.mapToDocumentType(parsedData.documentType);

        // Update document with parsed data and type
        await prisma.document.update({
          where: { id: document.id },
          data: {
            parsingStatus: 'COMPLETED',
            parsedData: parsedData as any,
            type: documentType,
          },
        });

        logger.info('Document parsing completed', {
          documentId: document.id,
          documentType,
          hasMedications: (parsedData.medications?.length || 0) > 0,
          hasRecommendations: (parsedData.recommendations?.length || 0) > 0,
        });

        // Trigger auto-population (non-blocking)
        let processingResult: ChatAttachmentDocumentResult['processingResult'];
        try {
          const result = await documentProcessingService.processAfterParsing({
            documentId: document.id,
            familyId,
            userId,
            parsedData,
          });

          processingResult = {
            providerId: result.providerId,
            journalEntryId: result.journalEntryId,
            recommendationCount: result.recommendationIds.length + result.reconciliationRecommendationIds.length,
          };

          logger.info('Document auto-population completed', { documentId: document.id, result: processingResult });
        } catch (processErr) {
          logger.warn('Document auto-population failed', { documentId: document.id, error: processErr });
        }

        return {
          documentId: document.id,
          title,
          type: documentType,
          parsingStatus: 'COMPLETED',
          parsedData,
          processingResult,
        };
      } else {
        // Parsing failed - update status
        await prisma.document.update({
          where: { id: document.id },
          data: {
            parsingStatus: 'FAILED',
            parsedData: { error: parsingError },
          },
        });

        return {
          documentId: document.id,
          title,
          type: 'OTHER',
          parsingStatus: 'FAILED',
          error: parsingError || 'Unknown parsing error',
        };
      }
    } catch (err: any) {
      logger.error('Failed to create document from chat attachment', { error: err.message });
      throw err;
    }
  }

  /**
   * Parse an attachment based on its MIME type
   */
  private async parseAttachment(params: {
    url: string;
    mimeType: string;
    documentId: string;
  }): Promise<ParsedMedicalRecord> {
    const { url, mimeType, documentId } = params;

    // Collect events for logging
    const events: any[] = [];
    const onEvent = (evt: any) => {
      events.push(evt);
      if (evt.type === 'error') {
        logger.error('Parsing error event', { documentId, evt });
      }
    };

    if (mimeType.startsWith('image/')) {
      // Parse as image
      return await claudeDocumentService.streamParseImageDocument(
        { imageUrl: url, docDomainType: 'unknown' },
        onEvent
      );
    } else if (mimeType === 'application/pdf') {
      // For PDFs, try to extract text first
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch PDF: ${response.status}`);
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      const pdfParse = require('pdf-parse');
      const pdfData = await pdfParse(buffer);
      const textContent = (pdfData.text || '').trim();

      if (textContent.length > 100) {
        // Has meaningful text - parse as text
        return await claudeDocumentService.streamParsePdfText(
          { text: textContent, docDomainType: 'unknown' },
          onEvent
        );
      } else {
        // Likely scanned PDF - would need to render pages as images
        // For now, return minimal parsed data
        logger.warn('PDF appears to be scanned/image-based, limited parsing available', { documentId });
        return {
          documentType: 'OTHER',
          patient: {},
          visit: {},
          diagnoses: [],
          medications: [],
          allergies: [],
          procedures: [],
          recommendations: [],
          warnings: ['PDF appears to be scanned or image-based. Limited information extracted.'],
        };
      }
    } else if (mimeType === 'text/plain' || mimeType === 'text/markdown') {
      // Parse as text
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch text file: ${response.status}`);
      }
      const textContent = await response.text();

      return await claudeDocumentService.streamParsePdfText(
        { text: textContent, docDomainType: 'unknown' },
        onEvent
      );
    } else {
      throw new Error(`Unsupported MIME type for parsing: ${mimeType}`);
    }
  }

  /**
   * Map parsed document type to Prisma DocumentType enum
   */
  private mapToDocumentType(parsedType?: string): DocumentType {
    switch (parsedType) {
      case 'MEDICAL_RECORD':
        return 'MEDICAL_RECORD';
      case 'FINANCIAL':
        return 'FINANCIAL';
      case 'LEGAL':
        return 'LEGAL';
      case 'INSURANCE':
        return 'INSURANCE';
      default:
        return 'OTHER';
    }
  }

  /**
   * Generate a human-readable title from filename
   */
  private generateTitle(filename: string): string {
    // Remove extension
    const nameWithoutExt = filename.replace(/\.[^/.]+$/, '');

    // Replace underscores/hyphens with spaces
    const cleaned = nameWithoutExt.replace(/[_-]/g, ' ');

    // Capitalize first letter of each word
    const titled = cleaned.replace(/\b\w/g, (c) => c.toUpperCase());

    // Truncate if too long
    if (titled.length > 100) {
      return titled.substring(0, 97) + '...';
    }

    return titled || 'Chat Upload';
  }
}

export const chatAttachmentDocumentService = new ChatAttachmentDocumentService();
