import crypto from 'crypto';
import { config } from '../config';
import { logger } from './logger';

/**
 * Encryption utility for sensitive data (OAuth tokens, API keys, etc.)
 * Uses AES-256-GCM for authenticated encryption
 */

// Algorithm constants
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 128 bits for GCM
const AUTH_TAG_LENGTH = 16; // 128 bits
const SALT_LENGTH = 32;
const KEY_LENGTH = 32; // 256 bits for AES-256

// Get encryption key from environment (must be 32 bytes for AES-256)
function getEncryptionKey(): Buffer {
  const key = config.encryptionKey;

  if (!key) {
    throw new Error('ENCRYPTION_KEY environment variable is not set');
  }

  // If key is hex-encoded (64 chars), decode it
  if (key.length === 64 && /^[0-9a-fA-F]+$/.test(key)) {
    return Buffer.from(key, 'hex');
  }

  // Otherwise, derive a key from the provided string using PBKDF2
  // Use a static salt so we can decrypt previously encrypted data
  const salt = Buffer.from('carecompanion-static-salt-v1', 'utf8');
  return crypto.pbkdf2Sync(key, salt, 100000, KEY_LENGTH, 'sha256');
}

/**
 * Encrypt a string value
 * @param plaintext - The string to encrypt
 * @returns Base64-encoded encrypted string (format: iv:authTag:ciphertext)
 */
export function encrypt(plaintext: string): string {
  if (!plaintext) {
    return plaintext;
  }

  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);

    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(plaintext, 'utf8', 'base64');
    encrypted += cipher.final('base64');

    const authTag = cipher.getAuthTag();

    // Combine iv, authTag, and ciphertext
    const combined = Buffer.concat([
      iv,
      authTag,
      Buffer.from(encrypted, 'base64'),
    ]);

    return combined.toString('base64');
  } catch (error) {
    logger.error('Encryption failed:', error);
    throw new Error('Failed to encrypt data');
  }
}

/**
 * Decrypt an encrypted string
 * @param encryptedData - Base64-encoded encrypted string
 * @returns Decrypted plaintext string
 */
export function decrypt(encryptedData: string): string {
  if (!encryptedData) {
    return encryptedData;
  }

  try {
    const key = getEncryptionKey();
    const combined = Buffer.from(encryptedData, 'base64');

    // Extract iv, authTag, and ciphertext
    const iv = combined.subarray(0, IV_LENGTH);
    const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const ciphertext = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(ciphertext);
    decrypted = Buffer.concat([decrypted, decipher.final()]);

    return decrypted.toString('utf8');
  } catch (error) {
    logger.error('Decryption failed:', error);
    throw new Error('Failed to decrypt data');
  }
}

/**
 * Check if a string appears to be encrypted
 * (Base64-encoded and of expected minimum length)
 */
export function isEncrypted(value: string): boolean {
  if (!value) return false;

  try {
    // Must be valid base64
    const decoded = Buffer.from(value, 'base64');

    // Must be at least IV + authTag + some ciphertext
    if (decoded.length < IV_LENGTH + AUTH_TAG_LENGTH + 1) {
      return false;
    }

    // Try to decode back - if it matches, it's likely base64
    return decoded.toString('base64') === value;
  } catch {
    return false;
  }
}

/**
 * Encrypt OAuth tokens object
 */
export function encryptOAuthTokens(tokens: {
  accessToken: string;
  refreshToken?: string | null;
}): {
  accessToken: string;
  refreshToken: string | null;
} {
  return {
    accessToken: encrypt(tokens.accessToken),
    refreshToken: tokens.refreshToken ? encrypt(tokens.refreshToken) : null,
  };
}

/**
 * Decrypt OAuth tokens object
 */
export function decryptOAuthTokens(tokens: {
  accessToken: string;
  refreshToken?: string | null;
}): {
  accessToken: string;
  refreshToken: string | null;
} {
  return {
    accessToken: decrypt(tokens.accessToken),
    refreshToken: tokens.refreshToken ? decrypt(tokens.refreshToken) : null,
  };
}

/**
 * Generate a new encryption key (for setup/rotation)
 */
export function generateEncryptionKey(): string {
  return crypto.randomBytes(KEY_LENGTH).toString('hex');
}
