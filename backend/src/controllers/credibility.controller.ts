import { Response, NextFunction } from 'express';
import { AuthRequest, CredibilityCodeResponse, VerifyCodeRequest, VerifyCodeResponse, DeductScoreResponse } from '../types';
import CredibilityCode from '../models/CredibilityCode';
import credibilityService from '../services/credibilityService';
import { CredibilityAction } from '../types/credibility';
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

      const code = await CredibilityCode.generateCode(userId, groupId);

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

      const codeDoc = await CredibilityCode.findByCode(code.toUpperCase());

      if (!codeDoc) {
        res.status(400).json({
          Status: 400,
          Message: { error: 'This code is not valid. Please check the code and try again.' },
          Body: null
        });
        return;
      }

      if (codeDoc.userId === verifierId) {
        res.status(400).json({
          Status: 400,
          Message: { error: 'You cannot verify your own code.' },
          Body: null
        });
        return;
      }

      if (codeDoc.verifiedBy.includes(verifierId)) {
        res.status(400).json({
          Status: 400,
          Message: { error: 'You have already verified this code.' },
          Body: null
        });
        return;
      }

      await codeDoc.verify(verifierId);

      const result = await credibilityService.updateCredibilityScore(
        verifierId,
        CredibilityAction.CHECK_IN
      );

      const response: VerifyCodeResponse = {
        success: true,
        message: `Code verified! You gained ${result.scoreChange} credibility points`,
        verifiedUserId: codeDoc.userId
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

  /**
   * POST /api/credibility/deduct
   * Deduct credibility score for leaving group early
   */
  async deductScore(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!ensureAuthenticated(req, res)) return;
      
      const userId = req.user.userId;

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

      const myCode = await CredibilityCode.findActiveCode(userId, groupId);
      const myCodeWasVerified = myCode && myCode.verifiedBy.length > 0;

      const someoneElsesCode = await CredibilityCode.findOne({
        groupId: groupId,
        verifiedBy: userId
      });
      const verifiedSomeoneElse = someoneElsesCode !== null;

      if (myCodeWasVerified || verifiedSomeoneElse) {
        if (myCode) {
          await myCode.deleteOne();
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

      const result = await credibilityService.updateCredibilityScore(
        userId,
        CredibilityAction.LEFT_WITHOUT_CHECKIN
      );

      if (myCode) {
        await myCode.deleteOne();
      }

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