import User from '../models/User';

/**
 * Remove invalid FCM token from user record
 */
export const removeInvalidToken = async (token: string): Promise<void> => {
  try {
    const result = await User.updateOne(
      { fcmToken: token },
      { $unset: { fcmToken: '' } }
    );
    
    if (result.modifiedCount > 0) {
      console.log(`Removed invalid token: ${token.substring(0, 20)}...`);
    }
  } catch (error) {
    console.error('Error removing invalid token:', error);
  }
};

/**
 * Update user's FCM token
 */
export const updateUserToken = async (
  userId: string,
  token: string
): Promise<void> => {
  try {
    await User.findByIdAndUpdate(userId, { fcmToken: token });
    console.log(`Updated FCM token for user ${userId}`);
  } catch (error) {
    console.error(`Error updating token for user ${userId}:`, error);
    throw error;
  }
};

/**
 * Clear user's FCM token (when they log out)
 */
export const clearUserToken = async (userId: string): Promise<void> => {
  try {
    await User.findByIdAndUpdate(userId, { $unset: { fcmToken: '' } });
    console.log(`Cleared FCM token for user ${userId}`);
  } catch (error) {
    console.error(`Error clearing token for user ${userId}:`, error);
    throw error;
  }
};

export default {
  removeInvalidToken,
  updateUserToken,
  clearUserToken,
};