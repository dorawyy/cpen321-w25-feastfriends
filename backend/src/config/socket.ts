import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
import jwt from 'jsonwebtoken';

const userSocketMap = new Map<string, string>();

export const initializeSocket = (server: HTTPServer): SocketIOServer => {
  const io = new SocketIOServer(server, {
    cors: {
      origin: process.env.CORS_ORIGIN || '*',
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error('Authentication error: No token provided'));
      }

      const secret = process.env.JWT_SECRET;
      if (!secret) {
        return next(new Error('Server configuration error'));
      }

      const decoded = jwt.verify(token, secret) as { userId: string };
      socket.data.userId = decoded.userId;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.data.userId;
    userSocketMap.set(userId, socket.id);

    socket.on('disconnect', () => {
      userSocketMap.delete(userId);
    });

    socket.on('join_room', async () => {
      try {
        socket.emit('join_room_ack', {
          success: true,
          message: 'Join room request received',
        });
      } catch {
        socket.emit('error', { message: 'Failed to join room' });
      }
    });

    socket.on('leave_room', async () => {
      try {
        socket.emit('leave_room_ack', {
          success: true,
          message: 'Leave room request received',
        });
      } catch {
        socket.emit('error', { message: 'Failed to leave room' });
      }
    });

    socket.on('subscribe_to_room', (roomId: string) => {
      socket.join(`room_${roomId}`);
    });

    socket.on('unsubscribe_from_room', (roomId: string) => {
      socket.leave(`room_${roomId}`);
    });

    socket.on('subscribe_to_group', (groupId: string) => {
      const groupChannel = `group_${groupId}`;
      socket.join(groupChannel);
    });

    socket.on('unsubscribe_from_group', (groupId: string) => {
      const groupChannel = `group_${groupId}`;
      socket.leave(groupChannel);
    });

    socket.on('disconnect', async () => {
      userSocketMap.delete(userId);

      try {
        const User = (await import('../models/User')).default;
        const matchingService = (await import('../services/matchingService')).default;

        const user = await User.findById(userId);
        if (!user) return;

        if (user.roomId) {
          try {
            await matchingService.leaveRoom(userId, user.roomId);
          } catch {
            user.roomId = undefined;
            user.status = 1;
            await user.save();
          }
        }
      } catch {}
    });

    socket.on('error', () => {});
  });

  return io;
};

export class SocketEmitter {
  constructor(private io: SocketIOServer) {}

  emitRoomUpdate(roomId: string, data: {
    roomId: string;
    members: string[];
    expiresAt: string;
    status: 'waiting' | 'matched' | 'expired';
  }) {
    this.io.to(`room_${roomId}`).emit('room_update', data);
  }

  emitGroupReady(roomId: string, groupId: string, members: string[]) {
    this.io.to(`room_${roomId}`).emit('group_ready', {
      groupId,
      members,
      ready: true,
    });
  }

  emitRoomExpired(roomId: string, reason: string = 'Not enough members') {
    this.io.to(`room_${roomId}`).emit('room_expired', {
      roomId,
      reason,
    });
  }

  emitVoteUpdate(groupId: string, data: {
    restaurantId: string;
    votes: Record<string, number>;
    totalVotes: number;
    membersVoted: number;
    totalMembers: number;
  }) {
    const groupChannel = `group_${groupId}`;
    this.io.to(groupChannel).emit('vote_update', data);
  }

  emitRestaurantSelected(groupId: string, data: {
    restaurantId: string;
    restaurantName: string;
    votes: Record<string, number>;
  }) {
    const groupChannel = `group_${groupId}`;
    this.io.to(groupChannel).emit('restaurant_selected', data);
  }

  emitMemberJoined(roomId: string, data: {
    userId: string;
    userName: string;
    currentMembers: number;
    maxMembers: number;
  }) {
    this.io.to(`room_${roomId}`).emit('member_joined', data);
  }

  emitMemberLeft(roomId: string, data: {
    userId: string;
    userName: string;
    remainingMembers: number;
  }) {
    this.io.to(`room_${roomId}`).emit('member_left', data);
  }

  emitToUser(userId: string, event: string, data: unknown, attempt = 1) {
    const socketId = userSocketMap.get(userId);
    if (!socketId) {
      if (attempt === 1) {
        setTimeout(() => { this.emitToUser(userId, event, data, 2); }, 500);
      }
      return;
    }

    this.io.to(socketId).emit(event, data);
  }
}

export default initializeSocket;
