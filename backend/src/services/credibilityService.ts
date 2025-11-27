import User from '../models/User';
import CredibilityLog, { CredibilityAction } from '../models/CredibilityLog';

export class CredibilityService {
  /**
   * Update user's credibility score
   */
  async updateCredibilityScore(
    userId: string,
    action: CredibilityAction,
    groupId?: string,
    roomId?: string,
    notes?: string
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
    
    // Get score change
    let scoreChange: number;
    switch (action) {
      case CredibilityAction.CHECK_IN:
        // Gain 5% of current score (rounded down)
        scoreChange = 5;
        break;
      case CredibilityAction.LEFT_WITHOUT_CHECKIN:
        // Lose 10% of current score (rounded down)
        scoreChange = -10;
        break;
      default:
        throw new Error(`Invalid credibility action: ${String(action)}`);
    }
    
    let newScore = previousScore + scoreChange;

    // Clamp score between 0 and 100
    newScore = Math.max(0, Math.min(100, newScore));

    // Update user score
    user.credibilityScore = newScore;
    await user.save();

    // Log the change
    await CredibilityLog.create({
      userId,
      action,
      scoreChange,
      groupId,
      roomId,
      previousScore,
      newScore,
      notes,
    });

    console.log(
      `📊 Credibility updated for user ${userId}: ${previousScore} → ${newScore} (${action})`
    );

    return {
      previousScore,
      newScore,
      scoreChange,
    };
  }

  /**
   * Get credibility logs for a user
   */
  async getUserCredibilityLogs(
    userId: string,
    limit: number = 20
  ): Promise<unknown[]> {
    const logs = await CredibilityLog.findByUserId(userId, limit);
    return logs;
  }

  /**
   * Get credibility statistics for a user
   */
  async getUserCredibilityStats(userId: string): Promise<{
    currentScore: number;
    totalLogs: number;
    positiveActions: number;
    negativeActions: number;
    recentTrend: string;
  }> {
    const user = await User.findById(userId);

    if (!user) {
      throw new Error('User not found');
    }

    const logs = await CredibilityLog.findByUserId(userId, 100);

    const positiveActions = logs.filter(log => log.scoreChange > 0).length;
    const negativeActions = logs.filter(log => log.scoreChange < 0).length;

    // Calculate recent trend (last 10 actions)
    const recentLogs = logs.slice(0, 10);
    const recentChange = recentLogs.reduce((sum, log) => sum + log.scoreChange, 0);
    
    let recentTrend = 'stable';
    if (recentChange > 5) recentTrend = 'improving';
    if (recentChange < -5) recentTrend = 'declining';

    return {
      currentScore: user.credibilityScore,
      totalLogs: logs.length,
      positiveActions,
      negativeActions,
      recentTrend,
    };
  }

  /**
   * Check if user meets minimum credibility requirement
   */
  isCredibilityAcceptable(score: number, minimumRequired: number = 50): boolean {
    return score >= minimumRequired;
  }
}

export default new CredibilityService();