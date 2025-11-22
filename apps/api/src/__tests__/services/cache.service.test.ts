import { generateCacheKey, hashData, CacheTTL } from '../../services/cache.service';

describe('Cache Service', () => {
  describe('generateCacheKey', () => {
    it('should generate a key from multiple parts', () => {
      const key = generateCacheKey('ai', 'summary', 'family-123', '2024-01-01');
      expect(key).toBe('ai:summary:family-123:2024-01-01');
    });

    it('should filter out undefined values', () => {
      const key = generateCacheKey('ai', undefined, 'family-123', undefined);
      expect(key).toBe('ai:family-123');
    });

    it('should handle numbers', () => {
      const key = generateCacheKey('ai', 'insights', 'family-123', 7);
      expect(key).toBe('ai:insights:family-123:7');
    });

    it('should return empty string for all undefined', () => {
      const key = generateCacheKey(undefined, undefined);
      expect(key).toBe('');
    });
  });

  describe('hashData', () => {
    it('should generate consistent hash for same string', () => {
      const hash1 = hashData('test string');
      const hash2 = hashData('test string');
      expect(hash1).toBe(hash2);
    });

    it('should generate different hashes for different strings', () => {
      const hash1 = hashData('test string 1');
      const hash2 = hashData('test string 2');
      expect(hash1).not.toBe(hash2);
    });

    it('should handle objects', () => {
      const hash1 = hashData({ a: 1, b: 2 });
      const hash2 = hashData({ a: 1, b: 2 });
      expect(hash1).toBe(hash2);
    });

    it('should return 16-character hash', () => {
      const hash = hashData('test');
      expect(hash).toHaveLength(16);
    });
  });

  describe('CacheTTL', () => {
    it('should have correct TTL values', () => {
      expect(CacheTTL.SHORT).toBe(60);
      expect(CacheTTL.MEDIUM).toBe(300);
      expect(CacheTTL.LONG).toBe(3600);
      expect(CacheTTL.AI_RESPONSE).toBe(1800);
      expect(CacheTTL.DAILY).toBe(86400);
    });
  });
});
