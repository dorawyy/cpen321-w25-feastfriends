import Room, { RoomStatus, IRoomDocument } from '../models/Room';
import User, { UserStatus } from '../models/User';
import Group from '../models/Group';
import socketManager from '../utils/socketManager';
import { notifyRoomMatched, notifyRoomExpired } from './notificationService';

export class MatchingService {
  private readonly ROOM_DURATION_MS = 2 * 60 * 1000; // 2 minutes
  private readonly MAX_MEMBERS = 10; // Maximum members per room
  private readonly MIN_MEMBERS = 2; // Minimum members to form a group
  private readonly MINIMUM_MATCH_SCORE = 30; // Minimum score to match a room
  private readonly VOTING_TIME = 30 * 60 * 1000; //Time for voting

  /**
   * Find the best matching room based on preferences
   */
  private async findBestMatchingRoom(userPreferences: {
    cuisines: string[];
    budget: number;
    radiusKm: number;
  }): Promise<IRoomDocument | null> {
    // Get all available rooms
    const availableRooms = await Room.find({
      status: RoomStatus.WAITING,
      completionTime: { $gt: new Date() },
      $expr: { $lt: [{ $size: '$members' }, this.MAX_MEMBERS] }
    }) as unknown as IRoomDocument[];

    if (availableRooms.length === 0) {
      return null;
    }

    // Score each room
    const scoredRooms = availableRooms.map(room => {
      let score = 0;
      
      // Cuisine match (50 points if ANY cuisine matches)
      if (room.cuisine && userPreferences.cuisines.includes(room.cuisine)) {
        score += 50;
      }
      
      // Budget similarity (up to 30 points)
      // Closer budgets get higher scores
      const budgetDiff = Math.abs((room.averageBudget || 0) - userPreferences.budget);
      const budgetScore = Math.max(0, 30 - budgetDiff);
      score += budgetScore;
      
      // Radius similarity (up to 20 points)
      // Closer radius preferences get higher scores
      const radiusDiff = Math.abs((room.averageRadius || 5) - userPreferences.radiusKm);
      const radiusScore = Math.max(0, 20 - (radiusDiff * 2));
      score += radiusScore;
      
      return { room, score };
    });

    // Sort by score (highest first)
    scoredRooms.sort((a, b) => b.score - a.score);
    
    // Only return a room if it has a minimum score
    // bestMatch is guaranteed to exist because we return early if availableRooms.length === 0
    const bestMatch = scoredRooms[0];
    
    if (bestMatch.score >= this.MINIMUM_MATCH_SCORE) {
      console.log(`✅ Best room match found with score: ${bestMatch.score}`);
      return bestMatch.room;
    }
    
    console.log(`⚠️ No good match found (best score: ${bestMatch.score})`);
    return null;
  }

  /**
   * Join a user to the matching pool
   * Finds best matching room or creates new one
   */
  async joinMatching(
    userId: string,
  preferences: {
    cuisine?: string[];
    budget?: number;
    radiusKm?: number;
  }
): Promise<{ roomId: string; room: IRoomDocument }> {
  console.log(`🎯 joinMatching START: User ${userId} joining with preferences:`, preferences);

  // Get user
  const user = await User.findById(userId);
  if (!user) {
    throw new Error('User not found');
  }

  // ✅ FIX: Different handling for rooms vs groups
  let needsSave = false;

  // Check room status
  if (user.roomId) {
    const existingRoom = await Room.findById(user.roomId);
    if (!existingRoom || existingRoom.status !== RoomStatus.WAITING) {
      // Room doesn't exist or is no longer active - clear it
      console.log(`🧹 Clearing stale roomId ${user.roomId} for user ${userId}`);
      user.roomId = undefined;
      needsSave = true;
    } else if (existingRoom.members.includes(userId)) {
      // User is legitimately in an active room
      throw new Error('User is already in an active room. Please leave the room first.');
    } else {
      // Room exists but user is not in it - clear the reference
      console.log(`🧹 Clearing invalid roomId ${user.roomId} for user ${userId} (not in member list)`);
      user.roomId = undefined;
      needsSave = true;
    }
  }

  // ⚠️ CRITICAL: Check if user is in an ACTIVE group - block if yes
  if (user.groupId) {
    const existingGroup = await Group.findById(user.groupId);
    
    // Only clear groupId if group is truly invalid/completed
    if (!existingGroup) {
      // Group doesn't exist - clear it
      console.log(`🧹 Clearing non-existent groupId ${user.groupId} for user ${userId}`);
      user.groupId = undefined;
      needsSave = true;
    } else if (!existingGroup.members.includes(userId)) {
      // User is not in the group member list - clear it
      console.log(`🧹 Clearing invalid groupId ${user.groupId} for user ${userId} (not in member list)`);
      user.groupId = undefined;
      needsSave = true;
    } else if (existingGroup.restaurantSelected) {
      // Restaurant already selected - group session should be complete
      // But user hasn't left yet - this is allowed, just log it
      console.log(`ℹ️ User ${userId} is in completed group ${user.groupId} but hasn't left yet`);
      // Don't block matching - allow them to join a new session while still technically in old group
      // The old group will be cleaned up eventually
    } else if (new Date() > existingGroup.completionTime) {
      // Group has expired (voting time ended)
      console.log(`ℹ️ User ${userId} is in expired group ${user.groupId}`);
      // Don't block - expired groups will be cleaned up by background task
    } else {
      // ❌ Group is ACTIVE (voting ongoing, not expired, restaurant not selected)
      // User should NOT be able to join matching while in an active group
      throw new Error('You are already in an active group. Please complete or leave your current group before joining matching.');
    }
  }

  // Reset status if needed
  if (needsSave) {
    user.status = UserStatus.ONLINE;
    await user.save();
    console.log(`✅ Cleaned up stale state for user ${userId}`);
  }

  // Update user preferences if provided
  if (preferences.budget !== undefined) user.budget = preferences.budget;
  if (preferences.radiusKm !== undefined) user.radiusKm = preferences.radiusKm;
  if (preferences.cuisine !== undefined) user.preference = preferences.cuisine;
  await user.save();

    // Prepare matching criteria
    const matchingPreferences = {
      cuisines: preferences.cuisine ?? user.preference,
      budget: preferences.budget ?? user.budget ?? 50,
      radiusKm: preferences.radiusKm ?? user.radiusKm ?? 5,
    };

    // Find best matching room
    let room = await this.findBestMatchingRoom(matchingPreferences);

    if (!room) {
      // No good match found - create new room
      const completionTime = new Date(Date.now() + this.ROOM_DURATION_MS);
      
      room = (await Room.create({
        completionTime,
        maxMembers: this.MAX_MEMBERS,
        members: [userId],
        status: RoomStatus.WAITING,
        cuisine: matchingPreferences.cuisines[0] || null, // Primary cuisine
        averageBudget: matchingPreferences.budget,
        averageRadius: matchingPreferences.radiusKm,
      })) as unknown as IRoomDocument;

      console.log(`✅ Created new room: ${room._id.toString()} (cuisine: ${room.cuisine})`);
      console.log(`   🕐 Room expires in: ${(room.completionTime.getTime() - Date.now()) / 1000}s`); // ✅ ADD THIS LINE
    } else {
      // Add user to existing room
      room.members.push(userId);
      
      // Update room averages
      await this.updateRoomAverages(room);
      
      await room.save();
      console.log(`✅ User ${userId} joined room: ${room._id.toString()} (members: ${room.members.length}/${this.MAX_MEMBERS})`);
    }

    // Update user status
    user.status = UserStatus.IN_WAITING_ROOM;
    user.roomId = room._id.toString();
    await user.save();

    // Emit room update to all members
    socketManager.emitRoomUpdate(
      room._id.toString(),
      room.members,
      room.completionTime,
      room.status
    );

    socketManager.emitToUser(userId, 'room_update', {
      roomId: room._id.toString(),
      members: room.members,
      expiresAt: room.completionTime,
      status: room.status,
    });

    // Emit member joined notification
    socketManager.emitMemberJoined(
      room._id.toString(),
      userId,
      user.name,
      room.members.length,
      room.maxMembers
    );

    // Check if room is full and create group
    if (room.members.length >= this.MAX_MEMBERS) {
      await this.createGroupFromRoom(room._id.toString());
    }

    return {
      roomId: room._id.toString(),
      room: room.toJSON() as IRoomDocument,
    };
  }

  /**
   * Update room averages (budget, radius)
   */
  private async updateRoomAverages(room: IRoomDocument): Promise<void> {
    const users = await User.find({ _id: { $in: room.members } });

    const totalBudget = users.reduce((sum, user) => sum + (user.budget || 0), 0);
    const totalRadius = users.reduce((sum, user) => sum + (user.radiusKm || 5), 0);

    room.averageBudget = totalBudget / users.length;
    room.averageRadius = totalRadius / users.length;
  }

  /**
 * Leave a room
 */
async leaveRoom(userId: string, roomId: string): Promise<void> {
  const user = await User.findById(userId);
  if (!user) {
    throw new Error('User not found');
  }

  const room = (await Room.findById(roomId)) as unknown as IRoomDocument | null;
  
  // ✅ FIXED: If room doesn't exist, just clear the user's roomID
  if (!room) {
    console.log(`Room ${roomId} not found - clearing user's roomID anyway`);
    
    // Clear user's roomID even if room doesn't exist
    if (user.roomId) {
      user.roomId = undefined;
      user.status = UserStatus.ONLINE;
      await user.save();
      console.log(`✅ Cleared stale roomID for user ${userId}`);
    }
    
    // Don't throw error - this is expected when cleaning up stale state
    return;
  }

  // Room exists - proceed with normal leave logic
  // ✅ CRITICAL: Remove user from room's member array
  room.members = room.members.filter(id => id !== userId);
  console.log(`✅ Removed user ${userId} from room ${roomId}, remaining members: ${room.members.length}`);
  
  // Update user status
  user.status = UserStatus.ONLINE;
  user.roomId = undefined;
  await user.save();

  // ✅ CRITICAL: Delete room if empty, otherwise update it
  if (room.members.length === 0) {
    await Room.findByIdAndDelete(roomId);
    console.log(`🗑️ Deleted empty room: ${roomId}`);
    return; // Exit early - no need to emit updates for deleted room
  }

  // Room still has members - update and notify
  await this.updateRoomAverages(room);
  await room.save();
  console.log(`✅ Saved room ${roomId} with ${room.members.length} members`);

  // Emit member left notification to remaining members
  try {
    socketManager.emitMemberLeft(
      roomId,
      userId,
      user.name,
      room.members.length
    );
    console.log(`📤 Emitted member_left for room ${roomId}`);
  } catch (error) {
    console.error('Failed to emit member left:', error);
  }

  // Emit room update with correct data
  try {
    socketManager.emitRoomUpdate(
      roomId,
      room.members,
      room.completionTime,
      room.status
    );
    console.log(`📤 Emitted room_update for room ${roomId}`);
  } catch (error) {
    console.error('Failed to emit room update:', error);
  }

  console.log(`✅ User ${userId} successfully left room ${roomId}`);
}

 /**
 * Create a group from a full room
 */
private async createGroupFromRoom(roomId: string): Promise<void> {
  const room = (await Room.findById(roomId)) as unknown as IRoomDocument | null;
  if (!room) {
    throw new Error('Room not found');
  }

  // Update room status
  room.status = RoomStatus.MATCHED;
  await room.save();

  // Create group WITH ROOM PREFERENCES
  const completionTime = new Date(Date.now() + this.VOTING_TIME);
  
  const group = await Group.create({
    roomId: room._id.toString(),
    completionTime,
    maxMembers: room.members.length,
    members: room.members,
    restaurantSelected: false,
    // ✅ COPY PREFERENCES FROM ROOM:
    cuisine: room.cuisine,
    averageBudget: room.averageBudget,
    averageRadius: room.averageRadius,
  });

  console.log(`✅ Created group: ${group._id.toString()} from room: ${roomId}`);
  console.log(`   🍽️ Group cuisine: ${group.cuisine}`);
  console.log(`   💰 Group budget: ${group.averageBudget}`);
  console.log(`   📍 Group radius: ${group.averageRadius} km`);

  // Update all users
  await User.updateMany(
    { _id: { $in: room.members } },
    {
      status: UserStatus.IN_GROUP,
      groupId: group._id.toString(),
      roomId: undefined,
    }
  );

  // Emit group ready to all members
  socketManager.emitGroupReady(
    roomId,
    group._id.toString(),
    room.members
  );

  // Send push notifications
  for (const memberId of room.members) {
    try {
      await notifyRoomMatched(memberId, roomId, group._id.toString());
    } catch (error) {
      console.error(`Failed to notify user ${memberId}:`, error);
    }
  }
}

  /**
   * Get room status
   */
  async getRoomStatus(roomId: string): Promise<{
    roomID: string;
    completionTime: number;
    members: string[];
    groupReady: boolean;
    status: RoomStatus;
  }> {
    const room = (await Room.findById(roomId)) as unknown as IRoomDocument | null;
    if (!room) {
      throw new Error('Room not found');
    }

    return {
      roomID: room._id.toString(),
      completionTime: room.completionTime.getTime(),
      members: room.members,
      groupReady: room.status === RoomStatus.MATCHED,
      status: room.status,
    };
  }

  /**
   * Get users in a room
   */
  async getRoomUsers(roomId: string): Promise<string[]> {
    const room = (await Room.findById(roomId)) as unknown as IRoomDocument | null;
    if (!room) {
      throw new Error('Room not found');
    }

    return room.members;
  }

  /**
 * Check and expire old rooms (background task)
 */
async checkExpiredRooms(): Promise<void> {
  console.log('🔍 Running checkExpiredRooms background task...');
  
  const now = new Date();
  console.log(`   Current time: ${now.toISOString()}`);
  
  const expiredRooms = await Room.find({
    status: RoomStatus.WAITING,
    completionTime: { $lt: now },
  }) as unknown as IRoomDocument[];

  console.log(`   Found ${expiredRooms.length} expired room(s)`);

  for (const room of expiredRooms) {
    const timeSinceExpiry = (now.getTime() - room.completionTime.getTime()) / 1000;
    console.log(`   ⏰ Room ${room._id} expired ${timeSinceExpiry}s ago, has ${room.members.length}/${this.MIN_MEMBERS} members`);
    
    // Check if room has enough members
    if (room.members.length >= this.MIN_MEMBERS) {
      console.log(`   ✅ Creating group from room ${room._id} with ${room.members.length} members`);
      // Create group even if not full
      await this.createGroupFromRoom(room._id.toString());
    } else {
      console.log(`   ❌ Room ${room._id} doesn't have enough members - expiring it`);
      // Expire the room
      room.status = RoomStatus.EXPIRED;
      await room.save();

      // Update users
      await User.updateMany(
        { _id: { $in: room.members } },
        {
          status: UserStatus.ONLINE,
          roomId: undefined,
        }
      );

      // Notify members
      socketManager.emitRoomExpired(room._id.toString(), 'Not enough members');

      for (const memberId of room.members) {
        try {
          await notifyRoomExpired(memberId, room._id.toString());
        } catch (error) {
          console.error(`Failed to notify user ${memberId}:`, error);
        }
      }

      console.log(`⏰ Expired room: ${room._id.toString()}`);
    }
  }
  
  if (expiredRooms.length === 0) {
    console.log('   ✅ No expired rooms found');
  }
}
}

export default new MatchingService();