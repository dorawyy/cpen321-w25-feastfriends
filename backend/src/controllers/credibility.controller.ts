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

      // ✅ IMPROVED: User-friendly error message for invalid code
      if (!codeDoc) {
        res.status(400).json({
          Status: 400,
          Message: { error: 'This code is not valid. Please check the code and try again.' },
          Body: null
        });
        return;
      }

      // ✅ IMPROVED: User-friendly error message for expired code
      if (codeDoc.isExpired()) {
        await codeDoc.deleteOne();
        res.status(400).json({
          Status: 400,
          Message: { error: 'This code has expired. Please ask for a new code.' },
          Body: null
        });
        return;
      }

      // ✅ IMPROVED: User-friendly error message for self-verification
      if (codeDoc.userId === verifierId) {
        res.status(400).json({
          Status: 400,
          Message: { error: 'You cannot verify your own code.' },
          Body: null
        });
        return;
      }

      // ✅ IMPROVED: User-friendly error message for already verified
      if (codeDoc.verifiedBy.includes(verifierId)) {
        res.status(400).json({
          Status: 400,
          Message: { error: 'You have already verified this code.' },
          Body: null
        });
        return;
      }

      // Verify the code
      await codeDoc.verify(verifierId);

      // Give +5% credibility to the VERIFIER (person entering the code)
      const result = await credibilityService.updateCredibilityScore(
        verifierId,
        CredibilityAction.CHECK_IN,
        codeDoc.groupId,
        undefined,
        'Verified another user\'s code - checked in at restaurant'
      );

      console.log(`✅ Code ${code} verified by user ${verifierId} for user ${codeDoc.userId}`);
      console.log(`✅ Verifier gained credibility: ${result.previousScore} → ${result.newScore} (+${result.scoreChange})`);

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

      // CHECK 1: Did someone verify MY code?
      let myCode = null;
      if (groupId) {
        myCode = await CredibilityCode.findActiveCode(userId, groupId);
      }
      const myCodeWasVerified = myCode && myCode.verifiedBy.length > 0;

      // CHECK 2: Did I verify someone else's code?
      let verifiedSomeoneElse = false;
      if (groupId) {
        const someoneElsesCode = await CredibilityCode.findOne({
          groupId: groupId,
          verifiedBy: userId
        });
        verifiedSomeoneElse = someoneElsesCode !== null;
      }

      // No penalty if EITHER condition is true
      if (myCodeWasVerified || verifiedSomeoneElse) {
        // Clean up my code if it exists
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

      // Neither condition met - deduct score
      const result = await credibilityService.updateCredibilityScore(
        userId,
        CredibilityAction.LEFT_WITHOUT_CHECKIN,
        groupId || undefined,
        undefined,
        'Left group without verifying any code'
      );

      // Clean up my code
      if (myCode) {
        await myCode.deleteOne();
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