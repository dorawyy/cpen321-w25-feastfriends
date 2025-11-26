import { Response, NextFunction } from 'express';
import { AuthRequest, CredibilityCodeResponse, VerifyCodeRequest, VerifyCodeResponse, DeductScoreResponse } from '../types';
import CredibilityCode from '../models/CredibilityCode';
import credibilityService from '../services/credibilityService';
import { CredibilityAction } from '../models/CredibilityLog';
import User from '../models/User';
import { ensureAuthenticated } from '../utils/authGuard';

export class CredibilityController {
  /**
   * GET /api/credibility/code
   * Generate credibility code for current user
   */
  async generateCode(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!ensureAuthenticated(req, res)) return;
      
      const userId = req.user.userId;

      // Get user's current group
      const user = await User.findById(userId);
      if (!user) {
        res.status(404).json({
          Status: 404,
          Message: { error: 'User not found' },
          Body: null
        });
        return;
      }

      const groupId = user.groupId;
      if (!groupId) {
        res.status(400).json({
          Status: 400,
          Message: { error: 'User not in a group' },
          Body: null
        });
        return;
      }

      // Check if user already has an active code for this group
      let existingCode = await CredibilityCode.findActiveCode(userId, groupId);

      if (existingCode) {
        const response: CredibilityCodeResponse = {
          code: existingCode.code,
          expiresAt: existingCode.expiresAt.getTime(),
          groupId: existingCode.groupId
        };

        res.status(200).json({
          Status: 200,
          Message: {},
          Body: response
        });
        return;
      }

      // Generate new code
      const code = await CredibilityCode.generateCode(userId, groupId);

      console.log(`✅ Generated credibility code ${code.code} for user ${userId}`);

      const response: CredibilityCodeResponse = {
        code: code.code,
        expiresAt: code.expiresAt.getTime(),
        groupId: code.groupId
      };

      res.status(200).json({
        Status: 200,
        Message: {},
        Body: response
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/credibility/verify
   * Verify another user's credibility code
   */
  async verifyCode(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!ensureAuthenticated(req, res)) return;
      
      const verifierId = req.user.userId;
      const { code } = req.body as VerifyCodeRequest;

      if (!code || typeof code !== 'string') {
        res.status(400).json({
          Status: 400,
          Message: { error: 'Code is required' },
          Body: null
        });
        return;
      }

      // Find the code
      const codeDoc = await CredibilityCode.findByCode(code.toUpperCase());

      if (!codeDoc) {
        res.status(404).json({
          Status: 404,
          Message: { error: 'Invalid code' },
          Body: null
        });
        return;
      }

      // Check if expired
      if (codeDoc.isExpired()) {
        await codeDoc.deleteOne();
        res.status(400).json({
          Status: 400,
          Message: { error: 'Code has expired' },
          Body: null
        });
        return;
      }

      // Prevent self-verification
      if (codeDoc.userId === verifierId) {
        res.status(400).json({
          Status: 400,
          Message: { error: 'Cannot verify your own code' },
          Body: null
        });
        return;
      }

      // Check if already verified by this user
      if (codeDoc.verifiedBy.includes(verifierId)) {
        res.status(400).json({
          Status: 400,
          Message: { error: 'You have already verified this code' },
          Body: null
        });
        return;
      }

      // Verify the code
      await codeDoc.verify(verifierId);

      console.log(`✅ Code ${code} verified by user ${verifierId} for user ${codeDoc.userId}`);

      const response: VerifyCodeResponse = {
        success: true,
        message: 'Code verified successfully',
        verifiedUserId: codeDoc.userId
      };

      res.status(200).json({
        Status: 200,
        Message: { text: 'Code verified successfully' },
        Body: response
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/credibility/deduct
   * Deduct credibility score for leaving group early
   */
  async deductScore(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!ensureAuthenticated(req, res)) return;
      
      const userId = req.user.userId;

      // Get user's current group
      const user = await User.findById(userId);
      if (!user) {
        res.status(404).json({
          Status: 404,
          Message: { error: 'User not found' },
          Body: null
        });
        return;
      }

      const groupId = user.groupId;

      // Find user's active code for this group
      let codeDoc = null;
      if (groupId) {
        codeDoc = await CredibilityCode.findActiveCode(userId, groupId);
      }

      // Check if code was verified
      const wasVerified = codeDoc && codeDoc.verifiedBy.length > 0;

      if (wasVerified) {
        // Code was verified, no penalty
        if (codeDoc) {
          await codeDoc.deleteOne();
        }

        const response: DeductScoreResponse = {
          success: true,
          message: 'Left group without penalty - code was verified',
          scoreDeducted: 0,
          newScore: user.credibilityScore
        };

        res.status(200).json({
          Status: 200,
          Message: { text: 'No penalty' },
          Body: response
        });
        return;
      }

      // Code wasn't verified, deduct score
      const result = await credibilityService.updateCredibilityScore(
        userId,
        CredibilityAction.LEFT_GROUP_EARLY,
        groupId || undefined,
        undefined,
        'Left group before code verification'
      );

      // Clean up the code
      if (codeDoc) {
        await codeDoc.deleteOne();
      }

      console.log(`⚠️ Deducted credibility for user ${userId}: ${result.previousScore} → ${result.newScore}`);

      const response: DeductScoreResponse = {
        success: true,
        message: `Credibility score reduced by ${Math.abs(result.scoreChange)} points`,
        scoreDeducted: Math.abs(result.scoreChange),
        newScore: result.newScore
      };

      res.status(200).json({
        Status: 200,
        Message: { text: response.message },
        Body: response
      });
    } catch (error) {
      next(error);
    }
  }
}

export const credibilityController = new CredibilityController();