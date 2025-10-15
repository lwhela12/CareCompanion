import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { config } from '../config';
import { logger } from '../utils/logger';
import crypto from 'crypto';

class S3Service {
  private client: S3Client;
  private bucketName: string;

  constructor() {
    const clientConfig: any = {
      region: config.aws.region,
      credentials: {
        accessKeyId: config.aws.accessKeyId,
        secretAccessKey: config.aws.secretAccessKey,
      },
    };

    // Add endpoint for LocalStack (local development)
    if (process.env.AWS_ENDPOINT_URL) {
      clientConfig.endpoint = process.env.AWS_ENDPOINT_URL;
      clientConfig.forcePathStyle = true; // Required for LocalStack
      logger.info('Using LocalStack S3 endpoint', { endpoint: process.env.AWS_ENDPOINT_URL });
    }

    this.client = new S3Client(clientConfig);
    this.bucketName = config.aws.s3BucketName;
  }

  /**
   * Generate a presigned URL for uploading a file directly to S3
   */
  async getPresignedUploadUrl(
    familyId: string,
    fileName: string,
    fileType: string,
    expiresIn: number = 3600 // 1 hour
  ): Promise<{ url: string; key: string }> {
    try {
      // Generate unique file key
      const fileExtension = fileName.split('.').pop();
      const uniqueId = crypto.randomBytes(16).toString('hex');
      const key = `${familyId}/${uniqueId}.${fileExtension}`;

      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        ContentType: fileType,
      });

      const url = await getSignedUrl(this.client, command, {
        expiresIn,
      });

      logger.info('Generated presigned upload URL', { familyId, key });

      return { url, key };
    } catch (error) {
      logger.error('Failed to generate presigned upload URL', { error, familyId });
      throw error;
    }
  }

  /**
   * Generate a presigned URL for downloading a file from S3
   */
  async getPresignedDownloadUrl(
    key: string,
    expiresIn: number = 3600 // 1 hour
  ): Promise<string> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      const url = await getSignedUrl(this.client, command, {
        expiresIn,
      });

      logger.info('Generated presigned download URL', { key });

      return url;
    } catch (error) {
      logger.error('Failed to generate presigned download URL', { error, key });
      throw error;
    }
  }

  /**
   * Delete a file from S3
   */
  async deleteFile(key: string): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      await this.client.send(command);

      logger.info('Deleted file from S3', { key });
    } catch (error) {
      logger.error('Failed to delete file from S3', { error, key });
      throw error;
    }
  }

  /**
   * Check if a file exists in S3
   */
  async fileExists(key: string): Promise<boolean> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      await this.client.send(command);
      return true;
    } catch (error: any) {
      if (error.name === 'NotFound') {
        return false;
      }
      logger.error('Failed to check if file exists', { error, key });
      throw error;
    }
  }

  /**
   * Get object metadata (e.g., ContentType) from S3 via HEAD
   */
  async getObjectMetadata(key: string): Promise<{ contentType?: string; contentLength?: number }> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      const result = await this.client.send(command);
      return {
        contentType: result.ContentType,
        contentLength: typeof result.ContentLength === 'number' ? result.ContentLength : undefined,
      };
    } catch (error) {
      logger.error('Failed to get object metadata from S3', { error, key });
      throw error;
    }
  }

  /**
   * Get the full S3 URL for a file (not presigned)
   */
  getPublicUrl(key: string): string {
    // For LocalStack, use path-style URL
    if (process.env.AWS_ENDPOINT_URL) {
      return `${process.env.AWS_ENDPOINT_URL}/${this.bucketName}/${key}`;
    }
    // For AWS S3, use virtual-hosted-style URL
    return `https://${this.bucketName}.s3.${config.aws.region}.amazonaws.com/${key}`;
  }

  /**
   * Extract the S3 key from a full URL
   */
  extractKeyFromUrl(url: string): string | null {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;

      // For LocalStack path-style URLs: http://localhost:4566/bucket-name/key
      // Remove leading slash and bucket name
      if (process.env.AWS_ENDPOINT_URL && urlObj.origin === process.env.AWS_ENDPOINT_URL) {
        const pathWithoutSlash = pathname.startsWith('/') ? pathname.substring(1) : pathname;
        // Remove bucket name from the beginning
        const bucketPrefix = `${this.bucketName}/`;
        if (pathWithoutSlash.startsWith(bucketPrefix)) {
          return pathWithoutSlash.substring(bucketPrefix.length);
        }
      }

      // For AWS S3 virtual-hosted-style URLs: https://bucket.s3.region.amazonaws.com/key
      // The pathname is already the key
      return pathname.startsWith('/') ? pathname.substring(1) : pathname;
    } catch {
      return null;
    }
  }
}

export const s3Service = new S3Service();
