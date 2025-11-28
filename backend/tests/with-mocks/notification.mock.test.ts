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