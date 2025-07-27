import multer from 'multer';
import { Request } from 'express';
import { ApiError } from './error';
import { ErrorCodes } from '@carecompanion/shared';

// Configure memory storage for audio files
const storage = multer.memoryStorage();

// File filter to only accept audio files
const audioFileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedMimeTypes = [
    'audio/mpeg',
    'audio/mp3',
    'audio/mp4',
    'audio/wav',
    'audio/webm',
    'audio/ogg',
    'audio/x-m4a',
  ];

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new ApiError(
      ErrorCodes.VALIDATION_ERROR,
      'Invalid file type. Only audio files are allowed.',
      400
    ) as any);
  }
};

// Create multer instance with size limit (25MB as per OpenAI docs)
export const audioUpload = multer({
  storage,
  fileFilter: audioFileFilter,
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB
  },
});