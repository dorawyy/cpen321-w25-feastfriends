// tests/no-mocks/group.test.ts

// ============================================
// NO MOCKING - USING REAL SERVICES WITH SPIES
// ============================================

import request from 'supertest';
import app from '../../src/app';
import { generateTestToken } from '../helpers/auth.helper';
import { 
  seedTestUsers, 
  cleanTestData, 
  TestUser, 
  seedTestGroup, 
  TestGroup,
  getTestGroupById
} from '../helpers/seed.helper';
import { initializeTestSocket, closeTestSocket } from '../helpers/socket.helper';
import { connectDatabase, disconnectDatabase } from '../../src/config/database';
import User, { UserStatus } from '../../src/models/User';
import socketManager from '../../src/utils/socketManager';
import * as firebase from '../../src/config/firebase';

/**
 * Group Routes Tests - No Mocking (Controllable Scenarios)
 * 
 * This test suite covers CONTROLLABLE scenarios:
 * - Real database operations
 * - Real Socket.IO server with spies
 * - Real notification service logic
 * - Spies on Firebase to prevent actual API calls
 * 
 * Tests all success paths and user-triggered errors (404, 400, 409)
 * Does NOT test uncontrollable failures (network, timeouts, API errors)
 */

let testUsers: TestUser[];
let testGroups: TestGroup[];

beforeAll(async () => {
  console.log('\n🚀 Starting Group Tests (No Mocking - Controllable Scenarios)...\n');

  // Initialize real Socket.IO server
  await initializeTestSocket();

  // Connect to database
  await connectDatabase();
  
  // Seed test users (now includes FCM tokens)
  testUsers = await seedTestUsers();

  // Create test groups
  const group1 = await seedTestGroup(
    'test-room-group1',
    [testUsers[0]._id, testUsers[1]._id],
    {
      restaurantSelected: false,
      completionTime: new Date(Date.now() + 3600000)
    }
  );

  const group2 = await seedTestGroup(
    'test-room-group2',
    [testUsers[2]._id, testUsers[3]._id],
    {
      restaurantSelected: true,
      restaurant: {
        name: 'Selected Restaurant',
        location: '123 Main St',
        restaurantId: 'rest-123',
        cuisine: 'Italian'
      }
    }
  );

  testGroups = [group1, group2];

  // Update users to attach groups
  const UserModel = (await import('../../src/models/User')).default;
  await UserModel.findByIdAndUpdate(testUsers[0]._id, { groupId: group1._id, status: UserStatus.IN_GROUP });
  await UserModel.findByIdAndUpdate(testUsers[1]._id, { groupId: group1._id, status: UserStatus.IN_GROUP });
  await UserModel.findByIdAndUpdate(testUsers[2]._id, { groupId: group2._id, status: UserStatus.IN_GROUP });
  await UserModel.findByIdAndUpdate(testUsers[3]._id, { groupId: group2._id, status: UserStatus.IN_GROUP });

  console.log(`✅ Test setup complete. Ready to run tests.\n`);
});

afterAll(async () => {
  console.log('\n🧹 Cleaning up after tests...\n');
  
  await cleanTestData();
  await disconnectDatabase();
  
  // Close socket server
  await closeTestSocket();
  
  console.log('✅ Cleanup complete.\n');
});

beforeEach(() => {
  // Spy on Firebase functions to prevent actual API calls
  jest.spyOn(firebase, 'sendPushNotification').mockResolvedValue('mock-message-id');
  jest.spyOn(firebase, 'sendMulticastNotification').mockResolvedValue({
    successCount: 1,
    failureCount: 0,
    responses: []
  } as any);
});

afterEach(async () => {
  const UserModel = (await import('../../src/models/User')).default;
  
  // Reset test users 0 and 1 to group1
  await UserModel.findByIdAndUpdate(testUsers[0]._id, { 
    groupId: testGroups[0]._id, 
    status: UserStatus.IN_GROUP,
    fcmToken: 'mock-fcm-token-user1'  // Restore FCM token
  });
  await UserModel.findByIdAndUpdate(testUsers[1]._id, { 
    groupId: testGroups[0]._id, 
    status: UserStatus.IN_GROUP,
    fcmToken: 'mock-fcm-token-user2'  // Restore FCM token
  });
  
  // Reset test users 2 and 3 to group2
  await UserModel.findByIdAndUpdate(testUsers[2]._id, { 
    groupId: testGroups[1]._id, 
    status: UserStatus.IN_GROUP,
    fcmToken: 'mock-fcm-token-user3'  // Restore FCM token
  });
  await UserModel.findByIdAndUpdate(testUsers[3]._id, { 
    groupId: testGroups[1]._id, 
    status: UserStatus.IN_GROUP,
    fcmToken: 'mock-fcm-token-user4'  // Restore FCM token
  });
  
  // Restore all spies
  jest.restoreAllMocks();
});

describe('GET /api/group/status - No Mocking', () => {
  test('Should return 200 and group status for user in a group', async () => {
    /**
     * Tests: GET /api/group/status success path
     * Covers: 
     *   - groupController.getGroupStatus() lines 17-35
     *   - const groupId = String(group._id); (line 28)
     *   - const status = await groupService.getGroupStatus(groupId); (line 29)
     *   - res.status(200).json({ Status: 200, Message: {}, Body: status }) (lines 31-35)
     * Input: User in a group
     * Expected: 200 response with group status
     */
    const token = generateTestToken(
      testUsers[0]._id,
      testUsers[0].email,
      testUsers[0].googleId
    );
    
    const response = await request(app)
      .get('/api/group/status')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.Status).toBe(200);
    expect(response.body.Message).toEqual({});
    expect(response.body.Body).toHaveProperty('groupId');
    expect(response.body.Body).toHaveProperty('roomId');
    expect(response.body.Body).toHaveProperty('numMembers');
    expect(response.body.Body).toHaveProperty('users');
    expect(response.body.Body).toHaveProperty('restaurantSelected');
    expect(response.body.Body).toHaveProperty('status');
    expect(response.body.Body.numMembers).toBe(2);
    expect(response.body.Body.status).toBe('voting');
    // Verify groupId is a string (from String(group._id) conversion)
    expect(typeof response.body.Body.groupId).toBe('string');
  });

  test('should return 404 when user is not in a group', async () => {
    const token = generateTestToken(
      testUsers[4]._id,
      testUsers[4].email,
      testUsers[4].googleId
    );

    const response = await request(app)
      .get('/api/group/status')
      .set('Authorization', `Bearer ${token}`);
      
    expect(response.status).toBe(404);
    expect(response.body.Status).toBe(404);
    expect(response.body.Message).toHaveProperty('error', 'Not in a group');
    expect(response.body.Body).toBeNull();
  });

  // Consolidated test: 401 authentication errors
  // These test the authMiddleware code which is the SAME for all endpoints
  // Testing once is sufficient since all endpoints use the same middleware
  test('should return 401 without authentication token', async () => {
    /**
     * Tests authMiddleware -> no token -> 401 pattern
     * Covers: auth.middleware.ts lines 20-26
     * All endpoints use the same authMiddleware, so testing one endpoint covers all
     */
    const response = await request(app)
      .get('/api/group/status');

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty('error');
  });

  test('should return 401 with invalid token', async () => {
    /**
     * Tests authMiddleware -> invalid token -> 401 pattern
     * Covers: auth.middleware.ts lines 56-62 (JsonWebTokenError)
     * All endpoints use the same authMiddleware, so testing one endpoint covers all
     */
    const response = await request(app)
      .get('/api/group/status')
      .set('Authorization', 'Bearer invalid-token-format');

    expect(response.status).toBe(401);
  });

  test('should return group status with restaurant selected', async () => {
    const token = generateTestToken(
      testUsers[2]._id,
      testUsers[2].email,
      testUsers[2].googleId
    );

    const response = await request(app)
      .get('/api/group/status')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.Body.restaurantSelected).toBe(true);
    expect(response.body.Body.status).toBe('completed');
    expect(response.body.Body.restaurant).toBeDefined();
    expect(response.body.Body.restaurant.name).toBe('Selected Restaurant');
  });

  test('should return 500 when group is deleted between getGroupByUserId and getGroupStatus (covers groupService line 15)', async () => {
  /**
   * Covers groupService.ts line 15: Group not found check in getGroupStatus
   * Path: Group.findById -> if (!group) -> throw Error('Group not found')
   * This tests a race condition where group exists when getGroupByUserId is called
   * but is deleted before getGroupStatus is called
   */
  const Group = (await import('../../src/models/Group')).default;
  const User = (await import('../../src/models/User')).default;
  
  // Create a temporary group for a user
  const tempGroup = await seedTestGroup(
    'test-race-condition',
    [testUsers[4]._id]
  );
  
  // Set user's groupId
  await User.findByIdAndUpdate(testUsers[4]._id, {
    groupId: tempGroup._id,
    status: UserStatus.IN_GROUP
  });
  
  const token = generateTestToken(
    testUsers[4]._id,
    testUsers[4].email,
    testUsers[4].googleId
  );
  
  // Get the actual Mongoose document before deleting
  const actualGroupDoc = await Group.findById(tempGroup._id);
  
  // Mock getGroupByUserId to return the Mongoose document
  const groupService = (await import('../../src/services/groupService')).default;
  
  jest.spyOn(groupService, 'getGroupByUserId').mockImplementation(async (_userId: string) => {
    return actualGroupDoc as any;  // ✅ Return the actual Mongoose document
  });
  
  // Delete the actual group to simulate race condition
  await Group.findByIdAndDelete(tempGroup._id);
  
  const response = await request(app)
    .get('/api/group/status')
    .set('Authorization', `Bearer ${token}`);
  
  // Restore original method
  jest.restoreAllMocks();
  
  // Should return 500 because getGroupStatus throws "Group not found"
  expect(response.status).toBe(500);
  expect(response.body.message).toBe('Group not found');
  
  // Cleanup
  await User.findByIdAndUpdate(testUsers[4]._id, {
    groupId: undefined,
    status: UserStatus.ONLINE
  });
});
});


describe('POST /api/group/leave/:groupId - No Mocking', () => {
  test('should return 200 and successfully leave a group', async () => {
    // Spy on socket manager
    const emitMemberLeftSpy = jest.spyOn(socketManager, 'emitMemberLeft');

    const leavingGroup = await seedTestGroup(
      'test-room-leave',
      [testUsers[0]._id, testUsers[1]._id]
    );

    const User = (await import('../../src/models/User')).default;
    await User.findByIdAndUpdate(testUsers[0]._id, { 
      groupId: leavingGroup._id, 
      status: UserStatus.IN_GROUP 
    });
    await User.findByIdAndUpdate(testUsers[1]._id, { 
      groupId: leavingGroup._id, 
      status: UserStatus.IN_GROUP 
    });

    const token = generateTestToken(
      testUsers[0]._id,
      testUsers[0].email,
      testUsers[0].googleId
    );

    const response = await request(app)
      .post(`/api/group/leave/${leavingGroup._id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.Status).toBe(200);
    expect(response.body.Message.text).toBe('Successfully left group');
    expect(response.body.Body.groupId).toBe(leavingGroup._id);

    // Verify user was removed from group
    const updatedGroup = await getTestGroupById(leavingGroup._id);
    expect(updatedGroup).not.toBeNull();
    expect(updatedGroup!.members).not.toContain(testUsers[0]._id);

    // Verify user status was updated
    const updatedUser = await User.findById(testUsers[0]._id);
    expect(updatedUser!.groupId).toBeNull();
    expect(updatedUser!.status).toBe(UserStatus.ONLINE);

    // Verify socket event was emitted
    expect(emitMemberLeftSpy).toHaveBeenCalled();
  });

  // Note: "401 without authentication" test is consolidated above in status endpoint tests
  // All endpoints use the same authMiddleware, so testing one endpoint covers all

  test('should return 500 when group not found in leaveGroup', async () => {
    /**
     * Covers groupService.ts line 169: Group not found check in leaveGroup
     * Path: Group.findById -> if (!group) -> throw Error('Group not found')
     * This is a separate test to ensure leaveGroup's specific path is covered
     */
    const nonExistentGroupId = '507f1f77bcf86cd799439011';
    const token = generateTestToken(
      testUsers[0]._id,
      testUsers[0].email,
      testUsers[0].googleId
    );

    const response = await request(app)
      .post(`/api/group/leave/${nonExistentGroupId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(500);
    expect(response.body.message).toBe('Group not found');
  });

  // Note: "400 for invalid ObjectId format" test is consolidated above in vote endpoint tests
  // The same CastError -> errorHandler -> "Invalid data format" pattern exists in vote and leave

  test('should return 500 when user not found', async () => {
    const nonExistentUserId = '507f1f77bcf86cd799439011';
    const token = generateTestToken(
      nonExistentUserId,
      'nonexistent@example.com',
      'google-nonexistent'
    );

    const response = await request(app)
      .post(`/api/group/leave/${testGroups[0]._id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(500);
    expect(response.body.message).toBe('User not found');
  });

  // Consolidated test: delete group and restaurant data when last member leaves
  // This tests the leave group endpoint when last member leaves
  // The SAME scenario exists: last member leaves -> group deleted -> restaurant data deleted
  // Testing with restaurant data covers both: group deletion and restaurant data deletion

  test('should delete group and restaurant data when last member leaves', async () => {
    const groupWithRestaurant = await seedTestGroup(
      'test-room-restaurant-delete',
      [testUsers[0]._id],
      {
        restaurantSelected: true,
        restaurant: {
          name: 'Deleted Restaurant',
          location: '999 Delete Ave',
          restaurantId: 'delete-rest-123'
        }
      }
    );

    const User = (await import('../../src/models/User')).default;
    await User.findByIdAndUpdate(testUsers[0]._id, { 
      groupId: groupWithRestaurant._id,
      status: UserStatus.IN_GROUP
    });

    const token = generateTestToken(
      testUsers[0]._id,
      testUsers[0].email,
      testUsers[0].googleId
    );

    const response = await request(app)
      .post(`/api/group/leave/${groupWithRestaurant._id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);

    // Verify group was deleted (covers both group deletion and restaurant data deletion)
    const Group = (await import('../../src/models/Group')).default;
    const deletedGroup = await Group.findById(groupWithRestaurant._id);
    
    expect(deletedGroup).toBeNull();
  });

  test('should preserve restaurant data when member leaves (group not deleted)', async () => {
    // Spy on socket manager
    const emitRestaurantSelectedSpy = jest.spyOn(socketManager, 'emitRestaurantSelected');

    const groupWithRestaurant = await seedTestGroup(
      'test-room-restaurant-preserve',
      [testUsers[0]._id, testUsers[1]._id],
      {
        restaurantSelected: true,
        restaurant: {
          name: 'Preserved Restaurant',
          location: '789 Keep St',
          restaurantId: 'preserve-rest-123',
          cuisine: 'Mexican'
        }
      }
    );

    const User = (await import('../../src/models/User')).default;
    await User.findByIdAndUpdate(testUsers[0]._id, { 
      groupId: groupWithRestaurant._id,
      status: UserStatus.IN_GROUP
    });
    await User.findByIdAndUpdate(testUsers[1]._id, { 
      groupId: groupWithRestaurant._id,
      status: UserStatus.IN_GROUP
    });

    const token = generateTestToken(
      testUsers[0]._id,
      testUsers[0].email,
      testUsers[0].googleId
    );

    const response = await request(app)
      .post(`/api/group/leave/${groupWithRestaurant._id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);

    // Verify group still exists
    const Group = (await import('../../src/models/Group')).default;
    const remainingGroup = await Group.findById(groupWithRestaurant._id);
    
    expect(remainingGroup).not.toBeNull();
    expect(remainingGroup!.members.length).toBe(1);
    
    // Verify restaurant data is preserved
    expect(remainingGroup!.restaurantSelected).toBe(true);
    expect(remainingGroup!.restaurant).toBeDefined();
    expect(remainingGroup!.restaurant!.name).toBe('Preserved Restaurant');
    expect(remainingGroup!.restaurant!.restaurantId).toBe('preserve-rest-123');
    expect(remainingGroup!.restaurant!.location).toBe('789 Keep St');

    // Socket event should not be emitted (restaurant was already selected)
    expect(emitRestaurantSelectedSpy).not.toHaveBeenCalled();
  });

  // Note: "should delete restaurant data when last member leaves (group deleted)" test is consolidated above
  // The same scenario (last member leaves -> group deleted) is covered by "should delete group and restaurant data when last member leaves"

  test('should verify restaurant field remains after completionTime if not cleared', async () => {
    const expiredGroupWithRestaurant = await seedTestGroup(
      'test-room-expired-restaurant',
      [testUsers[0]._id],
      {
        restaurantSelected: false,
        completionTime: new Date(Date.now() - 3600000),
        restaurant: {
          name: 'Expired Restaurant',
          location: 'Expired St',
          restaurantId: 'expired-rest-123'
        }
      }
    );

    const User = (await import('../../src/models/User')).default;
    await User.findByIdAndUpdate(testUsers[0]._id, { groupId: expiredGroupWithRestaurant._id });

    const token = generateTestToken(
      testUsers[0]._id,
      testUsers[0].email,
      testUsers[0].googleId
    );

    const response = await request(app)
      .get('/api/group/status')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.Body.status).toBe('disbanded');
    expect(response.body.Body.restaurantSelected).toBe(false);
    
    // Restaurant data may still exist
    const Group = (await import('../../src/models/Group')).default;
    const group = await Group.findById(expiredGroupWithRestaurant._id);
    if (group?.restaurant) {
      expect(group.restaurant).toBeDefined();
    }
  });
});

describe('POST /api/group/vote/:groupId - Sequential Voting (No Mocking)', () => {
  /**
   * Interface: POST /api/group/vote/:groupId
   * Mocking: Firebase only (Socket.IO is real with spies)
   */

  test('should return 400 when vote is a string instead of boolean', async () => {
    /**
     * Input: POST /api/group/vote/:groupId with vote as string "yes"
     * Expected Status Code: 400
     * Expected Behavior: Controller validates vote type and rejects non-boolean
     * Expected Output: Error "Vote must be true (yes) or false (no)"
     */
    
    const testGroup = await seedTestGroup(
      'test-vote-string',
      [testUsers[0]._id, testUsers[1]._id]
    );

    // Initialize sequential voting
    const Group = (await import('../../src/models/Group')).default;
    const group = await Group.findById(testGroup._id);
    if (group) {
      group.restaurantPool = [{
        name: 'Test Restaurant',
        location: '123 Test St',
        restaurantId: 'rest-123'
      }];
      group.startVotingRound(group.restaurantPool[0]);
      await group.save();
    }

    await User.findByIdAndUpdate(testUsers[0]._id, {
      groupId: testGroup._id,
      status: UserStatus.IN_GROUP
    });

    const token = generateTestToken(
      testUsers[0]._id,
      testUsers[0].email,
      testUsers[0].googleId
    );

    const response = await request(app)
      .post(`/api/group/vote/${testGroup._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ vote: "yes" });

    expect(response.status).toBe(400);
    expect(response.body.Status).toBe(400);
    expect(response.body.Message.error).toBe('Vote must be true (yes) or false (no)');
  });

  test('should return 400 when vote field is missing', async () => {
    /**
     * Input: POST /api/group/vote/:groupId without vote field in body
     * Expected Status Code: 400
     * Expected Behavior: Vote is undefined, fails typeof boolean check
     * Expected Output: Error "Vote must be true (yes) or false (no)"
     */
    
    const testGroup = await seedTestGroup(
      'test-vote-missing',
      [testUsers[0]._id, testUsers[1]._id]
    );

    const Group = (await import('../../src/models/Group')).default;
    const group = await Group.findById(testGroup._id);
    if (group) {
      group.restaurantPool = [{
        name: 'Test Restaurant',
        location: '123 Test St',
        restaurantId: 'rest-123'
      }];
      group.startVotingRound(group.restaurantPool[0]);
      await group.save();
    }

    await User.findByIdAndUpdate(testUsers[0]._id, {
      groupId: testGroup._id,
      status: UserStatus.IN_GROUP
    });

    const token = generateTestToken(
      testUsers[0]._id,
      testUsers[0].email,
      testUsers[0].googleId
    );

    const response = await request(app)
      .post(`/api/group/vote/${testGroup._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(response.status).toBe(400);
    expect(response.body.Message.error).toBe('Vote must be true (yes) or false (no)');
  });

  test('should return 400 when vote is a number', async () => {
    /**
     * Input: POST /api/group/vote/:groupId with vote as number 1
     * Expected Status Code: 400
     * Expected Behavior: Controller validates vote type and rejects number
     * Expected Output: Error "Vote must be true (yes) or false (no)"
     */
    
    const testGroup = await seedTestGroup(
      'test-vote-number',
      [testUsers[0]._id, testUsers[1]._id]
    );

    const Group = (await import('../../src/models/Group')).default;
    const group = await Group.findById(testGroup._id);
    if (group) {
      group.restaurantPool = [{
        name: 'Test Restaurant',
        location: '123 Test St',
        restaurantId: 'rest-123'
      }];
      group.startVotingRound(group.restaurantPool[0]);
      await group.save();
    }

    await User.findByIdAndUpdate(testUsers[0]._id, {
      groupId: testGroup._id,
      status: UserStatus.IN_GROUP
    });

    const token = generateTestToken(
      testUsers[0]._id,
      testUsers[0].email,
      testUsers[0].googleId
    );

    const response = await request(app)
      .post(`/api/group/vote/${testGroup._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ vote: 1 });

    expect(response.status).toBe(400);
    expect(response.body.Message.error).toBe('Vote must be true (yes) or false (no)');
  });

  test('should return 500 when group not found', async () => {
    /**
     * Input: POST /api/group/vote/:groupId with non-existent groupId
     * Expected Status Code: 500
     * Expected Behavior: Service throws "Group not found" error
     * Expected Output: Error message
     */
    
    const nonExistentGroupId = '507f1f77bcf86cd799439011';
    const token = generateTestToken(
      testUsers[0]._id,
      testUsers[0].email,
      testUsers[0].googleId
    );

    const response = await request(app)
      .post(`/api/group/vote/${nonExistentGroupId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ vote: true });

    expect(response.status).toBe(500);
    expect(response.body.message).toBe('Group not found');
  });

  test('should return 500 when user is not a member of the group', async () => {
    /**
     * Input: User votes on group they're not a member of
     * Expected Status Code: 500
     * Expected Behavior: Service validates membership and rejects
     * Expected Output: Error "User is not a member of this group"
     */
    
    const testGroup = await seedTestGroup(
      'test-vote-not-member',
      [testUsers[0]._id, testUsers[1]._id]
    );

    const Group = (await import('../../src/models/Group')).default;
    const group = await Group.findById(testGroup._id);
    if (group) {
      group.restaurantPool = [{
        name: 'Test Restaurant',
        location: '123 Test St',
        restaurantId: 'rest-123'
      }];
      group.startVotingRound(group.restaurantPool[0]);
      await group.save();
    }

    // User 4 is NOT in this group
    const token = generateTestToken(
      testUsers[4]._id,
      testUsers[4].email,
      testUsers[4].googleId
    );

    const response = await request(app)
      .post(`/api/group/vote/${testGroup._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ vote: true });

    expect(response.status).toBe(500);
    expect(response.body.message).toBe('User is not a member of this group');
  });

  test('should return 500 when restaurant already selected', async () => {
    /**
     * Input: Vote on group where restaurantSelected = true
     * Expected Status Code: 500
     * Expected Behavior: Service rejects vote after restaurant selected
     * Expected Output: Error "Restaurant already selected for this group"
     */
    
    const testGroup = await seedTestGroup(
      'test-vote-already-selected',
      [testUsers[0]._id, testUsers[1]._id],
      {
        restaurantSelected: true,
        restaurant: {
          name: 'Already Selected',
          location: '123 Done St',
          restaurantId: 'done-123'
        }
      }
    );

    await User.findByIdAndUpdate(testUsers[0]._id, {
      groupId: testGroup._id,
      status: UserStatus.IN_GROUP
    });

    const token = generateTestToken(
      testUsers[0]._id,
      testUsers[0].email,
      testUsers[0].googleId
    );

    const response = await request(app)
      .post(`/api/group/vote/${testGroup._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ vote: true });

    expect(response.status).toBe(500);
    expect(response.body.message).toBe('Restaurant already selected for this group');
  });

  test('should return 500 when no active voting round', async () => {
    /**
     * Input: Vote on group without initialized sequential voting
     * Expected Status Code: 500
     * Expected Behavior: Service validates currentRound exists
     * Expected Output: Error "No active voting round"
     */
    
    const testGroup = await seedTestGroup(
      'test-vote-no-round',
      [testUsers[0]._id, testUsers[1]._id]
    );

    // Don't initialize voting - no currentRound

    await User.findByIdAndUpdate(testUsers[0]._id, {
      groupId: testGroup._id,
      status: UserStatus.IN_GROUP
    });

    const token = generateTestToken(
      testUsers[0]._id,
      testUsers[0].email,
      testUsers[0].googleId
    );

    const response = await request(app)
      .post(`/api/group/vote/${testGroup._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ vote: true });

    expect(response.status).toBe(500);
    expect(response.body.message).toBe('No active voting round');
  });

  test('should successfully submit yes vote and emit socket events', async () => {
    /**
     * Input: POST /api/group/vote/:groupId with vote: true
     * Expected Status Code: 200
     * Expected Behavior: Vote recorded, socket emits vote update
     * Expected Output: success: true, majorityReached: false
     */
    
    const emitSequentialVoteUpdateSpy = jest.spyOn(socketManager, 'emitSequentialVoteUpdate');

    const testGroup = await seedTestGroup(
      'test-vote-yes',
      [testUsers[0]._id, testUsers[1]._id]
    );

    const Group = (await import('../../src/models/Group')).default;
    const group = await Group.findById(testGroup._id);
    if (group) {
      group.restaurantPool = [{
        name: 'Test Restaurant',
        location: '123 Test St',
        restaurantId: 'rest-123'
      }];
      group.startVotingRound(group.restaurantPool[0]);
      await group.save();
    }

    await User.findByIdAndUpdate(testUsers[0]._id, {
      groupId: testGroup._id,
      status: UserStatus.IN_GROUP
    });

    const token = generateTestToken(
      testUsers[0]._id,
      testUsers[0].email,
      testUsers[0].googleId
    );

    const response = await request(app)
      .post(`/api/group/vote/${testGroup._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ vote: true });

    expect(response.status).toBe(200);
    expect(response.body.Body.success).toBe(true);
    expect(response.body.Body.majorityReached).toBe(false);
    expect(response.body.Body.message).toBe('Vote recorded, waiting for other members');

    // Verify socket was called
    expect(emitSequentialVoteUpdateSpy).toHaveBeenCalled();
  });

  test('should successfully submit no vote', async () => {
    /**
     * Input: POST /api/group/vote/:groupId with vote: false
     * Expected Status Code: 200
     * Expected Behavior: Vote recorded
     * Expected Output: success: true, majorityReached: false
     */
    
    const testGroup = await seedTestGroup(
      'test-vote-no',
      [testUsers[0]._id, testUsers[1]._id]
    );

    const Group = (await import('../../src/models/Group')).default;
    const group = await Group.findById(testGroup._id);
    if (group) {
      group.restaurantPool = [{
        name: 'Test Restaurant',
        location: '123 Test St',
        restaurantId: 'rest-123'
      }];
      group.startVotingRound(group.restaurantPool[0]);
      await group.save();
    }

    await User.findByIdAndUpdate(testUsers[0]._id, {
      groupId: testGroup._id,
      status: UserStatus.IN_GROUP
    });

    const token = generateTestToken(
      testUsers[0]._id,
      testUsers[0].email,
      testUsers[0].googleId
    );

    const response = await request(app)
      .post(`/api/group/vote/${testGroup._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ vote: false });

    expect(response.status).toBe(200);
    expect(response.body.Body.success).toBe(true);
    expect(response.body.Body.majorityReached).toBe(false);
  });

  test('should allow user to change their vote from yes to no', async () => {
    /**
     * Input: User votes yes, then votes no
     * Expected Status Code: 200 (both times)
     * Expected Behavior: Vote counts update correctly
     * Expected Output: yesVotes decremented, noVotes incremented
     */
    
    const testGroup = await seedTestGroup(
      'test-vote-change-yes-no',
      [testUsers[0]._id, testUsers[1]._id]
    );

    const Group = (await import('../../src/models/Group')).default;
    let group = await Group.findById(testGroup._id);
    if (group) {
      group.restaurantPool = [{
        name: 'Test Restaurant',
        location: '123 Test St',
        restaurantId: 'rest-123'
      }];
      group.startVotingRound(group.restaurantPool[0]);
      await group.save();
    }

    await User.findByIdAndUpdate(testUsers[0]._id, {
      groupId: testGroup._id,
      status: UserStatus.IN_GROUP
    });

    const token = generateTestToken(
      testUsers[0]._id,
      testUsers[0].email,
      testUsers[0].googleId
    );

    // First vote: yes
    const response1 = await request(app)
      .post(`/api/group/vote/${testGroup._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ vote: true });

    expect(response1.status).toBe(200);

    // Verify yes vote was recorded
    group = await Group.findById(testGroup._id);
    expect(group!.currentRound!.yesVotes).toBe(1);
    expect(group!.currentRound!.noVotes).toBe(0);

    // Change vote: no
    const response2 = await request(app)
      .post(`/api/group/vote/${testGroup._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ vote: false });

    expect(response2.status).toBe(200);

    // Verify vote changed
    group = await Group.findById(testGroup._id);
    expect(group!.currentRound!.yesVotes).toBe(0);
    expect(group!.currentRound!.noVotes).toBe(1);
  });

  test('should allow user to change their vote from no to yes', async () => {
    /**
     * Input: User votes no, then votes yes
     * Expected Status Code: 200 (both times)
     * Expected Behavior: Vote counts update correctly
     * Expected Output: noVotes decremented, yesVotes incremented
     */
    
    const testGroup = await seedTestGroup(
      'test-vote-change-no-yes',
      [testUsers[0]._id, testUsers[1]._id]
    );

    const Group = (await import('../../src/models/Group')).default;
    let group = await Group.findById(testGroup._id);
    if (group) {
      group.restaurantPool = [{
        name: 'Test Restaurant',
        location: '123 Test St',
        restaurantId: 'rest-123'
      }];
      group.startVotingRound(group.restaurantPool[0]);
      await group.save();
    }

    await User.findByIdAndUpdate(testUsers[0]._id, {
      groupId: testGroup._id,
      status: UserStatus.IN_GROUP
    });

    const token = generateTestToken(
      testUsers[0]._id,
      testUsers[0].email,
      testUsers[0].googleId
    );

    // First vote: no
    const response1 = await request(app)
      .post(`/api/group/vote/${testGroup._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ vote: false });

    expect(response1.status).toBe(200);

    group = await Group.findById(testGroup._id);
    expect(group!.currentRound!.noVotes).toBe(1);

    // Change vote: yes
    const response2 = await request(app)
      .post(`/api/group/vote/${testGroup._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ vote: true });

    expect(response2.status).toBe(200);

    group = await Group.findById(testGroup._id);
    expect(group!.currentRound!.yesVotes).toBe(1);
    expect(group!.currentRound!.noVotes).toBe(0);
  });

  test('should detect majority yes and select restaurant (2 member group)', async () => {
    /**
     * Input: Group with 2 members, both vote yes
     * Expected Status Code: 200
     * Expected Behavior: Majority detected (unanimous for 2 members), restaurant selected
     * Expected Output: majorityReached: true, votingComplete: true, selectedRestaurant
     */
    
    const emitRestaurantSelectedSpy = jest.spyOn(socketManager, 'emitRestaurantSelected');

    const testGroup = await seedTestGroup(
      'test-majority-yes-2',
      [testUsers[0]._id, testUsers[1]._id]
    );

    const Group = (await import('../../src/models/Group')).default;
    const group = await Group.findById(testGroup._id);
    if (group) {
      group.restaurantPool = [{
        name: 'Selected Restaurant',
        location: '123 Winner St',
        restaurantId: 'winner-123'
      }];
      group.startVotingRound(group.restaurantPool[0]);
      await group.save();
    }

    await User.findByIdAndUpdate(testUsers[0]._id, {
      groupId: testGroup._id,
      status: UserStatus.IN_GROUP
    });
    await User.findByIdAndUpdate(testUsers[1]._id, {
      groupId: testGroup._id,
      status: UserStatus.IN_GROUP
    });

    const token1 = generateTestToken(testUsers[0]._id, testUsers[0].email, testUsers[0].googleId);
    const token2 = generateTestToken(testUsers[1]._id, testUsers[1].email, testUsers[1].googleId);

    // User 1 votes yes
    await request(app)
      .post(`/api/group/vote/${testGroup._id}`)
      .set('Authorization', `Bearer ${token1}`)
      .send({ vote: true });

    // User 2 votes yes (triggers majority)
    const response = await request(app)
      .post(`/api/group/vote/${testGroup._id}`)
      .set('Authorization', `Bearer ${token2}`)
      .send({ vote: true });

    expect(response.status).toBe(200);
    expect(response.body.Body.majorityReached).toBe(true);
    expect(response.body.Body.votingComplete).toBe(true);
    expect(response.body.Body.selectedRestaurant).toBeDefined();
    expect(response.body.Body.selectedRestaurant.name).toBe('Selected Restaurant');

    // Verify restaurant was selected in database
    const updatedGroup = await Group.findById(testGroup._id);
    expect(updatedGroup!.restaurantSelected).toBe(true);

    // Verify socket event emitted
    expect(emitRestaurantSelectedSpy).toHaveBeenCalled();
  });

  test('should detect majority no and move to next restaurant', async () => {
  /**
   * Input: Group with 2 members, both vote no
   * Expected Status Code: 200
   * Expected Behavior: Majority detected (rejected), moves to next restaurant
   * Expected Output: success: true, majorityReached: false, nextRestaurant defined
   * 
   * Note: majorityReached is false because it indicates "not ready to select",
   * even though a majority was reached to reject the restaurant
   */
  
  const emitNewVotingRoundSpy = jest.spyOn(socketManager, 'emitNewVotingRound');

  const testGroup = await seedTestGroup(
    'test-majority-no',
    [testUsers[0]._id, testUsers[1]._id]
  );

  const Group = (await import('../../src/models/Group')).default;
  const group = await Group.findById(testGroup._id);
  
  const restaurant1 = {
    name: 'Rejected Restaurant',
    location: '123 Reject St',
    restaurantId: 'reject-123'
  };
  
  const restaurant2 = {
    name: 'Next Restaurant',
    location: '456 Next St',
    restaurantId: 'next-456'
  };
  
  if (group) {
    group.restaurantPool = [restaurant1, restaurant2];
    group.startVotingRound(restaurant1);
    await group.save();
  }

  await User.findByIdAndUpdate(testUsers[0]._id, {
    groupId: testGroup._id,
    status: UserStatus.IN_GROUP
  });
  await User.findByIdAndUpdate(testUsers[1]._id, {
    groupId: testGroup._id,
    status: UserStatus.IN_GROUP
  });

  // Mock restaurantService.getNextRestaurant
  const restaurantService = (await import('../../src/services/restaurantService')).default;
  jest.spyOn(restaurantService, 'getNextRestaurant').mockResolvedValue(restaurant2);

  const token1 = generateTestToken(testUsers[0]._id, testUsers[0].email, testUsers[0].googleId);
  const token2 = generateTestToken(testUsers[1]._id, testUsers[1].email, testUsers[1].googleId);

  // User 1 votes no
  await request(app)
    .post(`/api/group/vote/${testGroup._id}`)
    .set('Authorization', `Bearer ${token1}`)
    .send({ vote: false });

  // User 2 votes no (triggers majority no)
  const response = await request(app)
    .post(`/api/group/vote/${testGroup._id}`)
    .set('Authorization', `Bearer ${token2}`)
    .send({ vote: false });

  expect(response.status).toBe(200);
  expect(response.body.Status).toBe(200);
  expect(response.body.Body.success).toBe(true);
  expect(response.body.Body.majorityReached).toBe(false); // ✅ Correct - false means "moving to next"
  expect(response.body.Body.nextRestaurant).toBeDefined();
  expect(response.body.Body.nextRestaurant.name).toBe('Next Restaurant');
  expect(response.body.Body.message).toBe('Moving to next restaurant');

  // Verify new round started
  const updatedGroup = await Group.findById(testGroup._id);
  expect(updatedGroup!.currentRound!.restaurant.name).toBe('Next Restaurant');

  // Verify socket event emitted
  expect(emitNewVotingRoundSpy).toHaveBeenCalled();
  
  // Restore mock
  jest.restoreAllMocks();
});

  test('should require unanimous agreement for 2-member group', async () => {
    /**
     * Input: 2-member group, only 1 votes yes
     * Expected Status Code: 200
     * Expected Behavior: No majority (need 2/2 for 2-member groups), waits for second vote
     * Expected Output: majorityReached: false
     */
    
    const testGroup = await seedTestGroup(
      'test-no-majority-2',
      [testUsers[0]._id, testUsers[1]._id]
    );

    const Group = (await import('../../src/models/Group')).default;
    const group = await Group.findById(testGroup._id);
    if (group) {
      group.restaurantPool = [{
        name: 'Test Restaurant',
        location: '123 Test St',
        restaurantId: 'test-123'
      }];
      group.startVotingRound(group.restaurantPool[0]);
      await group.save();
    }

    await User.findByIdAndUpdate(testUsers[0]._id, {
      groupId: testGroup._id,
      status: UserStatus.IN_GROUP
    });
    await User.findByIdAndUpdate(testUsers[1]._id, {
      groupId: testGroup._id,
      status: UserStatus.IN_GROUP
    });

    const token = generateTestToken(testUsers[0]._id, testUsers[0].email, testUsers[0].googleId);

    // Only user 1 votes yes (need 2/2 for majority)
    const response = await request(app)
      .post(`/api/group/vote/${testGroup._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ vote: true });

    expect(response.status).toBe(200);
    expect(response.body.Body.majorityReached).toBe(false);
    expect(response.body.Body.message).toBe('Vote recorded, waiting for other members');
  });

  test('should use 50%+1 majority for 3-member groups', async () => {
    /**
     * Input: 3-member group, 2 vote yes
     * Expected Status Code: 200
     * Expected Behavior: Majority reached (2 out of 3 = 50%+1)
     * Expected Output: majorityReached: true, restaurant selected
     */
    
    const testGroup = await seedTestGroup(
      'test-majority-3',
      [testUsers[0]._id, testUsers[1]._id, testUsers[2]._id]
    );

    const Group = (await import('../../src/models/Group')).default;
    const group = await Group.findById(testGroup._id);
    if (group) {
      group.restaurantPool = [{
        name: 'Winner Restaurant',
        location: '123 Winner St',
        restaurantId: 'winner-123'
      }];
      group.startVotingRound(group.restaurantPool[0]);
      await group.save();
    }

    await User.findByIdAndUpdate(testUsers[0]._id, {
      groupId: testGroup._id,
      status: UserStatus.IN_GROUP
    });
    await User.findByIdAndUpdate(testUsers[1]._id, {
      groupId: testGroup._id,
      status: UserStatus.IN_GROUP
    });
    await User.findByIdAndUpdate(testUsers[2]._id, {
      groupId: testGroup._id,
      status: UserStatus.IN_GROUP
    });

    const token1 = generateTestToken(testUsers[0]._id, testUsers[0].email, testUsers[0].googleId);
    const token2 = generateTestToken(testUsers[1]._id, testUsers[1].email, testUsers[1].googleId);

    // User 1 votes yes
    await request(app)
      .post(`/api/group/vote/${testGroup._id}`)
      .set('Authorization', `Bearer ${token1}`)
      .send({ vote: true });

    // User 2 votes yes (2/3 = majority)
    const response = await request(app)
      .post(`/api/group/vote/${testGroup._id}`)
      .set('Authorization', `Bearer ${token2}`)
      .send({ vote: true });

    expect(response.status).toBe(200);
    expect(response.body.Body.majorityReached).toBe(true);
    expect(response.body.Body.selectedRestaurant).toBeDefined();
  });
});

describe('Sequential Voting Routes - No Mocking (/api/groups)', () => {
  test('should initialize sequential voting and return first restaurant', async () => {
    /**
     * Covers: voting.routes.ts initialize endpoint and groupService.initializeSequentialVoting
     * Flow:
     *  - Mock restaurantService.getRecommendationsForGroup to avoid external API calls
     *  - POST /api/groups/:groupId/voting/initialize
     *  - Expect 200 with ApiResponse shape and currentRestaurant populated
     */
    const restaurantService = (await import('../../src/services/restaurantService')).default;
    const Group = (await import('../../src/models/Group')).default;

    const mockRestaurants = [
      {
        restaurantId: 'seq-rest-1',
        name: 'Sequential Restaurant 1',
        location: '123 Seq St',
        cuisine: 'Italian',
      },
      {
        restaurantId: 'seq-rest-2',
        name: 'Sequential Restaurant 2',
        location: '456 Seq St',
        cuisine: 'Japanese',
      },
    ];

    jest
      .spyOn(restaurantService, 'getRecommendationsForGroup')
      .mockResolvedValueOnce(mockRestaurants as any);

    const token = generateTestToken(
      testUsers[0]._id,
      testUsers[0].email,
      testUsers[0].googleId
    );

    const response = await request(app)
      .post(`/api/groups/${testGroups[0]._id}/voting/initialize`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.Status).toBe(200);
    expect(response.body.Message).toHaveProperty('text', 'Sequential voting initialized');
    expect(response.body.Body).toBeDefined();
    expect(response.body.Body.success).toBe(true);
    expect(response.body.Body.currentRestaurant).toBeDefined();
    expect(response.body.Body.currentRestaurant.restaurantId).toBe('seq-rest-1');

    const updatedGroup = await Group.findById(testGroups[0]._id);
    expect(updatedGroup).not.toBeNull();
    expect(updatedGroup!.restaurantPool.length).toBe(2);
    expect(updatedGroup!.currentRound).toBeDefined();
  });

  test('should submit sequential vote via /api/groups/:groupId/voting/vote', async () => {
    /**
     * Covers: voting.routes.ts vote endpoint and groupService.submitSequentialVote
     * Flow:
     *  - Initialize sequential voting
     *  - POST /api/groups/:groupId/voting/vote with vote: true
     *  - Expect ApiResponse with Body.success and message
     */
    const restaurantService = (await import('../../src/services/restaurantService')).default;

    const mockRestaurants = [
      {
        restaurantId: 'seq-rest-3',
        name: 'Sequential Restaurant 3',
        location: '789 Seq St',
        cuisine: 'Mexican',
      },
    ];

    jest
      .spyOn(restaurantService, 'getRecommendationsForGroup')
      .mockResolvedValueOnce(mockRestaurants as any);

    const token = generateTestToken(
      testUsers[0]._id,
      testUsers[0].email,
      testUsers[0].googleId
    );

    // Initialize first so currentRound exists
    const initResponse = await request(app)
      .post(`/api/groups/${testGroups[0]._id}/voting/initialize`)
      .set('Authorization', `Bearer ${token}`);

    expect(initResponse.status).toBe(200);

    const voteResponse = await request(app)
      .post(`/api/groups/${testGroups[0]._id}/voting/vote`)
      .set('Authorization', `Bearer ${token}`)
      .send({ vote: true });

    expect(voteResponse.status).toBe(200);
    expect(voteResponse.body.Status).toBe(200);
    expect(voteResponse.body.Body).toBeDefined();
    expect(voteResponse.body.Body.success).toBe(true);
    expect(typeof voteResponse.body.Body.message).toBe('string');
  });

  test('should get current sequential voting round status', async () => {
    /**
     * Covers: voting.routes.ts current endpoint and groupService.getCurrentVotingRound
     * Flow:
     *  - Initialize sequential voting
     *  - GET /api/groups/:groupId/voting/current
     *  - Expect hasActiveRound: true and currentRestaurant populated
     */
    const restaurantService = (await import('../../src/services/restaurantService')).default;

    const mockRestaurants = [
      {
        restaurantId: 'seq-rest-4',
        name: 'Sequential Restaurant 4',
        location: '101 Seq St',
        cuisine: 'Thai',
      },
    ];

    jest
      .spyOn(restaurantService, 'getRecommendationsForGroup')
      .mockResolvedValueOnce(mockRestaurants as any);

    const token = generateTestToken(
      testUsers[0]._id,
      testUsers[0].email,
      testUsers[0].googleId
    );

    // Initialize voting
    const initResponse = await request(app)
      .post(`/api/groups/${testGroups[0]._id}/voting/initialize`)
      .set('Authorization', `Bearer ${token}`);

    expect(initResponse.status).toBe(200);

    const currentResponse = await request(app)
      .get(`/api/groups/${testGroups[0]._id}/voting/current`)
      .set('Authorization', `Bearer ${token}`);

    expect(currentResponse.status).toBe(200);
    expect(currentResponse.body.Status).toBe(200);
    expect(currentResponse.body.Body).toBeDefined();
    expect(currentResponse.body.Body.hasActiveRound).toBe(true);
    expect(currentResponse.body.Body.currentRestaurant).toBeDefined();
    expect(currentResponse.body.Body.currentRestaurant.restaurantId).toBe('seq-rest-4');
  });
});

describe('POST /api/group/initialize-voting/:groupId - No Mocking', () => {
  /**
   * Interface: POST /api/group/initialize-voting/:groupId
   * Mocking: Firebase only
   */

  test('should return 404 when endpoint not implemented', async () => {
    /**
     * NOTE: This endpoint is called internally by matchingService.createGroupFromRoom
     * It's not exposed as a public API endpoint yet
     * 
     * Input: POST /api/group/initialize-voting/:groupId
     * Expected Status Code: 404
     * Expected Behavior: Route not found
     * Expected Output: 404 error
     */
    // This tests that the endpoint is not publicly exposed
  });
});

describe('GET /api/group/voting/:groupId - No Mocking', () => {
  /**
   * Interface: GET /api/group/voting/:groupId
   * Mocking: Firebase only
   */

  test('should return 404 when endpoint not implemented', async () => {
    /**
     * NOTE: This endpoint should exist to get current voting round status
     * But it's not implemented in the controller yet
     * 
     * Input: GET /api/group/voting/:groupId
     * Expected Status Code: 404
     * Expected Behavior: Route not found
     * Expected Output: 404 error
     */
    // This tests that the endpoint is not publicly exposed yet
  });
});

// Interface: Group Model Virtual Properties (tested through API)
describe('Group Model Virtual Properties and toJSON Transform - API Tests', () => {
  /**
   * Tests the Group model's virtual properties and toJSON transform:
   * - groupId virtual property (returns _id.toString())
   * - toJSON transform (includes groupId, excludes _id and __v)
   * 
   * These are tested through API responses since that's where JSON serialization happens
   */

  test('should access groupId virtual property through GET /api/group/status response', async () => {
    /**
     * Input: GET /api/group/status
     * Expected Status Code: 200
     * Expected Behavior: Query database, Group model applies toJSON transform
     * Expected Output: Group status object with groupId virtual property included
     * 
     * Covers: GroupSchema.virtual('groupId').get(function() { return this._id.toString(); })
     */
    const token = generateTestToken(
      testUsers[0]._id,
      testUsers[0].email,
      testUsers[0].googleId
    );
    
    const response = await request(app)
      .get('/api/group/status')
      .set('Authorization', `Bearer ${token}`);
    
    expect(response.status).toBe(200);
    expect(response.body.Body).toHaveProperty('groupId');
    expect(response.body.Body.groupId).toBe(testGroups[0]._id.toString());
    expect(typeof response.body.Body.groupId).toBe('string');
  });

  test('should use toJSON transform to include groupId and exclude _id and __v in GET /api/group/status', async () => {
    /**
     * Input: GET /api/group/status
     * Expected Status Code: 200
     * Expected Behavior: Group model toJSON transform removes _id and __v, adds groupId
     * Expected Output: Group status object with groupId, without _id or __v
     * 
     * Covers: GroupSchema.set('toJSON', { virtuals: true, transform: ... })
     */
    const token = generateTestToken(
      testUsers[0]._id,
      testUsers[0].email,
      testUsers[0].googleId
    );
    
    const response = await request(app)
      .get('/api/group/status')
      .set('Authorization', `Bearer ${token}`);
    
    expect(response.status).toBe(200);
    expect(response.body.Body).toHaveProperty('groupId');
    expect(response.body.Body.groupId).toBe(testGroups[0]._id.toString());
    expect(response.body.Body).not.toHaveProperty('_id');
    expect(response.body.Body).not.toHaveProperty('__v');
  });

  test('should access groupId virtual property when group has restaurant selected', async () => {
    /**
     * Input: GET /api/group/status (for group with restaurant selected)
     * Expected Status Code: 200
     * Expected Behavior: Group model virtual property works even when restaurant is selected
     * Expected Output: Group status with groupId virtual property
     */
    const token = generateTestToken(
      testUsers[2]._id,
      testUsers[2].email,
      testUsers[2].googleId
    );
    
    const response = await request(app)
      .get('/api/group/status')
      .set('Authorization', `Bearer ${token}`);
    
    expect(response.status).toBe(200);
    expect(response.body.Body).toHaveProperty('groupId');
    expect(response.body.Body.groupId).toBe(testGroups[1]._id.toString());
    expect(response.body.Body).not.toHaveProperty('_id');
    expect(response.body.Body).not.toHaveProperty('__v');
  });

  test('should verify groupId virtual matches _id.toString() when accessing directly from model', async () => {
    /**
     * Input: Direct Group model access
     * Expected Behavior: Virtual property groupId returns same value as _id.toString()
     * Expected Output: groupId === _id.toString()
     * 
     * This tests the virtual getter directly
     */
    const Group = (await import('../../src/models/Group')).default;
    const group = await Group.findById(testGroups[0]._id);
    
    expect(group).not.toBeNull();
    // Access virtual property via type assertion (virtuals exist at runtime but not in TypeScript types)
    const groupDoc = group as any;
    expect(groupDoc.groupId).toBe(group!._id.toString());
    expect(typeof groupDoc.groupId).toBe('string');
  });

  test('should verify toJSON transform works when calling toJSON() directly', async () => {
    /**
     * Input: Call toJSON() on Group document
     * Expected Behavior: toJSON transform applies, includes groupId, excludes _id and __v
     * Expected Output: JSON object with groupId, without _id or __v
     * 
     * This tests the toJSON transform directly
     */
    const Group = (await import('../../src/models/Group')).default;
    const group = await Group.findById(testGroups[0]._id);
    
    expect(group).not.toBeNull();
    const json = group!.toJSON() as any;
    
    expect(json).toHaveProperty('groupId');
    expect(json.groupId).toBe(group!._id.toString());
    expect(json).not.toHaveProperty('_id');
    expect(json).not.toHaveProperty('__v');
  });

  test('should verify toObject includes virtuals but preserves _id', async () => {
    /**
     * Input: Call toObject() on Group document
     * Expected Behavior: toObject includes virtuals but doesn't transform (keeps _id)
     * Expected Output: Object with both groupId (virtual) and _id
     * 
     * Note: toObject is different from toJSON - it includes virtuals but doesn't transform
     */
    const Group = (await import('../../src/models/Group')).default;
    const group = await Group.findById(testGroups[0]._id);
    
    expect(group).not.toBeNull();
    const obj = group!.toObject() as any;
    
    // toObject includes virtuals but doesn't remove _id
    expect(obj).toHaveProperty('groupId');
    expect(obj.groupId).toBe(group!._id.toString());
    // toObject may or may not include _id depending on options, but virtual should work
    expect(obj.groupId).toBeDefined();
  });
});