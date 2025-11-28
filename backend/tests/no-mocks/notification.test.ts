import request from 'supertest';
import app from '../../src/app'; // Assuming the main app instance is exported here
import { generateTestToken } from '../helpers/auth.helper'; // Assuming this helper exists
import { NotificationPayload } from '../../src/types'; // Assuming this type exists
import User from '../../src/models/User';
import * as firebase from '../../src/config/firebase';
import * as tokenManager from '../../src/utils/tokenManager';
// Mock all external dependencies used by the service and router
jest.mock('../../src/models/User');
jest.mock('../../src/config/firebase');
jest.mock('../../src/utils/tokenManager');

// Get typed mocks
const mockUserFindById = User.findById as jest.Mock;
const mockUserFind = User.find as jest.Mock;
const mockSendPushNotification = firebase.sendPushNotification as jest.Mock;
const mockSendMulticastNotification = firebase.sendMulticastNotification as jest.Mock;
const mockUpdateUserToken = tokenManager.updateUserToken as jest.Mock;
const mockClearUserToken = tokenManager.clearUserToken as jest.Mock;

// Import the service file AFTER mocks are set
import service from '../../src/services/notificationService';

/**
 * Notification Tests - No Mocking (Controllable Scenarios)
 * * This test suite covers CONTROLLABLE scenarios:
 * - Successful API calls (200)
 * - Input validation errors (400)
 * - Successful notification service logic (e.g., building payloads)
 * - Spies on internal functions to verify successful flow (e.g., builders calling base functions)
 * * External dependencies (DB, Firebase, tokenManager) are mocked to return success.
 * Does NOT test uncontrollable failures (network, API errors, DB crashes).
 */

describe('Notification Service Logic', () => {
  beforeEach(() => {
    // Clear mock calls and reset implementation before each test
    jest.clearAllMocks();
  });

  // --- sendNotificationToUser Tests ---
  describe('sendNotificationToUser', () => {
    const userId = 'user-token-1';
    const fcmToken = 'token-fcm-123';
    const notification: NotificationPayload = { title: 'Hello', body: 'World', data: { type: 'test' } };
    
    test('should successfully send a notification to a user with a token', async () => {
      /**
       * Input: Valid userId, valid FCM token found in DB.
       * Expected Status Code: N/A (Service Function)
       * Expected Output: Notification is sent successfully.
       * Expected Behavior:
       * - User is retrieved from DB.
       * - sendPushNotification is called with the user's token and sanitized data.
       */
      mockUserFindById.mockResolvedValueOnce({ fcmToken });
      mockSendPushNotification.mockResolvedValueOnce('message-id-123');

      await service.sendNotificationToUser(userId, notification);

      expect(mockUserFindById).toHaveBeenCalledWith(userId);
      expect(mockSendPushNotification).toHaveBeenCalledWith(
        fcmToken,
        notification,
        { type: 'test' } // sanitized data
      );
    });

    test('should log a warning and return if the user has no FCM token registered', async () => {
      /**
       * Input: Valid userId, but user document has fcmToken: null.
       * Expected Status Code: N/A (Service Function)
       * Expected Output: Function returns silently.
       * Expected Behavior:
       * - User is retrieved from DB.
       * - A warning is logged.
       * - sendPushNotification is NOT called.
       */
      mockUserFindById.mockResolvedValueOnce({ fcmToken: null });
      
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      await service.sendNotificationToUser(userId, notification);

      expect(mockUserFindById).toHaveBeenCalledWith(userId);
      expect(mockSendPushNotification).not.toHaveBeenCalled();
      expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('has no FCM token registered'));

      consoleWarnSpy.mockRestore();
    });

    test('should throw an error if the user is not found', async () => {
      /**
       * Input: Invalid userId (user not found in DB).
       * Expected Status Code: N/A (Service Function)
       * Expected Output: Throws "User not found" error.
       * Expected Behavior:
       * - User is retrieved from DB (returns null).
       * - An error is thrown before attempting to send the notification.
       */
      mockUserFindById.mockResolvedValueOnce(null);

      await expect(service.sendNotificationToUser(userId, notification)).rejects.toThrow(
        `User not found: ${userId}`
      );
      expect(mockSendPushNotification).not.toHaveBeenCalled();
    });
  });

  // --- sendNotificationToUsers Tests ---
  describe('sendNotificationToUsers', () => {
    const userIds = ['u1', 'u2', 'u3'];
    const users = [{ fcmToken: 't1' }, { fcmToken: null }, { fcmToken: 't3' }, { fcmToken: 't2' }];
    const notification: NotificationPayload = { title: 'Group Alert', body: 'Go time', data: { event: 'match' } };

    test('should successfully send a multicast notification to all users with tokens', async () => {
      /**
       * Input: List of userIds, some with valid tokens.
       * Expected Status Code: N/A (Service Function)
       * Expected Output: Notification is sent successfully to valid tokens.
       * Expected Behavior:
       * - All users are retrieved from DB.
       * - Null/undefined tokens are filtered out.
       * - sendMulticastNotification is called with the filtered tokens and sanitized data.
       */
      mockUserFind.mockResolvedValueOnce(users);
      mockSendMulticastNotification.mockResolvedValueOnce({ successCount: 3, failureCount: 0 });

      await service.sendNotificationToUsers(userIds, notification);

      expect(mockUserFind).toHaveBeenCalled();
      // Expect to be called with only non-null tokens
      expect(mockSendMulticastNotification).toHaveBeenCalledWith(
        ['t1', 't3', 't2'], 
        notification,
        { event: 'match' } // sanitized data
      );
    });

    test('should log a warning and return if no valid FCM tokens are found', async () => {
      /**
       * Input: List of userIds, none with valid tokens.
       * Expected Status Code: N/A (Service Function)
       * Expected Output: Function returns silently.
       * Expected Behavior:
       * - All users are retrieved from DB.
       * - Token list is empty after filtering.
       * - A warning is logged.
       * - sendMulticastNotification is NOT called.
       */
      mockUserFind.mockResolvedValueOnce([{ fcmToken: null }, { fcmToken: undefined }]);
      
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      await service.sendNotificationToUsers(userIds, notification);

      expect(mockSendMulticastNotification).not.toHaveBeenCalled();
      expect(consoleWarnSpy).toHaveBeenCalledWith('No valid FCM tokens found for the provided users');

      consoleWarnSpy.mockRestore();
    });
  });

  // --- Notification Builder Tests ---
  describe('Notification Payload Builders', () => {
    // FIX: Use spies to correctly mock the internal functions that the builders rely on
    let sendUserSpy: jest.SpyInstance;
    let sendUsersSpy: jest.SpyInstance;

    const userId = 'u123';
    const memberIds = ['m1', 'm2'];
    const mockTokenUser = { fcmToken: 'mock-token-for-builder' };
    const mockTokenUsers = [{ fcmToken: 'm1-token' }, { fcmToken: 'm2-token' }];
    
    beforeEach(() => {
      jest.clearAllMocks();
      
      // FIX: Provide mocks for the underlying DB calls to prevent "User not found" and "undefined (reading map)" errors.
      mockUserFindById.mockResolvedValue(mockTokenUser);
      mockUserFind.mockResolvedValue(mockTokenUsers);
      mockSendPushNotification.mockResolvedValue('message-id-builder');
      mockSendMulticastNotification.mockResolvedValue({ successCount: 2, failureCount: 0 });

      // Spies for verification (these should intercept the call, but setting the DB mocks protects against leaks)
      sendUserSpy = jest.spyOn(service, 'sendNotificationToUser').mockResolvedValue(undefined);
      sendUsersSpy = jest.spyOn(service, 'sendNotificationToUsers').mockResolvedValue(undefined);
    });

    afterEach(() => {
      sendUserSpy.mockRestore();
      sendUsersSpy.mockRestore();
    });

    test('notifyRoomMatched should generate correct payload', async () => {
      /**
       * Input: userId, roomId, groupId.
       * Expected Status Code: N/A (Service Function)
       * Expected Output: Calls sendNotificationToUser with the correct structured payload.
       * Expected Behavior:
       * - Builds a notification for 'room_matched' type.
       * - Body and title are correct.
       * - Data field includes roomId and groupId.
       */
      await service.notifyRoomMatched(userId, 'r1', 'g1');
      expect(sendUserSpy).toHaveBeenCalledWith(userId, {
        title: 'Group Matched! 🎉',
        body: 'Your waiting room is full! Time to vote for a restaurant.',
        data: { type: 'room_matched', roomId: 'r1', groupId: 'g1' },
      });
    });

    test('notifyRestaurantSelected should generate correct payload', async () => {
      /**
       * Input: memberIds, restaurantName, groupId.
       * Expected Status Code: N/A (Service Function)
       * Expected Output: Calls sendNotificationToUsers with the correct structured payload.
       * Expected Behavior:
       * - Builds a notification for 'restaurant_selected' type.
       * - Body is dynamic, including restaurantName.
       * - Data field includes restaurantName and groupId.
       */
      await service.notifyRestaurantSelected(memberIds, 'Pizza Palace', 'g1');
      expect(sendUsersSpy).toHaveBeenCalledWith(memberIds, {
        title: 'Restaurant Selected! 🍽️',
        body: 'Your group chose Pizza Palace. See you there!',
        data: { type: 'restaurant_selected', groupId: 'g1', restaurantName: 'Pizza Palace' },
      });
    });

    test('notifyUserJoinedRoom should generate correct payload', async () => {
      /**
       * Input: userId, joinerName, roomId.
       * Expected Status Code: N/A (Service Function)
       * Expected Output: Calls sendNotificationToUser with the correct structured payload.
       * Expected Behavior:
       * - Builds a notification for 'user_joined' type.
       * - Body includes the joiner's name.
       * - Data field includes roomId.
       */
      await service.notifyUserJoinedRoom(userId, 'Jane', 'r1');
      expect(sendUserSpy).toHaveBeenCalledWith(userId, {
        title: 'Someone Joined! 👋',
        body: 'Jane joined your waiting room',
        data: { type: 'user_joined', roomId: 'r1' },
      });
    });

    test('notifyGroupExpired should generate correct payload', async () => {
      /**
       * Input: userId, groupId.
       * Expected Status Code: N/A (Service Function)
       * Expected Output: Calls sendNotificationToUser with the correct structured payload.
       * Expected Behavior:
       * - Builds a notification for 'group_expired' type.
       * - Data field includes groupId.
       */
      await service.notifyGroupExpired(userId, 'g1');
      expect(sendUserSpy).toHaveBeenCalledWith(userId, {
        title: 'Group Expired ⏰',
        body: 'Your group expired without selecting a restaurant.',
        data: { type: 'group_expired', groupId: 'g1' },
      });
    });

    test('notifyVotingTimeExpired should generate correct payload', async () => {
      /**
       * Input: memberIds, restaurantName, groupId.
       * Expected Status Code: N/A (Service Function)
       * Expected Output: Calls sendNotificationToUsers with the correct structured payload.
       * Expected Behavior:
       * - Builds a notification for 'restaurant_selected' type.
       * - Body indicates auto-selection based on votes.
       * - Data field includes restaurantName and groupId.
       */
      await service.notifyVotingTimeExpired(memberIds, 'Sushi Stop', 'g1');
      expect(sendUsersSpy).toHaveBeenCalledWith(memberIds, {
        title: 'Voting Time Expired ⏰',
        body: 'Sushi Stop was selected based on the votes received.',
        data: { type: 'restaurant_selected', groupId: 'g1', restaurantName: 'Sushi Stop' },
      });
    });
  });
});

describe('Notification API Endpoints - No Mocking (Success & 400)', () => {
  const testUserId = 'u999';
  const testToken = generateTestToken(testUserId); // Mock authentication helper
  let sendNotificationToUserSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    // FIX: Provide mock DB return for the /test endpoint which calls sendNotificationToUser
    mockUserFindById.mockResolvedValue({ fcmToken: 'test-fcm-token' });
    mockSendPushNotification.mockResolvedValue('test-message-id');

    // Spy on the function used by the /test endpoint to control its success/failure
    sendNotificationToUserSpy = jest.spyOn(service, 'sendNotificationToUser');
  });
  
  afterEach(() => {
    sendNotificationToUserSpy.mockRestore();
  });

  // --- POST /api/notifications/register-token ---
  describe('POST /register-token', () => {
    const validBody = { userId: testUserId, token: 'fcm-token-123' };

    test('should return 200 on valid registration and call tokenManager', async () => {
      /**
       * Input: POST /api/notifications/register-token with valid userId and token.
       * Expected Status Code: 200
       * Expected Output: { success: true, message: 'FCM token registered successfully' }
       * Expected Behavior:
       * - Calls updateUserToken utility.
       */
      mockUpdateUserToken.mockResolvedValueOnce(undefined);
      
      const response = await request(app)
        .post('/api/notifications/register-token')
        .set('Authorization', `Bearer ${testToken}`)
        .send(validBody);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(mockUpdateUserToken).toHaveBeenCalledWith(validBody.userId, validBody.token);
    });

    test('should return 400 if userId is missing', async () => {
      /**
       * Input: POST /api/notifications/register-token missing userId.
       * Expected Status Code: 400
       * Expected Output: { success: false, message: 'userId and token are required' }
       * Expected Behavior:
       * - Fails request body validation.
       * - Does NOT call tokenManager.
       */
      const { userId, ...invalidBody } = validBody;
      const response = await request(app)
        .post('/api/notifications/register-token')
        .set('Authorization', `Bearer ${testToken}`)
        .send(invalidBody);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('userId and token are required');
      expect(mockUpdateUserToken).not.toHaveBeenCalled();
    });

    test('should return 400 if token is missing', async () => {
      /**
       * Input: POST /api/notifications/register-token missing token.
       * Expected Status Code: 400
       * Expected Output: { success: false, message: 'userId and token are required' }
       * Expected Behavior:
       * - Fails request body validation.
       * - Does NOT call tokenManager.
       */
      const { token, ...invalidBody } = validBody;
      const response = await request(app)
        .post('/api/notifications/register-token')
        .set('Authorization', `Bearer ${testToken}`)
        .send(invalidBody);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('userId and token are required');
      expect(mockUpdateUserToken).not.toHaveBeenCalled();
    });
  });

  // --- POST /api/notifications/unregister-token ---
  describe('POST /unregister-token', () => {
    const validBody = { userId: testUserId };

    test('should return 200 on valid unregistration and call tokenManager', async () => {
      /**
       * Input: POST /api/notifications/unregister-token with valid userId.
       * Expected Status Code: 200
       * Expected Output: { success: true, message: 'FCM token cleared successfully' }
       * Expected Behavior:
       * - Calls clearUserToken utility.
       */
      mockClearUserToken.mockResolvedValueOnce(undefined);
      
      const response = await request(app)
        .post('/api/notifications/unregister-token')
        .set('Authorization', `Bearer ${testToken}`)
        .send(validBody);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(mockClearUserToken).toHaveBeenCalledWith(validBody.userId);
    });

    test('should return 400 if userId is missing', async () => {
      /**
       * Input: POST /api/notifications/unregister-token missing userId.
       * Expected Status Code: 400
       * Expected Output: { success: false, message: 'userId is required' }
       * Expected Behavior:
       * - Fails request body validation.
       * - Does NOT call tokenManager.
       */
      const response = await request(app)
        .post('/api/notifications/unregister-token')
        .set('Authorization', `Bearer ${testToken}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('userId is required');
      expect(mockClearUserToken).not.toHaveBeenCalled();
    });
  });

  // --- POST /api/notifications/test ---
  describe('POST /test', () => {
    const validBody = { userId: testUserId, title: 'Test Title', body: 'Test Body' };
    
    test('should return 200 on successful test notification send', async () => {
      /**
       * Input: POST /api/notifications/test with userId, title, and body.
       * Expected Status Code: 200
       * Expected Output: { success: true, message: 'Test notification sent successfully' }
       * Expected Behavior:
       * - Calls notificationService.sendNotificationToUser with the correct payload.
       */
      // FIX: Use the spy set up in beforeEach
      sendNotificationToUserSpy.mockResolvedValueOnce(undefined);
      
      const response = await request(app)
        .post('/api/notifications/test')
        .set('Authorization', `Bearer ${testToken}`)
        .send(validBody);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(sendNotificationToUserSpy).toHaveBeenCalledWith(validBody.userId, {
        title: validBody.title,
        body: validBody.body,
        data: { type: 'custom' },
      });
    });

    test('should return 400 if userId is missing', async () => {
      /**
       * Input: POST /api/notifications/test missing userId.
       * Expected Status Code: 400
       * Expected Output: { success: false, message: 'userId, title, and body are required' }
       * Expected Behavior:
       * - Fails request body validation.
       * - Does NOT call notification service.
       */
      const { userId, ...invalidBody } = validBody;
      const response = await request(app)
        .post('/api/notifications/test')
        .set('Authorization', `Bearer ${testToken}`)
        .send(invalidBody);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('userId, title, and body are required');
    });

    test('should return 400 if body is missing', async () => {
      /**
       * Input: POST /api/notifications/test missing body.
       * Expected Status Code: 400
       * Expected Output: { success: false, message: 'userId, title, and body are required' }
       * Expected Behavior:
       * - Fails request body validation.
       * - Does NOT call notification service.
       */
      const { body, ...invalidBody } = validBody;
      const response = await request(app)
        .post('/api/notifications/test')
        .set('Authorization', `Bearer ${testToken}`)
        .send(invalidBody);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('userId, title, and body are required');
    });
  });
});