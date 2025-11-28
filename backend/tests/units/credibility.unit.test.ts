// tests/units/credibility.unit.test.ts

/**
 * Credibility Unit Tests
 * Combines service unit tests (with mocks) and model integration tests (with real database)
 */

// Mock the models BEFORE any imports (for service tests)
jest.mock('../../src/models/User');

import User from '../../src/models/User';
import { CredibilityAction } from '../../src/types/credibility';
import credibilityService from '../../src/services/credibilityService';
import CredibilityCode from '../../src/models/CredibilityCode';
import { connectDatabase, disconnectDatabase } from '../../src/config/database';
import { cleanTestData } from '../helpers/seed.helper';

const mockedUser = User as jest.Mocked<typeof User>;

describe('CredibilityService - Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('updateCredibilityScore()', () => {
    test('should update score with CHECK_IN action (+5 points)', async () => {
      const mockUser = {
        _id: 'user-123',
        credibilityScore: 50,
        save: jest.fn().mockResolvedValue(true)
      };

      mockedUser.findById.mockResolvedValue(mockUser as any);

      const result = await credibilityService.updateCredibilityScore(
        'user-123',
        CredibilityAction.CHECK_IN
      );

      expect(result.previousScore).toBe(50);
      expect(result.newScore).toBe(55);
      expect(result.scoreChange).toBe(5);
      expect(mockUser.credibilityScore).toBe(55);
      expect(mockUser.save).toHaveBeenCalled();
    });

    test('should update score with LEFT_WITHOUT_CHECKIN action (-10 points)', async () => {
      const mockUser = {
        _id: 'user-123',
        credibilityScore: 50,
        save: jest.fn().mockResolvedValue(true)
      };

      mockedUser.findById.mockResolvedValue(mockUser as any);

      const result = await credibilityService.updateCredibilityScore(
        'user-123',
        CredibilityAction.LEFT_WITHOUT_CHECKIN
      );

      expect(result.previousScore).toBe(50);
      expect(result.newScore).toBe(40);
      expect(result.scoreChange).toBe(-10);
      expect(mockUser.credibilityScore).toBe(40);
    });

    test('should clamp score to 0 when deduction would make it negative', async () => {
      const mockUser = {
        _id: 'user-123',
        credibilityScore: 5,
        save: jest.fn().mockResolvedValue(true)
      };

      mockedUser.findById.mockResolvedValue(mockUser as any);

      const result = await credibilityService.updateCredibilityScore(
        'user-123',
        CredibilityAction.LEFT_WITHOUT_CHECKIN
      );

      expect(result.newScore).toBe(0);
      expect(mockUser.credibilityScore).toBe(0);
    });

    test('should clamp score to 100 when addition would exceed 100', async () => {
      const mockUser = {
        _id: 'user-123',
        credibilityScore: 98,
        save: jest.fn().mockResolvedValue(true)
      };

      mockedUser.findById.mockResolvedValue(mockUser as any);

      const result = await credibilityService.updateCredibilityScore(
        'user-123',
        CredibilityAction.CHECK_IN
      );

      expect(result.newScore).toBe(100);
      expect(mockUser.credibilityScore).toBe(100);
    });

    test('should throw error when user not found', async () => {
      mockedUser.findById.mockResolvedValue(null);

      await expect(
        credibilityService.updateCredibilityScore(
          'non-existent-user',
          CredibilityAction.CHECK_IN
        )
      ).rejects.toThrow('User not found');
    });

    test('should throw error for invalid action', async () => {
      const mockUser = {
        _id: 'user-123',
        credibilityScore: 50,
        save: jest.fn().mockResolvedValue(true)
      };

      mockedUser.findById.mockResolvedValue(mockUser as any);

      await expect(
        credibilityService.updateCredibilityScore(
          'user-123',
          'invalid_action' as CredibilityAction
        )
      ).rejects.toThrow('Invalid credibility action');
    });

  });

  describe('isCredibilityAcceptable()', () => {
    test('should return true when score meets minimum requirement', () => {
      expect(credibilityService.isCredibilityAcceptable(75, 50)).toBe(true);
      expect(credibilityService.isCredibilityAcceptable(50, 50)).toBe(true);
      expect(credibilityService.isCredibilityAcceptable(100, 50)).toBe(true);
    });

    test('should return false when score below minimum requirement', () => {
      expect(credibilityService.isCredibilityAcceptable(40, 50)).toBe(false);
      expect(credibilityService.isCredibilityAcceptable(25, 50)).toBe(false);
      expect(credibilityService.isCredibilityAcceptable(0, 50)).toBe(false);
    });

    test('should use default minimum of 50 when not specified', () => {
      expect(credibilityService.isCredibilityAcceptable(60)).toBe(true);
      expect(credibilityService.isCredibilityAcceptable(50)).toBe(true);
      expect(credibilityService.isCredibilityAcceptable(40)).toBe(false);
    });

    test('should work with custom minimum requirements', () => {
      expect(credibilityService.isCredibilityAcceptable(80, 75)).toBe(true);
      expect(credibilityService.isCredibilityAcceptable(70, 75)).toBe(false);
      expect(credibilityService.isCredibilityAcceptable(90, 75)).toBe(true);
    });
  });
});



describe('CredibilityCode Model - Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateCode() - max attempts failure', () => {
    test('should throw error when unable to generate unique code after 10 attempts', async () => {
      const userId = 'user-123';
      const groupId = 'group-456';
      const mockExistingCode = { _id: 'existing-code-id', code: 'ABC123' };
      
      // Mock findOne to always return an existing code (simulating 10 collisions)
      // This forces the loop to exhaust all 10 attempts
      jest.spyOn(CredibilityCode, 'findOne').mockResolvedValue(mockExistingCode as any);

      // Attempt to generate code - should fail after 10 attempts
      await expect(
        CredibilityCode.generateCode(userId, groupId)
      ).rejects.toThrow('Failed to generate unique code');

      // Verify findOne was called 10 times (maxAttempts)
      expect(CredibilityCode.findOne).toHaveBeenCalledTimes(10);
    });
  });
});

describe('Credibility Models - Integration Tests', () => {
  beforeAll(async () => {
    await connectDatabase();
  });

  afterAll(async () => {
    await CredibilityCode.deleteMany({});
    await cleanTestData();
    await disconnectDatabase();
  });

  describe('CredibilityCode - Expiration Tests', () => {
    test('generateCode() should set expiresAt to 24 hours from now by default', async () => {
      const userId = 'test-user-expiry';
      const groupId = 'test-group-expiry';
      const beforeCreation = new Date();
      
      const code = await CredibilityCode.generateCode(userId, groupId);
      
      const afterCreation = new Date();
      const expectedMinExpiry = new Date(beforeCreation.getTime() + 24 * 60 * 60 * 1000);
      const expectedMaxExpiry = new Date(afterCreation.getTime() + 24 * 60 * 60 * 1000);
      
      expect(code.expiresAt.getTime()).toBeGreaterThanOrEqual(expectedMinExpiry.getTime());
      expect(code.expiresAt.getTime()).toBeLessThanOrEqual(expectedMaxExpiry.getTime());
      
      await code.deleteOne();
    });

    test('generateCode() should set expiresAt correctly with custom expiryHours', async () => {
      const userId = 'test-user-custom-expiry';
      const groupId = 'test-group-custom-expiry';
      const customHours = 12;
      const beforeCreation = new Date();
      
      const code = await CredibilityCode.generateCode(userId, groupId, customHours);
      
      const afterCreation = new Date();
      const expectedMinExpiry = new Date(beforeCreation.getTime() + customHours * 60 * 60 * 1000);
      const expectedMaxExpiry = new Date(afterCreation.getTime() + customHours * 60 * 60 * 1000);
      
      expect(code.expiresAt.getTime()).toBeGreaterThanOrEqual(expectedMinExpiry.getTime());
      expect(code.expiresAt.getTime()).toBeLessThanOrEqual(expectedMaxExpiry.getTime());
      
      await code.deleteOne();
    });

    test('isExpired() should return false for non-expired code', async () => {
      const userId = 'test-user-not-expired';
      const groupId = 'test-group-not-expired';
      
      const code = await CredibilityCode.generateCode(userId, groupId);
      
      expect(code.isExpired()).toBe(false);
      
      await code.deleteOne();
    });

    test('isExpired() should return true for expired code', async () => {
      const userId = 'test-user-expired';
      const groupId = 'test-group-expired';
      
      // Create a code with expiration in the past
      const expiredDate = new Date();
      expiredDate.setHours(expiredDate.getHours() - 1); // 1 hour ago
      
      const code = await CredibilityCode.create({
        code: 'EXP123',
        userId,
        groupId,
        expiresAt: expiredDate,
        verifiedBy: []
      });
      
      expect(code.isExpired()).toBe(true);
      
      await code.deleteOne();
    });

    test('findByCode() should not return expired codes', async () => {
      const userId = 'test-user-expired-filter';
      const groupId = 'test-group-expired-filter';
      
      // Create an expired code
      const expiredDate = new Date();
      expiredDate.setHours(expiredDate.getHours() - 1);
      
      const expiredCode = await CredibilityCode.create({
        code: 'EXP456',
        userId,
        groupId,
        expiresAt: expiredDate,
        verifiedBy: []
      });
      
      // Try to find it - should return null because it's expired
      const found = await CredibilityCode.findByCode('EXP456');
      expect(found).toBeNull();
      
      await expiredCode.deleteOne();
    });

    test('findByCode() should return non-expired codes', async () => {
      const userId = 'test-user-active-filter';
      const groupId = 'test-group-active-filter';
      
      const code = await CredibilityCode.generateCode(userId, groupId);
      
      const found = await CredibilityCode.findByCode(code.code);
      expect(found).not.toBeNull();
      expect(found?.code).toBe(code.code);
      
      await code.deleteOne();
    });

    test('findActiveCode() should not return expired codes', async () => {
      const userId = 'test-user-active-expired';
      const groupId = 'test-group-active-expired';
      
      // Create an expired code
      const expiredDate = new Date();
      expiredDate.setHours(expiredDate.getHours() - 1);
      
      const expiredCode = await CredibilityCode.create({
        code: 'EXP789',
        userId,
        groupId,
        expiresAt: expiredDate,
        verifiedBy: []
      });
      
      // Try to find active code - should return null because it's expired
      const found = await CredibilityCode.findActiveCode(userId, groupId);
      expect(found).toBeNull();
      
      await expiredCode.deleteOne();
    });

    test('findActiveCode() should return non-expired codes', async () => {
      const userId = 'test-user-active-valid';
      const groupId = 'test-group-active-valid';
      
      const code = await CredibilityCode.generateCode(userId, groupId);
      
      const found = await CredibilityCode.findActiveCode(userId, groupId);
      expect(found).not.toBeNull();
      expect(found?.code).toBe(code.code);
      
      await code.deleteOne();
    });
  });

  describe('CredibilityCode - verify() method', () => {
    test('verify() should add verifierId when not already verified', async () => {
      const userId = 'test-user-verify';
      const groupId = 'test-group-verify';
      const verifierId = 'test-verifier-1';
      
      const code = await CredibilityCode.generateCode(userId, groupId);
      
      expect(code.verifiedBy).not.toContain(verifierId);
      
      await code.verify(verifierId);
      
      // Reload from database
      const updatedCode = await CredibilityCode.findById(code._id);
      expect(updatedCode?.verifiedBy).toContain(verifierId);
      expect(updatedCode?.verifiedBy.length).toBe(1);
      
      await code.deleteOne();
    });

    test('verify() should not add duplicate verifierId when already verified', async () => {
      const userId = 'test-user-verify-duplicate';
      const groupId = 'test-group-verify-duplicate';
      const verifierId = 'test-verifier-2';
      
      const code = await CredibilityCode.generateCode(userId, groupId);
      
      // Verify once
      await code.verify(verifierId);
      expect(code.verifiedBy).toContain(verifierId);
      expect(code.verifiedBy.length).toBe(1);
      
      // Verify again with same verifierId - should not add duplicate
      await code.verify(verifierId);
      
      // Reload from database
      const updatedCode = await CredibilityCode.findById(code._id);
      expect(updatedCode?.verifiedBy).toContain(verifierId);
      expect(updatedCode?.verifiedBy.length).toBe(1); // Still only 1, not 2
      
      await code.deleteOne();
    });

    test('verify() should allow multiple different verifiers', async () => {
      const userId = 'test-user-verify-multiple';
      const groupId = 'test-group-verify-multiple';
      const verifier1 = 'test-verifier-3';
      const verifier2 = 'test-verifier-4';
      
      const code = await CredibilityCode.generateCode(userId, groupId);
      
      await code.verify(verifier1);
      await code.verify(verifier2);
      
      // Reload from database
      const updatedCode = await CredibilityCode.findById(code._id);
      expect(updatedCode?.verifiedBy).toContain(verifier1);
      expect(updatedCode?.verifiedBy).toContain(verifier2);
      expect(updatedCode?.verifiedBy.length).toBe(2);
      
      await code.deleteOne();
    });
  });
});



