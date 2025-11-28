// tests/with-mocks/matching.mock.test.ts

/**
 * Matching Routes Tests - With Mocking (Uncontrollable Failures)
 * 
 * This test suite covers UNCONTROLLABLE failures:
 * - Database connection errors
 * - Database query timeouts
 * - Save/delete operation failures
 * - Network errors
 * 
 * Tests how application handles failures that cannot be reliably triggered
 * in no-mocks tests using real database.
 */

// Mock all dependencies BEFORE imports
jest.mock('../../src/models/Room');
jest.mock('../../src/models/User');
jest.mock('../../src/models/Group');
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
  }
}));
jest.mock('../../src/services/notificationService', () => ({
  notifyRoomMatched: jest.fn(),
  notifyRoomExpired: jest.fn()
}));

import request from 'supertest';
import app from '../../src/app';
import { generateTestToken } from '../helpers/auth.helper';
import Room from '../../src/models/Room';
import User, { UserStatus } from '../../src/models/User';
import mongoose from 'mongoose';

// Get typed mocks
const mockedRoom = Room as jest.Mocked<typeof Room>;
const mockedUser = User as jest.Mocked<typeof User>;

describe('POST /api/matching/join - With Mocking', () => {
  /**
   * Interface: POST /api/matching/join
   * Mocking: Database (Room, User models), Socket.IO, Notifications
   */

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should return 500 when user not found in database', async () => {
    /**
     * Mocked Behavior: User.findById() returns null
     * 
     * Input: POST /api/matching/join with valid token
     * Expected Status Code: 500
     * Expected Behavior: Service throws "User not found" error
     * Expected Output: Error message "User not found"
     * 
     * Scenario: User's token is valid, but user doesn't exist in database
     * This verifies error handling when user account was deleted but they still have a valid token
     */
    mockedUser.findById.mockResolvedValue(null);

    const token = generateTestToken('test-user-123');

    const response = await request(app)
      .post('/api/matching/join')
      .set('Authorization', `Bearer ${token}`)
      .send({ cuisine: ['italian'], budget: 50 });

    expect(response.status).toBe(500);
    expect(response.body.message).toBe('User not found');
    expect(response.body.statusCode).toBe(500);
    expect(mockedUser.findById).toHaveBeenCalledWith('test-user-123');
  });

  test('should return 500 when database connection fails', async () => {
    /**
     * Mocked Behavior: User.findById() throws connection error
     * 
     * Input: POST /api/matching/join
     * Expected Status Code: 500
     * Expected Behavior: Database connection fails
     * Expected Output: Connection error message
     * 
     * Scenario: Database connection is lost during operation
     * This verifies graceful handling of database failures
     */
    mockedUser.findById.mockRejectedValue(new Error('Database connection lost'));

    const token = generateTestToken('test-user-123');

    const response = await request(app)
      .post('/api/matching/join')
      .set('Authorization', `Bearer ${token}`)
      .send({ cuisine: ['italian'] });

    expect(response.status).toBe(500);
    expect(response.body.message).toBe('Database connection lost');
  });

  test('should return 500 when user already in active room', async () => {
  /**
   * Mocked Behavior: User has roomId, Room exists with user in members
   * 
   * Input: POST /api/matching/join when user is in an active room
   * Expected Status Code: 500
   * Expected Behavior: Service throws "already in an active room" error
   * Expected Output: Error message about already being in a room
   */

  const roomId = 'existing-room-id';
  const userId = 'test-user-123';

  // ✅ Mock the room that the user is in
  const mockRoom = {
    _id: roomId,
    status: 'waiting',  // Active room
    members: [userId, 'other-user'],  // ← User is in the members array
    completionTime: new Date(Date.now() + 60000),
  };

  const mockUser = {
    _id: userId,
    roomId: roomId,
    groupId: null,
    save: jest.fn()
  };

  mockedUser.findById.mockResolvedValue(mockUser as any);
  mockedRoom.findById.mockResolvedValue(mockRoom as any);  // ← ADD THIS

  const token = generateTestToken(userId);

  const response = await request(app)
    .post('/api/matching/join')
    .set('Authorization', `Bearer ${token}`)
    .send({ cuisine: ['italian'] });

  expect(response.status).toBe(500);
  expect(response.body.message).toMatch(/already in an active room/i);
});

  test('should return 500 when Room.find() fails', async () => {
    /**
     * Mocked Behavior: User found, but Room.find() throws error
     * 
     * Input: POST /api/matching/join
     * Expected Status Code: 500
     * Expected Behavior: Finding matching rooms fails
     * Expected Output: Query timeout error
     * 
     * Scenario: Finding matching rooms fails due to database error
     * This verifies error handling during room search
     */
    const mockUser = {
      _id: 'test-user-123',
      roomId: null,
      groupId: null,
      budget: 50,
      radiusKm: 5,
      preference: ['italian'],
      save: jest.fn().mockResolvedValue(true)
    };

    mockedUser.findById.mockResolvedValue(mockUser as any);
    mockedRoom.find.mockRejectedValue(new Error('Query timeout'));

    const token = generateTestToken('test-user-123');

    const response = await request(app)
      .post('/api/matching/join')
      .set('Authorization', `Bearer ${token}`)
      .send({ cuisine: ['italian'] });

    expect(response.status).toBe(500);
    expect(response.body.message).toBe('Query timeout');
  });

  test('should return 500 when Room.create() fails', async () => {
    /**
     * Mocked Behavior: User found, no matches, but Room.create() fails
     * 
     * Input: POST /api/matching/join
     * Expected Status Code: 500
     * Expected Behavior: Creating new room fails
     * Expected Output: Failed to create room error
     * 
     * Scenario: Creating new room fails due to database error
     * This verifies error handling when room creation fails
     */
    const mockUser = {
      _id: 'test-user-123',
      roomId: null,
      groupId: null,
      budget: 50,
      radiusKm: 5,
      preference: ['italian'],
      save: jest.fn().mockResolvedValue(true)
    };

    mockedUser.findById.mockResolvedValue(mockUser as any);
    mockedRoom.find.mockResolvedValue([]);
    mockedRoom.create.mockRejectedValue(new Error('Failed to create room'));

    const token = generateTestToken('test-user-123');

    const response = await request(app)
      .post('/api/matching/join')
      .set('Authorization', `Bearer ${token}`)
      .send({ cuisine: ['italian'] });

    expect(response.status).toBe(500);
    expect(response.body.message).toBe('Failed to create room');
  });

  test('should return 400 when invalid ObjectId format', async () => {
    /**
     * Mocked Behavior: User.findById() throws CastError
     * 
     * Input: POST /api/matching/join with invalid userId
     * Expected Status Code: 400
     * Expected Behavior: Mongoose throws CastError
     * Expected Output: Invalid data format error
     * 
     * Scenario: Invalid user ID format causes CastError
     * This verifies handling of malformed IDs
     */
    const castError = new Error('Cast to ObjectId failed') as any;
    castError.name = 'CastError';

    mockedUser.findById.mockRejectedValue(castError);

    const token = generateTestToken('invalid-id-format');

    const response = await request(app)
      .post('/api/matching/join')
      .set('Authorization', `Bearer ${token}`)
      .send({ cuisine: ['italian'] });

    expect(response.status).toBe(400);
    expect(response.body.message).toBe('Invalid data format');
  });

  test('should return 400 when user.save() fails with ValidationError', async () => {
    /**
     * Mocked Behavior: User found, but user.save() throws ValidationError
     * 
     * Input: POST /api/matching/join
     * Expected Status Code: 400
     * Expected Behavior: Mongoose validation fails
     * Expected Output: Validation error message
     * 
     * Scenario: Saving user with invalid data fails validation
     * This verifies validation error handling
     */
    const validationError = new Error('Validation failed: budget must be positive') as any;
    validationError.name = 'ValidationError';

    const mockUser = {
      _id: 'test-user-123',
      roomId: null,
      groupId: null,
      budget: -10,
      save: jest.fn().mockRejectedValue(validationError)
    };

    mockedUser.findById.mockResolvedValue(mockUser as any);

    const token = generateTestToken('test-user-123');

    const response = await request(app)
      .post('/api/matching/join')
      .set('Authorization', `Bearer ${token}`)
      .send({ cuisine: ['italian'], budget: -10 });

    expect(response.status).toBe(400);
    expect(response.body.message).toContain('Validation failed');
  });

   test('should handle room deletion during group creation', async () => {
  /**
   * Mocked Behavior: Room.findById returns null in createGroupFromRoom
   */
  
  const mockUser = {
    _id: 'test-user-10',
    name: 'Test User 10',
    roomId: null,
    groupId: null,
    preference: ['italian'],
    budget: 50,
    radiusKm: 5,
    currentLatitude: 49.2827,
    currentLongitude: -123.1207,
    save: jest.fn().mockResolvedValue(true)
  };

  const existingMembers = Array.from({ length: 9 }, (_, i) => `user-${i}`);
  
  const mockRoom = {
    _id: 'room-id',
    members: [...existingMembers, 'test-user-10'],  // 10 members
    status: 'waiting',
    completionTime: new Date(Date.now() + 60000),
    cuisines: ['italian'],
    averageBudget: 50,
    averageRadius: 5,
    maxMembers: 10,
    save: jest.fn().mockResolvedValue(true),
    toJSON: jest.fn().mockReturnValue({ _id: 'room-id' })
  };

  // Mock users for updateRoomAverages
  const mockUsers = existingMembers.map(id => ({
    _id: id,
    budget: 50,
    radiusKm: 5,
    currentLatitude: 49.2827,
    currentLongitude: -123.1207,
    preference: ['italian']
  }));

  mockedUser.findById.mockResolvedValue(mockUser as any);
  mockedRoom.find.mockResolvedValue([mockRoom] as any);
  mockedUser.find.mockResolvedValue([...mockUsers, mockUser] as any);  // ← ADD THIS
  
  mockedRoom.findById
    .mockResolvedValueOnce(mockRoom as any)
    .mockResolvedValueOnce(null);

  const token = generateTestToken('test-user-10');

  const response = await request(app)
    .post('/api/matching/join')
    .set('Authorization', `Bearer ${token}`)
    .send({ cuisine: ['italian'], budget: 50, radiusKm: 5 });

  expect(response.status).toBe(500);
  expect(response.body.message).toMatch(/Failed to create room/i);
});
});

describe('PUT /api/matching/leave/:roomId - With Mocking', () => {
  /**
   * Interface: PUT /api/matching/leave/:roomId
   * Mocking: Database (Room, User models), Socket.IO, Notifications
   */

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should return 500 when user not found', async () => {
    /**
     * Mocked Behavior: User.findById() returns null
     * 
     * Input: PUT /api/matching/leave/:roomId
     * Expected Status Code: 500
     * Expected Behavior: Service throws "User not found" error
     * Expected Output: Error message "User not found"
     * 
     * Scenario: Valid token but user doesn't exist
     * This verifies error handling for deleted users
     */
    mockedUser.findById.mockResolvedValue(null);

    const roomId = new mongoose.Types.ObjectId().toString();
    const token = generateTestToken('test-user-123');

    const response = await request(app)
      .put(`/api/matching/leave/${roomId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(500);
    expect(response.body.message).toBe('User not found');
  });

  test('should return 500 when User.findById() fails during leave room', async () => {
  /**
   * Mocked Behavior: User.findById throws database error
   * 
   * Input: PUT /api/matching/leave/:roomId
   * Expected Status Code: 500
   * Expected Behavior: Database error when fetching user
   * Expected Output: Error message about database failure
   */

  mockedUser.findById.mockRejectedValue(new Error('Database timeout'));

  const token = generateTestToken('test-user-123');

  const response = await request(app)
    .put('/api/matching/leave/room-id')
    .set('Authorization', `Bearer ${token}`);

  expect(response.status).toBe(500);
  expect(response.body.message).toMatch(/Database timeout/i);
});

  test('should handle gracefully when room not found (cleanup stale state)', async () => {
  /**
   * Mocked Behavior: Room.findById returns null
   */

  const mockUser = {
    _id: 'test-user-123',
    roomId: 'stale-room-id' as string | null,  // ← Allow null
    status: 'in_waiting_room' as string,
    save: jest.fn().mockImplementation(() => {
      // Manually update the mock object properties
      mockUser.roomId = null;
      mockUser.status = 'online';
      return Promise.resolve(mockUser);
    })
  };

  mockedUser.findById.mockResolvedValue(mockUser as any);
  mockedRoom.findById.mockResolvedValue(null);

  const token = generateTestToken('test-user-123');

  const response = await request(app)
    .put('/api/matching/leave/stale-room-id')
    .set('Authorization', `Bearer ${token}`);

  expect(response.status).toBe(200);
  expect(mockUser.save).toHaveBeenCalled();
  expect(mockUser.roomId).toBeNull();
});
  

  test('should return 500 when user.save() fails during leave room', async () => {
  /**
   * Mocked Behavior: user.save() throws database error
   * 
   * Input: PUT /api/matching/leave/:roomId
   * Expected Status Code: 500
   * Expected Behavior: Database error when saving user after leaving room
   * Expected Output: Error message about failed user save
   * 
   * Scenario: User leaves room, but saving the updated user fails
   */

  const mockUser = {
    _id: 'test-user-123',
    name: 'Test User',
    roomId: 'room-id',
    status: 'in_waiting_room' as string,
    save: jest.fn().mockRejectedValue(new Error('Failed to save user'))  // ← Reject on save
  };

  const mockRoom = {
    _id: 'room-id',
    members: ['test-user-123', 'other-user'],  // 2 members
    status: 'waiting',
    completionTime: new Date(Date.now() + 60000),
    cuisines: ['italian'],
    averageBudget: 50,
    averageRadius: 5,
    averageLatitude: 49.2827,
    averageLongitude: -123.1207,
    save: jest.fn().mockResolvedValue(true)
  };

  const mockOtherUser = {
    _id: 'other-user',
    budget: 50,
    radiusKm: 5,
    currentLatitude: 49.2827,
    currentLongitude: -123.1207,
    preference: ['italian']
  };

  mockedUser.findById.mockResolvedValue(mockUser as any);
  mockedRoom.findById.mockResolvedValue(mockRoom as any);
  mockedUser.find.mockResolvedValue([mockOtherUser] as any);

  const token = generateTestToken('test-user-123');

  const response = await request(app)
    .put('/api/matching/leave/room-id')
    .set('Authorization', `Bearer ${token}`);

  expect(response.status).toBe(500);
  expect(response.body.message).toMatch(/Failed to save user/i);
});

  test('should return 500 when Room.findByIdAndDelete() fails', async () => {
    /**
     * Mocked Behavior: Last member leaves, but Room.findByIdAndDelete() fails
     * 
     * Input: PUT /api/matching/leave/:roomId
     * Expected Status Code: 500
     * Expected Behavior: Deleting empty room fails
     * Expected Output: Delete failed error
     * 
     * Scenario: Deleting empty room fails
     * This verifies error handling when room deletion fails
     */
    const mockUser = {
      _id: 'test-user-123',
      name: 'Test User',
      roomId: 'room-123',
      status: UserStatus.IN_WAITING_ROOM,
      save: jest.fn().mockResolvedValue(true)
    };

    const mockRoom = {
      _id: 'room-123',
      members: ['test-user-123'],
      save: jest.fn()
    };

    mockedUser.findById.mockResolvedValue(mockUser as any);
    mockedRoom.findById.mockResolvedValue(mockRoom as any);
    mockedRoom.findByIdAndDelete.mockRejectedValue(new Error('Delete failed'));

    const roomId = 'room-123';
    const token = generateTestToken('test-user-123');

    const response = await request(app)
      .put(`/api/matching/leave/${roomId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(500);
    expect(response.body.message).toBe('Delete failed');
  });
});

describe('GET /api/matching/status/:roomId - With Mocking', () => {
  /**
   * Interface: GET /api/matching/status/:roomId
   * Mocking: Database (Room model), Socket.IO, Notifications
   */

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should return 500 when room not found', async () => {
    /**
     * Mocked Behavior: Room.findById() returns null
     * 
     * Input: GET /api/matching/status/:roomId
     * Expected Status Code: 500
     * Expected Behavior: Service throws "Room not found" error
     * Expected Output: Error message "Room not found"
     * 
     * Scenario: Room doesn't exist in database
     * This verifies error handling for non-existent rooms
     */
    mockedRoom.findById.mockResolvedValue(null);

    const roomId = new mongoose.Types.ObjectId().toString();
    const token = generateTestToken('test-user-123');

    const response = await request(app)
      .get(`/api/matching/status/${roomId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(500);
    expect(response.body.message).toBe('Room not found');
  });

  test('should return 500 when database query fails', async () => {
    /**
     * Mocked Behavior: Room.findById() throws error
     * 
     * Input: GET /api/matching/status/:roomId
     * Expected Status Code: 500
     * Expected Behavior: Database query fails
     * Expected Output: Connection refused error
     * 
     * Scenario: Database error when finding room
     * This verifies error handling during database failures
     */
    mockedRoom.findById.mockRejectedValue(new Error('Connection refused'));

    const roomId = new mongoose.Types.ObjectId().toString();
    const token = generateTestToken('test-user-123');

    const response = await request(app)
      .get(`/api/matching/status/${roomId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(500);
    expect(response.body.message).toBe('Connection refused');
  });

  test('should return 400 for invalid ObjectId format', async () => {
    /**
     * Mocked Behavior: Room.findById() throws CastError
     * 
     * Input: GET /api/matching/status/invalid-id
     * Expected Status Code: 400
     * Expected Behavior: Mongoose throws CastError
     * Expected Output: Invalid data format error
     * 
     * Scenario: Invalid room ID format
     * This verifies handling of malformed IDs
     */
    const castError = new Error('Cast to ObjectId failed') as any;
    castError.name = 'CastError';

    mockedRoom.findById.mockRejectedValue(castError);

    const roomId = 'invalid-id-format';
    const token = generateTestToken('test-user-123');

    const response = await request(app)
      .get(`/api/matching/status/${roomId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(400);
    expect(response.body.message).toBe('Invalid data format');
  });
});

describe('GET /api/matching/users/:roomId - With Mocking', () => {
  /**
   * Interface: GET /api/matching/users/:roomId
   * Mocking: Database (Room model), Socket.IO, Notifications
   */

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should return 500 when room not found', async () => {
    /**
     * Mocked Behavior: Room.findById() returns null
     * 
     * Input: GET /api/matching/users/:roomId
     * Expected Status Code: 500
     * Expected Behavior: Service throws "Room not found" error
     * Expected Output: Error message "Room not found"
     * 
     * Scenario: Room doesn't exist
     * This verifies error handling for missing rooms
     */
    mockedRoom.findById.mockResolvedValue(null);

    const roomId = new mongoose.Types.ObjectId().toString();
    const token = generateTestToken('test-user-123');

    const response = await request(app)
      .get(`/api/matching/users/${roomId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(500);
    expect(response.body.message).toBe('Room not found');
  });

  test('should return 500 when database connection fails', async () => {
    /**
     * Mocked Behavior: Room.findById() throws error
     * 
     * Input: GET /api/matching/users/:roomId
     * Expected Status Code: 500
     * Expected Behavior: Database query fails
     * Expected Output: Network error
     * 
     * Scenario: Database error
     * This verifies error handling during database failures
     */
    mockedRoom.findById.mockRejectedValue(new Error('Network error'));

    const roomId = new mongoose.Types.ObjectId().toString();
    const token = generateTestToken('test-user-123');

    const response = await request(app)
      .get(`/api/matching/users/${roomId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(500);
    expect(response.body.message).toBe('Network error');
  });
});

// In matching.mock.test.ts

describe('POST /api/matching/join - Location Error Handling', () => {
  /**
   * Interface: POST /api/matching/join
   * Mocking: Database (Room, User models)
   */

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should handle Room.find() failure when filtering by location', async () => {
  /**
   * Mocked Behavior: Room.find() throws database error
   * 
   * Input: POST /api/matching/join with location
   * Expected Status Code: 500
   * Expected Behavior: Database query fails during room search
   * Expected Output: Error message about database failure
   */

  const mockUser = {
    _id: 'test-user-123',
    roomId: null,
    groupId: null,
    preference: ['italian'],
    budget: 50,
    radiusKm: 5,
    currentLatitude: 49.2827,
    currentLongitude: -123.1207,
    save: jest.fn().mockResolvedValue(true)
  };

  mockedUser.findById.mockResolvedValue(mockUser as any);
  
  // Mock Room.find() to throw database error
  mockedRoom.find.mockRejectedValue(new Error('Database connection lost'));

  const token = generateTestToken('test-user-123');

  const response = await request(app)
    .post('/api/matching/join')
    .set('Authorization', `Bearer ${token}`)
    .send({ 
      cuisine: ['italian'], 
      budget: 50, 
      radiusKm: 5,
      latitude: 49.2827,
      longitude: -123.1207
    });

  expect(response.status).toBe(500);
  expect(response.body.message).toMatch(/Database connection lost/i);
});
 test('should handle Room.create() failure when creating room with location', async () => {
  /**
   * Mocked Behavior: Room.create() fails when saving location data
   * 
   * Input: POST /api/matching/join with location, no matching rooms
   * Expected Status Code: 500
   * Expected Behavior: Room creation fails due to validation error
   * Expected Output: Error message about room creation failure
   */

  const mockUser = {
    _id: 'test-user-123',
    roomId: null,
    groupId: null,
    preference: ['italian'],
    budget: 50,
    radiusKm: 5,
    currentLatitude: 49.2827,
    currentLongitude: -123.1207,
    save: jest.fn().mockResolvedValue(true)
  };

  mockedUser.findById.mockResolvedValue(mockUser as any);
  mockedRoom.find.mockResolvedValue([]);  // No existing rooms
  
  // Mock Room.create() to fail with validation error
  mockedRoom.create.mockRejectedValue(
    new Error('Validation failed: averageLatitude must be between -90 and 90')
  );

  const token = generateTestToken('test-user-123');

  const response = await request(app)
    .post('/api/matching/join')
    .set('Authorization', `Bearer ${token}`)
    .send({ 
      cuisine: ['italian'], 
      budget: 50, 
      radiusKm: 5,
      latitude: 49.2827,
      longitude: -123.1207
    });

  expect(response.status).toBe(500);
  expect(response.body.message).toMatch(/Validation failed/i);
});
test('should handle User.save() failure when updating user location', async () => {
  /**
   * Mocked Behavior: User.save() fails when updating location
   * 
   * Input: POST /api/matching/join with location
   * Expected Status Code: 500
   * Expected Behavior: User location update fails
   * Expected Output: Error message about user update failure
   */

  const mockUser = {
    _id: 'test-user-123',
    roomId: null,
    groupId: null,
    preference: ['italian'],
    budget: 50,
    radiusKm: 5,
    currentLatitude: null,
    currentLongitude: null,
    save: jest.fn()
      .mockRejectedValueOnce(new Error('User location update failed'))  // First save fails
  };

  mockedUser.findById.mockResolvedValue(mockUser as any);

  const token = generateTestToken('test-user-123');

  const response = await request(app)
    .post('/api/matching/join')
    .set('Authorization', `Bearer ${token}`)
    .send({ 
      cuisine: ['italian'], 
      budget: 50, 
      radiusKm: 5,
      latitude: 49.2827,
      longitude: -123.1207
    });

  expect(response.status).toBe(500);
  expect(response.body.message).toMatch(/User location update failed/i);
});
test('should handle User.find() failure when calculating room location average', async () => {
  /**
   * Mocked Behavior: User.find() fails during room average calculation
   * 
   * Input: POST /api/matching/join, user joins existing room
   * Expected Status Code: 500
   * Expected Behavior: Fails when calculating average location for room
   * Expected Output: Error message about user lookup failure
   */

  const mockUser = {
    _id: 'test-user-123',
    roomId: null,
    groupId: null,
    preference: ['italian'],
    budget: 50,
    radiusKm: 5,
    currentLatitude: 49.2827,
    currentLongitude: -123.1207,
    save: jest.fn().mockResolvedValue(true)
  };

  const mockExistingRoom = {
    _id: 'existing-room-id',
    status: 'waiting',
    completionTime: new Date(Date.now() + 60000),
    members: ['other-user'],
    cuisines: ['italian'],
    averageBudget: 50,
    averageRadius: 5,
    averageLatitude: 49.2827,
    averageLongitude: -123.1207,
    push: jest.fn(),
    save: jest.fn().mockResolvedValue(true),
    toJSON: jest.fn().mockReturnValue({
      _id: 'existing-room-id',
      members: ['other-user', 'test-user-123']
    })
  };

  // First User.findById returns the joining user
  mockedUser.findById.mockResolvedValue(mockUser as any);
  
  // Room.find returns matching room
  mockedRoom.find.mockResolvedValue([mockExistingRoom] as any);
  
  // User.find fails when trying to calculate room averages
  mockedUser.find.mockRejectedValue(new Error('Failed to fetch room members'));

  const token = generateTestToken('test-user-123');

  const response = await request(app)
    .post('/api/matching/join')
    .set('Authorization', `Bearer ${token}`)
    .send({ 
      cuisine: ['italian'], 
      budget: 50, 
      radiusKm: 5,
      latitude: 49.2827,
      longitude: -123.1207
    });

  expect(response.status).toBe(500);
  expect(response.body.message).toMatch(/Failed to fetch room members/i);
});
});