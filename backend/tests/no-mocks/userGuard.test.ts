// This checks userGuard file
// tests/unit/controller-type-guards.test.ts

/**
 * Controller Type Guard Tests
 * 
 * These tests specifically cover the ensureAuthenticated type guards
 * in controller methods. These guards are defensive checks that should
 * never trigger in production (auth middleware runs first), but we test
 * them for 100% code coverage.
 */

import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../src/types';
import { userController } from '../../src/controllers/user.controller';
import { groupController } from '../../src/controllers/group.controller';
import { matchingController } from '../../src/controllers/matching.controller';
import { credibilityController } from '../../src/controllers/credibility.controller';
import { connectDatabase, disconnectDatabase } from '../../src/config/database';
import { cleanTestData } from '../helpers/seed.helper';

describe('User Controller Type Guards', () => {
  let req: Partial<AuthRequest>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    req = {
      headers: {},
      body: {},
      params: {},
      user: undefined // Simulate missing user (middleware failure)
    };
    
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    
    next = jest.fn();
    
    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  test('getUserSettings should return 401 when req.user is undefined', async () => {
    await userController.getUserSettings(
      req as AuthRequest,
      res as Response,
      next
    );

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      Status: 401,
      Message: { error: 'Unauthorized - User not authenticated' },
      Body: null
    });
    expect(next).not.toHaveBeenCalled();
  });

  test('createUserProfile should return 401 when req.user is undefined', async () => {
    req.body = { name: 'Test User' };

    await userController.createUserProfile(
      req as AuthRequest,
      res as Response,
      next
    );

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      Status: 401,
      Message: { error: 'Unauthorized - User not authenticated' },
      Body: null
    });
    expect(next).not.toHaveBeenCalled();
  });

  test('updateUserSettings should return 401 when req.user is undefined', async () => {
    req.body = { name: 'Updated Name' };

    await userController.updateUserSettings(
      req as AuthRequest,
      res as Response,
      next
    );

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      Status: 401,
      Message: { error: 'Unauthorized - User not authenticated' },
      Body: null
    });
    expect(next).not.toHaveBeenCalled();
  });

  test('updateUserProfile should return 401 when req.user is undefined', async () => {
    req.body = { name: 'Updated Name' };

    await userController.updateUserProfile(
      req as AuthRequest,
      res as Response,
      next
    );

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      Status: 401,
      Message: { error: 'Unauthorized - User not authenticated' },
      Body: null
    });
    expect(next).not.toHaveBeenCalled();
  });

  test('deleteUser should return 401 when req.user is undefined', async () => {
    req.params = { userId: 'some-user-id' };

    await userController.deleteUser(
      req as AuthRequest,
      res as Response,
      next
    );

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      Status: 401,
      Message: { error: 'Unauthorized - User not authenticated' },
      Body: null
    });
    expect(next).not.toHaveBeenCalled();
  });
});

describe('Group Controller Type Guards', () => {
  let req: Partial<AuthRequest>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeAll(async () => {
    await connectDatabase();
  });

  afterAll(async () => {
    await cleanTestData();
    await disconnectDatabase();
  });

  beforeEach(() => {
    req = {
      headers: {},
      body: {},
      params: {},
      user: undefined // Simulate missing user
    };
    
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    
    next = jest.fn();
  });

  test('getGroupStatus should return 401 when req.user is undefined', async () => {
    await groupController.getGroupStatus(
      req as AuthRequest,
      res as Response,
      next
    );

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      Status: 401,
      Message: { error: 'Unauthorized - User not authenticated' },
      Body: null
    });
    expect(next).not.toHaveBeenCalled();
  });

  test('getGroupStatus should return 200 with group status when user is in a group', async () => {
    /**
     * Tests: getGroupStatus() success path
     * Covers: Lines 28-35 in group.controller.ts
     *   - Line 28: const groupId = String(group._id);
     *   - Line 29: const status = await groupService.getGroupStatus(groupId);
     *   - Lines 31-35: res.status(200).json({ Status: 200, Message: {}, Body: status })
     * Input: User in a group
     * Expected: Returns 200 with group status
     */
    const Group = (await import('../../src/models/Group')).default;
    const User = (await import('../../src/models/User')).default;
    const { UserStatus } = await import('../../src/models/User');
    
    // Create test user
    const testUser = await User.create({
      googleId: 'google-controller-test-user',
      email: 'controllertest@example.com',
      name: 'Controller Test User',
      status: UserStatus.IN_GROUP,
      fcmToken: 'mock-fcm-controller',
      budget: 50,
      radiusKm: 10,
      preference: []
    });

    // Create test group
    const testGroup = await Group.create({
      roomId: 'test-room-controller',
      members: [testUser._id.toString()],
      completionTime: new Date(Date.now() + 3600000),
      restaurantSelected: false
    });

    // Link user to group
    testUser.groupId = testGroup._id.toString();
    await testUser.save();

    // Set up request with authenticated user
    req.params = {};
    req.body = {};
    req.user = {
      userId: testUser._id.toString(),
      email: testUser.email,
      googleId: testUser.googleId
    };

    await groupController.getGroupStatus(
      req as AuthRequest,
      res as Response,
      next
    );

    // Verify 200 status was set
    expect(res.status).toHaveBeenCalledWith(200);
    // Verify response was sent with correct format
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        Status: 200,
        Message: {},
        Body: expect.objectContaining({
          groupId: expect.any(String),
          roomId: 'test-room-controller',
          numMembers: 1,
          restaurantSelected: false
        })
      })
    );
    // Verify next was not called (no error)
    expect(next).not.toHaveBeenCalled();

    // Cleanup
    await User.deleteMany({ email: { $regex: /controllertest@example\.com/ } });
    await Group.deleteMany({ roomId: { $regex: /test-room-controller/ } });
  });

  test('voteForRestaurant should return 401 when req.user is undefined', async () => {
    req.params = { groupId: 'group-123' };
    req.body = { restaurantID: 'rest-123' };

    await groupController.voteForRestaurant(
      req as AuthRequest,
      res as Response,
      next
    );

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      Status: 401,
      Message: { error: 'Unauthorized - User not authenticated' },
      Body: null
    });
    expect(next).not.toHaveBeenCalled();
  });

  test('voteForRestaurant should return 400 when vote is not a boolean', async () => {
    /**
     * Tests: voteForRestaurant() validates vote type
     * Covers: Lines 53-59 in group.controller.ts
     *   - Line 53: if (typeof vote !== 'boolean')
     *   - Line 54: res.status(400).json(...)
     *   - Line 59: return
     * Input: vote is a string instead of boolean
     * Expected: Returns 400 status and error message, does not call next
     */
    req.params = { groupId: 'group-123' };
    req.body = { vote: 'yes' }; // String instead of boolean
    req.user = {
      userId: 'user-123',
      email: 'test@example.com',
      googleId: 'google-123'
    };

    await groupController.voteForRestaurant(
      req as AuthRequest,
      res as Response,
      next
    );

    // Verify 400 status was set
    expect(res.status).toHaveBeenCalledWith(400);
    // Verify error response was sent
    expect(res.json).toHaveBeenCalledWith({
      Status: 400,
      Message: { error: 'Vote must be true (yes) or false (no)' },
      Body: null
    });
    // Verify return statement - next should not be called
    expect(next).not.toHaveBeenCalled();
  });

  test('voteForRestaurant should return 400 when vote is undefined', async () => {
    /**
     * Tests: voteForRestaurant() validates vote type when vote is undefined
     * Covers: Lines 53-59 in group.controller.ts
     * Input: vote field is missing (undefined)
     * Expected: Returns 400 status and error message
     */
    req.params = { groupId: 'group-123' };
    req.body = {}; // No vote field
    req.user = {
      userId: 'user-123',
      email: 'test@example.com',
      googleId: 'google-123'
    };

    await groupController.voteForRestaurant(
      req as AuthRequest,
      res as Response,
      next
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      Status: 400,
      Message: { error: 'Vote must be true (yes) or false (no)' },
      Body: null
    });
    expect(next).not.toHaveBeenCalled();
  });

  test('voteForRestaurant should return 400 when vote is a number', async () => {
    /**
     * Tests: voteForRestaurant() validates vote type when vote is a number
     * Covers: Lines 53-59 in group.controller.ts
     * Input: vote is a number (1 or 0)
     * Expected: Returns 400 status and error message
     */
    req.params = { groupId: 'group-123' };
    req.body = { vote: 1 }; // Number instead of boolean
    req.user = {
      userId: 'user-123',
      email: 'test@example.com',
      googleId: 'google-123'
    };

    await groupController.voteForRestaurant(
      req as AuthRequest,
      res as Response,
      next
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      Status: 400,
      Message: { error: 'Vote must be true (yes) or false (no)' },
      Body: null
    });
    expect(next).not.toHaveBeenCalled();
  });

  test('voteForRestaurant should return 200 when vote is valid boolean', async () => {
    /**
     * Tests: voteForRestaurant() success path
     * Covers: Lines 68-80 in group.controller.ts
     *   - Line 68: res.status(200).json({...})
     *   - Lines 69-79: Response body with all fields
     * Input: Valid boolean vote
     * Expected: Returns 200 with result from service
     */
    const groupService = (await import('../../src/services/groupService')).default;
    
    // Mock groupService.submitSequentialVote to return success
    jest.spyOn(groupService, 'submitSequentialVote').mockResolvedValueOnce({
      success: true,
      majorityReached: false,
      message: 'Vote recorded, waiting for other members'
    });

    req.params = { groupId: 'group-123' };
    req.body = { vote: true }; // Valid boolean
    req.user = {
      userId: 'user-123',
      email: 'test@example.com',
      googleId: 'google-123'
    };

    await groupController.voteForRestaurant(
      req as AuthRequest,
      res as Response,
      next
    );

    // Verify 200 status was set
    expect(res.status).toHaveBeenCalledWith(200);
    // Verify success response was sent
    expect(res.json).toHaveBeenCalledWith({
      Status: 200,
      Message: { text: 'Vote recorded, waiting for other members' },
      Body: {
        success: true,
        majorityReached: false,
        result: undefined,
        nextRestaurant: undefined,
        selectedRestaurant: undefined,
        votingComplete: undefined,
        message: 'Vote recorded, waiting for other members'
      }
    });
    // Verify next was not called (no error)
    expect(next).not.toHaveBeenCalled();

    // Restore mock
    jest.restoreAllMocks();
  });

  test('leaveGroup should return 200 when successfully leaving group', async () => {
    /**
     * Tests: leaveGroup() success path
     * Covers: Lines 98-102 in group.controller.ts
     *   - Line 98: res.status(200).json({...})
     *   - Lines 99-101: Response body with success message and groupId
     * Input: Valid groupId and userId
     * Expected: Returns 200 with success message
     */
    const groupService = (await import('../../src/services/groupService')).default;
    
    // Mock groupService.leaveGroup to succeed
    jest.spyOn(groupService, 'leaveGroup').mockResolvedValueOnce(undefined);

    req.params = { groupId: 'group-123' };
    req.body = {};
    req.user = {
      userId: 'user-123',
      email: 'test@example.com',
      googleId: 'google-123'
    };

    await groupController.leaveGroup(
      req as AuthRequest,
      res as Response,
      next
    );

    // Verify 200 status was set
    expect(res.status).toHaveBeenCalledWith(200);
    // Verify success response was sent
    expect(res.json).toHaveBeenCalledWith({
      Status: 200,
      Message: { text: 'Successfully left group' },
      Body: { groupId: 'group-123' }
    });
    // Verify next was not called (no error)
    expect(next).not.toHaveBeenCalled();

    // Restore mock
    jest.restoreAllMocks();
  });

  test('leaveGroup should return 401 when req.user is undefined', async () => {
    req.params = { groupId: 'group-123' };

    await groupController.leaveGroup(
      req as AuthRequest,
      res as Response,
      next
    );

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      Status: 401,
      Message: { error: 'Unauthorized - User not authenticated' },
      Body: null
    });
    expect(next).not.toHaveBeenCalled();
  });
});

describe('Matching Controller Type Guards', () => {
  let req: Partial<AuthRequest>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    req = {
      headers: {},
      body: {},
      params: {},
      user: undefined // Simulate missing user
    };
    
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    
    next = jest.fn();
  });

  test('joinMatching should return 401 when req.user is undefined', async () => {
    req.body = {
      cuisine: 'Italian',
      budget: '$$$',
      radiusKm: 5
    };

    await matchingController.joinMatching(
      req as AuthRequest,
      res as Response,
      next
    );

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      Status: 401,
      Message: { error: 'Unauthorized - User not authenticated' },
      Body: null
    });
    expect(next).not.toHaveBeenCalled();
  });

  test('leaveRoom should return 401 when req.user is undefined', async () => {
    req.params = { roomId: 'room-123' };

    await matchingController.leaveRoom(
      req as AuthRequest,
      res as Response,
      next
    );

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      Status: 401,
      Message: { error: 'Unauthorized - User not authenticated' },
      Body: null
    });
    expect(next).not.toHaveBeenCalled();
  });
});

describe('Credibility Controller Type Guards', () => {
  let req: Partial<AuthRequest>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    req = {
      headers: {},
      body: {},
      params: {},
      user: undefined // Simulate missing user
    };
    
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    
    next = jest.fn();
  });

  test('generateCode should return 401 when req.user is undefined', async () => {
    await credibilityController.generateCode(
      req as AuthRequest,
      res as Response,
      next
    );

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      Status: 401,
      Message: { error: 'Unauthorized - User not authenticated' },
      Body: null
    });
    expect(next).not.toHaveBeenCalled();
  });

  test('verifyCode should return 401 when req.user is undefined', async () => {
    req.body = { code: 'ABC123' };

    await credibilityController.verifyCode(
      req as AuthRequest,
      res as Response,
      next
    );

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      Status: 401,
      Message: { error: 'Unauthorized - User not authenticated' },
      Body: null
    });
    expect(next).not.toHaveBeenCalled();
  });

  test('deductScore should return 401 when req.user is undefined', async () => {
    await credibilityController.deductScore(
      req as AuthRequest,
      res as Response,
      next
    );

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      Status: 401,
      Message: { error: 'Unauthorized - User not authenticated' },
      Body: null
    });
    expect(next).not.toHaveBeenCalled();
  });
});