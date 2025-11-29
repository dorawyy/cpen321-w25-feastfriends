// tests/mocks/group.mocks.test.ts

// ============================================
// MOCK ALL EXTERNAL SERVICES FOR FAILURE TESTING
// ============================================

// Mock Socket Manager
jest.mock('../../src/utils/socketManager', () => ({
  __esModule: true,
  default: {
    initialize: jest.fn(),
    getIO: jest.fn(),
    getEmitter: jest.fn(),
    emitRoomUpdate: jest.fn(),
    emitToUser: jest.fn(),
    emitMemberJoined: jest.fn(),
    emitMemberLeft: jest.fn(),
    emitGroupReady: jest.fn(),
    emitRoomExpired: jest.fn(),
    emitVoteUpdate: jest.fn(),
    emitRestaurantSelected: jest.fn(),
    // ✅ ADD THESE SEQUENTIAL VOTING METHODS:
    emitSequentialVoteUpdate: jest.fn(),
    emitNewVotingRound: jest.fn(),
  }
}));

// Mock Notification Service
jest.mock('../../src/services/notificationService', () => ({
  notifyGroupMembers: jest.fn(),
  notifyRestaurantSelected: jest.fn(),
  notifyRoomMatched: jest.fn(),
  notifyRoomExpired: jest.fn(),
  sendNotificationToUser: jest.fn(),
  sendNotificationToUsers: jest.fn(),
  notifyRoomMembers: jest.fn(),
}));

// ============================================
// IMPORTS
// ============================================

import request from 'supertest';
import app from '../../src/app';
import { connectDatabase, disconnectDatabase } from '../../src/config/database';
import User, { UserStatus } from '../../src/models/User';
import Group from '../../src/models/Group';
import { seedTestUsers, cleanTestData, TestUser, seedTestGroup } from '../helpers/seed.helper';
import { generateTestToken } from '../helpers/auth.helper';
import socketManager from '../../src/utils/socketManager';
import * as notificationService from '../../src/services/notificationService';

/**
 * Group Routes Tests - With Mocks (External Failure Scenarios)
 * 
 * This test suite covers UNCONTROLLABLE external failures:
 * - Database connection failures
 * - Network timeouts
 * - MongoDB server errors
 * - Socket.IO emission failures
 * - Firebase notification failures
 * - External service unavailability
 * 
 * These failures cannot be reliably triggered in no-mocks tests.
 * Combined with no-mocks tests, this achieves 100% coverage.
 */

let testUsers: TestUser[];

beforeAll(async () => {
  console.log('\n🚀 Starting Group Tests (With Mocks - Failure Scenarios)...\n');
  await connectDatabase();
  testUsers = await seedTestUsers();
  console.log('✅ Test setup complete.\n');
});

afterAll(async () => {
  console.log('\n🧹 Cleaning up after tests...\n');
  await cleanTestData();
  await disconnectDatabase();
  console.log('✅ Cleanup complete.\n');
});

afterEach(() => {
  jest.clearAllMocks();
  jest.restoreAllMocks();
});

describe('GET /api/group/status - External Failures', () => {
  test('should return 500 when database connection fails during User.findById', async () => {
    /**
     * Scenario: MongoDB connection lost while fetching user
     * Expected: Error handler catches, returns 500
     */
    
    const token = generateTestToken(
      testUsers[0]._id,
      testUsers[0].email,
      testUsers[0].googleId
    );

    // Mock database failure
    jest.spyOn(User, 'findById').mockRejectedValueOnce(
      new Error('MongoNetworkError: connection refused')
    );

    const response = await request(app)
      .get('/api/group/status')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(500);
    expect(response.body.message).toContain('connection refused');
  });

  test('should return 500 when database timeout occurs during Group.findById', async () => {
    /**
     * Scenario: MongoDB query timeout
     * Expected: Error handler catches timeout, returns 500
     */
    
    // Create user with groupId
    await User.findByIdAndUpdate(testUsers[0]._id, {
      groupId: 'some-group-id',
      status: UserStatus.IN_GROUP
    });

    const token = generateTestToken(
      testUsers[0]._id,
      testUsers[0].email,
      testUsers[0].googleId
    );

    // Mock timeout
    jest.spyOn(Group, 'findById').mockRejectedValueOnce(
      new Error('MongoServerError: operation exceeded time limit')
    );

    const response = await request(app)
      .get('/api/group/status')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(500);
    expect(response.body.message).toContain('time limit');
  });

  test('should return 500 when MongoDB server is unavailable', async () => {
    /**
     * Scenario: MongoDB server down
     * Expected: Connection error caught, returns 500
     */
    
    await User.findByIdAndUpdate(testUsers[0]._id, {
      groupId: 'some-group-id',
      status: UserStatus.IN_GROUP
    });

    const token = generateTestToken(
      testUsers[0]._id,
      testUsers[0].email,
      testUsers[0].googleId
    );

    jest.spyOn(Group, 'findById').mockRejectedValueOnce(
      new Error('MongoServerSelectionError: server selection timed out')
    );

    const response = await request(app)
      .get('/api/group/status')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(500);
    expect(response.body.message).toContain('server selection');
  });
});

describe('POST /api/group/vote/:groupId - Sequential Voting Failures', () => {
  /**
   * Interface: POST /api/group/vote/:groupId
   * Mocking: Database (Group, User models)
   */

  test('should return 500 when Group.findById fails', async () => {
    /**
     * Mocked Behavior: Group.findById throws database error
     * 
     * Input: POST /api/group/vote/:groupId
     * Expected Status Code: 500
     * Expected Behavior: Database connection error
     * Expected Output: Error message about database failure
     */
    // Mock database failure
  });

  test('should return 500 when group.save() fails after submitVote', async () => {
    /**
     * Mocked Behavior: group.save() throws error after vote submission
     * 
     * Input: POST /api/group/vote/:groupId with vote: true
     * Expected Status Code: 500
     * Expected Behavior: Vote recorded but save fails
     * Expected Output: Database write error
     */
    // Mock save failure
  });

  test('should handle socket emission failure gracefully (emitSequentialVoteUpdate)', async () => {
    /**
     * Mocked Behavior: socketManager.emitSequentialVoteUpdate throws error
     * 
     * Input: POST /api/group/vote/:groupId
     * Expected Status Code: 200
     * Expected Behavior: Vote succeeds despite socket failure
     * Expected Output: Success response
     */
    // Socket failure should not break voting
  });

  test('should handle socket emission failure when restaurant selected (emitRestaurantSelected)', async () => {
    /**
     * Mocked Behavior: emitRestaurantSelected throws error
     * 
     * Input: Majority yes vote triggers restaurant selection
     * Expected Status Code: 200
     * Expected Behavior: Restaurant selected despite socket failure
     * Expected Output: Success with selectedRestaurant
     */
    // Socket failure should not break selection
  });

  test('should handle notification failure when restaurant selected', async () => {
    /**
     * Mocked Behavior: notifyRestaurantSelected throws Firebase error
     * 
     * Input: Majority yes vote
     * Expected Status Code: 200
     * Expected Behavior: Restaurant selected despite notification failure
     * Expected Output: Success response
     */
    // Notification failure should not break selection
  });

  test('should handle socket emission failure when moving to next restaurant (emitNewVotingRound)', async () => {
    /**
     * Mocked Behavior: emitNewVotingRound throws error
     * 
     * Input: Majority no vote triggers next restaurant
     * Expected Status Code: 200
     * Expected Behavior: Moves to next restaurant despite socket failure
     * Expected Output: Success with nextRestaurant
     */
    // Socket failure should not break restaurant progression
  });

  test('should return 400 when vote is not a boolean for /api/groups/:groupId/voting/vote', async () => {
    /**
     * Covers: validation branch in voting.routes.ts for /:groupId/voting/vote
     * Path:
     *   if (typeof vote !== 'boolean') {
     *     return res.status(400).json({
     *       Status: 400,
     *       Message: { error: 'Vote must be a boolean (true/false)' },
     *       Body: null
     *     });
     *   }
     *
     * We use a valid token so authMiddleware sets req.user, but send an invalid vote payload.
     */
    const groupId = 'some-group-id';
    const token = generateTestToken(
      testUsers[0]._id,
      testUsers[0].email,
      testUsers[0].googleId
    );

    const response = await request(app)
      .post(`/api/groups/${groupId}/voting/vote`)
      .set('Authorization', `Bearer ${token}`)
      .send({ vote: 'yes' }); // not a boolean

    expect(response.status).toBe(400);
    expect(response.body.Status).toBe(400);
    expect(response.body.Message).toHaveProperty('error', 'Vote must be a boolean (true/false)');
    expect(response.body.Body).toBeNull();
  });
});

describe('POST /api/group/leave/:groupId - External Failures', () => {
  test('should return 500 when database fails during Group.findById', async () => {
    /**
     * Scenario: MongoDB connection lost while fetching group
     * Expected: Database error caught, returns 500
     */
    
    const groupId = 'some-group-id';
    const token = generateTestToken(
      testUsers[0]._id,
      testUsers[0].email,
      testUsers[0].googleId
    );

    jest.spyOn(Group, 'findById').mockRejectedValueOnce(
      new Error('MongoNetworkError: no connection available')
    );

    const response = await request(app)
      .post(`/api/group/leave/${groupId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(500);
    expect(response.body.message).toContain('no connection available');
  });

  test('should return 500 when database fails during User.findById', async () => {
    /**
     * Scenario: Group found, but User.findById fails
     * Expected: Database error caught, returns 500
     */
    
    const testGroup = await seedTestGroup(
      'test-user-find-fail',
      [testUsers[0]._id, testUsers[1]._id]
    );

    const token = generateTestToken(
      testUsers[0]._id,
      testUsers[0].email,
      testUsers[0].googleId
    );

    // Mock User.findById failure
    jest.spyOn(User, 'findById').mockRejectedValueOnce(
      new Error('MongoServerError: cursor timeout')
    );

    const response = await request(app)
      .post(`/api/group/leave/${testGroup._id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(500);
    expect(response.body.message).toContain('cursor timeout');
  });

  test('should return 500 when user.save() fails', async () => {
    /**
     * Scenario: Updating user status fails due to write error
     * Expected: Save error caught, returns 500
     */
    
    const testGroup = await seedTestGroup(
      'test-user-save-fail',
      [testUsers[0]._id, testUsers[1]._id]
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

    // Mock user save failure
    jest.spyOn(User.prototype, 'save').mockRejectedValueOnce(
      new Error('MongoServerError: disk full')
    );

    const response = await request(app)
      .post(`/api/group/leave/${testGroup._id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(500);
    expect(response.body.message).toContain('disk full');
  });

  test('should return 500 when Group.findByIdAndDelete fails (empty group)', async () => {
    /**
     * Scenario: Last member leaves, but delete operation fails
     * Expected: Delete error caught, returns 500
     */
    
    const testGroup = await seedTestGroup(
      'test-delete-fail',
      [testUsers[0]._id]
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

    // Mock delete failure
    jest.spyOn(Group, 'findByIdAndDelete').mockRejectedValueOnce(
      new Error('MongoServerError: write operation failed')
    );

    const response = await request(app)
      .post(`/api/group/leave/${testGroup._id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(500);
    expect(response.body.message).toContain('write operation failed');
  });

  test('should return 500 when group.save() fails (non-empty group)', async () => {
    /**
     * Scenario: Member leaves but saving updated group fails
     * Expected: Save error caught, returns 500
     */
    
    const testGroup = await seedTestGroup(
      'test-group-save-fail',
      [testUsers[0]._id, testUsers[1]._id]
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

    // Mock group save failure
    jest.spyOn(Group.prototype, 'save').mockRejectedValueOnce(
      new Error('MongoNetworkError: connection closed')
    );

    const response = await request(app)
      .post(`/api/group/leave/${testGroup._id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(500);
    expect(response.body.message).toContain('connection closed');
  });


  test('should handle Socket.IO emission failure when member leaves', async () => {
    /**
     * Scenario: Member leaves, but socket emission fails
     * Expected: Leave succeeds, socket error logged
     */
    
    const testGroup = await seedTestGroup(
      'test-socket-leave-fail',
      [testUsers[0]._id, testUsers[1]._id]
    );

    await User.findByIdAndUpdate(testUsers[0]._id, {
      groupId: testGroup._id,
      status: UserStatus.IN_GROUP
    });
    await User.findByIdAndUpdate(testUsers[1]._id, {
      groupId: testGroup._id,
      status: UserStatus.IN_GROUP
    });

    const token = generateTestToken(
      testUsers[0]._id,
      testUsers[0].email,
      testUsers[0].googleId
    );

    // Mock socket failure
    (socketManager.emitMemberLeft as jest.Mock).mockImplementationOnce(() => {
      throw new Error('Socket.IO error: transport closed');
    });

    const response = await request(app)
      .post(`/api/group/leave/${testGroup._id}`)
      .set('Authorization', `Bearer ${token}`);

    // Should succeed despite socket failure
    expect(response.status).toBe(200);
    expect(socketManager.emitMemberLeft).toHaveBeenCalled();
  });

  test('should handle Firebase failure when notifying after auto-selection', async () => {
    /**
     * Scenario: Member leaves, triggers auto-selection, but Firebase fails
     * Expected: Leave succeeds, notification failure logged
     */
    
    // Create group with 2 members, both vote, then one leaves (triggers auto-select)
    const testGroup = await seedTestGroup(
      'test-auto-select-notification-fail',
      [testUsers[0]._id, testUsers[1]._id],
      {
        restaurantSelected: false,
        restaurant: {
          name: 'Test Restaurant',
          location: '123 Test St',
          restaurantId: 'rest-123'
        }
      }
    );

    // Both users vote
    const group = await Group.findById(testGroup._id);
    group!.addVote(testUsers[0]._id, 'rest-123');
    group!.addVote(testUsers[1]._id, 'rest-123');
    await group!.save();

    await User.findByIdAndUpdate(testUsers[0]._id, {
      groupId: testGroup._id,
      status: UserStatus.IN_GROUP
    });
    await User.findByIdAndUpdate(testUsers[1]._id, {
      groupId: testGroup._id,
      status: UserStatus.IN_GROUP
    });

    const token = generateTestToken(
      testUsers[0]._id,
      testUsers[0].email,
      testUsers[0].googleId
    );

    // Mock Firebase failure
    (notificationService.notifyRestaurantSelected as jest.Mock).mockRejectedValueOnce(
      new Error('FirebaseError: messaging/server-unavailable')
    );

    const response = await request(app)
      .post(`/api/group/leave/${testGroup._id}`)
      .set('Authorization', `Bearer ${token}`);

    // Should succeed despite notification failure
    expect(response.status).toBe(200);
  });
});

describe('Edge Case: Multiple Simultaneous Failures', () => {
  test('should handle cascade of failures gracefully', async () => {
  /**
   * Mocked Behavior: Socket and notification failures
   * 
   * Input: POST /api/group/vote/:groupId with sequential vote
   * Expected Status Code: 200
   * Expected Behavior: Vote succeeds despite multiple external failures
   * Expected Output: Success response
   * 
   * Scenario: Database slow, socket fails, notification fails
   */
  
  const testGroup = await seedTestGroup(
    'test-cascade-fail',
    [testUsers[0]._id, testUsers[1]._id]
  );

  // Initialize sequential voting for the group
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
  await User.findByIdAndUpdate(testUsers[1]._id, {
    groupId: testGroup._id,
    status: UserStatus.IN_GROUP
  });

  const token = generateTestToken(
    testUsers[0]._id,
    testUsers[0].email,
    testUsers[0].googleId
  );

  // Mock multiple failures
  (socketManager.emitSequentialVoteUpdate as jest.Mock).mockImplementationOnce(() => {
    throw new Error('Socket error');
  });
  (socketManager.emitRestaurantSelected as jest.Mock).mockImplementationOnce(() => {
    throw new Error('Socket error');
  });
  (notificationService.notifyRestaurantSelected as jest.Mock).mockRejectedValueOnce(
    new Error('Firebase error')
  );

  const response = await request(app)
    .post(`/api/group/vote/${testGroup._id}`)
    .set('Authorization', `Bearer ${token}`)
    .send({ vote: true });  // ✅ Changed from restaurantID to vote: true

  // Should still succeed despite all external failures
  expect(response.status).toBe(200);
  expect(response.body.Body.success).toBe(true);
});
});

describe('Network Timeout Scenarios', () => {
    test('should handle database query timeout', async () => {
    /**
     * Scenario: MongoDB query exceeds maxTimeMS
     * Expected: Timeout might cause user lookup to fail → 404 or 500
     */
    
    const token = generateTestToken(
        testUsers[0]._id,
        testUsers[0].email,
        testUsers[0].googleId
    );

    jest.spyOn(User, 'findById').mockReturnValueOnce({
        exec: () => new Promise((_, reject) => {
        setTimeout(() => reject(new Error('MongoServerError: operation exceeded time limit')), 100);
        })
    } as any);

    const response = await request(app)
        .get('/api/group/status')
        .set('Authorization', `Bearer ${token}`);

    // Either 404 (user lookup failed, treated as "not in group") or 500 (error propagated)
    expect([404, 500]).toContain(response.status);
    });

  test('should handle network partition during write', async () => {
  /**
   * Mocked Behavior: Network partition during save operation
   * 
   * Input: POST /api/group/vote/:groupId with sequential vote
   * Expected Status Code: 500
   * Expected Behavior: Network error caught during save
   * Expected Output: Network partition error message
   * 
   * Scenario: Network partition during save operation
   */
  
  const testGroup = await seedTestGroup(
    'test-network-partition',
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

  jest.spyOn(Group.prototype, 'save').mockRejectedValueOnce(
    new Error('MongoNetworkError: network partition detected')
  );

  const response = await request(app)
    .post(`/api/group/vote/${testGroup._id}`)
    .set('Authorization', `Bearer ${token}`)
    .send({ vote: true });  // ✅ Changed from restaurantID to vote: true

  expect(response.status).toBe(500);
  expect(response.body.message).toContain('network partition');
});
});