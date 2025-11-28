import User from '../models/User';
import { CredibilityAction } from '../types/credibility';

export class CredibilityService {
  async updateCredibilityScore(
    userId: string,
    action: CredibilityAction
  ): Promise<{
    previousScore: number;
    newScore: number;
    scoreChange: number;
  }> {
    const user = await User.findById(userId);

    if (!user) {
      throw new Error('User not found');
    }

    const previousScore = user.credibilityScore;
    
    let scoreChange: number;
    switch (action) {
      case CredibilityAction.CHECK_IN:
        scoreChange = 5;
        break;
      case CredibilityAction.LEFT_WITHOUT_CHECKIN:
        scoreChange = -10;
        break;
      default:
        throw new Error(`Invalid credibility action: ${String(action)}`);
    }
    
    let newScore = previousScore + scoreChange;
    newScore = Math.max(0, Math.min(100, newScore));

    user.credibilityScore = newScore;
    await user.save();

    return {
      previousScore,
      newScore,
      scoreChange,
    };
  }

  isCredibilityAcceptable(score: number, minimumRequired: number = 50): boolean {
    return score >= minimumRequired;
  }
}

export default new CredibilityService();