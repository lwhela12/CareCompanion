import { encrypt, decrypt, isEncrypted, generateEncryptionKey, encryptOAuthTokens, decryptOAuthTokens } from '../../utils/encryption';

describe('Encryption Utility', () => {
  describe('encrypt/decrypt', () => {
    it('should encrypt and decrypt a string correctly', () => {
      const plaintext = 'Hello, World!';
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should produce different ciphertext for same plaintext (random IV)', () => {
      const plaintext = 'Test message';
      const encrypted1 = encrypt(plaintext);
      const encrypted2 = encrypt(plaintext);

      expect(encrypted1).not.toBe(encrypted2);
    });

    it('should handle empty string', () => {
      const plaintext = '';
      const result = encrypt(plaintext);

      expect(result).toBe('');
    });

    it('should handle special characters', () => {
      const plaintext = '!@#$%^&*()_+-={}[]|\\:";\'<>?,./~`';
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should handle unicode characters', () => {
      const plaintext = '你好世界 🌍 مرحبا';
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should handle long strings', () => {
      const plaintext = 'a'.repeat(10000);
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });
  });

  describe('isEncrypted', () => {
    it('should return true for encrypted data', () => {
      const encrypted = encrypt('test');
      expect(isEncrypted(encrypted)).toBe(true);
    });

    it('should return false for plain text', () => {
      expect(isEncrypted('plain text')).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(isEncrypted('')).toBe(false);
    });

    it('should return false for short base64 strings', () => {
      expect(isEncrypted('YWJj')).toBe(false); // "abc" in base64
    });
  });

  describe('generateEncryptionKey', () => {
    it('should generate a 64-character hex string', () => {
      const key = generateEncryptionKey();

      expect(key).toHaveLength(64);
      expect(/^[0-9a-f]+$/.test(key)).toBe(true);
    });

    it('should generate unique keys', () => {
      const key1 = generateEncryptionKey();
      const key2 = generateEncryptionKey();

      expect(key1).not.toBe(key2);
    });
  });

  describe('OAuth Token Encryption', () => {
    it('should encrypt and decrypt OAuth tokens', () => {
      const tokens = {
        accessToken: 'ya29.access-token-here',
        refreshToken: '1//refresh-token-here',
      };

      const encrypted = encryptOAuthTokens(tokens);
      expect(encrypted.accessToken).not.toBe(tokens.accessToken);
      expect(encrypted.refreshToken).not.toBe(tokens.refreshToken);

      const decrypted = decryptOAuthTokens(encrypted);
      expect(decrypted.accessToken).toBe(tokens.accessToken);
      expect(decrypted.refreshToken).toBe(tokens.refreshToken);
    });

    it('should handle null refresh token', () => {
      const tokens = {
        accessToken: 'ya29.access-token-here',
        refreshToken: null,
      };

      const encrypted = encryptOAuthTokens(tokens);
      expect(encrypted.refreshToken).toBeNull();

      const decrypted = decryptOAuthTokens(encrypted);
      expect(decrypted.refreshToken).toBeNull();
    });
  });
});
