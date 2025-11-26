import { Router, Request, Response } from 'express';
import { updateUserToken, clearUserToken } from '../utils/tokenManager';

const router = Router();

/**
 * POST /api/notifications/register-token
 * Register or update FCM token for a user
 */
router.post('/register-token', async (req: Request, res: Response) => {
  try {
    const { userId, token } = req.body;

    if (!userId || !token) {
      return res.status(400).json({
        success: false,
        message: 'userId and token are required',
      });
    }

    await updateUserToken(userId, token);

    return res.status(200).json({
      success: true,
      message: 'FCM token registered successfully',
    });
  } catch (error) {
    console.error('Error registering FCM token:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to register FCM token',
    });
  }
});

/**
 * POST /api/notifications/unregister-token
 * Clear FCM token for a user (on logout)
 */
router.post('/unregister-token', async (req: Request, res: Response) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'userId is required',
      });
    }

    await clearUserToken(userId);

    return res.status(200).json({
      success: true,
      message: 'FCM token cleared successfully',
    });
  } catch (error) {
    console.error('Error clearing FCM token:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to clear FCM token',
    });
  }
});

/**
 * POST /api/notifications/test
 * Test endpoint to send a notification to a user
 */
router.post('/test', async (req: Request, res: Response) => {
  try {
    const { userId, title, body } = req.body;

    if (!userId || !title || !body) {
      return res.status(400).json({
        success: false,
        message: 'userId, title, and body are required',
      });
    }

    const { sendNotificationToUser } = require('../services/notificationService');
    
    await sendNotificationToUser(userId, {
      title,
      body,
      data: { type: 'custom' },
    });

    return res.status(200).json({
      success: true,
      message: 'Test notification sent successfully',
    });
  } catch (error) {
    console.error('Error sending test notification:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to send test notification',
    });
  }
});

export default router;