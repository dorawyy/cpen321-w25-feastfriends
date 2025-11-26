import { sendPushNotification, sendMulticastNotification, initializeFirebase } from '../config/firebase';
import User from '../models/User';
import { NotificationPayload } from '../types';
import { removeInvalidToken } from '../utils/tokenManager';

// Initialize Firebase on module load
initializeFirebase();

/**
 * Helper function to ensure all data values are strings (FCM requirement)
 * Removes undefined values
 */
const sanitizeData = (data?: Record<string, string>): Record<string, string> | undefined => {
  if (!data) return undefined;
  
  const sanitized: Record<string, string> = {};
  Object.entries(data).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      sanitized[key] = String(value);
    }
  });
  
  return Object.keys(sanitized).length > 0 ? sanitized : undefined;
};

/**
 * Send notification to a single user
 */
export const sendNotificationToUser = async (
  userId: string,
  notification: NotificationPayload
): Promise<void> => {
  try {
    const user = await User.findById(userId);
    
    if (!user) {
      throw new Error(`User not found: ${userId}`);
    }

    if (!user.fcmToken) {
      console.warn(`User ${userId} has no FCM token registered`);
      return;
    }

    try {
      await sendPushNotification(user.fcmToken, notification, sanitizeData(notification.data));
      console.log(`✅ Notification sent to user ${userId}`);
    } catch (error: any) {
      // Handle invalid token errors from Firebase
      const errorCode = error?.code || error?.errorInfo?.code;
      if (errorCode === 'messaging/invalid-registration-token' ||
          errorCode === 'messaging/registration-token-not-registered') {
        console.log(`Removing invalid token for user ${userId}`);
        await removeInvalidToken(user.fcmToken);
      }
      throw error;
    }
  } catch (error) {
    console.error(`Failed to send notification to user ${userId}:`, error);
    throw error;
  }
};

/**
 * Send notification to multiple users
 */
export const sendNotificationToUsers = async (
  userIds: string[],
  notification: NotificationPayload
): Promise<void> => {
  try {
    const users = await User.find({ _id: { $in: userIds } });
    
    const tokens = users
      .map(user => user.fcmToken)
      .filter((token): token is string => token != null);

    if (tokens.length === 0) {
      console.warn('No valid FCM tokens found for the provided users');
      return;
    }

    await sendMulticastNotification(tokens, notification, sanitizeData(notification.data));
    console.log(`✅ Notification sent to ${tokens.length} users`);
  } catch (error) {
    console.error('Failed to send notifications to users:', error);
    throw error;
  }
};

/**
 * Send notification to all members of a room
 */
export const notifyRoomMembers = async (
  memberIds: string[],
  notification: NotificationPayload
): Promise<void> => {
  await sendNotificationToUsers(memberIds, notification);
};

/**
 * Send notification to all members of a group
 */
export const notifyGroupMembers = async (
  memberIds: string[],
  notification: NotificationPayload
): Promise<void> => {
  await sendNotificationToUsers(memberIds, notification);
};

/**
 * Notify user when room is ready (matched)
 */
export const notifyRoomMatched = async (
  userId: string,
  roomId: string,
  groupId: string
): Promise<void> => {
  const notification: NotificationPayload = {
    title: 'Group Matched! 🎉',
    body: 'Your waiting room is full! Time to vote for a restaurant.',
    data: {
      type: 'room_matched',
      roomId: roomId,
      groupId: groupId,
    },
  };

  await sendNotificationToUser(userId, notification);
};

/**
 * Notify user when room expires
 */
export const notifyRoomExpired = async (
  userId: string,
  roomId: string
): Promise<void> => {
  const notification: NotificationPayload = {
    title: 'Room Expired ⏰',
    body: 'Your waiting room expired. Try matching again!',
    data: {
      type: 'room_expired',
      roomId: roomId,
    },
  };

  await sendNotificationToUser(userId, notification);
};

/**
 * Notify group when restaurant is selected
 */
export const notifyRestaurantSelected = async (
  memberIds: string[],
  restaurantName: string,
  groupId: string
): Promise<void> => {
  const notification: NotificationPayload = {
    title: 'Restaurant Selected! 🍽️',
    body: `Your group chose ${restaurantName}. See you there!`,
    data: {
      type: 'restaurant_selected',
      groupId: groupId,
      restaurantName: restaurantName,
    },
  };

  await sendNotificationToUsers(memberIds, notification);
};

/**
 * Notify user when someone joins their room
 */
export const notifyUserJoinedRoom = async (
  userId: string,
  joinerName: string,
  roomId: string
): Promise<void> => {
  const notification: NotificationPayload = {
    title: 'Someone Joined! 👋',
    body: `${joinerName} joined your waiting room`,
    data: {
      type: 'user_joined',
      roomId: roomId,
    },
  };

  await sendNotificationToUser(userId, notification);
};

/**
 * Notify when group expires
 */
export const notifyGroupExpired = async (
  userId: string,
  groupId: string
): Promise<void> => {
  const notification: NotificationPayload = {
    title: 'Group Expired ⏰',
    body: 'Your group expired without selecting a restaurant.',
    data: {
      type: 'group_expired',
      groupId: groupId,
    },
  };

  await sendNotificationToUser(userId, notification);
};

/**
 * Notify when voting time expires and restaurant is auto-selected
 */
export const notifyVotingTimeExpired = async (
  memberIds: string[],
  restaurantName: string,
  groupId: string
): Promise<void> => {
  const notification: NotificationPayload = {
    title: 'Voting Time Expired ⏰',
    body: `${restaurantName} was selected based on the votes received.`,
    data: {
      type: 'restaurant_selected',
      groupId: groupId,
      restaurantName: restaurantName,
    },
  };

  await sendNotificationToUsers(memberIds, notification);
};

export default {
  sendNotificationToUser,
  sendNotificationToUsers,
  notifyRoomMembers,
  notifyGroupMembers,
  notifyRoomMatched,
  notifyRoomExpired,
  notifyRestaurantSelected,
  notifyUserJoinedRoom,
  notifyGroupExpired,
  notifyVotingTimeExpired,
};