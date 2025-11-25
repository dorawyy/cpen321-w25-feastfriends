import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
import initializeSocket, { SocketEmitter } from '../config/socket';
import { RestaurantType } from '../types';

/**
 * Global Socket Manager
 * Singleton pattern for managing socket connections across the app
 */

class SocketManager {
  private static instance: SocketManager | undefined;
  private io: SocketIOServer | null = null;
  private emitter: SocketEmitter | null = null;

  private constructor() {}

  public static getInstance(): SocketManager {
    if (!SocketManager.instance) {
      SocketManager.instance = new SocketManager();
    }
    return SocketManager.instance;
  }

  /**
   * Initialize Socket.IO with HTTP server
   */
  public initialize(server: HTTPServer): void {
    if (this.io) {
      console.warn('⚠️  Socket.IO already initialized');
      return;
    }

    this.io = initializeSocket(server);
    this.emitter = new SocketEmitter(this.io);
    console.log('✅ SocketManager initialized');
  }

  /**
   * Get the Socket.IO instance
   */
  public getIO(): SocketIOServer {
    if (!this.io) {
      throw new Error('Socket.IO not initialized. Call initialize() first.');
    }
    return this.io;
  }

  /**
   * Get the SocketEmitter for emitting events
   */
  public getEmitter(): SocketEmitter {
    if (!this.emitter) {
      throw new Error('SocketEmitter not initialized. Call initialize() first.');
    }
    return this.emitter;
  }

  // ==================== CONVENIENCE METHODS ====================

  /**
   * Emit room update to all members in a room
   */
  public emitRoomUpdate(
    roomId: string,
    members: string[],
    expiresAt: Date,
    status: 'waiting' | 'matched' | 'expired'
  ): void {
    this.getEmitter().emitRoomUpdate(roomId, {
      roomId,
      members,
      expiresAt: expiresAt.toISOString(),
      status,
    });
  }

  /**
   * Notify that a group is ready
   */
  public emitGroupReady(roomId: string, groupId: string, members: string[]): void {
    this.getEmitter().emitGroupReady(roomId, groupId, members);
  }

  /**
   * Notify that a room has expired
   */
  public emitRoomExpired(roomId: string, reason?: string): void {
    this.getEmitter().emitRoomExpired(roomId, reason);
  }

  /**
   * Emit vote update to group (LEGACY - for list-based voting)
   */
  public emitVoteUpdate(
    groupId: string,
    restaurantId: string,
    votes: Record<string, number>,
    membersVoted: number,
    totalMembers: number
  ): void {
    const totalVotes = Object.values(votes).reduce((sum, count) => sum + count, 0);
    
    this.getEmitter().emitVoteUpdate(groupId, {
      restaurantId,
      votes,
      totalVotes,
      membersVoted,
      totalMembers,
    });
  }

  /**
   * Emit restaurant selected to group
   */
  public emitRestaurantSelected(
    groupId: string,
    restaurantId: string,
    restaurantName: string,
    votes: Record<string, number>
  ): void {
    this.getEmitter().emitRestaurantSelected(groupId, {
      restaurantId,
      restaurantName,
      votes,
    });
  }

  /**
   * Emit member joined to room
   */
  public emitMemberJoined(
    roomId: string,
    userId: string,
    userName: string,
    currentMembers: number,
    maxMembers: number
  ): void {
    this.getEmitter().emitMemberJoined(roomId, {
      userId,
      userName,
      currentMembers,
      maxMembers,
    });
  }

  /**
   * Emit member left to room
   */
  public emitMemberLeft(
    roomId: string,
    userId: string,
    userName: string,
    remainingMembers: number
  ): void {
    this.getEmitter().emitMemberLeft(roomId, {
      userId,
      userName,
      remainingMembers,
    });
  }

  /**
   * Emit an event directly to a specific user (by userId)
   */
  public emitToUser(userId: string, event: string, payload: unknown): void {
    const io = this.getIO();

    // You must make sure your socket connection stores userId on handshake
    for (const [_, socket] of io.sockets.sockets) {
      // Access the userId from socket.data where it's actually stored
      if (socket.data?.userId === userId) {
        socket.emit(event, payload);
        console.log(`✅ Emitted ${event} to user ${userId}`);
        return;
      }
    }

    console.warn(`⚠️ emitToUser: No socket found for user ${userId}`);
  }

  // ==================== NEW: SEQUENTIAL VOTING METHODS ====================

  /**
   * Emit new voting round started
   */
  public emitNewVotingRound(
    groupId: string,
    restaurant: RestaurantType,
    roundNumber: number,
    totalRounds: number,
    timeoutSeconds: number
  ): void {
    const io = this.getIO();
    io.to(`group_${groupId}`).emit('voting:new_round', {
      restaurant,
      roundNumber,
      totalRounds,
      timeoutSeconds,
      expiresAt: new Date(Date.now() + timeoutSeconds * 1000).toISOString(),
    });
    console.log(`🎯 Emitted new voting round for group ${groupId}: ${restaurant.name}`);
  }

  /**
   * Emit sequential vote update
   */
  public emitSequentialVoteUpdate(
    groupId: string,
    userId: string,
    vote: boolean,
    yesVotes: number,
    noVotes: number,
    totalMembers: number
  ): void {
    const io = this.getIO();
    io.to(`group_${groupId}`).emit('voting:vote_update', {
      userId,
      vote,
      yesVotes,
      noVotes,
      totalMembers,
      votesRemaining: totalMembers - (yesVotes + noVotes),
    });
    console.log(`✅ Vote update for group ${groupId}: ${yesVotes}/${noVotes} (${vote ? 'yes' : 'no'})`);
  }

  /**
   * Emit majority reached (restaurant accepted or rejected)
   */
  public emitMajorityReached(
    groupId: string,
    result: 'yes' | 'no',
    restaurantId: string
  ): void {
    const io = this.getIO();
    io.to(`group_${groupId}`).emit('voting:majority_reached', {
      result,
      restaurantId,
    });
    console.log(`🎉 Majority reached for group ${groupId}: ${result}`);
  }

  /**
   * Emit voting round timeout
   */
  public emitVotingRoundTimeout(
    groupId: string,
    restaurantId: string
  ): void {
    const io = this.getIO();
    io.to(`group_${groupId}`).emit('voting:round_timeout', {
      restaurantId,
    });
    console.log(`⏰ Voting round timeout for group ${groupId}`);
  }
}

// Export singleton instance
export const socketManager = SocketManager.getInstance();
export default socketManager;