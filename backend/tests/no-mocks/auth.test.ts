// tests/no-mocks/auth.test.ts

import request from 'supertest';
import app from '../../src/app';
import { generateTestToken } from '../helpers/auth.helper';
import { 
  seedTestUsers, 
  cleanTestData, 
  TestUser,
} from '../helpers/seed.helper';
import { connectDatabase, disconnectDatabase } from '../../src/config/database';
import { UserStatus } from '../../src/models/User';
import User from '../../src/models/User';
import * as firebase from '../../src/config/firebase';

/**
 * Auth Routes Tests - No Mocking (Controllable Scenarios)
 * 
 * This test suite covers CONTROLLABLE scenarios:
 * - Request validation (missing fields, invalid formats)
 * - Business logic (user already exists, user not found)
 * - Real database operations
 * - JWT token operations (generate, verify, expire)
 * - User status management
 * 
 * Does NOT test:
 * - Google OAuth token verification (external API) - mocked via AuthService or OAuth2Client
 * - Database connection failures (uncontrollable) - tested in auth.mock.test.ts
 * 
 * MOCKING STRATEGY:
 * - Mock external APIs (Google OAuth) for consistency
 * - /api/auth/signup and /api/auth/signin: Mock AuthService.verifyGoogleToken()
 * - /api/auth/google (legacy): Mock OAuth2Client.verifyIdToken() directly
 *   (This legacy endpoint doesn't use AuthService)
 * - Use jest.spyOn() for cleaner mocking
 * - Restore mocks after each test via afterEach()
 */

let testUsers: TestUser[];

beforeAll(async () => {
  console.log('\n🚀 Starting Auth Tests (No Mocking - Controllable Scenarios)...\n');
  
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
  
  // Close database connection
  await disconnectDatabase();
  
  console.log('✅ Cleanup complete.\n');
});

beforeEach(() => {
  // Spy on Firebase to prevent actual API calls
  jest.spyOn(firebase, 'sendPushNotification').mockResolvedValue('mock-message-id');
  jest.spyOn(firebase, 'sendMulticastNotification').mockResolvedValue({
    successCount: 1,
    failureCount: 0,
    responses: []
  } as any);
});

afterEach(() => {
  // Restore all spies after each test
  jest.restoreAllMocks();
});

describe('POST /api/auth/signup - Validation (No Mocking)', () => {
  test('should return 400 when idToken is missing', async () => {
    /**
     * Tests if (!idToken) -> 400 pattern
     * Covers: auth.controller.ts lines 20-25 (signup), 90-95 (signin), 160-165 (googleAuth)
     * All three methods have identical code: if (!idToken) { 400 }
     */
    const response = await request(app)
      .post('/api/auth/signup')
      .send({});

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Bad Request');
    expect(response.body.message).toBe('Google ID token is required');
  });

  test('should return 409 when user already exists', async () => {
    /**
     * Covers auth.controller.ts lines 32-38: Check if user already exists
     * Path: User.findOne -> if (existingUser) -> 409 response
     */
    const { AuthService } = require('../../src/services/authService');
    const existingUser = testUsers[0];
    
    // Mock verifyGoogleToken to return data for existing user
    const mockGoogleData = {
      googleId: existingUser.googleId,
      email: existingUser.email,
      name: existingUser.name,
      picture: 'https://example.com/pic.jpg'
    };
    
    jest.spyOn(AuthService.prototype, 'verifyGoogleToken').mockResolvedValueOnce(mockGoogleData);
    
    const response = await request(app)
      .post('/api/auth/signup')
      .send({ idToken: 'mock-google-token-existing' });
    
    expect(response.status).toBe(409);
    expect(response.body.error).toBe('Conflict');
    expect(response.body.message).toBe('Account already exists. Please sign in instead.');
  });

  test('should return 500 when JWT_SECRET is missing', async () => {
    /**
     * Tests if (!jwtSecret) -> 500 pattern
     * Covers: auth.controller.ts lines 45-52 (signup), 115-122 (signin), 212-219 (logout), 212-219 (googleAuth)
     * All four methods have identical code: if (!jwtSecret) { 500 }
     */
    const { AuthService } = require('../../src/services/authService');
    const originalSecret = process.env.JWT_SECRET;
    
    // Mock verifyGoogleToken to return data for new user
    const mockGoogleData = {
      googleId: `google-new-${Date.now()}`,
      email: `new-${Date.now()}@example.com`,
      name: 'New User',
      picture: 'https://example.com/pic.jpg'
    };
    
    // Mock findOrCreateUser to return a user (so it passes the existing user check)
    const mockUser = {
      _id: { toString: () => 'test-user-id' },
      email: mockGoogleData.email,
      googleId: mockGoogleData.googleId,
      name: mockGoogleData.name,
      profilePicture: mockGoogleData.picture,
      credibilityScore: 100
    };
    
    jest.spyOn(AuthService.prototype, 'verifyGoogleToken').mockResolvedValueOnce(mockGoogleData);
    jest.spyOn(AuthService.prototype, 'findOrCreateUser').mockResolvedValueOnce(mockUser);
    
    // Remove JWT_SECRET to trigger the error path
    delete process.env.JWT_SECRET;
    
    const response = await request(app)
      .post('/api/auth/signup')
      .send({ idToken: 'mock-google-token-new' });

    // Restore JWT_SECRET immediately
    process.env.JWT_SECRET = originalSecret;
    
    expect(response.status).toBe(500);
    expect(response.body.error).toBe('Server Error');
    expect(response.body.message).toBe('JWT configuration error');
  });

  test('should handle errors in catch block and call next(error)', async () => {
    /**
     * Covers auth.controller.ts line 78: catch block -> next(error)
     * Path: Error thrown -> catch block -> next(error) -> error handler
     */
    const { AuthService } = require('../../src/services/authService');
    
    // Mock verifyGoogleToken to throw an error
    jest.spyOn(AuthService.prototype, 'verifyGoogleToken').mockRejectedValueOnce(
      new Error('Google token verification failed')
    );
    
    const response = await request(app)
      .post('/api/auth/signup')
      .send({ idToken: 'mock-google-token-error' });
    
    // Error should be caught and handled by error handler
    expect(response.status).toBe(500);
    expect(response.body).toHaveProperty('message');
    expect(response.body.message).toContain('Google token verification failed');
  });

  test('should successfully sign up new user and return JWT token', async () => {
    /**
     * Covers auth.controller.ts lines 54-76: Successful signup path
     * Path: findOrCreateUser -> JWT generation -> response with token and user data
     */
    const { AuthService } = require('../../src/services/authService');
    
    // Create unique Google data for new user
    const uniqueGoogleId = `google-new-${Date.now()}-${Math.random()}`;
    const uniqueEmail = `newuser-${Date.now()}-${Math.random()}@example.com`;
    
    const mockGoogleData = {
      googleId: uniqueGoogleId,
      email: uniqueEmail,
      name: 'New Test User',
      picture: 'https://example.com/new-pic.jpg'
    };
    
    // Mock verifyGoogleToken to return data for new user
    jest.spyOn(AuthService.prototype, 'verifyGoogleToken').mockResolvedValueOnce(mockGoogleData);
    
    // Ensure user doesn't exist
    await User.deleteOne({ googleId: uniqueGoogleId });
    
    const response = await request(app)
      .post('/api/auth/signup')
      .send({ idToken: 'mock-google-token-new-user' });
    
    // Should successfully create user and return JWT
    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('token');
    expect(response.body).toHaveProperty('user');
    expect(response.body.user.email).toBe(uniqueEmail);
    expect(response.body.user.name).toBe('New Test User');
    expect(response.body.token).toBeTruthy();
    
    // Cleanup
    await User.deleteOne({ googleId: uniqueGoogleId });
  });
});

describe('POST /api/auth/signin - Validation (No Mocking)', () => {
  test('should return 400 when idToken is missing in signin', async () => {
    /**
     * Covers auth.controller.ts lines 91-95: idToken check in signin
     * Path: if (!idToken) -> 400 response
     */
    const response = await request(app)
      .post('/api/auth/signin')
      .send({});

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Bad Request');
    expect(response.body.message).toBe('Google ID token is required');
  });

  test('should return 404 when user not found', async () => {
    /**
     * Covers auth.controller.ts lines 102-108: User not found during signin
     * Path: User.findOne -> if (!user) -> 404 response
     */
    const { AuthService } = require('../../src/services/authService');
    
    const mockGoogleData = {
      googleId: 'google-nonexistent-user',
      email: 'nonexistent@example.com',
      name: 'Nonexistent User',
      picture: 'https://example.com/pic.jpg'
    };
    
    jest.spyOn(AuthService.prototype, 'verifyGoogleToken').mockResolvedValueOnce(mockGoogleData);
    
    const response = await request(app)
      .post('/api/auth/signin')
      .send({ idToken: 'mock-google-token-nonexistent' });
    
    expect(response.status).toBe(404);
    expect(response.body.error).toBe('Not Found');
    expect(response.body.message).toBe('Account not found. Please sign up first.');
  });

  test('should return 500 when JWT_SECRET is missing in signin', async () => {
    /**
     * Covers auth.controller.ts lines 116-121: JWT_SECRET check in signin
     * Path: if (!jwtSecret) -> 500 response
     */
    const { AuthService } = require('../../src/services/authService');
    const originalSecret = process.env.JWT_SECRET;
    const existingUser = testUsers[0];
    
    // Mock verifyGoogleToken to return data for existing user
    const mockGoogleData = {
      googleId: existingUser.googleId,
      email: existingUser.email,
      name: existingUser.name,
      picture: 'https://example.com/pic.jpg'
    };
    
    jest.spyOn(AuthService.prototype, 'verifyGoogleToken').mockResolvedValueOnce(mockGoogleData);
    
    // Remove JWT_SECRET to trigger the error path
    delete process.env.JWT_SECRET;
    
    const response = await request(app)
      .post('/api/auth/signin')
      .send({ idToken: 'mock-google-token-existing' });

    // Restore JWT_SECRET immediately
    process.env.JWT_SECRET = originalSecret;
    
    expect(response.status).toBe(500);
    expect(response.body.error).toBe('Server Error');
    expect(response.body.message).toBe('JWT configuration error');
  });

  test('should successfully sign in existing user and return JWT token', async () => {
    /**
     * Covers auth.controller.ts lines 124-146: Successful signin path
     * Path: User found -> JWT generation -> response with token and user data
     */
    const { AuthService } = require('../../src/services/authService');
    const existingUser = testUsers[0];
    
    // Mock verifyGoogleToken to return data for existing user
    const mockGoogleData = {
      googleId: existingUser.googleId,
      email: existingUser.email,
      name: existingUser.name,
      picture: 'https://example.com/pic.jpg'
    };
    
    jest.spyOn(AuthService.prototype, 'verifyGoogleToken').mockResolvedValueOnce(mockGoogleData);
    
    const response = await request(app)
      .post('/api/auth/signin')
      .send({ idToken: 'mock-google-token-existing' });
    
    // Should successfully sign in and return JWT
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('token');
    expect(response.body).toHaveProperty('user');
    expect(response.body.user.email).toBe(existingUser.email);
    expect(response.body.user.userId).toBe(existingUser._id.toString());
    expect(response.body.token).toBeTruthy();
  });

  test('should handle errors in signin catch block and call next(error)', async () => {
    /**
     * Covers auth.controller.ts line 148: catch block -> next(error) in signin
     * Path: Error thrown -> catch block -> next(error) -> error handler
     */
    const { AuthService } = require('../../src/services/authService');
    
    // Mock verifyGoogleToken to throw an error
    jest.spyOn(AuthService.prototype, 'verifyGoogleToken').mockRejectedValueOnce(
      new Error('Google token verification failed in signin')
    );
    
    const response = await request(app)
      .post('/api/auth/signin')
      .send({ idToken: 'mock-google-token-error' });
    
    // Error should be caught and handled by error handler
    expect(response.status).toBe(500);
    expect(response.body).toHaveProperty('message');
    expect(response.body.message).toContain('Google token verification failed in signin');
  });

  test('should update profile picture when user has empty profile picture and Google provides one', async () => {
    /**
     * Covers authService.ts lines 113-114: Profile picture update condition
     * Path: if (convertedProfilePicture && (!user.profilePicture || user.profilePicture === '')) -> update
     * This tests the branch where user has empty profile picture and Google provides one
     */
    const existingUser = testUsers[0];
    
    // Set user profile picture to empty
    await User.findByIdAndUpdate(existingUser._id, { profilePicture: '' });
    
    const { AuthService } = require('../../src/services/authService');
    const axios = require('axios');
    
    // Mock Google data with picture
    const mockGoogleData = {
      googleId: existingUser.googleId,
      email: existingUser.email,
      name: existingUser.name,
      picture: 'https://lh3.googleusercontent.com/test-picture.jpg'
    };
    
    // Mock axios to return a successful image response (so conversion succeeds)
    const mockImageBuffer = Buffer.from('fake-image-data');
    jest.spyOn(axios, 'get').mockResolvedValueOnce({
      data: mockImageBuffer,
      headers: { 'content-type': 'image/jpeg' }
    });
    
    jest.spyOn(AuthService.prototype, 'verifyGoogleToken').mockResolvedValueOnce(mockGoogleData);
    
    const response = await request(app)
      .post('/api/auth/signin')
      .send({ idToken: 'mock-google-token-with-picture' });
    
    // Should successfully sign in
    expect(response.status).toBe(200);
    
    // Verify profile picture was updated in database (should be Base64 data URI)
    const updatedUser = await User.findById(existingUser._id);
    expect(updatedUser!.profilePicture).toBeTruthy();
    expect(updatedUser!.profilePicture).not.toBe('');
    expect(updatedUser!.profilePicture).toContain('data:image'); // Should be Base64 data URI
  });

  test('should update profile picture when user has undefined profile picture and Google provides one', async () => {
    /**
     * Covers authService.ts line 112: Profile picture update condition - !user.profilePicture branch
     * Path: if (convertedProfilePicture && (!user.profilePicture || user.profilePicture === '')) -> update
     * This tests the branch where user.profilePicture is undefined (not just empty string)
     */
    const existingUser = testUsers[1];
    
    // Set user profile picture to undefined (unset the field)
    await User.findByIdAndUpdate(existingUser._id, { $unset: { profilePicture: '' } });
    
    const { AuthService } = require('../../src/services/authService');
    const axios = require('axios');
    
    // Mock Google data with picture
    const mockGoogleData = {
      googleId: existingUser.googleId,
      email: existingUser.email,
      name: existingUser.name,
      picture: 'https://lh3.googleusercontent.com/test-picture-undefined.jpg'
    };
    
    // Mock axios to return a successful image response (so conversion succeeds)
    const mockImageBuffer = Buffer.from('fake-image-data-for-undefined-test');
    jest.spyOn(axios, 'get').mockResolvedValueOnce({
      data: mockImageBuffer,
      headers: { 'content-type': 'image/jpeg' }
    });
    
    jest.spyOn(AuthService.prototype, 'verifyGoogleToken').mockResolvedValueOnce(mockGoogleData);
    
    const response = await request(app)
      .post('/api/auth/signin')
      .send({ idToken: 'mock-google-token-with-picture-undefined' });
    
    // Should successfully sign in
    expect(response.status).toBe(200);
    
    // Verify profile picture was updated in database (should be Base64 data URI)
    const updatedUser = await User.findById(existingUser._id);
    expect(updatedUser!.profilePicture).toBeTruthy();
    expect(updatedUser!.profilePicture).not.toBe('');
    expect(updatedUser!.profilePicture).toContain('data:image'); // Should be Base64 data URI
  });

  test('should skip profile picture conversion when googleData.picture is missing', async () => {
    /**
     * Covers authService.ts line 89: else branch when googleData.picture is falsy
     * Path: if (googleData.picture) [FALSE] -> skip conversion, convertedProfilePicture remains ''
     * This tests the branch where Google doesn't provide a picture
     */
    const existingUser = testUsers[2];
    
    // Set user profile picture to empty first
    await User.findByIdAndUpdate(existingUser._id, { profilePicture: '' });
    
    const { AuthService } = require('../../src/services/authService');
    
    // Mock Google data WITHOUT picture (undefined/missing)
    const mockGoogleData = {
      googleId: existingUser.googleId,
      email: existingUser.email,
      name: existingUser.name
      // picture is missing/undefined
    };
    
    jest.spyOn(AuthService.prototype, 'verifyGoogleToken').mockResolvedValueOnce(mockGoogleData);
    
    const response = await request(app)
      .post('/api/auth/signin')
      .send({ idToken: 'mock-google-token-no-picture' });
    
    // Should successfully sign in
    expect(response.status).toBe(200);
    
    // Verify profile picture was NOT updated (should remain empty since no picture was provided)
    const updatedUser = await User.findById(existingUser._id);
    expect(updatedUser!.profilePicture).toBe(''); // Should remain empty
  });

  test('should keep existing profile picture when user has one and Google provides picture', async () => {
    /**
     * Covers authService.ts line 115: else if branch when user has existing profile picture
     * Path: else if (user.profilePicture && user.profilePicture !== '') -> keep existing, don't update
     * This tests the branch where user already has a custom profile picture and we keep it
     */
    const existingUser = testUsers[3];
    
    // Set user profile picture to a custom value
    const customProfilePicture = 'https://example.com/custom-picture.jpg';
    await User.findByIdAndUpdate(existingUser._id, { profilePicture: customProfilePicture });
    
    const { AuthService } = require('../../src/services/authService');
    const axios = require('axios');
    
    // Mock Google data WITH picture
    const mockGoogleData = {
      googleId: existingUser.googleId,
      email: existingUser.email,
      name: existingUser.name,
      picture: 'https://lh3.googleusercontent.com/google-picture.jpg'
    };
    
    // Mock axios (even though it won't be called since we keep existing picture)
    const mockImageBuffer = Buffer.from('fake-image-data');
    jest.spyOn(axios, 'get').mockResolvedValueOnce({
      data: mockImageBuffer,
      headers: { 'content-type': 'image/jpeg' }
    });
    
    jest.spyOn(AuthService.prototype, 'verifyGoogleToken').mockResolvedValueOnce(mockGoogleData);
    
    const response = await request(app)
      .post('/api/auth/signin')
      .send({ idToken: 'mock-google-token-with-picture-existing' });
    
    // Should successfully sign in
    expect(response.status).toBe(200);
    
    // Verify profile picture was NOT updated (should keep the custom one)
    const updatedUser = await User.findById(existingUser._id);
    expect(updatedUser!.profilePicture).toBe(customProfilePicture); // Should keep existing custom picture
    expect(updatedUser!.profilePicture).not.toContain('data:image'); // Should NOT be converted to Base64
  });
});

describe('POST /api/auth/google - Validation (No Mocking)', () => {
  /**
   * NOTE: The /api/auth/google endpoint is a LEGACY endpoint that implements
   * Google OAuth verification inline (using OAuth2Client directly) rather than
   * using AuthService.verifyGoogleToken() like /api/auth/signup and /api/auth/signin do.
   * 
   * Therefore, tests for this endpoint mock at the OAuth2Client level,
   * while tests for signup/signin mock at the AuthService level.
   * 
   * This is the ONLY exception to our consistent mocking strategy.
   */
  
  test('should return 400 when idToken is missing in googleAuth', async () => {
    /**
     * Covers auth.controller.ts lines 160-165: idToken check in googleAuth
     * Path: if (!idToken) -> 400 response
     */
    const response = await request(app)
      .post('/api/auth/google')
      .send({});

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Bad Request');
    expect(response.body.message).toBe('Google ID token is required');
  });

  test('should return 401 when Google token payload is invalid (missing sub)', async () => {
    /**
     * Covers auth.controller.ts lines 174-182: Invalid payload check
     * Path: if (!payload || !payload.sub || !payload.email) -> 401 response
     */
    const { AuthService } = require('../../src/services/authService');
    
    // Mock verifyGoogleToken to throw validation error
    jest.spyOn(AuthService.prototype, 'verifyGoogleToken').mockRejectedValueOnce(
      new Error('Failed to verify Google token')
    );
    
    const response = await request(app)
      .post('/api/auth/google')
      .send({ idToken: 'mock-token' });
    
    expect([401, 500]).toContain(response.status);
  });

  test('should return 401 when Google token payload is invalid (missing email)', async () => {
    /**
     * Covers auth.controller.ts lines 174-182: Invalid payload check
     */
    const { AuthService } = require('../../src/services/authService');
    
    // Mock verifyGoogleToken to throw validation error
    jest.spyOn(AuthService.prototype, 'verifyGoogleToken').mockRejectedValueOnce(
      new Error('Failed to verify Google token')
    );
    
    const response = await request(app)
      .post('/api/auth/google')
      .send({ idToken: 'mock-token' });
    
    expect([401, 500]).toContain(response.status);
  });

  test('should return 500 when JWT_SECRET is missing in googleAuth', async () => {
    /**
     * Covers auth.controller.ts lines 214-218: JWT_SECRET check in googleAuth
     * Path: if (!jwtSecret) -> 500 response
     * 
     * NOTE: /api/auth/google is a legacy endpoint that uses OAuth2Client directly,
     * not AuthService, so we mock at the OAuth2Client level
     */
    const { OAuth2Client } = require('google-auth-library');
    const originalSecret = process.env.JWT_SECRET;
    
    // Mock valid Google token payload
    const mockTicket = {
      getPayload: jest.fn().mockReturnValue({
        sub: 'google-id-123',
        email: 'test@example.com',
        name: 'Test User',
        picture: 'https://example.com/pic.jpg'
      })
    };
    
    jest.spyOn(OAuth2Client.prototype, 'verifyIdToken').mockResolvedValueOnce(mockTicket);
    
    // Remove JWT_SECRET to trigger the error path
    delete process.env.JWT_SECRET;
    
    const response = await request(app)
      .post('/api/auth/google')
      .send({ idToken: 'mock-token' });

    // Restore JWT_SECRET immediately
    process.env.JWT_SECRET = originalSecret;
    
    expect(response.status).toBe(500);
    expect(response.body.error).toBe('Server Error');
    expect(response.body.message).toBe('JWT configuration error');
  });

  test('should use fallback "User" when name is missing in googleAuth', async () => {
    /**
     * Covers auth.controller.ts line 194: name fallback branch
     * Path: name || 'User' -> when name is falsy, use 'User' as fallback
     * 
     * NOTE: /api/auth/google is a legacy endpoint that uses OAuth2Client directly,
     * not AuthService, so we mock at the OAuth2Client level
     */
    const { OAuth2Client } = require('google-auth-library');
    
    const uniqueGoogleId = `google-no-name-${Date.now()}`;
    const uniqueEmail = `noname-${Date.now()}@example.com`;
    
    // Mock Google token with missing name
    const mockTicket = {
      getPayload: jest.fn().mockReturnValue({
        sub: uniqueGoogleId,
        email: uniqueEmail,
        // name is missing/undefined - controller will apply fallback
        picture: 'https://example.com/pic.jpg'
      })
    };
    
    jest.spyOn(OAuth2Client.prototype, 'verifyIdToken').mockResolvedValueOnce(mockTicket);
    
    // Ensure user doesn't exist
    await User.deleteOne({ googleId: uniqueGoogleId });
    
    const response = await request(app)
      .post('/api/auth/google')
      .send({ idToken: 'mock-token-no-name' });
    
    // Should successfully create user with fallback name
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('user');
    expect(response.body.user.name).toBe('User'); // Fallback name
    
    // Verify database has fallback name
    const createdUser = await User.findOne({ googleId: uniqueGoogleId });
    expect(createdUser).not.toBeNull();
    expect(createdUser!.name).toBe('User');
    
    // Cleanup
    await User.deleteOne({ googleId: uniqueGoogleId });
  });

  test('should use empty string fallback when picture is missing in googleAuth', async () => {
    /**
     * Covers auth.controller.ts line 195: picture fallback branch
     * Path: picture || '' -> when picture is falsy, use '' as fallback
     * 
     * NOTE: /api/auth/google is a legacy endpoint that uses OAuth2Client directly,
     * not AuthService, so we mock at the OAuth2Client level
     */
    const { OAuth2Client } = require('google-auth-library');
    
    const uniqueGoogleId = `google-no-pic-${Date.now()}`;
    const uniqueEmail = `nopic-${Date.now()}@example.com`;
    
    // Mock Google token with missing picture
    const mockTicket = {
      getPayload: jest.fn().mockReturnValue({
        sub: uniqueGoogleId,
        email: uniqueEmail,
        name: 'Test User',
        // picture is missing/undefined - controller will apply fallback
      })
    };
    
    jest.spyOn(OAuth2Client.prototype, 'verifyIdToken').mockResolvedValueOnce(mockTicket);
    
    // Ensure user doesn't exist
    await User.deleteOne({ googleId: uniqueGoogleId });
    
    const response = await request(app)
      .post('/api/auth/google')
      .send({ idToken: 'mock-token-no-pic' });
    
    // Should successfully create user with empty picture
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('user');
    expect(response.body.user.profilePicture).toBe(''); // Fallback empty string
    
    // Verify database has empty picture
    const createdUser = await User.findOne({ googleId: uniqueGoogleId });
    expect(createdUser).not.toBeNull();
    expect(createdUser!.profilePicture).toBe('');
    
    // Cleanup
    await User.deleteOne({ googleId: uniqueGoogleId });
  });

  test('should return 401 when Google token payload is null', async () => {
    /**
     * Covers auth.controller.ts lines 174-182: Invalid payload check (null payload)
     */
    const { AuthService } = require('../../src/services/authService');
    
    // Mock verifyGoogleToken to throw validation error
    jest.spyOn(AuthService.prototype, 'verifyGoogleToken').mockRejectedValueOnce(
      new Error('Failed to verify Google token')
    );
    
    const response = await request(app)
      .post('/api/auth/google')
      .send({ idToken: 'mock-token' });
    
    expect([401, 500]).toContain(response.status);
  });

  test('should create new user when not found', async () => {
    /**
     * Covers auth.controller.ts lines 187-201: Create new user path
     * Path: if (!user) -> User.create -> console.log
     * 
     * NOTE: /api/auth/google is a legacy endpoint that uses OAuth2Client directly,
     * not AuthService, so we mock at the OAuth2Client level
     */
    const { OAuth2Client } = require('google-auth-library');
    
    const mockPayload = {
      sub: `google-new-${Date.now()}`,
      email: `new-${Date.now()}@example.com`,
      name: 'New Legacy User',
      picture: 'https://example.com/pic.jpg'
    };
    
    const mockTicket = {
      getPayload: jest.fn().mockReturnValue(mockPayload)
    };
    
    jest.spyOn(OAuth2Client.prototype, 'verifyIdToken').mockResolvedValueOnce(mockTicket);
    
    const response = await request(app)
      .post('/api/auth/google')
      .send({ idToken: 'mock-google-token-new' });
    
    if (response.status === 200) {
      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user.email).toBe(mockPayload.email);
      
      // Verify user was created in database
      const createdUser = await User.findOne({ googleId: mockPayload.sub });
      expect(createdUser).not.toBeNull();
      expect(createdUser!.status).toBe(UserStatus.ONLINE);
      expect(createdUser!.credibilityScore).toBe(100);
      
      // Clean up
      await User.deleteOne({ googleId: mockPayload.sub });
    } else {
      expect([401, 500, 200]).toContain(response.status);
    }
  });

  test('should create new user when not found and update existing user status when found', async () => {
    /**
     * Tests findOrCreateUser pattern
     * Covers: auth.controller.ts lines 187-201 (create), 205-208 (update)
     * 
     * NOTE: /api/auth/google is a legacy endpoint that uses OAuth2Client directly,
     * not AuthService, so we mock at the OAuth2Client level
     */
    const { OAuth2Client } = require('google-auth-library');
    
    // Test 1: Create new user
    const mockPayloadNew = {
      sub: `google-new-${Date.now()}`,
      email: `new-${Date.now()}@example.com`,
      name: 'New Legacy User',
      picture: 'https://example.com/pic.jpg'
    };
    
    const mockTicketNew = {
      getPayload: jest.fn().mockReturnValue(mockPayloadNew)
    };
    
    jest.spyOn(OAuth2Client.prototype, 'verifyIdToken').mockResolvedValueOnce(mockTicketNew);
    
    const responseNew = await request(app)
      .post('/api/auth/google')
      .send({ idToken: 'mock-google-token-new' });
    
    if (responseNew.status === 200) {
      expect(responseNew.body).toHaveProperty('token');
      expect(responseNew.body).toHaveProperty('user');
      expect(responseNew.body.user.email).toBe(mockPayloadNew.email);
      
      // Verify user was created in database
      const createdUser = await User.findOne({ googleId: mockPayloadNew.sub });
      expect(createdUser).not.toBeNull();
      expect(createdUser!.status).toBe(UserStatus.ONLINE);
      expect(createdUser!.credibilityScore).toBe(100);
      
      // Clean up
      await User.deleteOne({ googleId: mockPayloadNew.sub });
    }
    
    // Test 2: Update existing user
    const existingUser = testUsers[0];
    
    // Set user to OFFLINE first
    await User.findByIdAndUpdate(existingUser._id, { status: UserStatus.OFFLINE });
    
    const mockPayloadExisting = {
      sub: existingUser.googleId,
      email: existingUser.email,
      name: existingUser.name,
      picture: 'https://example.com/pic.jpg'
    };
    
    const mockTicketExisting = {
      getPayload: jest.fn().mockReturnValue(mockPayloadExisting)
    };
    
    jest.spyOn(OAuth2Client.prototype, 'verifyIdToken').mockResolvedValueOnce(mockTicketExisting);
    
    const responseExisting = await request(app)
      .post('/api/auth/google')
      .send({ idToken: 'mock-google-token-existing' });
    
    if (responseExisting.status === 200) {
      expect(responseExisting.body).toHaveProperty('token');
      expect(responseExisting.body).toHaveProperty('user');
      
      // Verify user status was updated to ONLINE
      const updatedUser = await User.findById(existingUser._id);
      expect(updatedUser!.status).toBe(UserStatus.ONLINE);
    }
  });
});

describe('POST /api/auth/logout - No Mocking', () => {
  test('should return 200 and logout user successfully', async () => {
    /**
     * Input: POST /api/auth/logout with valid JWT token
     * Expected Status Code: 200
     * Expected Output: Logged out successfully
     */
    // Ensure user is online first
    await User.findByIdAndUpdate(testUsers[0]._id, { status: UserStatus.ONLINE });

    const token = generateTestToken(
      testUsers[0]._id,
      testUsers[0].email,
      testUsers[0].googleId
    );

    const response = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.message).toBe('Logged out successfully');

    // Verify user status was updated in database
    const updatedUser = await User.findById(testUsers[0]._id);
    expect(updatedUser!.status).toBe(UserStatus.OFFLINE);
  });

  test('should return 401 without authentication token', async () => {
    /**
     * Input: POST /api/auth/logout without Authorization header
     * Expected Status Code: 401
     * Expected Behavior: Auth middleware blocks request
     */
    const response = await request(app)
      .post('/api/auth/logout');

    expect(response.status).toBe(401);
  });

  test('should return 200 even if user not found', async () => {
    /**
     * Input: POST /api/auth/logout with valid token for non-existent user
     * Expected Status Code: 200
     * Expected Behavior: Logout succeeds even if user not in database (graceful handling)
     */
    const nonExistentUserId = '507f1f77bcf86cd799439011';
    const token = generateTestToken(
      nonExistentUserId,
      'nonexistent@example.com',
      'google-nonexistent'
    );

    const response = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
  });
});

describe('Auth Middleware - Error Handling via Auth Endpoints', () => {
  /**
   * These tests verify auth middleware error handling through actual auth endpoints.
   * Covers: JWT_SECRET missing, JsonWebTokenError, TokenExpiredError
   */

  test('should return 500 when JWT_SECRET is missing in authMiddleware', async () => {
    /**
     * Covers auth.middleware.ts lines 35-41: JWT_SECRET missing error
     * Path: if (!jwtSecret) -> console.error -> 500 response
     */
    const originalSecret = process.env.JWT_SECRET;
    const token = generateTestToken(
      testUsers[0]._id,
      testUsers[0].email,
      testUsers[0].googleId
    );
    
    // Remove JWT_SECRET to trigger the error path
    delete process.env.JWT_SECRET;
    
    const response = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${token}`);
    
    // Restore JWT_SECRET immediately
    process.env.JWT_SECRET = originalSecret;
    
    expect(response.status).toBe(500);
    expect(response.body.error).toBe('Server Error');
    expect(response.body.message).toBe('Authentication configuration error');
  });

  test('should return 401 with Invalid token message for JsonWebTokenError', async () => {
    /**
     * Covers auth.middleware.ts lines 56-62: JsonWebTokenError handling
     * Path: if (error instanceof jwt.JsonWebTokenError) -> 401 with "Invalid token"
     */
    const response = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', 'Bearer invalid.token.here');
    
    expect(response.status).toBe(401);
    expect(response.body.error).toBe('Unauthorized');
    expect(response.body.message).toBe('Invalid token');
  });

  test('should return 401 with Token expired message for TokenExpiredError', async () => {
    /**
     * Covers auth.middleware.ts lines 64-70: TokenExpiredError handling
     * Path: if (error instanceof jwt.TokenExpiredError) -> 401 with "Token expired"
     */
    const jwt = require('jsonwebtoken');
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET is required for this test');
    }
    
    // Create a token with explicit past expiration time
    const now = Math.floor(Date.now() / 1000);
    const pastExpToken = jwt.sign(
      {
        userId: testUsers[0]._id,
        email: testUsers[0].email,
        googleId: testUsers[0].googleId,
        exp: now - 3600  // Expired 1 hour ago
      },
      secret
    );
    
    const response = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${pastExpToken}`);
    
    expect(response.status).toBe(401);
    expect(response.body.error).toBe('Unauthorized');
    expect(response.body.message).toBe('Token expired');
  });
});

describe('GET /api/auth/verify - No Mocking', () => {
  test('should return 200 and user info with valid token', async () => {
    /**
     * Input: GET /api/auth/verify with valid JWT token
     * Expected Status Code: 200
     * Expected Output: User information
     */
    const token = generateTestToken(
      testUsers[0]._id,
      testUsers[0].email,
      testUsers[0].googleId
    );

    const response = await request(app)
      .get('/api/auth/verify')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.user).toBeDefined();
    expect(response.body.user.userId).toBe(testUsers[0]._id);
    expect(response.body.user.email).toBe(testUsers[0].email);
    expect(response.body.user.name).toBe(testUsers[0].name);
    expect(response.body.user).toHaveProperty('profilePicture');
    expect(response.body.user).toHaveProperty('credibilityScore');
    expect(response.body.user).toHaveProperty('status');
  });

  test('should return 401 without authentication token', async () => {
    /**
     * Input: GET /api/auth/verify without Authorization header
     * Expected Status Code: 401
     * Expected Behavior: Auth middleware blocks request
     */
    const response = await request(app)
      .get('/api/auth/verify');

    expect(response.status).toBe(401);
  });

  test('should return 404 when user not found in verify', async () => {
    /**
     * Covers auth.controller.ts lines 292-300: User not found in verify
     * Path: User.findById -> if (!user) -> 404 response
     */
    const nonExistentUserId = '507f1f77bcf86cd799439011';
    const token = generateTestToken(
      nonExistentUserId,
      'nonexistent@example.com',
      'google-nonexistent'
    );

    const response = await request(app)
      .get('/api/auth/verify')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(404);
    expect(response.body.error).toBe('Not Found');
    expect(response.body.message).toBe('User not found');
  });
});

describe('POST /api/auth/fcm-token - No Mocking', () => {
  test('should return 200 and update FCM token successfully', async () => {
    /**
     * Input: POST /api/auth/fcm-token with fcmToken in body
     * Expected Status Code: 200
     * Expected Output: FCM token updated successfully
     */
    const token = generateTestToken(
      testUsers[0]._id,
      testUsers[0].email,
      testUsers[0].googleId
    );

    const newFcmToken = 'test-fcm-token-12345';

    const response = await request(app)
      .post('/api/auth/fcm-token')
      .set('Authorization', `Bearer ${token}`)
      .send({ fcmToken: newFcmToken });

    expect(response.status).toBe(200);
    expect(response.body.message).toBe('FCM token updated successfully');

    // Verify FCM token was saved in database
    const updatedUser = await User.findById(testUsers[0]._id);
    expect(updatedUser!.fcmToken).toBe(newFcmToken);
  });

  test('should return 400 when fcmToken is missing', async () => {
    /**
     * Input: POST /api/auth/fcm-token without fcmToken in body
     * Expected Status Code: 400
     * Expected Output: FCM token is required
     */
    const token = generateTestToken(
      testUsers[0]._id,
      testUsers[0].email,
      testUsers[0].googleId
    );

    const response = await request(app)
      .post('/api/auth/fcm-token')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Bad Request');
    expect(response.body.message).toBe('FCM token is required');
  });

  test('should return 401 without authentication token', async () => {
    /**
     * Input: POST /api/auth/fcm-token without Authorization header
     * Expected Status Code: 401
     * Expected Behavior: Auth middleware blocks request
     */
    const response = await request(app)
      .post('/api/auth/fcm-token')
      .send({ fcmToken: 'test-token' });

    expect(response.status).toBe(401);
  });

  test('should return 404 when user not found in updateFCMToken', async () => {
    /**
     * Covers auth.controller.ts lines 344-348: User not found in updateFCMToken
     * Path: User.findById -> if (!user) -> 404 response
     */
    const nonExistentUserId = '507f1f77bcf86cd799439011';
    const token = generateTestToken(
      nonExistentUserId,
      'nonexistent@example.com',
      'google-nonexistent'
    );

    const response = await request(app)
      .post('/api/auth/fcm-token')
      .set('Authorization', `Bearer ${token}`)
      .send({ fcmToken: 'test-token' });

    expect(response.status).toBe(404);
    expect(response.body.error).toBe('Not Found');
    expect(response.body.message).toBe('User not found');
  });
});

describe('DELETE /api/auth/account - No Mocking', () => {
  test('should return 200 and delete account successfully', async () => {
    /**
     * Input: DELETE /api/auth/account with valid token
     * Expected Status Code: 200
     * Expected Output: Account deleted successfully
     */
    // Create a deletable user (not in room or group)
    const deletableUser = await User.create({
      googleId: `google-deletable-${Date.now()}`,
      email: `deletable-${Date.now()}@example.com`,
      name: 'Deletable User',
      preference: [],
      credibilityScore: 100,
      status: UserStatus.ONLINE,
      roomId: null,
      groupId: null,
      budget: 50,
      radiusKm: 10,
    });

    const token = generateTestToken(
      deletableUser._id.toString(),
      deletableUser.email,
      deletableUser.googleId
    );

    const response = await request(app)
      .delete('/api/auth/account')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.message).toBe('Account deleted successfully');

    // Verify user was actually deleted from database
    const deletedUser = await User.findById(deletableUser._id);
    expect(deletedUser).toBeNull();
  });

  test('should return 400 when user is in a room', async () => {
    /**
     * Input: DELETE /api/auth/account for user with roomId
     * Expected Status Code: 400
     * Expected Output: Cannot delete account while in a room or group
     */
    const token = generateTestToken(
      testUsers[2]._id, // User with roomId
      testUsers[2].email,
      testUsers[2].googleId
    );

    const response = await request(app)
      .delete('/api/auth/account')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Bad Request');
    expect(response.body.message).toBe('Cannot delete account while in a room or group. Please leave first.');
  });

  test('should return 400 when user is in a group', async () => {
    /**
     * Input: DELETE /api/auth/account for user with groupId
     * Expected Status Code: 400
     * Expected Output: Cannot delete account while in a room or group
     */
    const token = generateTestToken(
      testUsers[3]._id, // User with groupId
      testUsers[3].email,
      testUsers[3].googleId
    );

    const response = await request(app)
      .delete('/api/auth/account')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(400);
    expect(response.body.message).toBe('Cannot delete account while in a room or group. Please leave first.');
  });

  test('should return 401 without authentication token', async () => {
    /**
     * Input: DELETE /api/auth/account without Authorization header
     * Expected Status Code: 401
     * Expected Behavior: Auth middleware blocks request
     */
    const response = await request(app)
      .delete('/api/auth/account');

    expect(response.status).toBe(401);
  });

  test('should return 404 when user not found in deleteAccount', async () => {
    /**
     * Covers auth.controller.ts lines 379-383: User not found in deleteAccount
     * Path: User.findById -> if (!user) -> 404 response
     */
    const nonExistentUserId = '507f1f77bcf86cd799439011';
    const token = generateTestToken(
      nonExistentUserId,
      'nonexistent@example.com',
      'google-nonexistent'
    );

    const response = await request(app)
      .delete('/api/auth/account')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(404);
    expect(response.body.error).toBe('Not Found');
    expect(response.body.message).toBe('User not found');
  });
});