import express, { Response } from 'express';
import groupService from '../services/groupService';
import { authMiddleware } from '../middleware/auth.middleware';
import { AuthRequest } from '../types';

const router = express.Router();

/**
 * POST /api/groups/:groupId/voting/initialize
 * Initialize sequential voting for a group
 */
router.post(
  '/:groupId/voting/initialize',
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      const { groupId } = req.params;
      
      if (!req.user) {
        return res.status(401).json({
          Status: 401,
          Message: { error: 'Unauthorized' },
          Body: null
        });
      }
      
      const result = await groupService.initializeSequentialVoting(groupId);

      return res.status(200).json({
        Status: 200,
        Message: { text: result.message },
        Body: result
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to initialize voting';
      return res.status(500).json({
        Status: 500,
        Message: { error: message },
        Body: null
      });
    }
  }
);

/**
 * POST /api/groups/:groupId/voting/vote
 * Submit a yes/no vote for the current restaurant
 */
router.post(
  '/:groupId/voting/vote',
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      const { groupId } = req.params;
      const { vote } = req.body;
      
      if (!req.user) {
        return res.status(401).json({
          Status: 401,
          Message: { error: 'Unauthorized' },
          Body: null
        });
      }
      
      const userId = req.user.userId;

      if (typeof vote !== 'boolean') {
        return res.status(400).json({
          Status: 400,
          Message: { error: 'Vote must be a boolean (true/false)' },
          Body: null
        });
      }

      const result = await groupService.submitSequentialVote(userId, groupId, vote);

      // ✅ Match Android ApiResponse format
      return res.status(200).json({
        Status: 200,
        Message: { text: result.message },
        Body: result
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to submit vote';
      return res.status(500).json({
        Status: 500,
        Message: { error: message },
        Body: null
      });
    }
  }
);

/**
 * GET /api/groups/:groupId/voting/current
 * Get current voting round status
 */
router.get(
  '/:groupId/voting/current',
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      const { groupId } = req.params;
      
      if (!req.user) {
        return res.status(401).json({
          Status: 401,
          Message: { error: 'Unauthorized' },
          Body: null
        });
      }
      
      const result = await groupService.getCurrentVotingRound(groupId);

      return res.status(200).json({
        Status: 200,
        Message: { text: 'Success' },
        Body: result
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to get voting round';
      return res.status(500).json({
        Status: 500,
        Message: { error: message },
        Body: null
      });
    }
  }
);

export default router;