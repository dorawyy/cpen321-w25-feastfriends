import Group, { IGroupDocument } from '../models/Group';
import User, { UserStatus } from '../models/User';
import restaurantService from './restaurantService';
import socketManager from '../utils/socketManager';
import { notifyGroupMembers, notifyRestaurantSelected } from './notificationService';
import { RestaurantType, GroupStatusResponse } from '../types';

export class GroupService {
  // In-memory lock to prevent concurrent operations on the same group
  private operationLocks: Map<string, Promise<any>> = new Map();

  /**
   * Execute an operation with locking to prevent concurrent modifications
   */
  private async withLock<T>(groupId: string, operation: () => Promise<T>): Promise<T> {
    // If there's already an operation in progress, wait for it
    const existingLock = this.operationLocks.get(groupId);
    if (existingLock) {
      await existingLock.catch(() => {}); // Wait but ignore errors
    }

    // Create new lock
    const lockPromise = operation();
    this.operationLocks.set(groupId, lockPromise);

    try {
      const result = await lockPromise;
      return result;
    } finally {
      // Clean up lock
      this.operationLocks.delete(groupId);
    }
  }

  /**
   * Helper to safely get group ID as string
   */
  private getGroupId(group: IGroupDocument): string {
    return (group._id as any).toString();
  }

  /**
   * Get group status
   */
  async getGroupStatus(groupId: string): Promise<GroupStatusResponse & { groupId: string }> {
    const group = await Group.findById(groupId) as IGroupDocument | null;

    if (!group) {
      throw new Error('Group not found');
    }

    return {
      groupId: this.getGroupId(group),
      roomId: group.roomId,
      completionTime: group.completionTime.getTime(),
      numMembers: group.members.length,
      users: group.members,
      restaurantSelected: group.restaurantSelected,
      restaurant: group.restaurant || undefined,
      status: this.getGroupStatusString(group),
      cuisines: group.cuisines,
      averageBudget: group.averageBudget,
      averageRadius: group.averageRadius,
    };
  }

  /**
   * Get group status string
   */
  private getGroupStatusString(group: IGroupDocument | { restaurantSelected: boolean; completionTime: Date }): 'voting' | 'matched' | 'completed' | 'disbanded' {
    if (group.restaurantSelected) {
      return 'completed';
    }
    if (new Date() > group.completionTime) {
      return 'disbanded';
    }
    return 'voting';
  }


  // ============================================
  // NEW: SEQUENTIAL VOTING METHODS
  // ============================================

  /**
   * Initialize sequential voting for a group
   * Fetches restaurant pool and starts first round
   */
  async initializeSequentialVoting(groupId: string): Promise<{
    success: boolean;
    currentRestaurant?: RestaurantType;
    message: string;
  }> {
    return this.withLock(groupId, async () => {
      const maxRetries = 3;
      let lastError: any;

      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          // Fetch fresh document each attempt
          const group = await Group.findById(groupId) as IGroupDocument | null;

          if (!group) {
            throw new Error('Group not found');
          }

          if (group.restaurantSelected) {
            throw new Error('Restaurant already selected for this group');
          }

          // Get user data from all members
          const users = await User.find({ _id: { $in: group.members } });
          const userPreferences = users.map(user => ({
            cuisineTypes: user.preference || [],
            budget: user.budget || 50,
            location: { 
              coordinates: [
                user.currentLongitude || 0,
                user.currentLatitude || 0
              ] as [number, number]
            },
            radiusKm: user.radiusKm || 5,
          }));

          // Fetch restaurant recommendations
          const restaurants = await restaurantService.getRecommendationsForGroup(
            groupId,
            userPreferences
          );

          if (restaurants.length === 0) {
            return {
              success: false,
              message: 'No restaurants found matching group preferences',
            };
          }

          // Store restaurant pool and initialize voting structures
          group.restaurantPool = restaurants;
          group.votingHistory = [];
          group.votingHistoryDetailed = [];
          
          // Start first voting round
          const firstRestaurant = restaurants[0];
          group.startVotingRound(firstRestaurant);
          
          // Mark all modified paths
          group.markModified('restaurantPool');
          group.markModified('votingHistory');
          group.markModified('votingHistoryDetailed');
          group.markModified('currentRound');
          
          // Save with version check
          await group.save();

          // Notify all members
          try {
            socketManager.emitNewVotingRound(
              groupId,
              firstRestaurant,
              1,
              Math.min(group.maxRounds, restaurants.length),
              group.votingTimeoutSeconds
            );
          } catch (error) {
          }

          return {
            success: true,
            currentRestaurant: firstRestaurant,
            message: 'Sequential voting initialized',
          };

        } catch (error: any) {
          lastError = error;
          
          if (error.name === 'VersionError' && attempt < maxRetries - 1) {
            await new Promise(resolve => setTimeout(resolve, 50 * Math.pow(2, attempt)));
            continue;
          }
          
          throw error;
        }
      }

      throw lastError;
    });
  }

  /**
   * Submit a yes/no vote for the current restaurant
   */
  async submitSequentialVote(
    userId: string,
    groupId: string,
    vote: boolean
  ): Promise<{
    success: boolean;
    majorityReached: boolean;
    result?: 'yes' | 'no';
    nextRestaurant?: RestaurantType;
    selectedRestaurant?: RestaurantType;
    votingComplete?: boolean;
    message: string;
  }> {
    return this.withLock(groupId, async () => {
      const maxRetries = 3;
      let lastError: any;

      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          const group = await Group.findById(groupId) as IGroupDocument | null;

          if (!group) {
            throw new Error('Group not found');
          }

          if (!group.members.includes(userId)) {
            throw new Error('User is not a member of this group');
          }

          if (group.restaurantSelected) {
            throw new Error('Restaurant already selected for this group');
          }

          if (!group.currentRound) {
            throw new Error('No active voting round');
          }

          // Check if round has expired
          if (new Date() > group.currentRound.expiresAt) {
            return await this.handleExpiredRoundInternal(group);
          }

          // Submit vote
          group.submitVote(userId, vote);
          group.markModified('currentRound');
          await group.save();

          // Emit vote update to all members
          try {
            socketManager.emitSequentialVoteUpdate(
              groupId,
              userId,
              vote,
              group.currentRound.yesVotes,
              group.currentRound.noVotes,
              group.members.length
            );
          } catch (error) {
          }

          // Check for majority
          const majorityCheck = group.checkMajority();

          if (majorityCheck.hasMajority) {
            if (majorityCheck.result === 'yes') {
              // Restaurant accepted!
              return await this.selectRestaurant(group, group.currentRound.restaurant);
            } else {
              // Restaurant rejected, move to next
              return await this.moveToNextRestaurant(group);
            }
          }

          // No majority yet, wait for more votes
          return {
            success: true,
            majorityReached: false,
            message: 'Vote recorded, waiting for other members',
          };

        } catch (error: any) {
          lastError = error;
          
          // If it's a version error and we have retries left, try again
          if (error.name === 'VersionError' && attempt < maxRetries - 1) {
            await new Promise(resolve => setTimeout(resolve, 50 * Math.pow(2, attempt)));
            continue;
          }
          
          throw error;
        }
      }

      throw lastError;
    });
  }

  /**
   * Get current voting round status
   */
  async getCurrentVotingRound(groupId: string): Promise<{
    hasActiveRound: boolean;
    currentRestaurant?: RestaurantType;
    votes?: { userId: string; vote: boolean }[];
    yesVotes?: number;
    noVotes?: number;
    expiresAt?: Date;
    roundNumber?: number;
    totalRounds?: number;
    timeRemaining?: number;
  }> {
    const group = await Group.findById(groupId) as IGroupDocument | null;

    if (!group) {
      throw new Error('Group not found');
    }

    if (!group.currentRound) {
      return { hasActiveRound: false };
    }

    // Check if expired
    const now = new Date();
    if (now > group.currentRound.expiresAt) {
      // Don't call handleExpiredRound here to avoid lock contention
      // Let the background task handle it
      return { hasActiveRound: false };
    }

    const votes = Array.from(group.currentRound.votes.entries()).map(([userId, vote]) => ({
      userId,
      vote,
    }));

    const timeRemaining = Math.max(0, Math.floor((group.currentRound.expiresAt.getTime() - now.getTime()) / 1000));

    return {
      hasActiveRound: true,
      currentRestaurant: group.currentRound.restaurant,
      votes,
      yesVotes: group.currentRound.yesVotes,
      noVotes: group.currentRound.noVotes,
      expiresAt: group.currentRound.expiresAt,
      roundNumber: group.votingHistory.length,
      totalRounds: Math.min(group.maxRounds, group.restaurantPool.length),
      timeRemaining,
    };
  }

  /**
   * Handle expired voting round (timeout) - PUBLIC method for background task
   */
  async handleExpiredRound(group: IGroupDocument): Promise<{
    success: boolean;
    majorityReached: boolean;
    nextRestaurant?: RestaurantType;
    selectedRestaurant?: RestaurantType;
    votingComplete?: boolean;
    message: string;
  }> {
    const groupId = this.getGroupId(group);
    
    return this.withLock(groupId, async () => {
      // Fetch fresh group to avoid stale data
      const freshGroup = await Group.findById(groupId) as IGroupDocument | null;
      if (!freshGroup) {
        throw new Error('Group not found');
      }

      // Double-check it's still expired (might have been handled already)
      if (freshGroup.currentRound && new Date() > freshGroup.currentRound.expiresAt) {
        return await this.handleExpiredRoundInternal(freshGroup);
      }

      // Already handled
      return {
        success: true,
        majorityReached: false,
        message: 'Round already processed',
      };
    });
  }

  /**
   * Internal handler for expired rounds (no locking, assumes already locked)
   */
  private async handleExpiredRoundInternal(group: IGroupDocument): Promise<{
    success: boolean;
    majorityReached: boolean;
    nextRestaurant?: RestaurantType;
    selectedRestaurant?: RestaurantType;
    votingComplete?: boolean;
    message: string;
  }> {
    group.endCurrentRound();
    group.markModified('currentRound');
    await group.save();

    return await this.moveToNextRestaurant(group);
  }

  /**
   * Move to the next restaurant in the pool
   */
  private async moveToNextRestaurant(group: IGroupDocument): Promise<{
    success: boolean;
    majorityReached: boolean;
    nextRestaurant?: RestaurantType;
    selectedRestaurant?: RestaurantType;
    votingComplete?: boolean;
    message: string;
  }> {
    // Save current round to detailed history before moving on
    if (group.currentRound) {
      group.votingHistoryDetailed.push({
        restaurantId: group.currentRound.restaurantId,
        restaurant: group.currentRound.restaurant,
        yesVotes: group.currentRound.yesVotes,
        noVotes: group.currentRound.noVotes,
        result: group.currentRound.status === 'expired' ? 'timeout' : 'rejected',
        votedAt: new Date()
      });
      group.markModified('votingHistoryDetailed');
    }

    // Check if we've reached max rounds
    if (group.votingHistory.length >= group.maxRounds) {
      return await this.fallbackSelection(group);
    }

    // Get next restaurant
    const nextRestaurant = await restaurantService.getNextRestaurant(
      group.restaurantPool,
      group.votingHistory
    );

    if (!nextRestaurant) {
      // No more restaurants, use fallback
      return await this.fallbackSelection(group);
    }

    // Start new round
    group.startVotingRound(nextRestaurant);
    group.markModified('currentRound');
    group.markModified('votingHistory');
    await group.save();

    // Notify members
    try {
      socketManager.emitNewVotingRound(
        this.getGroupId(group),
        nextRestaurant,
        group.votingHistory.length,
        Math.min(group.maxRounds, group.restaurantPool.length),
        group.votingTimeoutSeconds
      );
    } catch (error) {
    }

    return {
      success: true,
      majorityReached: false,
      nextRestaurant,
      message: 'Moving to next restaurant',
    };
  }

  /**
   * Select a restaurant (voting complete)
   */
  private async selectRestaurant(
    group: IGroupDocument,
    restaurant: RestaurantType
  ): Promise<{
    success: boolean;
    majorityReached: boolean;
    selectedRestaurant: RestaurantType;
    votingComplete: boolean;
    message: string;
  }> {
    group.restaurant = restaurant;
    group.restaurantSelected = true;
    group.endCurrentRound();
    group.markModified('restaurant');
    group.markModified('currentRound');
    await group.save();

    // Notify members
    try {
      socketManager.emitRestaurantSelected(
        this.getGroupId(group),
        restaurant.restaurantId || '',
        restaurant.name,
        {}
      );
    } catch (error) {
    }

    try {
      await notifyRestaurantSelected(
        group.members,
        restaurant.name,
        this.getGroupId(group)
      );
    } catch (error) {
    }

    return {
      success: true,
      majorityReached: true,
      selectedRestaurant: restaurant,
      votingComplete: true,
      message: 'Restaurant selected!',
    };
  }

  /**
   * Fallback: Select restaurant with most yes votes
   * or random selection if tied/no votes
   */
  private async fallbackSelection(group: IGroupDocument): Promise<{
    success: boolean;
    majorityReached: boolean;
    selectedRestaurant?: RestaurantType;
    votingComplete: boolean;
    message: string;
  }> {
    // Save current round to history if it exists
    if (group.currentRound) {
      group.votingHistoryDetailed.push({
        restaurantId: group.currentRound.restaurantId,
        restaurant: group.currentRound.restaurant,
        yesVotes: group.currentRound.yesVotes,
        noVotes: group.currentRound.noVotes,
        result: 'timeout',
        votedAt: new Date()
      });
      group.markModified('votingHistoryDetailed');
    }

    // Get restaurant with most yes votes from history
    const bestRestaurant = group.getBestRestaurantFromHistory();

    if (!bestRestaurant) {
      return {
        success: false,
        majorityReached: false,
        votingComplete: true,
        message: 'No restaurants available for selection',
      };
    }
    
    return await this.selectRestaurant(group, bestRestaurant);
  }

  // ============================================
  // COMMON METHODS
  // ============================================

  /**
   * Leave a group
   */
  async leaveGroup(userId: string, groupId: string): Promise<void> {
    return this.withLock(groupId, async () => {
      const group = await Group.findById(groupId) as IGroupDocument | null;

      if (!group) {
        throw new Error('Group not found');
      }

      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Remove user from group
      group.removeMember(userId);

      // Update user status
      user.status = UserStatus.ONLINE;
      user.groupId = undefined;
      // ✅ FIX: Also clear roomId when leaving group (in case user was in a room that became a group)
      user.roomId = undefined;
      await user.save();

      if (group.members.length === 0) {
        await Group.findByIdAndDelete(groupId);
      } else {
        group.markModified('currentRound');
        await group.save();

        try {
          socketManager.emitMemberLeft(
            `group_${groupId}`,
            userId,
            user.name,
            group.members.length
          );
        } catch (error) {
        }

        // Check if majority can still be reached
        if (group.votingMode === 'sequential' && group.currentRound) {
          const majorityCheck = group.checkMajority();
          if (majorityCheck.hasMajority) {
            if (majorityCheck.result === 'yes') {
              await this.selectRestaurant(group, group.currentRound.restaurant);
            } else {
              await this.moveToNextRestaurant(group);
            }
          }
        }

        // Legacy voting check
        if (group.votingMode === 'list' && group.hasAllVoted() && !group.restaurantSelected) {
          const winningRestaurantId = group.getWinningRestaurant();
          
          if (winningRestaurantId && group.restaurant) {
            group.restaurantSelected = true;
            await group.save();

            const currentVotes: Record<string, number> = Object.fromEntries(
              Array.from(group.restaurantVotes.entries()).map(([id, count]) => [String(id), count])
            );

            try {
              socketManager.emitRestaurantSelected(
                groupId,
                winningRestaurantId,
                group.restaurant.name,
                currentVotes
              );
            } catch (error) {
            }

            try {
              await notifyRestaurantSelected(
                group.members,
                group.restaurant.name,
                groupId
              );
            } catch (error) {
            }
          }
        }
      }
    });
  }

  /**
   * Get group by user ID
   */
  async getGroupByUserId(userId: string): Promise<IGroupDocument | null> {
    const user = await User.findById(userId);
    
    if (!user || !user.groupId) {
      return null;
    }

    return Group.findById(user.groupId) as Promise<IGroupDocument | null>;
  }

  /**
   * Close/disband a group
   */
  async closeGroup(groupId: string): Promise<void> {
    return this.withLock(groupId, async () => {
      const group = await Group.findById(groupId) as IGroupDocument | null;

      if (!group) {
        throw new Error('Group not found');
      }

      await User.updateMany(
        { _id: { $in: group.members } },
        {
          status: UserStatus.ONLINE,
          groupId: undefined,
        }
      );

      await Group.findByIdAndDelete(groupId);
    });
  }

  /**
   * Check for expired groups (background task)
   */
  async checkExpiredGroups(): Promise<void> {
    const expiredGroups = await Group.find({
      restaurantSelected: false,
      completionTime: { $lt: new Date() },
    }) as IGroupDocument[];

    for (const group of expiredGroups) {
      const groupId = this.getGroupId(group);
      
      // Skip if there's already an operation in progress
      if (this.operationLocks.has(groupId)) {
        continue;
      }

      try {
        if (group.votingMode === 'sequential') {
          // Handle sequential voting expiration
          await this.fallbackSelection(group);
        } else {
          // Handle legacy voting expiration
          const winningRestaurantId = group.getWinningRestaurant();
          
          if (winningRestaurantId && group.votes.size > 0) {
            group.restaurantSelected = true;
            await group.save();

            if (group.restaurant) {
              const currentVotes: Record<string, number> = Object.fromEntries(
                Array.from(group.restaurantVotes.entries()).map(([id, count]) => [String(id), count])
              );

              socketManager.emitRestaurantSelected(
                groupId,
                winningRestaurantId,
                group.restaurant.name,
                currentVotes
              );
              
              await notifyGroupMembers(group.members, {
                title: 'Voting Time Expired',
                body: `${group.restaurant.name} was selected based on the votes received.`,
                data: {
                  type: 'restaurant_selected',
                  groupId: groupId,
                },
              });
            }

          } else {
            await this.closeGroup(groupId);
            
            await notifyGroupMembers(group.members, {
              title: 'Group Expired',
              body: 'Your group expired without selecting a restaurant.',
              data: {
                type: 'group_expired',
                groupId: groupId,
              },
            });

          }
        }
      } catch (error: any) {
        if (error.name === 'VersionError') {
        } else {
        }
      }
    }
  }

  /**
   * Background task: Check for expired voting rounds
   */
  async checkExpiredVotingRounds(): Promise<void> {
    try {
      const now = new Date();
      
      const activeGroups = await Group.find({
        votingMode: 'sequential',
        restaurantSelected: false,
        'currentRound.status': 'active',
        'currentRound.expiresAt': { $lt: now } // Only get actually expired ones
      }) as IGroupDocument[];

      if (activeGroups.length === 0) {
        return; // Silent when nothing to do
      }

      for (const group of activeGroups) {
        const groupId = this.getGroupId(group);
        
        if (this.operationLocks.has(groupId)) {
          continue;
        }

        try {
          await this.handleExpiredRound(group);
        } catch (error: any) {
          if (error.name === 'VersionError') {
          } else {
          }
        }
      }
    } catch (error) {
    }
  }
}

export default new GroupService();