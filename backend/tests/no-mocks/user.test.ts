// tests/no-mocks/user.test.ts
import request from 'supertest';
import app from '../../src/app';
import { generateTestToken } from '../helpers/auth.helper';
import { generateExpiredToken } from '../helpers/auth.helper';
import { seedTestUsers, cleanTestData, TestUser, seedDeletableUser, getTestUserById } from '../helpers/seed.helper';
import { connectDatabase, disconnectDatabase } from '../../src/config/database';
import mongoose from 'mongoose';

/**
 * User Routes Tests - No Mocking (Controllable Scenarios)
 * 
 * This test suite covers CONTROLLABLE scenarios:
 * - Request validation (missing fields, invalid formats)
 * - Business logic (authorization, user not found)
 * - Real database operations
 * - Profile and settings updates
 * - User deletion with business constraints
 * 
 * Does NOT test:
 * - Database connection failures (uncontrollable) - tested in user.mock.test.ts
 * - Model hooks and virtuals directly - only through API responses
 */

let testUsers: TestUser[];

beforeAll(async () => {
  console.log('\n🚀 Starting User Tests (No Mocking)...\n');
  
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

// Interface: GET /api/user/profile/:ids
describe('GET /api/user/profile/:ids - No Mocking', () => {
  // Input: GET /api/user/profile/userId1,userId2 (valid MongoDB ObjectIds)
  // Expected status code: 200
  // Expected behavior: Query database for users, return profiles
  // Expected output: Array of user profiles with matching IDs
  test('should return 200 and user profiles for valid IDs', async () => {
    const userIds = `${testUsers[0]._id},${testUsers[1]._id}`;
    
    const response = await request(app)
      .get(`/api/user/profile/${userIds}`);

    expect(response.status).toBe(200);
    expect(response.body.Status).toBe(200);
    expect(Array.isArray(response.body.Body)).toBe(true);
    expect(response.body.Body).toHaveLength(2);
    
    // Verify we got the correct users
    const returnedIds = response.body.Body.map((u: any) => u.userId);
    expect(returnedIds).toContain(testUsers[0]._id);
    expect(returnedIds).toContain(testUsers[1]._id);
  });

  // Input: GET /api/user/profile/nonexistent-id (valid ObjectId format, doesn't exist)
  // Expected status code: 200
  // Expected behavior: Query database, find no users
  // Expected output: Empty array in Body
  test('should return 200 with empty array for non-existent IDs', async () => {
    // Valid ObjectId format but doesn't exist in database
    const nonExistentId = new mongoose.Types.ObjectId().toString();
    
    const response = await request(app)
      .get(`/api/user/profile/${nonExistentId}`);

    expect(response.status).toBe(200);
    expect(response.body.Status).toBe(200);
    expect(response.body.Body).toHaveLength(0);
  });

  // Input: GET /api/user/profile/userId (single ID) and /api/user/profile/id1,id2,id3,id4 (multiple IDs)
  // Expected status code: 200
  // Expected behavior: Parse comma-separated IDs, query database
  // Expected output: Arrays with 1 and 4 user profiles respectively
  test('should handle single and multiple IDs correctly', async () => {
    // Test single ID
    const singleResponse = await request(app)
      .get(`/api/user/profile/${testUsers[0]._id}`);

    expect(singleResponse.status).toBe(200);
    expect(singleResponse.body.Body).toHaveLength(1);
    expect(singleResponse.body.Body[0].userId).toBe(testUsers[0]._id.toString());

    // Test multiple IDs
    const userIds = testUsers.slice(0, 4).map(u => u._id).join(',');
    const multipleResponse = await request(app)
      .get(`/api/user/profile/${userIds}`);

    expect(multipleResponse.status).toBe(200);
    expect(multipleResponse.body.Body).toHaveLength(4);
  });

  // Input: GET /api/user/profile/invalid-id-format-123 (invalid MongoDB ObjectId format)
  // Expected status code: 400
  // Expected behavior: Mongoose throws CastError
  // Expected output: "Invalid data format" error message
  test('should return 400 for invalid MongoDB ObjectId format', async () => {
    const response = await request(app)
      .get('/api/user/profile/invalid-id-format-123');

    expect(response.status).toBe(400);
    expect(response.body.message).toBe('Invalid data format');
  });
});

// Interface: GET /api/user/settings
describe('GET /api/user/settings - No Mocking', () => {
  // Input: GET /api/user/settings with valid JWT token
  // Expected status code: 200
  // Expected behavior: Auth middleware verifies token, query database for user, return settings
  // Expected output: Complete user settings object
  test('should return 200 and user settings with valid authentication', async () => {
    const token = generateTestToken(
      testUsers[0]._id,
      testUsers[0].email,
      testUsers[0].googleId
    );

    const response = await request(app)
      .get('/api/user/settings')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.Status).toBe(200);
    expect(response.body.Body.userId).toBe(testUsers[0]._id);
    expect(response.body.Body.name).toBe('Test User 1');
    expect(response.body.Body.budget).toBe(50);
    expect(response.body.Body.radiusKm).toBe(10);
  });

  // Input: GET /api/user/settings without Authorization header
  // Expected status code: 401
  // Expected behavior: Auth middleware blocks request
  // Expected output: Unauthorized error
  test('should return 401 without authentication token', async () => {
    const response = await request(app)
      .get('/api/user/settings');

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty('error');
    expect(response.body.message).toMatch(/token|unauthorized/i);
  });

  // Input: GET /api/user/settings with invalid token format
  // Expected status code: 401
  // Expected behavior: Auth middleware detects invalid token
  // Expected output: "Invalid token" error message
  test('should return 401 with invalid token', async () => {
    const response = await request(app)
      .get('/api/user/settings')
      .set('Authorization', 'Bearer invalid-token-format');

    expect(response.status).toBe(401);
    expect(response.body.message).toMatch(/invalid/i);
  });

  // Input: GET /api/user/settings with expired JWT token
  // Expected status code: 401
  // Expected behavior: Auth middleware detects expired token
  // Expected output: "Token expired" or "Invalid" error message
  test('should return 401 with expired token', async () => {
    const expiredToken = generateExpiredToken(testUsers[0]._id);

    const response = await request(app)
      .get('/api/user/settings')
      .set('Authorization', `Bearer ${expiredToken}`);

    expect(response.status).toBe(401);
    expect(response.body.message).toMatch(/expired|invalid/i);
  });

  // Input: GET /api/user/settings with valid token for non-existent user
  // Expected status code: 500
  // Expected behavior: Auth succeeds, database query returns null, service throws error
  // Expected output: "User not found" error message
  test('should return 500 when user not found in database', async () => {
    // Create token for user that doesn't exist in database
    const nonExistentUserId = new mongoose.Types.ObjectId().toString();
    const token = generateTestToken(
      nonExistentUserId,
      'nonexistent@example.com',
      'google-nonexistent'
    );

    const response = await request(app)
      .get('/api/user/settings')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(500);
    expect(response.body.message).toBe('User not found');
  });
});

// Interface: POST /api/user/profile
describe('POST /api/user/profile - No Mocking', () => {
  // Input: POST /api/user/profile with updated name, bio, and contactNumber
  // Expected status code: 200
  // Expected behavior: Auth succeeds, find user, update fields, save to database
  // Expected output: Updated profile with new values
  test('should create/update profile with valid data', async () => {
    const token = generateTestToken(
      testUsers[0]._id,
      testUsers[0].email,
      testUsers[0].googleId
    );

    const updatedData = {
      name: 'Updated Test User 1',
      bio: 'Updated bio text',
      contactNumber: '9999999999'
    };

    const response = await request(app)
      .post('/api/user/profile')
      .set('Authorization', `Bearer ${token}`)
      .send(updatedData);

    expect(response.status).toBe(200);
    expect(response.body.Status).toBe(200);
    expect(response.body.Message.text).toBe('Profile updated successfully');
    expect(response.body.Body.name).toBe('Updated Test User 1');
    expect(response.body.Body.bio).toBe('Updated bio text');
    expect(response.body.Body.contactNumber).toBe('9999999999');
  });

  // Input: POST /api/user/profile with profilePicture URL (non-Google URL)
  // Expected status code: 200
  // Expected behavior: Update profile picture directly without Base64 conversion
  // Expected output: Profile with profilePicture set to original URL
  test('should update profilePicture directly in createUserProfile (covers userService line 101)', async () => {
    const token = generateTestToken(
      testUsers[1]._id,
      testUsers[1].email,
      testUsers[1].googleId
    );

    const profileData = {
      name: 'Profile Picture Test',
      profilePicture: 'https://example.com/custom-picture.jpg'
    };

    const response = await request(app)
      .post('/api/user/profile')
      .set('Authorization', `Bearer ${token}`)
      .send(profileData);

    expect(response.status).toBe(200);
    expect(response.body.Body.profilePicture).toBe('https://example.com/custom-picture.jpg');
    
    // Verify in database - should be stored as-is (no Base64 conversion)
    const User = (await import('../../src/models/User')).default;
    const updatedUser = await User.findById(testUsers[1]._id);
    expect(updatedUser!.profilePicture).toBe('https://example.com/custom-picture.jpg');
  });

  // Input: POST /api/user/profile with only name field
  // Expected status code: 200
  // Expected behavior: Update only provided fields, leave others unchanged
  // Expected output: Profile with updated name, original bio
  test('should handle partial updates correctly', async () => {
    const token = generateTestToken(
      testUsers[1]._id,
      testUsers[1].email,
      testUsers[1].googleId
    );

    // Store original bio
    const originalBio = testUsers[1].bio;

    const partialResponse = await request(app)
      .post('/api/user/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Only Name Changed' });

    expect(partialResponse.status).toBe(200);
    expect(partialResponse.body.Body.name).toBe('Only Name Changed');
    expect(partialResponse.body.Body.bio).toBe(originalBio);
  });

  // Input: POST /api/user/profile with empty body
  // Expected status code: 200
  // Expected behavior: No fields updated, profile remains unchanged
  // Expected output: Success response with unchanged profile
  test('should handle empty body', async () => {
    const token = generateTestToken(
      testUsers[1]._id,
      testUsers[1].email,
      testUsers[1].googleId
    );

    const emptyResponse = await request(app)
      .post('/api/user/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(emptyResponse.status).toBe(200);
  });
});

// Interface: POST /api/user/settings
describe('POST /api/user/settings - No Mocking', () => {
  // Input: POST /api/user/settings with all fields (name, bio, preference, budget, radiusKm)
  // Expected status code: 200
  // Expected behavior: Update all provided fields, save to database
  // Expected output: Updated settings with all new values
  test('should update settings with full data', async () => {
    const token = generateTestToken(
      testUsers[1]._id,
      testUsers[1].email,
      testUsers[1].googleId
    );

    const fullSettings = {
      name: 'Settings Updated Name',
      bio: 'Settings updated bio',
      preference: ['vegetarian', 'italian', 'mexican'],
      budget: 100,
      radiusKm: 25
    };

    const fullResponse = await request(app)
      .post('/api/user/settings')
      .set('Authorization', `Bearer ${token}`)
      .send(fullSettings);

    expect(fullResponse.status).toBe(200);
    expect(fullResponse.body.Status).toBe(200);
    expect(fullResponse.body.Message.text).toBe('Settings updated successfully');
    expect(fullResponse.body.Body.name).toBe('Settings Updated Name');
    expect(fullResponse.body.Body.budget).toBe(100);
    expect(fullResponse.body.Body.radiusKm).toBe(25);
  });

  // Input: POST /api/user/settings with partial fields (budget, radiusKm)
  // Expected status code: 200
  // Expected behavior: Update only provided fields
  // Expected output: Settings with updated budget and radiusKm
  test('should update settings with partial data', async () => {
    const token = generateTestToken(
      testUsers[1]._id,
      testUsers[1].email,
      testUsers[1].googleId
    );

    const partialSettings = {
      budget: 150,
      radiusKm: 30
    };

    const partialResponse = await request(app)
      .post('/api/user/settings')
      .set('Authorization', `Bearer ${token}`)
      .send(partialSettings);

    expect(partialResponse.status).toBe(200);
    expect(partialResponse.body.Body.budget).toBe(150);
    expect(partialResponse.body.Body.radiusKm).toBe(30);
  });

  // Input: POST /api/user/settings with contactNumber, budget, and radiusKm
  // Expected status code: 200
  // Expected behavior: Update contactNumber, budget, radiusKm fields
  // Expected output: Settings with updated values, verified in database
  test('should update contactNumber, budget, and radiusKm in updateUserSettings (covers userService lines 149-151)', async () => {
    const token = generateTestToken(
      testUsers[2]._id,
      testUsers[2].email,
      testUsers[2].googleId
    );

    const settingsUpdate = {
      contactNumber: '1234567890',
      budget: 75,
      radiusKm: 15
    };

    const response = await request(app)
      .post('/api/user/settings')
      .set('Authorization', `Bearer ${token}`)
      .send(settingsUpdate);

    expect(response.status).toBe(200);
    expect(response.body.Body.contactNumber).toBe('1234567890');
    expect(response.body.Body.budget).toBe(75);
    expect(response.body.Body.radiusKm).toBe(15);
    
    // Verify in database
    const User = (await import('../../src/models/User')).default;
    const updatedUser = await User.findById(testUsers[2]._id);
    expect(updatedUser!.contactNumber).toBe('1234567890');
    expect(updatedUser!.budget).toBe(75);
    expect(updatedUser!.radiusKm).toBe(15);
  });

  // Input: POST /api/user/settings with Google profile picture URL
  // Expected status code: 200
  // Expected behavior: Fetch image from Google, convert to Base64, save as data URI
  // Expected output: Profile picture stored as Base64 data URI in database
  test('should successfully convert Google profile picture to Base64 in updateUserSettings (covers userService lines 22-29)', async () => {
    const token = generateTestToken(
      testUsers[1]._id,
      testUsers[1].email,
      testUsers[1].googleId
    );

    const axios = require('axios');
    
    // Mock axios to return a successful image response
    const mockImageBuffer = Buffer.from('fake-image-data-for-settings-test');
    jest.spyOn(axios, 'get').mockResolvedValueOnce({
      data: mockImageBuffer,
      headers: { 'content-type': 'image/png' }
    });

    const googleProfilePictureUrl = 'https://lh3.googleusercontent.com/test-settings-picture.jpg';

    const response = await request(app)
      .post('/api/user/settings')
      .set('Authorization', `Bearer ${token}`)
      .send({ profilePicture: googleProfilePictureUrl });

    jest.restoreAllMocks();

    expect(response.status).toBe(200);
    
    // Verify profile picture was converted to Base64 data URI
    const User = (await import('../../src/models/User')).default;
    const updatedUser = await User.findById(testUsers[1]._id);
    expect(updatedUser!.profilePicture).toBeTruthy();
    expect(updatedUser!.profilePicture).toContain('data:image/png;base64,');
    expect(updatedUser!.profilePicture).not.toBe(googleProfilePictureUrl);
  });

  // Input: POST /api/user/settings with Google URL, but axios response has no content-type header
  // Expected status code: 200
  // Expected behavior: Use 'image/png' as fallback content-type
  // Expected output: Profile picture converted with fallback content-type 'image/png'
  test('should use image/png fallback when content-type header is missing (covers userService line 24)', async () => {
    const token = generateTestToken(
      testUsers[2]._id,
      testUsers[2].email,
      testUsers[2].googleId
    );

    const axios = require('axios');
    
    // Mock axios to return response without content-type header
    const mockImageBuffer = Buffer.from('fake-image-data-no-content-type');
    jest.spyOn(axios, 'get').mockResolvedValueOnce({
      data: mockImageBuffer,
      headers: {} // No content-type header
    });

    const googleProfilePictureUrl = 'https://lh3.googleusercontent.com/test-no-content-type.jpg';

    const response = await request(app)
      .post('/api/user/settings')
      .set('Authorization', `Bearer ${token}`)
      .send({ profilePicture: googleProfilePictureUrl });

    jest.restoreAllMocks();

    expect(response.status).toBe(200);
    
    // Verify profile picture was converted with fallback content-type
    const User = (await import('../../src/models/User')).default;
    const updatedUser = await User.findById(testUsers[2]._id);
    expect(updatedUser!.profilePicture).toBeTruthy();
    expect(updatedUser!.profilePicture).toContain('data:image/png;base64,');
  });
});

// Interface: PUT /api/user/profile
describe('PUT /api/user/profile - No Mocking', () => {
  // Input: PUT /api/user/profile with all fields (name, bio, preference)
  // Expected status code: 200
  // Expected behavior: Update all provided fields
  // Expected output: Updated profile with all new values
  test('should update profile with full data', async () => {
    const token = generateTestToken(
      testUsers[0]._id,
      testUsers[0].email,
      testUsers[0].googleId
    );

    const fullUpdate = {
      name: 'PUT Updated Name',
      bio: 'PUT updated bio',
      preference: ['thai', 'korean']
    };

    const fullResponse = await request(app)
      .put('/api/user/profile')
      .set('Authorization', `Bearer ${token}`)
      .send(fullUpdate);

    expect(fullResponse.status).toBe(200);
    expect(fullResponse.body.Status).toBe(200);
    expect(fullResponse.body.Message.text).toBe('Profile updated successfully');
    expect(fullResponse.body.Body.name).toBe('PUT Updated Name');
  });

  // Input: PUT /api/user/profile with partial field (bio only)
  // Expected status code: 200
  // Expected behavior: Update only bio field
  // Expected output: Profile with updated bio
  test('should update profile with partial data', async () => {
    const token = generateTestToken(
      testUsers[0]._id,
      testUsers[0].email,
      testUsers[0].googleId
    );

    const partialUpdate = {
      bio: 'Just bio update via PUT'
    };

    const partialResponse = await request(app)
      .put('/api/user/profile')
      .set('Authorization', `Bearer ${token}`)
      .send(partialUpdate);

    expect(partialResponse.status).toBe(200);
    expect(partialResponse.body.Body.bio).toBe('Just bio update via PUT');
  });

  // Input: PUT /api/user/profile with contactNumber, budget, and radiusKm
  // Expected status code: 200
  // Expected behavior: Update contactNumber, budget, radiusKm fields
  // Expected output: Profile with updated values, verified in database
  test('should update contactNumber, budget, and radiusKm in updateUserProfile (covers userService lines 188-190)', async () => {
    const token = generateTestToken(
      testUsers[3]._id,
      testUsers[3].email,
      testUsers[3].googleId
    );

    const profileUpdate = {
      contactNumber: '9876543210',
      budget: 125,
      radiusKm: 20
    };

    const response = await request(app)
      .put('/api/user/profile')
      .set('Authorization', `Bearer ${token}`)
      .send(profileUpdate);

    expect(response.status).toBe(200);
    expect(response.body.Body.contactNumber).toBe('9876543210');
    
    // Verify in database
    const User = (await import('../../src/models/User')).default;
    const updatedUser = await User.findById(testUsers[3]._id);
    expect(updatedUser!.contactNumber).toBe('9876543210');
    expect(updatedUser!.budget).toBe(125);
    expect(updatedUser!.radiusKm).toBe(20);
  });

  // Input: PUT /api/user/profile with Google profile picture URL
  // Expected status code: 200
  // Expected behavior: Fetch image from Google, convert to Base64, save as data URI
  // Expected output: Profile picture stored as Base64 data URI
  test('should successfully convert Google profile picture to Base64 (covers userService lines 22-29)', async () => {
    const token = generateTestToken(
      testUsers[0]._id,
      testUsers[0].email,
      testUsers[0].googleId
    );

    const axios = require('axios');
    
    // Mock axios to return a successful image response
    const mockImageBuffer = Buffer.from('fake-image-data-for-testing');
    jest.spyOn(axios, 'get').mockResolvedValueOnce({
      data: mockImageBuffer,
      headers: { 'content-type': 'image/jpeg' }
    });

    const googleProfilePictureUrl = 'https://lh3.googleusercontent.com/test-picture.jpg';

    const response = await request(app)
      .put('/api/user/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ profilePicture: googleProfilePictureUrl });

    jest.restoreAllMocks();

    expect(response.status).toBe(200);
    
    // Verify profile picture was converted to Base64 data URI
    const User = (await import('../../src/models/User')).default;
    const updatedUser = await User.findById(testUsers[0]._id);
    expect(updatedUser!.profilePicture).toBeTruthy();
    expect(updatedUser!.profilePicture).toContain('data:image/jpeg;base64,');
    expect(updatedUser!.profilePicture).not.toBe(googleProfilePictureUrl);
  });

  // Input: PUT /api/user/profile with non-Google profile picture URL
  // Expected status code: 200
  // Expected behavior: Store URL as-is without conversion
  // Expected output: Profile picture remains as original URL
  test('should handle non-Google profile picture URL (covers convertGoogleProfilePictureToBase64 early return)', async () => {
    const token = generateTestToken(
      testUsers[0]._id,
      testUsers[0].email,
      testUsers[0].googleId
    );

    const nonGoogleUrl = 'https://example.com/profile.jpg';
    const response = await request(app)
      .put('/api/user/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ profilePicture: nonGoogleUrl });

    expect(response.status).toBe(200);
    expect(response.body.Body.profilePicture).toBe(nonGoogleUrl);
    
    // Verify in database
    const User = (await import('../../src/models/User')).default;
    const updatedUser = await User.findById(testUsers[0]._id);
    expect(updatedUser!.profilePicture).toBe(nonGoogleUrl);
  });
});

// Interface: DELETE /api/user/:userId
describe('DELETE /api/user/:userId - No Mocking', () => {
  // Input: DELETE /api/user/otherUserId with token for different user
  // Expected status code: 403
  // Expected behavior: Auth succeeds, but userId doesn't match token userId
  // Expected output: Forbidden error
  test('should return 403 when trying to delete different user', async () => {
    const token = generateTestToken(
      testUsers[0]._id,
      testUsers[0].email,
      testUsers[0].googleId
    );

    const response = await request(app)
      .delete(`/api/user/${testUsers[1]._id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(403);
    expect(response.body.Status).toBe(403);
    expect(response.body.Message.error).toBe('Forbidden');
    expect(response.body.Body).toBeNull();
  });

  // Input: DELETE /api/user/userId for user with roomId set
  // Expected status code: 500
  // Expected behavior: Find user with roomId, service throws error
  // Expected output: "Cannot delete account while in a room or group" error
  test('should return 500 when user is in a waiting room', async () => {
    // testUsers[2] has roomId = 'test-room-123'
    const token = generateTestToken(
      testUsers[2]._id,
      testUsers[2].email,
      testUsers[2].googleId
    );

    const response = await request(app)
      .delete(`/api/user/${testUsers[2]._id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(500);
    expect(response.body.message).toBe('Cannot delete account while in a room or group');
  });

  // Input: DELETE /api/user/userId for user with groupId set
  // Expected status code: 500
  // Expected behavior: Find user with groupId, service throws error
  // Expected output: "Cannot delete account while in a room or group" error
  test('should return 500 when user is in a group', async () => {
    // testUsers[3] has groupId = 'test-group-456'
    const token = generateTestToken(
      testUsers[3]._id,
      testUsers[3].email,
      testUsers[3].googleId
    );

    const response = await request(app)
      .delete(`/api/user/${testUsers[3]._id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(500);
    expect(response.body.message).toBe('Cannot delete account while in a room or group');
  });

  // Input: DELETE /api/user/userId for user without roomId or groupId
  // Expected status code: 200
  // Expected behavior: Find user, verify no constraints, delete from database
  // Expected output: Success message with deleted: true, user removed from database
  test('should successfully delete user not in room or group', async () => {
    // Create a fresh deletable user
    const deletableUser = await seedDeletableUser();
    
    const token = generateTestToken(
      deletableUser._id,
      deletableUser.email,
      deletableUser.googleId
    );

    const response = await request(app)
      .delete(`/api/user/${deletableUser._id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.Status).toBe(200);
    expect(response.body.Message.text).toBe('User deleted successfully');
    expect(response.body.Body.deleted).toBe(true);

    // Verify user was actually deleted from database
    const deletedUser = await getTestUserById(deletableUser._id);
    expect(deletedUser).toBeNull();
  });

  // Input: DELETE /api/user/nonexistentId with matching token
  // Expected status code: 500
  // Expected behavior: Auth succeeds, try to find user, user doesn't exist
  // Expected output: "User not found" error
  test('should return 500 when trying to delete non-existent user', async () => {
    const nonExistentId = new mongoose.Types.ObjectId().toString();
    const token = generateTestToken(
      nonExistentId,
      'nonexistent@example.com',
      'google-nonexistent'
    );

    const response = await request(app)
      .delete(`/api/user/${nonExistentId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(500);
    expect(response.body.message).toBe('User not found');
  });
});

// Interface: User Model Virtual Properties (tested through API)
describe('User Model Virtual Properties - API Tests', () => {
  // Input: GET /api/user/profile/userId
  // Expected status code: 200
  // Expected behavior: Query database, User model applies toJSON transform
  // Expected output: User object with userId virtual property included
  test('should access userId virtual property through API response', async () => {
    const token = generateTestToken(
      testUsers[0]._id,
      testUsers[0].email,
      testUsers[0].googleId
    );
    
    const response = await request(app)
      .get(`/api/user/profile/${testUsers[0]._id}`)
      .set('Authorization', `Bearer ${token}`);
    
    expect(response.status).toBe(200);
    expect(response.body.Body[0]).toHaveProperty('userId');
    expect(response.body.Body[0].userId).toBe(testUsers[0]._id);
  });

  // Input: GET /api/user/profile/userId
  // Expected status code: 200
  // Expected behavior: User model toJSON transform removes _id and __v, adds userId
  // Expected output: User object with userId, without _id or __v
  test('should use toJSON transform to include userId and exclude _id and __v', async () => {
    const response = await request(app)
      .get(`/api/user/profile/${testUsers[0]._id}`);
    
    expect(response.status).toBe(200);
    expect(response.body.Body[0]).toHaveProperty('userId');
    expect(response.body.Body[0].userId).toBe(testUsers[0]._id);
    expect(response.body.Body[0]).not.toHaveProperty('_id');
    expect(response.body.Body[0]).not.toHaveProperty('__v');
  });
});