import { Worker, Job } from 'bullmq';
import { prisma } from '@carecompanion/database';
import { logger } from '../../utils/logger';
import { openAiService } from '../../services/ai/openai.service';
import { DocumentProcessingService } from '../../services/documentProcessing.service';
import { s3Service } from '../../services/s3.service';
import pdfParse from 'pdf-parse';

/**
 * Extract text from PDF buffer
 */
async function extractPdfText(buffer: ArrayBuffer): Promise<string> {
  try {
    const data = await pdfParse(Buffer.from(buffer));
    return data.text;
  } catch (error) {
    logger.error('Failed to extract PDF text', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return '';
  }
}

/**
 * Job data for document processing
 */
interface DocumentProcessingJobData {
  documentId: string;
  familyId: string;
  userId: string;
  fileUrl: string;
  fileType: string;
}

/**
 * Process a document: download, parse with AI, and auto-populate entities
 */
async function processDocument(job: Job<DocumentProcessingJobData>) {
  const { documentId, familyId, userId, fileUrl, fileType } = job.data;

  logger.info('Processing document', {
    jobId: job.id,
    documentId,
    familyId,
    fileType,
  });

  try {
    // Update document status to PROCESSING
    await prisma.document.update({
      where: { id: documentId },
      data: { parsingStatus: 'PROCESSING' },
    });

    // Parse the document with AI
    logger.info('Parsing document with OpenAI', { documentId, fileType });

    let parsedData: any;

    // Determine parsing method based on file type
    if (fileType.startsWith('image/')) {
      // For images, use the image parsing method
      parsedData = await openAiService.streamParseImageDocument(
        { imageUrl: fileUrl, docDomainType: 'medical_record' },
        (event) => {
          // Log events during parsing
          if (event.type === 'status') {
            logger.debug('Document parsing status', { documentId, status: event.status });
          }
        }
      );
    } else if (fileType === 'application/pdf') {
      // For PDFs, download and parse
      const response = await fetch(fileUrl);
      if (!response.ok) {
        throw new Error(`Failed to download PDF: ${response.statusText}`);
      }
      const buffer = await response.arrayBuffer();
      const pdfText = await extractPdfText(buffer);

      if (pdfText && pdfText.trim().length > 100) {
        parsedData = await openAiService.streamParsePdfText(
          { text: pdfText, docDomainType: 'medical_record' },
          (event) => {
            if (event.type === 'status') {
              logger.debug('Document parsing status', { documentId, status: event.status });
            }
          }
        );
      } else {
        // Fall back to file upload parsing for PDFs without text
        parsedData = await openAiService.streamParsePdfFileUpload(
          { buffer: Buffer.from(buffer), docDomainType: 'medical_record' },
          (event) => {
            if (event.type === 'status') {
              logger.debug('Document parsing status', { documentId, status: event.status });
            }
          }
        );
      }
    } else {
      throw new Error(`Unsupported file type for parsing: ${fileType}`);
    }

    // Update document with parsed data
    await prisma.document.update({
      where: { id: documentId },
      data: {
        parsedData: parsedData as any,
        parsingStatus: 'COMPLETED',
      },
    });

    logger.info('Document parsed successfully', { documentId });

    // Process the parsed data to auto-populate entities
    const documentProcessingService = new DocumentProcessingService();
    const processingResult = await documentProcessingService.processAfterParsing({
      documentId,
      familyId,
      userId,
      parsedData,
    });

    logger.info('Document processing completed', {
      documentId,
      result: {
        providerCreated: processingResult.providerCreated,
        journalEntryCreated: !!processingResult.journalEntryId,
        recommendationsCreated: processingResult.recommendationIds.length,
        reconciliationRecommendations: processingResult.reconciliationRecommendationIds.length,
      },
    });

    return {
      success: true,
      documentId,
      processingResult,
    };
  } catch (error) {
    logger.error('Document processing failed', {
      jobId: job.id,
      documentId,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });

    // Update document status to FAILED
    await prisma.document.update({
      where: { id: documentId },
      data: {
        parsingStatus: 'FAILED',
      },
    });

    throw error; // Re-throw to mark the job as failed
  }
}

/**
 * Create and export the document processing worker
 */
export function createDocumentProcessingWorker(connection: any) {
  const worker = new Worker('document-processing', processDocument, {
    connection,
    concurrency: 3, // Process up to 3 documents concurrently (AI calls can be slow)
    limiter: {
      max: 5, // Max 5 jobs
      duration: 1000, // per second
    },
  });

  worker.on('completed', (job) => {
    logger.info('Document processing job completed', {
      jobId: job.id,
      documentId: job.data.documentId,
      returnValue: job.returnvalue,
    });
  });

  worker.on('failed', (job, err) => {
    logger.error('Document processing job failed', {
      jobId: job?.id,
      documentId: job?.data?.documentId,
      error: err.message,
      stack: err.stack,
    });
  });

  worker.on('error', (err) => {
    logger.error('Document processing worker error', {
      error: err.message,
      stack: err.stack,
    });
  });

  return worker;
}
