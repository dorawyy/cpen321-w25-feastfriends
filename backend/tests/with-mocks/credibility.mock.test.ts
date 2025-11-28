// tests/with-mocks/credibility.mock.test.ts

/**
 * Credibility Routes Tests - With Mocking
 * Tests error scenarios and edge cases using mocked database
 */

// STEP 1: Mock the models BEFORE any imports
jest.mock('../../src/models/User');
jest.mock('../../src/models/CredibilityCode');

// STEP 2: Import everything you need
import request from 'supertest';
import app from '../../src/app';
import User from '../../src/models/User';
import CredibilityCode from '../../src/models/CredibilityCode';
import { generateTestToken } from '../helpers/auth.helper';
import credibilityService from '../../src/services/credibilityService';

// STEP 3: Get typed versions of mocks
const mockedUser = User as jest.Mocked<typeof User>;
const mockedCredibilityCode = CredibilityCode as jest.Mocked<typeof CredibilityCode>;

describe('GET /api/credibility/code - With Mocking', () => {
  /**
   * Interface: GET /api/credibility/code
   * Mocking: Database errors and user not found scenarios
   */

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  test('should return 500 when database query fails', async () => {
    /**
     * Input: GET /api/credibility/code with valid token
     * Expected Status Code: 500
     * Expected Output: Database error message
     * Expected Behavior:
     *   - Auth succeeds
     *   - User.findById() throws error
     *   - Error handler catches it
     *   - Return 500
     * Mock Behavior:
     *   - User.findById() rejects with Error('Database connection failed')
     */

    mockedUser.findById.mockRejectedValue(new Error('Database connection failed'));

    const token = generateTestToken('test-user-id-123');

    const response = await request(app)
      .get('/api/credibility/code')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(500);
    expect(response.body.message).toBe('Database connection failed');
  });

  test('should return 404 when user not found', async () => {
    /**
     * Input: GET /api/credibility/code with valid token
     * Expected Status Code: 404
     * Expected Output: User not found error
     * Expected Behavior:
     *   - Auth succeeds
     *   - User.findById() returns null
     *   - Controller returns 404
     * Mock Behavior:
     *   - User.findById() resolves to null
     */

    mockedUser.findById.mockResolvedValue(null);

    const token = generateTestToken('test-user-id-123');

    const response = await request(app)
      .get('/api/credibility/code')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(404);
    expect(response.body.Status).toBe(404);
    expect(response.body.Message.error).toBe('User not found');
  });

  test('should return 500 when CredibilityCode.findActiveCode fails', async () => {
    /**
     * Input: GET /api/credibility/code with valid token and user in group
     * Expected Status Code: 500
     * Expected Output: Database error
     * Expected Behavior:
     *   - Auth succeeds
     *   - User found with groupId
     *   - CredibilityCode.findActiveCode() throws error
     *   - Return 500
     * Mock Behavior:
     *   - User.findById() returns mock user with groupId
     *   - CredibilityCode.findActiveCode() throws error
     */

    const mockUser = {
      _id: 'test-user-id-123',
      groupId: 'test-group-id',
      save: jest.fn().mockResolvedValue(true)
    };

    mockedUser.findById.mockResolvedValue(mockUser as any);
    mockedCredibilityCode.findActiveCode.mockRejectedValue(new Error('Database query failed'));

    const token = generateTestToken('test-user-id-123');

    const response = await request(app)
      .get('/api/credibility/code')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(500);
    expect(response.body.message).toBe('Database query failed');
  });

  test('should return 500 when CredibilityCode.generateCode fails', async () => {
    /**
     * Input: GET /api/credibility/code with valid token and user in group
     * Expected Status Code: 500
     * Expected Output: Code generation error
     * Expected Behavior:
     *   - Auth succeeds
     *   - User found with groupId
     *   - No active code found
     *   - CredibilityCode.generateCode() throws error
     *   - Return 500
     * Mock Behavior:
     *   - User.findById() returns mock user with groupId
     *   - CredibilityCode.findActiveCode() returns null
     *   - CredibilityCode.generateCode() throws error
     */

    const mockUser = {
      _id: 'test-user-id-123',
      groupId: 'test-group-id',
      save: jest.fn().mockResolvedValue(true)
    };

    mockedUser.findById.mockResolvedValue(mockUser as any);
    mockedCredibilityCode.findActiveCode.mockResolvedValue(null);
    mockedCredibilityCode.generateCode.mockRejectedValue(new Error('Failed to generate unique code'));

    const token = generateTestToken('test-user-id-123');

    const response = await request(app)
      .get('/api/credibility/code')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(500);
    expect(response.body.message).toBe('Failed to generate unique code');
  });

  test('should return 500 when code generation fails after max attempts (10 collisions)', async () => {
    /**
     * Input: GET /api/credibility/code with valid token and user in group
     * Expected Status Code: 500
     * Expected Output: "Failed to generate unique code" error
     * Expected Behavior:
     *   - Auth succeeds
     *   - User found with groupId
     *   - No active code found
     *   - CredibilityCode.generateCode() fails after 10 collision attempts
     *   - Return 500
     * Mock Behavior:
     *   - User.findById() returns mock user with groupId
     *   - CredibilityCode.findActiveCode() returns null
     *   - CredibilityCode.generateCode() throws "Failed to generate unique code" after max attempts
     */

    const mockUser = {
      _id: 'test-user-id-123',
      groupId: 'test-group-id',
      save: jest.fn().mockResolvedValue(true)
    };

    mockedUser.findById.mockResolvedValue(mockUser as any);
    mockedCredibilityCode.findActiveCode.mockResolvedValue(null);
    // Mock generateCode to simulate max attempts failure
    mockedCredibilityCode.generateCode.mockRejectedValue(
      new Error('Failed to generate unique code')
    );

    const token = generateTestToken('test-user-id-123');

    const response = await request(app)
      .get('/api/credibility/code')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(500);
    expect(response.body.message).toBe('Failed to generate unique code');
  });
});

describe('POST /api/credibility/verify - With Mocking', () => {
  /**
   * Interface: POST /api/credibility/verify
   * Mocking: Database errors and code validation failures
   */

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should return 500 when CredibilityCode.findByCode fails', async () => {
    /**
     * Input: POST /api/credibility/verify with valid code
     * Expected Status Code: 500
     * Expected Output: Database error
     * Expected Behavior:
     *   - Auth succeeds
     *   - CredibilityCode.findByCode() throws error
     *   - Return 500
     * Mock Behavior:
     *   - CredibilityCode.findByCode() throws error
     */

    mockedCredibilityCode.findByCode.mockRejectedValue(new Error('Database query failed'));

    const token = generateTestToken('test-user-id-123');

    const response = await request(app)
      .post('/api/credibility/verify')
      .set('Authorization', `Bearer ${token}`)
      .send({ code: 'ABC123' });

    expect(response.status).toBe(500);
    expect(response.body.message).toBe('Database query failed');
  });

  test('should return 500 when code.verify() fails', async () => {
    /**
     * Input: POST /api/credibility/verify with valid code
     * Expected Status Code: 500
     * Expected Output: Verification error
     * Expected Behavior:
     *   - Auth succeeds
     *   - Code found and valid
     *   - code.verify() throws error
     *   - Return 500
     * Mock Behavior:
     *   - CredibilityCode.findByCode() returns mock code
     *   - code.verify() throws error
     */

    const mockCode = {
      code: 'ABC123',
      userId: 'code-owner-id',
      groupId: 'test-group-id',
      verifiedBy: [],
      verify: jest.fn().mockRejectedValue(new Error('Verification failed')),
      deleteOne: jest.fn().mockResolvedValue(true)
    };

    mockedCredibilityCode.findByCode.mockResolvedValue(mockCode as any);

    const token = generateTestToken('verifier-id');

    const response = await request(app)
      .post('/api/credibility/verify')
      .set('Authorization', `Bearer ${token}`)
      .send({ code: 'ABC123' });

    expect(response.status).toBe(500);
    expect(response.body.message).toBe('Verification failed');
  });

  test('should return 500 when credibilityService.updateCredibilityScore fails', async () => {
    /**
     * Input: POST /api/credibility/verify with valid code
     * Expected Status Code: 500
     * Expected Output: Service error
     * Expected Behavior:
     *   - Auth succeeds
     *   - Code verified successfully
     *   - credibilityService.updateCredibilityScore() throws error
     *   - Return 500
     * Mock Behavior:
     *   - CredibilityCode.findByCode() returns mock code
     *   - code.verify() succeeds
     *   - credibilityService.updateCredibilityScore() throws error
     */

    const mockCode = {
      code: 'ABC123',
      userId: 'code-owner-id',
      groupId: 'test-group-id',
      verifiedBy: [],
      verify: jest.fn().mockResolvedValue(true),
      deleteOne: jest.fn().mockResolvedValue(true)
    };

    mockedCredibilityCode.findByCode.mockResolvedValue(mockCode as any);
    jest.spyOn(credibilityService, 'updateCredibilityScore').mockRejectedValue(new Error('Service error'));

    const token = generateTestToken('verifier-id');

    const response = await request(app)
      .post('/api/credibility/verify')
      .set('Authorization', `Bearer ${token}`)
      .send({ code: 'ABC123' });

    expect(response.status).toBe(500);
    expect(response.body.message).toBe('Service error');

    jest.restoreAllMocks();
  });
});

describe('POST /api/credibility/deduct - With Mocking', () => {
  /**
   * Interface: POST /api/credibility/deduct
   * Mocking: Database errors and service failures
   */

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should return 500 when user not found', async () => {
    /**
     * Input: POST /api/credibility/deduct with valid token
     * Expected Status Code: 404
     * Expected Output: User not found error
     * Expected Behavior:
     *   - Auth succeeds
     *   - User.findById() returns null
     *   - Controller returns 404
     * Mock Behavior:
     *   - User.findById() resolves to null
     */

    mockedUser.findById.mockResolvedValue(null);

    const token = generateTestToken('test-user-id-123');

    const response = await request(app)
      .post('/api/credibility/deduct')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(404);
    expect(response.body.Status).toBe(404);
    expect(response.body.Message.error).toBe('User not found');
  });

  test('should return 500 when CredibilityCode.findActiveCode fails', async () => {
    /**
     * Input: POST /api/credibility/deduct with valid token
     * Expected Status Code: 500
     * Expected Output: Database error
     * Expected Behavior:
     *   - Auth succeeds
     *   - User found with groupId
     *   - CredibilityCode.findActiveCode() throws error
     *   - Return 500
     * Mock Behavior:
     *   - User.findById() returns mock user with groupId
     *   - CredibilityCode.findActiveCode() throws error
     */

    const mockUser = {
      _id: 'test-user-id-123',
      groupId: 'test-group-id',
      credibilityScore: 50,
      save: jest.fn().mockResolvedValue(true)
    };

    mockedUser.findById.mockResolvedValue(mockUser as any);
    mockedCredibilityCode.findActiveCode.mockRejectedValue(new Error('Database query failed'));

    const token = generateTestToken('test-user-id-123');

    const response = await request(app)
      .post('/api/credibility/deduct')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(500);
    expect(response.body.message).toBe('Database query failed');
  });

  test('should return 500 when CredibilityCode.findOne fails', async () => {
    /**
     * Input: POST /api/credibility/deduct with valid token
     * Expected Status Code: 500
     * Expected Output: Database error
     * Expected Behavior:
     *   - Auth succeeds
     *   - User found with groupId
     *   - CredibilityCode.findOne() throws error
     *   - Return 500
     * Mock Behavior:
     *   - User.findById() returns mock user with groupId
     *   - CredibilityCode.findActiveCode() returns null
     *   - CredibilityCode.findOne() throws error
     */

    const mockUser = {
      _id: 'test-user-id-123',
      groupId: 'test-group-id',
      credibilityScore: 50,
      save: jest.fn().mockResolvedValue(true)
    };

    mockedUser.findById.mockResolvedValue(mockUser as any);
    mockedCredibilityCode.findActiveCode.mockResolvedValue(null);
    mockedCredibilityCode.findOne.mockRejectedValue(new Error('Query failed'));

    const token = generateTestToken('test-user-id-123');

    const response = await request(app)
      .post('/api/credibility/deduct')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(500);
    expect(response.body.message).toBe('Query failed');
  });

  test('should return 500 when credibilityService.updateCredibilityScore fails', async () => {
    /**
     * Input: POST /api/credibility/deduct with valid token
     * Expected Status Code: 500
     * Expected Output: Service error
     * Expected Behavior:
     *   - Auth succeeds
     *   - User found, no code verified
     *   - credibilityService.updateCredibilityScore() throws error
     *   - Return 500
     * Mock Behavior:
     *   - User.findById() returns mock user
     *   - CredibilityCode.findActiveCode() returns null
     *   - CredibilityCode.findOne() returns null
     *   - credibilityService.updateCredibilityScore() throws error
     */

    const mockUser = {
      _id: 'test-user-id-123',
      groupId: 'test-group-id',
      credibilityScore: 50,
      save: jest.fn().mockResolvedValue(true)
    };

    mockedUser.findById.mockResolvedValue(mockUser as any);
    mockedCredibilityCode.findActiveCode.mockResolvedValue(null);
    mockedCredibilityCode.findOne.mockResolvedValue(null);
    jest.spyOn(credibilityService, 'updateCredibilityScore').mockRejectedValue(new Error('Service error'));

    const token = generateTestToken('test-user-id-123');

    const response = await request(app)
      .post('/api/credibility/deduct')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(500);
    expect(response.body.message).toBe('Service error');

    jest.restoreAllMocks();
  });

  test('should return 500 when code.deleteOne fails', async () => {
    /**
     * Input: POST /api/credibility/deduct with valid token and code exists
     * Expected Status Code: 500
     * Expected Output: Delete error
     * Expected Behavior:
     *   - Auth succeeds
     *   - User found, code exists but not verified
     *   - Score updated successfully
     *   - code.deleteOne() throws error
     *   - Return 500
     * Mock Behavior:
     *   - User.findById() returns mock user
     *   - CredibilityCode.findActiveCode() returns mock code
     *   - CredibilityCode.findOne() returns null
     *   - credibilityService.updateCredibilityScore() succeeds
     *   - code.deleteOne() throws error
     */

    const mockUser = {
      _id: 'test-user-id-123',
      groupId: 'test-group-id',
      credibilityScore: 50,
      save: jest.fn().mockResolvedValue(true)
    };

    const mockCode = {
      code: 'ABC123',
      userId: 'test-user-id-123',
      groupId: 'test-group-id',
      verifiedBy: [],
      deleteOne: jest.fn().mockRejectedValue(new Error('Delete failed'))
    };

    mockedUser.findById.mockResolvedValue(mockUser as any);
    mockedCredibilityCode.findActiveCode.mockResolvedValue(mockCode as any);
    mockedCredibilityCode.findOne.mockResolvedValue(null);
    jest.spyOn(credibilityService, 'updateCredibilityScore').mockResolvedValue({
      previousScore: 50,
      newScore: 40,
      scoreChange: -10
    });

    const token = generateTestToken('test-user-id-123');

    const response = await request(app)
      .post('/api/credibility/deduct')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(500);
    expect(response.body.message).toBe('Delete failed');

    jest.restoreAllMocks();
  });
});

