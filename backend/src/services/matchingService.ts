import Room, { RoomStatus, IRoomDocument } from '../models/Room';
import User, { UserStatus } from '../models/User';
import Group from '../models/Group';
import socketManager from '../utils/socketManager';
import { notifyRoomMatched, notifyRoomExpired } from './notificationService';
import groupService from './groupService';

export class MatchingService {
  private readonly ROOM_DURATION_MS = 0.25 * 60 * 1000; // 15 seconds
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
    return null;
  }

  if (userPreferences.latitude && userPreferences.longitude) {
    availableRooms = availableRooms.filter(room => {
      if (!room.averageLatitude || !room.averageLongitude) {
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
        return false;
      }
      
      return true;
    });

    if (availableRooms.length === 0) {
      return null;
    }
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
      
      const locationScore = Math.max(0, 50 - (distance * 5));
      score += locationScore;
    }
    
    if (room.cuisines && room.cuisines.length > 0) {
      const commonCuisines = room.cuisines.filter(cuisine => 
        userPreferences.cuisines.includes(cuisine)
      );
      const cuisineScore = commonCuisines.length * 20;
      score += cuisineScore;
    }
    
    const budgetDiff = Math.abs((room.averageBudget || 0) - userPreferences.budget);
    const budgetScore = Math.max(0, 30 - budgetDiff);
    score += budgetScore;
    
    const radiusDiff = Math.abs((room.averageRadius || 5) - userPreferences.radiusKm);
    const radiusScore = Math.max(0, 20 - (radiusDiff * 2));
    score += radiusScore;
    
    return { room, score };
  });

  scoredRooms.sort((a, b) => b.score - a.score);
  
  const bestMatch = scoredRooms[0];
  
  if (bestMatch.score >= this.MINIMUM_MATCH_SCORE) {
    return bestMatch.room;
  }
  
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

  ): Promise<{ roomId: string; room: IRoomDocument; serverTime: number }> {

    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    let needsSave = false;

    if (user.roomId) {
      const existingRoom = await Room.findById(user.roomId);
      if (!existingRoom || existingRoom.status !== RoomStatus.WAITING) {
        user.roomId = undefined;
        needsSave = true;
      } else if (existingRoom.members.includes(userId)) {
        throw new Error('User is already in an active room. Please leave the room first.');
      } else {
        user.roomId = undefined;
        needsSave = true;
      }
    }

    if (user.groupId) {
      const existingGroup = await Group.findById(user.groupId);
      
      if (!existingGroup) {
        user.groupId = undefined;
        needsSave = true;
      } else if (!existingGroup.members.includes(userId)) {
        user.groupId = undefined;
        needsSave = true;
      } else if (existingGroup.restaurantSelected) {
      } else if (new Date() > existingGroup.completionTime) {
      } else {
        throw new Error('You are already in an active group. Please complete or leave your current group before joining matching.');
      }
    }

    if (needsSave) {
      user.status = UserStatus.ONLINE;
      await user.save();
    }

    let needsUpdate = false;
    
    if (preferences.latitude !== undefined && preferences.longitude !== undefined) {
      user.currentLatitude = preferences.latitude;
      user.currentLongitude = preferences.longitude;
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

    const matchingPreferences = {
      cuisines: preferences.cuisine ?? user.preference,
      budget: preferences.budget ?? user.budget ?? 50,
      radiusKm: preferences.radiusKm ?? user.radiusKm ?? 5,
      latitude: user.currentLatitude,
      longitude: user.currentLongitude,
    };

    let room = await this.findBestMatchingRoom(matchingPreferences);

    if (!room) {
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
    } else {
      room.members.push(userId);
      await this.updateRoomCuisinePreferences(room);
      await this.updateRoomAverages(room);
      
      await room.save();
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
      serverTime: Date.now(),
    };
  }

  /**
   * Update room averages (budget, radius, and location)
   */
  private async updateRoomAverages(room: IRoomDocument): Promise<void> {
    const users = await User.find({ _id: { $in: room.members } });

    const totalBudget = users.reduce((sum, user) => sum + (user.budget || 0), 0);
    const totalRadius = users.reduce((sum, user) => sum + (user.radiusKm || 5), 0);
    
    const usersWithLocation = users.filter(u => u.currentLatitude && u.currentLongitude);
    if (usersWithLocation.length > 0) {
      const totalLat = usersWithLocation.reduce((sum, user) => sum + user.currentLatitude!, 0);
      const totalLng = usersWithLocation.reduce((sum, user) => sum + user.currentLongitude!, 0);
      room.averageLatitude = totalLat / usersWithLocation.length;
      room.averageLongitude = totalLng / usersWithLocation.length;
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
    
    if (!room) {
      if (user.roomId) {
        user.roomId = undefined;
        user.status = UserStatus.ONLINE;
        await user.save();
      }
      
      return;
    }

    room.members = room.members.filter(id => id !== userId);
    
    user.status = UserStatus.ONLINE;
    user.roomId = undefined;
    await user.save();

    if (room.members.length === 0) {
      await Room.findByIdAndDelete(roomId);
      return;
    }

    await this.updateRoomAverages(room);
    await room.save();

    try {
      socketManager.emitMemberLeft(
        roomId,
        userId,
        user.name,
        room.members.length
      );
    } catch (error) {
    }

    try {
      socketManager.emitRoomUpdate(
        roomId,
        room.members,
        room.completionTime,
        room.status
      );
    } catch (error) {
    }
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

    if (commonCuisines.length === 0) {
      const allPreferences = users.flatMap(user => user.preference || []);
      const uniquePreferences = [...new Set(allPreferences)];
      
      if (uniquePreferences.length > 0) {
        commonCuisines = uniquePreferences;
      } else {
        commonCuisines = ['Italian', 'Chinese', 'American', 'Japanese'];
      }
    }
    
    room.cuisines = commonCuisines;
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

    const completionTime = new Date(Date.now() + this.VOTING_TIME);
    
    const group = await Group.create({
      roomId: room._id.toString(),
      completionTime,
      maxMembers: room.members.length,
      members: room.members,
      restaurantSelected: false,
      cuisines: room.cuisines,
      averageBudget: room.averageBudget,
      averageRadius: room.averageRadius,
    });

    await groupService.initializeSequentialVoting(group._id.toString());

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

    for (const memberId of room.members) {
      try {
        await notifyRoomMatched(memberId, roomId, group._id.toString());
      } catch (error) {
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
    const now = new Date();
    
    const expiredRooms = await Room.find({
      status: RoomStatus.WAITING,
      completionTime: { $lt: now },
    }) as unknown as IRoomDocument[];

    for (const room of expiredRooms) {
      if (room.members.length >= this.MIN_MEMBERS) {
        await this.createGroupFromRoom(room._id.toString());
      } else {
        room.status = RoomStatus.EXPIRED;
        await room.save();

        await User.updateMany(
          { _id: { $in: room.members } },
          {
            status: UserStatus.ONLINE,
            roomId: undefined,
          }
        );

        socketManager.emitRoomExpired(room._id.toString(), 'Not enough members');

        for (const memberId of room.members) {
          try {
            await notifyRoomExpired(memberId, room._id.toString());
          } catch (error) {
          }
        }
      }
    }
  }

  /**
 * Check if a room should be finalized (create group or expire)
 * Called by clients when their timer expires for instant response
 */
async checkRoomCompletion(roomId: string): Promise<{
  status: 'waiting' | 'group_created' | 'expired' | 'not_found';
  groupId?: string;
  serverTime: number;
}> {
  
  
  const room = await Room.findById(roomId) as unknown as IRoomDocument | null;
  const serverTime = Date.now();
  
  if (!room) {
  
    return { status: 'not_found', serverTime };
  }

  // Already matched - find and return the group
  if (room.status === RoomStatus.MATCHED) {
    const group = await Group.findOne({ roomId: room._id.toString() });
  
    return { 
      status: 'group_created', 
      groupId: group?._id.toString(),
      serverTime 
    };
  }

  // Already expired
  if (room.status === RoomStatus.EXPIRED) {
    console.log(`⏰ Room ${roomId} already expired`);
    return { status: 'expired', serverTime };
  }


  const now = new Date();
  const timeUntilCompletion = room.completionTime.getTime() - now.getTime();
  
  console.log(`⏱️ Room ${roomId} completion check:`);
  console.log(`   - Completion time: ${room.completionTime.toISOString()}`);
  console.log(`   - Current time: ${now.toISOString()}`);
  console.log(`   - Time until completion: ${timeUntilCompletion}ms`);
  console.log(`   - Members: ${room.members.length}/${this.MIN_MEMBERS} required`);

  if (timeUntilCompletion > 0) {
 
    console.log(`⏳ Room ${roomId} still waiting (${timeUntilCompletion}ms remaining)`);
    return { status: 'waiting', serverTime };
  }

  // Room time has passed - decide whether to create group or expire
  if (room.members.length >= this.MIN_MEMBERS) {

    

    await this.createGroupFromRoom(room._id.toString());
    
    // Find the newly created group
    const group = await Group.findOne({ roomId: room._id.toString() });
    
    if (group) {
      console.log(`🎉 Group ${group._id} created successfully`);
      return { 
        status: 'group_created', 
        groupId: group._id.toString(),
        serverTime 
      };
    } else {
     
      return { status: 'expired', serverTime };
    }
  } else {
   
    room.status = RoomStatus.EXPIRED;
    await room.save();

  
    await User.updateMany(
      { _id: { $in: room.members } },
      { 
        status: UserStatus.ONLINE, 
        roomId: undefined 
      }
    );

 
    socketManager.emitRoomExpired(room._id.toString(), 'Not enough members joined');


    for (const memberId of room.members) {
      try {
        await notifyRoomExpired(memberId, room._id.toString());
      } catch (error) {
        console.error(`Failed to notify user ${memberId}:`, error);
      }
    }

    return { status: 'expired', serverTime };
  }
}
}

export default new MatchingService();