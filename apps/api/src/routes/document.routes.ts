import { Router } from 'express';
import { documentController } from '../controllers/document.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Get presigned URL for upload
router.post('/documents/upload-url', async (req, res, next) => {
  try {
    await documentController.getUploadUrl(req, res);
  } catch (error) {
    next(error);
  }
});

// Create document metadata after upload
router.post('/documents', async (req, res, next) => {
  try {
    await documentController.createDocument(req, res);
  } catch (error) {
    next(error);
  }
});

// Get all documents for family
router.get('/documents', async (req, res, next) => {
  try {
    await documentController.getDocuments(req, res);
  } catch (error) {
    next(error);
  }
});

// Get single document
router.get('/documents/:documentId', async (req, res, next) => {
  try {
    await documentController.getDocument(req, res);
  } catch (error) {
    next(error);
  }
});

// Get download URL for document
router.get('/documents/:documentId/download', async (req, res, next) => {
  try {
    await documentController.getDownloadUrl(req, res);
  } catch (error) {
    next(error);
  }
});

// Parse a document (streaming SSE)
router.post('/documents/:documentId/parse', async (req, res, next) => {
  try {
    await documentController.parseDocument(req, res);
  } catch (error) {
    next(error);
  }
});

// Update document metadata
router.put('/documents/:documentId', async (req, res, next) => {
  try {
    await documentController.updateDocument(req, res);
  } catch (error) {
    next(error);
  }
});

// Delete document
router.delete('/documents/:documentId', async (req, res, next) => {
  try {
    await documentController.deleteDocument(req, res);
  } catch (error) {
    next(error);
  }
});

export default router;
