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
      
      // After authMiddleware, user is guaranteed to exist
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      
      const result = await groupService.initializeSequentialVoting(groupId);

      return res.status(200).json(result);
    } catch (error) {
      console.error('Error initializing sequential voting:', error);
      const message = error instanceof Error ? error.message : 'Failed to initialize voting';
      return res.status(500).json({ error: message });
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
      const { vote } = req.body; // boolean: true = yes, false = no
      
      // After authMiddleware, user is guaranteed to exist
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      
      const userId = req.user.userId;

      if (typeof vote !== 'boolean') {
        return res.status(400).json({ error: 'Vote must be a boolean (true/false)' });
      }

      const result = await groupService.submitSequentialVote(userId, groupId, vote);

      return res.status(200).json(result);
    } catch (error) {
      console.error('Error submitting vote:', error);
      const message = error instanceof Error ? error.message : 'Failed to submit vote';
      return res.status(500).json({ error: message });
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
      
      // After authMiddleware, user is guaranteed to exist
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      
      const result = await groupService.getCurrentVotingRound(groupId);

      return res.status(200).json(result);
    } catch (error) {
      console.error('Error getting voting round:', error);
      const message = error instanceof Error ? error.message : 'Failed to get voting round';
      return res.status(500).json({ error: message });
    }
  }
);

export default router;