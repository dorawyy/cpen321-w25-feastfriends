import Group, { IGroupDocument } from '../models/Group';
import User, { UserStatus } from '../models/User';
import restaurantService from './restaurantService';
import socketManager from '../utils/socketManager';
import { notifyGroupMembers, notifyRestaurantSelected } from './notificationService';
import { RestaurantType, GroupStatusResponse } from '../types';

export class GroupService {
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
  // LEGACY VOTING (for backward compatibility)
  // ============================================

  /**
   * Vote for a restaurant (legacy list-based voting)
   */
  async voteForRestaurant(
    userId: string,
    groupId: string,
    restaurantId: string,
    restaurant?: RestaurantType
  ): Promise<{ message: string; Current_votes: Record<string, number> }> {
    const group = await Group.findById(groupId) as IGroupDocument | null;

    if (!group) {
      throw new Error('Group not found');
    }

    // Check if user is in the group
    if (!group.members.includes(userId)) {
      throw new Error('User is not a member of this group');
    }

    // Check if restaurant is already selected
    if (group.restaurantSelected) {
      throw new Error('Restaurant has already been selected for this group');
    }

    // Add/update vote
    group.addVote(userId, restaurantId);
    
    // Mark Map fields as modified for Mongoose to persist changes
    group.markModified('votes');
    group.markModified('restaurantVotes');
    
    await group.save();

    // Convert Map to object for response
    const currentVotes: Record<string, number> = Object.fromEntries(
      Array.from(group.restaurantVotes.entries()).map(([id, count]) => {
        const safeId = String(id);
        return [safeId, count];
      })
    );

    try {
      socketManager.emitVoteUpdate(
        groupId,
        restaurantId,
        currentVotes,
        group.votes.size,
        group.members.length
      );
    } catch (error) {
      console.error('Failed to emit vote update:', error);
    }

    // Check if all members have voted
    if (group.hasAllVoted()) {
      const winningRestaurantId = group.getWinningRestaurant();
      
      if (winningRestaurantId) {
        if (restaurant) {
          group.restaurant = restaurant;
        }
        group.restaurantSelected = true;
        await group.save();

        try {
          socketManager.emitRestaurantSelected(
            groupId,
            winningRestaurantId,
            group.restaurant?.name || 'Selected Restaurant',
            currentVotes
          );
        } catch (error) {
          console.error('Failed to emit restaurant selected:', error);
        }

        try {
          await notifyRestaurantSelected(
            group.members,
            group.restaurant?.name || 'Selected Restaurant',
            groupId
          );
        } catch (error) {
          console.error('Failed to send notification:', error);
        }

        console.log(`✅ Restaurant selected for group ${groupId}`);
      }
    }

    return {
      message: 'Voting successful',
      Current_votes: currentVotes,
    };
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
    const group = await Group.findById(groupId) as IGroupDocument | null;

    if (!group) {
      throw new Error('Group not found');
    }

    if (group.restaurantSelected) {
      throw new Error('Restaurant already selected for this group');
    }

    // Get user data from all members - FIXED: using correct field names
    const users = await User.find({ _id: { $in: group.members } });
    const userPreferences = users.map(user => ({
      cuisineTypes: user.preference || [], // ✅ FIXED: 'preference' not 'preferences'
      budget: user.budget || 50,
      location: { 
        coordinates: [
          user.currentLongitude || 0,  // ✅ FIXED: using currentLongitude/currentLatitude
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

    // Store restaurant pool
    group.restaurantPool = restaurants;
    group.votingHistory = [];
    group.votingHistoryDetailed = [];
    
    // Start first voting round
    const firstRestaurant = restaurants[0];
    group.startVotingRound(firstRestaurant);
    
    group.markModified('restaurantPool');
    group.markModified('votingHistory');
    group.markModified('votingHistoryDetailed');
    group.markModified('currentRound');
    
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
      console.error('Failed to emit new voting round:', error);
    }

    console.log(`🎯 Started sequential voting for group ${groupId} with ${restaurants.length} restaurants`);

    return {
      success: true,
      currentRestaurant: firstRestaurant,
      message: 'Sequential voting initialized',
    };
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
      return await this.handleExpiredRound(group);
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
      console.error('Failed to emit vote update:', error);
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
      await this.handleExpiredRound(group);
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
   * Handle expired voting round (timeout)
   */
  private async handleExpiredRound(group: IGroupDocument): Promise<{
    success: boolean;
    majorityReached: boolean;
    nextRestaurant?: RestaurantType;
    selectedRestaurant?: RestaurantType;
    votingComplete?: boolean;
    message: string;
  }> {
    console.log(`⏰ Voting round expired for group ${this.getGroupId(group)}`);
    
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
      console.error('Failed to emit new voting round:', error);
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
      console.error('Failed to emit restaurant selected:', error);
    }

    try {
      await notifyRestaurantSelected(
        group.members,
        restaurant.name,
        this.getGroupId(group)
      );
    } catch (error) {
      console.error('Failed to send notification:', error);
    }

    console.log(`✅ Restaurant selected for group ${this.getGroupId(group)}: ${restaurant.name}`);

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
    console.log(`🎲 Fallback selection for group ${this.getGroupId(group)}`);

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

    console.log(`📊 Selected restaurant with most yes votes: ${bestRestaurant.name}`);
    
    return await this.selectRestaurant(group, bestRestaurant);
  }

  // ============================================
  // COMMON METHODS
  // ============================================

  /**
   * Leave a group
   */
  async leaveGroup(userId: string, groupId: string): Promise<void> {
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
    await user.save();

    if (group.members.length === 0) {
      await Group.findByIdAndDelete(groupId);
      console.log(`🗑️ Deleted empty group: ${groupId}`);
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
        console.error('Failed to emit member left:', error);
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
            console.error('Failed to emit restaurant selected:', error);
          }

          try {
            await notifyRestaurantSelected(
              group.members,
              group.restaurant.name,
              groupId
            );
          } catch (error) {
            console.error('Failed to send notification:', error);
          }
        }
      }
    }
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

    console.log(`✅ Closed group: ${groupId}`);
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
              this.getGroupId(group),
              winningRestaurantId,
              group.restaurant.name,
              currentVotes
            );
            
            await notifyGroupMembers(group.members, {
              title: 'Voting Time Expired',
              body: `${group.restaurant.name} was selected based on the votes received.`,
              data: {
                type: 'restaurant_selected',
                groupId: this.getGroupId(group),
              },
            });
          }

          console.log(`⏰ Auto-selected restaurant for expired group: ${this.getGroupId(group)}`);
        } else {
          await this.closeGroup(this.getGroupId(group));
          
          await notifyGroupMembers(group.members, {
            title: 'Group Expired',
            body: 'Your group expired without selecting a restaurant.',
            data: {
              type: 'group_expired',
              groupId: this.getGroupId(group),
            },
          });

          console.log(`⏰ Disbanded expired group with no votes: ${this.getGroupId(group)}`);
        }
      }
    }
  }

  /**
   * Background task: Check for expired voting rounds
   */
  async checkExpiredVotingRounds(): Promise<void> {
    const activeGroups = await Group.find({
      votingMode: 'sequential',
      restaurantSelected: false,
      'currentRound.status': 'active',
    }) as IGroupDocument[];

    const now = new Date();

    for (const group of activeGroups) {
      if (group.currentRound && now > group.currentRound.expiresAt) {
        console.log(`⏰ Voting round expired for group ${this.getGroupId(group)}`);
        await this.handleExpiredRound(group);
      }
    }
  }
}

export default new GroupService();