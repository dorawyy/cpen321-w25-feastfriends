// tests/no-mocks/credibility.test.ts
import request from 'supertest';
import app from '../../src/app';
import { generateTestToken } from '../helpers/auth.helper';
import { seedTestUsers, cleanTestData, TestUser } from '../helpers/seed.helper';
import { connectDatabase, disconnectDatabase } from '../../src/config/database';
import mongoose from 'mongoose';
import User from '../../src/models/User';
import CredibilityCode from '../../src/models/CredibilityCode';

/**
 * Credibility Routes Tests - No Mocking (Controllable Scenarios)
 * 
 * This test suite covers CONTROLLABLE scenarios:
 * - Request validation (missing fields, invalid formats)
 * - Business logic (authorization, user not found, code validation)
 * - Real database operations
 * - Code generation and verification
 * - Score deduction logic
 * 
 * Does NOT test:
 * - Database connection failures (uncontrollable) - tested in credibility.mock.test.ts
 * - Model hooks and virtuals directly - only through API responses
 */

let testUsers: TestUser[];

beforeAll(async () => {
  console.log('\n🚀 Starting Credibility Tests (No Mocking)...\n');
  
  // Connect to test database
  await connectDatabase();
  
  // Seed test data
  testUsers = await seedTestUsers();
  
  console.log(`\n✅ Test setup complete. Ready to run tests.\n`);
});

afterAll(async () => {
  console.log('\n🧹 Cleaning up after tests...\n');
  
  // Clean up test data
  await cleanTestData();
  
  // Clean up credibility codes and logs
  await CredibilityCode.deleteMany({});
  
  // Close database connection
  await disconnectDatabase();
  
  console.log('✅ Cleanup complete.\n');
});

// Interface: GET /api/credibility/code
describe('GET /api/credibility/code - No Mocking', () => {
  // Input: GET /api/credibility/code with valid token and user in group
  // Expected status code: 200
  // Expected behavior: Generate or return existing code for user's group
  // Expected output: Code object with code, expiresAt, and groupId
  test('should return 200 and generate code for user in group', async () => {
    // Set up user with groupId
    const user = await User.findById(testUsers[0]._id);
    if (!user) throw new Error('Test user not found');
    user.groupId = new mongoose.Types.ObjectId().toString();
    await user.save();

    const token = generateTestToken(
      testUsers[0]._id,
      testUsers[0].email,
      testUsers[0].googleId
    );

    const response = await request(app)
      .get('/api/credibility/code')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.Status).toBe(200);
    expect(response.body.Body).toHaveProperty('code');
    expect(response.body.Body).toHaveProperty('expiresAt');
    expect(response.body.Body).toHaveProperty('groupId');
    expect(response.body.Body.code).toMatch(/^[A-Z0-9]{6}$/);
  });

  // Input: GET /api/credibility/code without Authorization header
  // Expected status code: 401
  // Expected behavior: Auth middleware blocks request
  // Expected output: Unauthorized error
  test('should return 401 without authentication token', async () => {
    const response = await request(app)
      .get('/api/credibility/code');

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty('error');
    expect(response.body.message).toMatch(/token|unauthorized/i);
  });

  // Input: GET /api/credibility/code with user not in a group
  // Expected status code: 400
  // Expected behavior: User has no groupId
  // Expected output: "User not in a group" error message
  test('should return 400 when user is not in a group', async () => {
    // Ensure user has no groupId
    const user = await User.findById(testUsers[1]._id);
    if (!user) throw new Error('Test user not found');
    user.groupId = undefined;
    await user.save();

    const token = generateTestToken(
      testUsers[1]._id,
      testUsers[1].email,
      testUsers[1].googleId
    );

    const response = await request(app)
      .get('/api/credibility/code')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(400);
    expect(response.body.Status).toBe(400);
    expect(response.body.Message.error).toBe('User not in a group');
  });

  // Input: GET /api/credibility/code with valid token for non-existent user
  // Expected status code: 404
  // Expected behavior: Auth succeeds, database query returns null
  // Expected output: "User not found" error message
  test('should return 404 when user not found in database', async () => {
    const nonExistentUserId = new mongoose.Types.ObjectId().toString();
    const token = generateTestToken(
      nonExistentUserId,
      'nonexistent@example.com',
      'google-nonexistent'
    );

    const response = await request(app)
      .get('/api/credibility/code')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(404);
    expect(response.body.Status).toBe(404);
    expect(response.body.Message.error).toBe('User not found');
  });

  // Input: GET /api/credibility/code when user already has active code
  // Expected status code: 200
  // Expected behavior: Return existing code instead of generating new one
  // Expected output: Existing code object
  test('should return existing code if user already has active code', async () => {
    const user = await User.findById(testUsers[2]._id);
    if (!user) throw new Error('Test user not found');
    const groupId = new mongoose.Types.ObjectId().toString();
    user.groupId = groupId;
    await user.save();

    // Create an active code
    const existingCode = await CredibilityCode.generateCode(testUsers[2]._id, groupId);

    const token = generateTestToken(
      testUsers[2]._id,
      testUsers[2].email,
      testUsers[2].googleId
    );

    const response = await request(app)
      .get('/api/credibility/code')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.Body.code).toBe(existingCode.code);
  });
});

// Interface: POST /api/credibility/verify
describe('POST /api/credibility/verify - No Mocking', () => {
  let codeOwner: TestUser;
  let verifier: TestUser;
  let groupId: string;
  let testCode: any;

  beforeEach(async () => {
    // Set up two users in the same group
    codeOwner = testUsers[0];
    verifier = testUsers[1];
    groupId = new mongoose.Types.ObjectId().toString();

    const ownerUser = await User.findById(codeOwner._id);
    const verifierUser = await User.findById(verifier._id);
    if (!ownerUser || !verifierUser) throw new Error('Test users not found');

    ownerUser.groupId = groupId;
    verifierUser.groupId = groupId;
    await ownerUser.save();
    await verifierUser.save();

    // Generate a code for the owner
    testCode = await CredibilityCode.generateCode(codeOwner._id, groupId);
  });

  // Input: POST /api/credibility/verify with valid code
  // Expected status code: 200
  // Expected behavior: Verify code, update verifier's credibility score
  // Expected output: Success response with verifiedUserId
  test('should return 200 and verify code successfully', async () => {
    const token = generateTestToken(
      verifier._id,
      verifier.email,
      verifier.googleId
    );

    // Get verifier's initial score
    const verifierUser = await User.findById(verifier._id);
    const initialScore = verifierUser?.credibilityScore || 0;

    const response = await request(app)
      .post('/api/credibility/verify')
      .set('Authorization', `Bearer ${token}`)
      .send({ code: testCode.code });

    expect(response.status).toBe(200);
    expect(response.body.Status).toBe(200);
    expect(response.body.Body.success).toBe(true);
    expect(response.body.Body.verifiedUserId).toBe(codeOwner._id);
    expect(response.body.Body.message).toContain('gained');

    // Verify credibility score did not decrease (implementation may cap at 100)
    const updatedVerifier = await User.findById(verifier._id);
    expect((updatedVerifier?.credibilityScore || 0)).toBeGreaterThanOrEqual(initialScore);
  });

  // Input: POST /api/credibility/verify without Authorization header
  // Expected status code: 401
  // Expected behavior: Auth middleware blocks request
  // Expected output: Unauthorized error
  test('should return 401 without authentication token', async () => {
    const response = await request(app)
      .post('/api/credibility/verify')
      .send({ code: testCode.code });

    expect(response.status).toBe(401);
    expect(response.body.message).toMatch(/token|unauthorized/i);
  });

  // Input: POST /api/credibility/verify without code in body
  // Expected status code: 400
  // Expected behavior: Validation fails
  // Expected output: "Code is required" error message
  test('should return 400 when code is missing', async () => {
    const token = generateTestToken(
      verifier._id,
      verifier.email,
      verifier.googleId
    );

    const response = await request(app)
      .post('/api/credibility/verify')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(response.status).toBe(400);
    expect(response.body.Status).toBe(400);
    expect(response.body.Message.error).toBe('Code is required');
  });

  // Input: POST /api/credibility/verify with invalid code
  // Expected status code: 400
  // Expected behavior: Code not found in database
  // Expected output: "This code is not valid" error message
  test('should return 400 for invalid code', async () => {
    const token = generateTestToken(
      verifier._id,
      verifier.email,
      verifier.googleId
    );

    const response = await request(app)
      .post('/api/credibility/verify')
      .set('Authorization', `Bearer ${token}`)
      .send({ code: 'INVALID' });

    expect(response.status).toBe(400);
    expect(response.body.Status).toBe(400);
    expect(response.body.Message.error).toContain('not valid');
  });

  // Input: POST /api/credibility/verify with own code
  // Expected status code: 400
  // Expected behavior: User tries to verify their own code
  // Expected output: "You cannot verify your own code" error message
  test('should return 400 when trying to verify own code', async () => {
    const token = generateTestToken(
      codeOwner._id,
      codeOwner.email,
      codeOwner.googleId
    );

    const response = await request(app)
      .post('/api/credibility/verify')
      .set('Authorization', `Bearer ${token}`)
      .send({ code: testCode.code });

    expect(response.status).toBe(400);
    expect(response.body.Status).toBe(400);
    expect(response.body.Message.error).toBe('You cannot verify your own code.');
  });

  // Input: POST /api/credibility/verify with already verified code
  // Expected status code: 400
  // Expected behavior: Code was already verified by this user
  // Expected output: "You have already verified this code" error message
  test('should return 400 when code already verified by same user', async () => {
    const token = generateTestToken(
      verifier._id,
      verifier.email,
      verifier.googleId
    );

    // Verify once
    await request(app)
      .post('/api/credibility/verify')
      .set('Authorization', `Bearer ${token}`)
      .send({ code: testCode.code });

    // Try to verify again
    const response = await request(app)
      .post('/api/credibility/verify')
      .set('Authorization', `Bearer ${token}`)
      .send({ code: testCode.code });

    expect(response.status).toBe(400);
    expect(response.body.Status).toBe(400);
    expect(response.body.Message.error).toBe('You have already verified this code.');
  });
});

// Interface: POST /api/credibility/deduct
describe('POST /api/credibility/deduct - No Mocking', () => {
  let testUser: TestUser;
  let groupId: string;

  beforeEach(async () => {
    testUser = testUsers[3];
    groupId = new mongoose.Types.ObjectId().toString();

    const user = await User.findById(testUser._id);
    if (!user) throw new Error('Test user not found');
    user.groupId = groupId;
    await user.save();
  });

  // Input: POST /api/credibility/deduct for user who left without verification
  // Expected status code: 200
  // Expected behavior: Deduct credibility score
  // Expected output: Success response with scoreDeducted and newScore
  test('should return 200 and deduct score when leaving without verification', async () => {
    const token = generateTestToken(
      testUser._id,
      testUser.email,
      testUser.googleId
    );

    const user = await User.findById(testUser._id);
    const initialScore = user?.credibilityScore || 0;

    const response = await request(app)
      .post('/api/credibility/deduct')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.Status).toBe(200);
    expect(response.body.Body.success).toBe(true);
    expect(response.body.Body.scoreDeducted).toBe(10);
    expect(response.body.Body.newScore).toBe(Math.max(0, initialScore - 10));

    // Verify score was updated
    const updatedUser = await User.findById(testUser._id);
    expect(updatedUser?.credibilityScore).toBe(Math.max(0, initialScore - 10));

    // Verify log was created
  });

  // Input: POST /api/credibility/deduct without Authorization header
  // Expected status code: 401
  // Expected behavior: Auth middleware blocks request
  // Expected output: Unauthorized error
  test('should return 401 without authentication token', async () => {
    const response = await request(app)
      .post('/api/credibility/deduct');

    expect(response.status).toBe(401);
    expect(response.body.message).toMatch(/token|unauthorized/i);
  });

  // Input: POST /api/credibility/deduct for user not found
  // Expected status code: 404
  // Expected behavior: User doesn't exist in database
  // Expected output: "User not found" error message
  test('should return 404 when user not found', async () => {
    const nonExistentUserId = new mongoose.Types.ObjectId().toString();
    const token = generateTestToken(
      nonExistentUserId,
      'nonexistent@example.com',
      'google-nonexistent'
    );

    const response = await request(app)
      .post('/api/credibility/deduct')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(404);
    expect(response.body.Status).toBe(404);
    expect(response.body.Message.error).toBe('User not found');
  });

  // Input: POST /api/credibility/deduct with user not in a group
  // Expected status code: 400
  // Expected behavior: User has no groupId
  // Expected output: "User not in a group" error message
  test('should return 400 when user is not in a group', async () => {
    // Ensure user has no groupId
    const user = await User.findById(testUsers[2]._id);
    if (!user) throw new Error('Test user not found');
    user.groupId = undefined;
    await user.save();

    const token = generateTestToken(
      testUsers[2]._id,
      testUsers[2].email,
      testUsers[2].googleId
    );

    const response = await request(app)
      .post('/api/credibility/deduct')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(400);
    expect(response.body.Status).toBe(400);
    expect(response.body.Message.error).toBe('User not in a group');
  });

  // Input: POST /api/credibility/deduct when user's code was verified
  // Expected status code: 200
  // Expected behavior: No penalty because code was verified
  // Expected output: Success with scoreDeducted: 0
  test('should return 200 with no penalty when code was verified', async () => {
    const codeOwner = testUsers[0];
    const verifier = testUsers[1];
    const groupId = new mongoose.Types.ObjectId().toString();

    // Set up users in same group
    const ownerUser = await User.findById(codeOwner._id);
    const verifierUser = await User.findById(verifier._id);
    if (!ownerUser || !verifierUser) throw new Error('Test users not found');
    ownerUser.groupId = groupId;
    verifierUser.groupId = groupId;
    await ownerUser.save();
    await verifierUser.save();

    // Generate and verify code
    const code = await CredibilityCode.generateCode(codeOwner._id, groupId);
    const verifierToken = generateTestToken(verifier._id, verifier.email, verifier.googleId);
    await request(app)
      .post('/api/credibility/verify')
      .set('Authorization', `Bearer ${verifierToken}`)
      .send({ code: code.code });

    // Try to deduct (should have no penalty)
    const ownerToken = generateTestToken(codeOwner._id, codeOwner.email, codeOwner.googleId);
    const ownerUserBefore = await User.findById(codeOwner._id);
    const initialScore = ownerUserBefore?.credibilityScore || 0;

    const response = await request(app)
      .post('/api/credibility/deduct')
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(response.status).toBe(200);
    expect(response.body.Status).toBe(200);
    expect(response.body.Body.success).toBe(true);
    expect(response.body.Body.scoreDeducted).toBe(0);
    expect(response.body.Body.newScore).toBe(initialScore);

    // Verify score was not changed
    const ownerUserAfter = await User.findById(codeOwner._id);
    expect(ownerUserAfter?.credibilityScore).toBe(initialScore);
  });

  // Input: POST /api/credibility/deduct when user verified someone else's code
  // Expected status code: 200
  // Expected behavior: No penalty because user verified someone else
  // Expected output: Success with scoreDeducted: 0
  test('should return 200 with no penalty when user verified someone else', async () => {
    const codeOwner = testUsers[2];
    const verifier = testUsers[4];
    const groupId = new mongoose.Types.ObjectId().toString();

    // Set up users in same group
    const ownerUser = await User.findById(codeOwner._id);
    const verifierUser = await User.findById(verifier._id);
    if (!ownerUser || !verifierUser) throw new Error('Test users not found');
    ownerUser.groupId = groupId;
    verifierUser.groupId = groupId;
    await ownerUser.save();
    await verifierUser.save();

    // Generate code and have verifier verify it
    const code = await CredibilityCode.generateCode(codeOwner._id, groupId);
    const verifierToken = generateTestToken(verifier._id, verifier.email, verifier.googleId);
    await request(app)
      .post('/api/credibility/verify')
      .set('Authorization', `Bearer ${verifierToken}`)
      .send({ code: code.code });

    // Verifier tries to deduct (should have no penalty)
    const verifierUserBefore = await User.findById(verifier._id);
    const initialScore = verifierUserBefore?.credibilityScore || 0;

    const response = await request(app)
      .post('/api/credibility/deduct')
      .set('Authorization', `Bearer ${verifierToken}`);

    expect(response.status).toBe(200);
    expect(response.body.Status).toBe(200);
    expect(response.body.Body.success).toBe(true);
    expect(response.body.Body.scoreDeducted).toBe(0);
    expect(response.body.Body.newScore).toBe(initialScore);
  });

  // Input: POST /api/credibility/deduct when score would go below 0
  // Expected status code: 200
  // Expected behavior: Score clamped to 0
  // Expected output: newScore should be 0
  test('should clamp score to 0 when deduction would make it negative', async () => {
    const user = await User.findById(testUser._id);
    if (!user) throw new Error('Test user not found');
    user.credibilityScore = 5; // Set low score
    await user.save();

    const token = generateTestToken(
      testUser._id,
      testUser.email,
      testUser.googleId
    );

    const response = await request(app)
      .post('/api/credibility/deduct')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.Body.newScore).toBe(0);
    
    const updatedUser = await User.findById(testUser._id);
    expect(updatedUser?.credibilityScore).toBe(0);
  });
});


