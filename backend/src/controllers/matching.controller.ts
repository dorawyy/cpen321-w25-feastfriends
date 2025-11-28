import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import matchingService from '../services/matchingService';
import { requireParam } from '../middleware/errorHandler';
import { ensureAuthenticated } from '../utils/authGuard';

export class MatchingController {
  /**
   * POST /api/matching/join
   * Join the matching pool
   */
  async joinMatching(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!ensureAuthenticated(req, res)) return;
      const userId = req.user.userId;

      const { cuisine, budget, radiusKm, latitude, longitude } = req.body;

      const result = await matchingService.joinMatching(userId, {
        cuisine,
        budget,
        radiusKm,
        latitude,
        longitude
      });

      res.status(200).json({
        Status: 200,
        Message: { text: 'Successfully joined matching' },
        Body: result
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/matching/join/:roomId
   * Join a specific room
   */
  async joinSpecificRoom(_req: AuthRequest, res: Response, _next: NextFunction): Promise<void> {
    // This functionality might not be needed based on your specs
    // But keeping it for flexibility
    res.status(501).json({
      Status: 501,
      Message: { error: 'Not implemented - use /api/matching/join instead' },
      Body: null
    });
  }

  /**
   * PUT /api/matching/leave/:roomId
   * Leave a waiting room
   */
  async leaveRoom(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!ensureAuthenticated(req, res)) return;
      const userId = req.user.userId;
      
      const roomId = requireParam(req, 'roomId');

      await matchingService.leaveRoom(userId, roomId);

      res.status(200).json({
        Status: 200,
        Message: { text: 'Successfully left room' },
        Body: { roomId }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/matching/status/:roomId
   * Get status of a waiting room
   */
  async getRoomStatus(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const roomId = requireParam(req, 'roomId');

      const status = await matchingService.getRoomStatus(roomId);

      res.status(200).json({
        Status: 200,
        Message: {},
        Body: status
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/matching/users/:roomId
   * Get users in a room
   */
  async getRoomUsers(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const roomId = requireParam(req, 'roomId');

      const users = await matchingService.getRoomUsers(roomId);

      res.status(200).json({
        Status: 200,
        Message: {},
        Body: {
          roomID: roomId,
          Users: users
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
 * POST /api/matching/cleanup
 * Clean up stale user state before joining matching
 * Only cleans waiting rooms and invalid groups, NOT active groups
 */
async cleanupUserState(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!ensureAuthenticated(req, res)) return;
    const userId = req.user.userId;

    const User = (await import('../models/User')).default;
    const Room = (await import('../models/Room')).default;
    const Group = (await import('../models/Group')).default;

    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({
        Status: 404,
        Message: { error: 'User not found' },
        Body: null
      });
      return;
    }

    let cleaned = false;
    let hasActiveGroup = false;

    // Always clean stale rooms - rooms don't persist across sessions
    if (user.roomId) {
      const room = await Room.findById(user.roomId);
      if (!room || room.status !== 'waiting' || !room.members.includes(userId)) {
        console.log(`🧹 Cleanup: Clearing stale roomId ${user.roomId}`);
        user.roomId = undefined;
        cleaned = true;
      }
    }

    // Only clean INVALID groups - preserve active groups
    if (user.groupId) {
      const group = await Group.findById(user.groupId);
      
      if (!group) {
        // Group doesn't exist - safe to clean
        console.log(`🧹 Cleanup: Clearing non-existent groupId ${user.groupId}`);
        user.groupId = undefined;
        cleaned = true;
      } else if (!group.members.includes(userId)) {
        // User not in group - safe to clean
        console.log(`🧹 Cleanup: Clearing invalid groupId ${user.groupId} (not in member list)`);
        user.groupId = undefined;
        cleaned = true;
      } else if (group.restaurantSelected || new Date() > group.completionTime) {
        // Group completed or expired - but don't auto-clean
        // Let user explicitly leave when ready
        console.log(`ℹ️ User ${userId} has completed/expired group ${user.groupId} - not auto-cleaning`);
        hasActiveGroup = false; // Not truly "active" anymore
      } else {
        // Group is still active
        console.log(`ℹ️ User ${userId} has active group ${user.groupId} - preserving`);
        hasActiveGroup = true;
      }
    }

    if (cleaned) {
      user.status = 1; // UserStatus.ONLINE
      await user.save();
    }

    res.status(200).json({
      Status: 200,
      Message: { 
        text: cleaned ? 'State cleaned up' : (hasActiveGroup ? 'User in active group' : 'No cleanup needed')
      },
      Body: { 
        cleaned, 
        hasActiveGroup,
        status: user.status 
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/matching/room/:roomId/check-completion
 * Check if room should be finalized (called when client timer expires)
 */
async checkRoomCompletion(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!ensureAuthenticated(req, res)) return;
    const userId = req.user.userId;
    
    const roomId = requireParam(req, 'roomId');

    console.log(`📱 User ${userId} requesting room completion check for ${roomId}`);

    const result = await matchingService.checkRoomCompletion(roomId);

    res.status(200).json({
      Status: 200,
      Message: { text: `Room status: ${result.status}` },
      Body: result
    });
  } catch (error) {
    next(error);
  }
}
}

export const matchingController = new MatchingController();