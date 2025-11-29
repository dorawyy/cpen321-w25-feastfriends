import request from 'supertest';
import app from '../../src/app';
import { generateTestToken } from '../helpers/auth.helper';
import User from '../../src/models/User';
import * as firebase from '../../src/config/firebase';
import * as tokenManager from '../../src/utils/tokenManager';
// Removed direct import of sendNotificationToUser to avoid conflicting mocking issues

// Mock external dependencies
jest.mock('../../src/models/User');
jest.mock('../../src/config/firebase');
jest.mock('../../src/utils/tokenManager');

// Get typed mocks
const mockUserFindById = User.findById as jest.Mock;
const mockUserFind = User.find as jest.Mock; 
const mockSendPushNotification = firebase.sendPushNotification as jest.Mock;
const mockRemoveInvalidToken = tokenManager.removeInvalidToken as jest.Mock;
const mockUpdateUserToken = tokenManager.updateUserToken as jest.Mock;
const mockClearUserToken = tokenManager.clearUserToken as jest.Mock;
// Removed the problematic global mock definition for sendNotificationToUser

// Import the service module (its real implementation is used here, but its dependencies are mocked)
import service from '../../src/services/notificationService'; 


/**
 * Notification Tests - With Mocking (Uncontrollable Failures)
 * * This test suite covers UNCONTROLLABLE failures:
 * - Database connection errors (500)
 * - External API failures (Firebase, token manager) (500)
 * - Specific external error codes (e.g., invalid FCM token cleanup)
 */

describe('Notification Service Logic - Failure Scenarios', () => {
  const userId = 'user-fail-1';
  const fcmToken = 'token-fcm-invalid';
  const notification = { title: 'Fail', body: 'Test', data: { type: 'test' } };
  
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- sendNotificationToUser Error Handling ---
  describe('sendNotificationToUser Error Cleanup', () => {

    it('should handle "messaging/invalid-registration-token" error and call removeInvalidToken', async () => {
      mockUserFindById.mockResolvedValueOnce({ fcmToken });
      const firebaseInvalidTokenError = { code: 'messaging/invalid-registration-token', message: 'The token is invalid' };
      mockSendPushNotification.mockRejectedValueOnce(firebaseInvalidTokenError);
      mockRemoveInvalidToken.mockResolvedValueOnce(undefined);

      // This now tests the REAL service implementation relying on mocked dependencies
      await expect(service.sendNotificationToUser(userId, notification)).rejects.toEqual(firebaseInvalidTokenError);

      expect(mockRemoveInvalidToken).toHaveBeenCalledWith(fcmToken);
    });

    it('should handle "messaging/registration-token-not-registered" error (errorInfo code) and call removeInvalidToken', async () => {
      mockUserFindById.mockResolvedValueOnce({ fcmToken });
      const firebaseUnregisteredTokenError = { errorInfo: { code: 'messaging/registration-token-not-registered' }, message: 'Not registered' };
      mockSendPushNotification.mockRejectedValueOnce(firebaseUnregisteredTokenError);
      mockRemoveInvalidToken.mockResolvedValueOnce(undefined);

      // This now tests the REAL service implementation
      await expect(service.sendNotificationToUser(userId, notification)).rejects.toEqual(firebaseUnregisteredTokenError);

      expect(mockRemoveInvalidToken).toHaveBeenCalledWith(fcmToken);
    });

    it('should handle a general FCM push failure (non-token error) and re-throw without cleaning token', async () => {
      mockUserFindById.mockResolvedValueOnce({ fcmToken });
      const fcmError = new Error('FCM Timeout');
      mockSendPushNotification.mockRejectedValueOnce(fcmError);

      // This now tests the REAL service implementation
      await expect(service.sendNotificationToUser(userId, notification)).rejects.toThrow(fcmError);

      expect(mockRemoveInvalidToken).not.toHaveBeenCalled();
    });
  });

  // --- sendNotificationToUsers Failure Tests ---
  describe('sendNotificationToUsers Error Handling', () => {
    it('should throw and re-throw an error if the DB query for multiple users fails', async () => {
      const dbError = new Error('Mongoose DB Find Failed');
      mockUserFind.mockRejectedValueOnce(dbError);

      // This now tests the REAL service implementation
      await expect(service.sendNotificationToUsers(['u1', 'u2'], notification)).rejects.toThrow(dbError);
    });
  });
});

describe('Notification Service Helper Wrappers - Success Paths', () => {
  const userId = 'user-1';
  const memberIds = ['u1', 'u2'];
  const roomId = 'room-123';
  const groupId = 'group-123';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('notifyRoomMembers should delegate to sendNotificationToUsers with same memberIds and payload', async () => {
    const spy = jest
      .spyOn(service, 'sendNotificationToUsers')
      .mockResolvedValueOnce(undefined as any);

    const notification = { title: 't', body: 'b', data: { type: 'room' } };
    await service.notifyRoomMembers(memberIds, notification);

    expect(spy).toHaveBeenCalledWith(memberIds, notification);
    spy.mockRestore();
  });

  it('notifyGroupMembers should delegate to sendNotificationToUsers with same memberIds and payload', async () => {
    const spy = jest
      .spyOn(service, 'sendNotificationToUsers')
      .mockResolvedValueOnce(undefined as any);

    const notification = { title: 't2', body: 'b2', data: { type: 'group' } };
    await service.notifyGroupMembers(memberIds, notification);

    expect(spy).toHaveBeenCalledWith(memberIds, notification);
    spy.mockRestore();
  });

  it('notifyRoomExpired should build the correct payload and call sendNotificationToUser', async () => {
    const spy = jest
      .spyOn(service, 'sendNotificationToUser')
      .mockResolvedValueOnce(undefined as any);

    await service.notifyRoomExpired(userId, roomId);

    expect(spy).toHaveBeenCalledWith(userId, {
      title: 'Room Expired ⏰',
      body: 'Your waiting room expired. Try matching again!',
      data: {
        type: 'room_expired',
        roomId,
      },
    });
    spy.mockRestore();
  });

  it('notifyUserJoinedRoom should build the correct payload and call sendNotificationToUser', async () => {
    const spy = jest
      .spyOn(service, 'sendNotificationToUser')
      .mockResolvedValueOnce(undefined as any);

    await service.notifyUserJoinedRoom(userId, 'Alice', roomId);

    expect(spy).toHaveBeenCalledWith(userId, {
      title: 'Someone Joined! 👋',
      body: 'Alice joined your waiting room',
      data: {
        type: 'user_joined',
        roomId,
      },
    });
    spy.mockRestore();
  });

  it('notifyGroupExpired should build the correct payload and call sendNotificationToUser', async () => {
    const spy = jest
      .spyOn(service, 'sendNotificationToUser')
      .mockResolvedValueOnce(undefined as any);

    await service.notifyGroupExpired(userId, groupId);

    expect(spy).toHaveBeenCalledWith(userId, {
      title: 'Group Expired ⏰',
      body: 'Your group expired without selecting a restaurant.',
      data: {
        type: 'group_expired',
        groupId,
      },
    });
    spy.mockRestore();
  });

  it('notifyVotingTimeExpired should build the correct payload and call sendNotificationToUsers', async () => {
    const spy = jest
      .spyOn(service, 'sendNotificationToUsers')
      .mockResolvedValueOnce(undefined as any);

    await service.notifyVotingTimeExpired(memberIds, 'Sushi Place', groupId);

    expect(spy).toHaveBeenCalledWith(memberIds, {
      title: 'Voting Time Expired ⏰',
      body: 'Sushi Place was selected based on the votes received.',
      data: {
        type: 'restaurant_selected',
        groupId,
        restaurantName: 'Sushi Place',
      },
    });
    spy.mockRestore();
  });
});

describe('Notification API Endpoints - With Mocking (500 Failures)', () => {
  const testUserId = 'u999';
  const testToken = generateTestToken(testUserId);
  const internalError = new Error('Simulated Internal Failure');
  let sendNotificationToUserSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    // FIX: Spy on the module returned by require to catch the function used by the router's dynamic import.
    const notificationServiceModule = require('../../src/services/notificationService');
    sendNotificationToUserSpy = jest.spyOn(notificationServiceModule, 'sendNotificationToUser');
  });

  afterEach(() => {
    // Restore the spy after each test in this describe block
    sendNotificationToUserSpy.mockRestore();
  });

  // --- POST /api/notifications/register-token Failure ---
  describe('POST /register-token Failure', () => {
    const validBody = { userId: testUserId, token: 'fcm-token-123' };

    it('should return 500 if tokenManager.updateUserToken fails', async () => {
      mockUpdateUserToken.mockRejectedValueOnce(internalError);

      const response = await request(app)
        .post('/api/notifications/register-token')
        .set('Authorization', `Bearer ${testToken}`)
        .send(validBody);

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Failed to register FCM token');
      expect(mockUpdateUserToken).toHaveBeenCalled();
    });
  });

  // --- POST /api/notifications/unregister-token Failure ---
  describe('POST /unregister-token Failure', () => {
    const validBody = { userId: testUserId };

    it('should return 500 if tokenManager.clearUserToken fails', async () => {
      mockClearUserToken.mockRejectedValueOnce(internalError);

      const response = await request(app)
        .post('/api/notifications/unregister-token')
        .set('Authorization', `Bearer ${testToken}`)
        .send(validBody);

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Failed to clear FCM token');
      expect(mockClearUserToken).toHaveBeenCalled();
    });
  });

  // --- POST /api/notifications/test Failure ---
  describe('POST /test Failure', () => {
    const validBody = { userId: testUserId, title: 'Test Title', body: 'Test Body' };
    
    it('should return 500 if notificationService.sendNotificationToUser fails', async () => {
      // Use the spy set up in beforeEach/afterEach
      sendNotificationToUserSpy.mockRejectedValueOnce(internalError);

      const response = await request(app)
        .post('/api/notifications/test')
        .set('Authorization', `Bearer ${testToken}`)
        .send(validBody);

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Failed to send test notification');
      expect(sendNotificationToUserSpy).toHaveBeenCalled();
    });
  });
});