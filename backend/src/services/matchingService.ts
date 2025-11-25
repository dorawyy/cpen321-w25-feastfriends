import Room, { RoomStatus, IRoomDocument } from '../models/Room';
import User, { UserStatus } from '../models/User';
import Group from '../models/Group';
import socketManager from '../utils/socketManager';
import { notifyRoomMatched, notifyRoomExpired } from './notificationService';

export class MatchingService {
  private readonly ROOM_DURATION_MS = 0.25 * 60 * 1000; // 2 minutes
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
  latitude?: number;
  longitude?: number;
}): Promise<IRoomDocument | null> {
  let availableRooms = await Room.find({
    status: RoomStatus.WAITING,
    completionTime: { $gt: new Date() },
    $expr: { $lt: [{ $size: '$members' }, this.MAX_MEMBERS] }
  }) as unknown as IRoomDocument[];

  if (availableRooms.length === 0) {
    console.log(`⚠️ No available rooms found`);
    return null;
  }

  console.log(`🔍 Found ${availableRooms.length} available room(s) to check`);

  // ✅ FILTER BY DISTANCE FIRST (if location available)
  if (userPreferences.latitude && userPreferences.longitude) {
    console.log(`📍 Filtering rooms by distance from user location: ${userPreferences.latitude}, ${userPreferences.longitude}`);
    
    availableRooms = availableRooms.filter(room => {
      if (!room.averageLatitude || !room.averageLongitude) {
        console.log(`❌ Room ${room._id} rejected: No location data`);
        return false;
      }

      const distance = this.calculateDistance(
        userPreferences.latitude!,
        userPreferences.longitude!,
        room.averageLatitude,
        room.averageLongitude
      );
      
      const maxAcceptableDistance = Math.min(userPreferences.radiusKm, room.averageRadius || 5);
      
      if (distance > maxAcceptableDistance) {
        console.log(`❌ Room ${room._id} rejected: ${distance.toFixed(2)}km > ${maxAcceptableDistance}km (too far)`);
        return false;
      }
      
      console.log(`✅ Room ${room._id} within range: ${distance.toFixed(2)}km <= ${maxAcceptableDistance}km`);
      return true;
    });

    if (availableRooms.length === 0) {
      console.log(`⚠️ No rooms within acceptable distance (${userPreferences.radiusKm}km)`);
      return null;
    }
    
    console.log(`✅ ${availableRooms.length} room(s) passed distance filter`);
  } else {
    console.log(`⚠️ User location not available - skipping distance filtering`);
  }

  // Now score only the rooms that passed distance filter
  const scoredRooms = availableRooms.map(room => {
    let score = 0;
    
    // Location scoring (for rooms within range) - closer is better
    if (userPreferences.latitude && userPreferences.longitude && 
        room.averageLatitude && room.averageLongitude) {
      const distance = this.calculateDistance(
        userPreferences.latitude,
        userPreferences.longitude,
        room.averageLatitude,
        room.averageLongitude
      );
      
      // Give higher scores to closer rooms (50 points at 0km, decreasing)
      const locationScore = Math.max(0, 50 - (distance * 5));
      score += locationScore;
      console.log(`📍 Room ${room._id} location score: +${locationScore.toFixed(2)} (distance: ${distance.toFixed(2)}km)`);
    }
    
    // ✅ Cuisine match - count common cuisines
    if (room.cuisines && room.cuisines.length > 0) {
      const commonCuisines = room.cuisines.filter(cuisine => 
        userPreferences.cuisines.includes(cuisine)
      );
      // Give points for each common cuisine
      const cuisineScore = commonCuisines.length * 20;
      score += cuisineScore;
      console.log(`🍽️ Room ${room._id} cuisine score: +${cuisineScore} (${commonCuisines.length} common: ${commonCuisines.join(', ')})`);
    }
    
    // Budget scoring
    const budgetDiff = Math.abs((room.averageBudget || 0) - userPreferences.budget);
    const budgetScore = Math.max(0, 30 - budgetDiff);
    score += budgetScore;
    console.log(`💰 Room ${room._id} budget score: +${budgetScore.toFixed(2)} (diff: $${budgetDiff})`);
    
    // Radius preference scoring (how similar are search preferences)
    const radiusDiff = Math.abs((room.averageRadius || 5) - userPreferences.radiusKm);
    const radiusScore = Math.max(0, 20 - (radiusDiff * 2));
    score += radiusScore;
    console.log(`📏 Room ${room._id} radius score: +${radiusScore.toFixed(2)} (diff: ${radiusDiff.toFixed(2)}km)`);
    
    console.log(`🏆 Room ${room._id} TOTAL SCORE: ${score.toFixed(2)}`);
    return { room, score };
  });

  // Sort by score (highest first)
  scoredRooms.sort((a, b) => b.score - a.score);
  
  // Only return a room if it has a minimum score
  const bestMatch = scoredRooms[0];
  
  if (bestMatch.score >= this.MINIMUM_MATCH_SCORE) {
    console.log(`✅ Best room match found: ${bestMatch.room._id} with score ${bestMatch.score.toFixed(2)}`);
    return bestMatch.room;
  }
  
  console.log(`⚠️ No good match found (best score: ${bestMatch.score.toFixed(2)}, minimum required: ${this.MINIMUM_MATCH_SCORE})`);
  return null;
}

  /**
   * Distance calculation helper using Haversine formula
   */
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.deg2rad(lat2 - lat1);
    const dLon = this.deg2rad(lon2 - lon1);
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c; // Distance in km
  }

  private deg2rad(deg: number): number {
    return deg * (Math.PI/180);
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
      latitude?: number;
      longitude?: number;
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

    // ✅ Update user's location and preferences
    let needsUpdate = false;
    
    if (preferences.latitude !== undefined && preferences.longitude !== undefined) {
      user.currentLatitude = preferences.latitude;
      user.currentLongitude = preferences.longitude;
      console.log(`📍 Updated user ${userId} location: ${preferences.latitude}, ${preferences.longitude}`);
      needsUpdate = true;
    }

    if (preferences.budget !== undefined) {
      user.budget = preferences.budget;
      needsUpdate = true;
    }
    
    if (preferences.radiusKm !== undefined) {
      user.radiusKm = preferences.radiusKm;
      needsUpdate = true;
    }
    
    if (preferences.cuisine !== undefined) {
      user.preference = preferences.cuisine;
      needsUpdate = true;
    }

    if (needsUpdate) {
      await user.save();
    }

    // ✅ Prepare matching criteria with location
    const matchingPreferences = {
      cuisines: preferences.cuisine ?? user.preference,
      budget: preferences.budget ?? user.budget ?? 50,
      radiusKm: preferences.radiusKm ?? user.radiusKm ?? 5,
      latitude: user.currentLatitude,
      longitude: user.currentLongitude,
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
        cuisines: matchingPreferences.cuisines,
        averageBudget: matchingPreferences.budget,
        averageRadius: matchingPreferences.radiusKm,
        averageLatitude: matchingPreferences.latitude,
        averageLongitude: matchingPreferences.longitude,
      })) as unknown as IRoomDocument;

      console.log(`✅ Created new room: ${room._id.toString()} (cuisines: ${room.cuisines})`);
      console.log(`   📍 Room location: ${room.averageLatitude}, ${room.averageLongitude}`);
      console.log(`   🕐 Room expires in: ${(room.completionTime.getTime() - Date.now()) / 1000}s`);
    } else {
      // Add user to existing room
      room.members.push(userId);
      await this.updateRoomCuisinePreferences(room);
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
   * Update room averages (budget, radius, and location)
   */
  private async updateRoomAverages(room: IRoomDocument): Promise<void> {
    const users = await User.find({ _id: { $in: room.members } });

    const totalBudget = users.reduce((sum, user) => sum + (user.budget || 0), 0);
    const totalRadius = users.reduce((sum, user) => sum + (user.radiusKm || 5), 0);
    
    // ✅ NEW: Calculate average location
    const usersWithLocation = users.filter(u => u.currentLatitude && u.currentLongitude);
    if (usersWithLocation.length > 0) {
      const totalLat = usersWithLocation.reduce((sum, user) => sum + user.currentLatitude!, 0);
      const totalLng = usersWithLocation.reduce((sum, user) => sum + user.currentLongitude!, 0);
      room.averageLatitude = totalLat / usersWithLocation.length;
      room.averageLongitude = totalLng / usersWithLocation.length;
      console.log(`📍 Updated room ${room._id} average location: ${room.averageLatitude}, ${room.averageLongitude}`);
    }

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

  private async updateRoomCuisinePreferences(room: IRoomDocument): Promise<void> {
    const users = await User.find({ _id: { $in: room.members } });
    
    // Find cuisines that ALL users have in common
    let commonCuisines = users[0]?.preference || [];
    
    users.slice(1).forEach(user => {
      if (user.preference) {
        commonCuisines = commonCuisines.filter(cuisine => 
          user.preference.includes(cuisine)
        );
      }
    });

    // ✅ NEW: Handle empty common cuisines
    if (commonCuisines.length === 0) {
      // Fall back to most popular cuisines or all user preferences combined
      const allPreferences = users.flatMap(user => user.preference || []);
      const uniquePreferences = [...new Set(allPreferences)];
      
      if (uniquePreferences.length > 0) {
        // Use all unique preferences (broader search)
        commonCuisines = uniquePreferences;
        console.log(`🍽️ No common cuisines found. Using all user preferences: [${commonCuisines.join(', ')}]`);
      } else {
        // Ultimate fallback to popular cuisines
        commonCuisines = ['Italian', 'Chinese', 'American', 'Japanese'];
        console.log(`🍽️ No user preferences found. Using default popular cuisines: [${commonCuisines.join(', ')}]`);
      }
    }
    
    room.cuisines = commonCuisines;
    
    console.log(`🍽️ Updated room ${room._id} cuisines to: [${commonCuisines.join(', ')}]`);
    console.log(`   Users have these in common from: ${users.map(u => u.preference?.join(',')).join(' & ')}`);
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
      cuisines: room.cuisines, // ← Copy cuisines array
      averageBudget: room.averageBudget,
      averageRadius: room.averageRadius,
    });

    console.log(`✅ Created group: ${group._id.toString()} from room: ${roomId}`);
    console.log(`   🍽️ Group cuisines: [${group.cuisines.join(', ')}]`);
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