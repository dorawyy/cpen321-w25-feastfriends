import admin from 'firebase-admin';

let firebaseApp: admin.app.App | null = null;

export const initializeFirebase = (): admin.app.App => {
  try {
    if (firebaseApp) {
      return firebaseApp;
    }

    const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;

    let credential: admin.credential.Credential;

    // Priority 1: Use individual environment variables (PRODUCTION)
    if (projectId && clientEmail && privateKey) {
      console.log('🔐 Initializing Firebase with environment variables');
      credential = admin.credential.cert({
        projectId: projectId,
        clientEmail: clientEmail,
        privateKey: privateKey.replace(/\\n/g, '\n'),
      });
    }
    // Priority 2: Use service account file path (DEVELOPMENT)
    else if (serviceAccountPath) {
      console.log('📄 Initializing Firebase with service account file');
      credential = admin.credential.cert(serviceAccountPath);
    }
    // Fallback: Error
    else {
      throw new Error(
        'Firebase configuration missing. Set either:\n' +
        '1. FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY (recommended for production)\n' +
        '2. FIREBASE_SERVICE_ACCOUNT_PATH (for local development)'
      );
    }

    firebaseApp = admin.initializeApp({
      credential: credential,
      databaseURL: process.env.FIREBASE_DATABASE_URL,
    });

    console.log('✅ Firebase Admin SDK initialized successfully');
    return firebaseApp;
  } catch (error) {
    console.error('❌ Failed to initialize Firebase:', error);
    throw error;
  }
};

export const getMessaging = (): admin.messaging.Messaging => {
  if (!firebaseApp) {
    throw new Error('Firebase not initialized. Call initializeFirebase() first');
  }
  return admin.messaging();
};

export const getFirestore = (): admin.firestore.Firestore => {
  if (!firebaseApp) {
    throw new Error('Firebase not initialized. Call initializeFirebase() first');
  }
  return admin.firestore();
};

export const sendPushNotification = async (
  token: string,
  notification: { title: string; body: string },
  data?: { [key: string]: string }
): Promise<string> => {
  try {
    const messaging = getMessaging();

    const message: admin.messaging.Message = {
      token,
      notification,
      data,
      android: {
        priority: 'high',
        notification: { sound: 'default', priority: 'high' },
      },
      apns: { payload: { aps: { sound: 'default', badge: 1 } } },
    };

    const response = await messaging.send(message);
    console.log('✅ Push notification sent successfully:', response);
    return response;
  } catch (error) {
    console.error('❌ Error sending push notification:', error);
    throw error;
  }
};

export const sendMulticastNotification = async (
  tokens: string[],
  notification: { title: string; body: string },
  data?: { [key: string]: string }
): Promise<admin.messaging.BatchResponse> => {
  try {
    const messaging = getMessaging();

    const message: admin.messaging.MulticastMessage = {
      tokens,
      notification,
      data,
      android: { priority: 'high', notification: { sound: 'default', priority: 'high' } },
      apns: { payload: { aps: { sound: 'default', badge: 1 } } },
    };

    const response = await messaging.sendEachForMulticast(message);

    console.log(
      `✅ Multicast notification sent: ${response.successCount} succeeded, ${response.failureCount} failed`
    );

    // Log any failures safely
    if (response.failureCount > 0) {
      for (let i = 0; i < response.responses.length; i++) {
        const resp = response.responses[i];
        if (!resp.success) {
          if (i >= 0 && i < tokens.length) {
            const rawToken = tokens[i];
            if (typeof rawToken === 'string' && rawToken.length > 0) {
              const tokenSafe = String(rawToken);
              const errorMessage = resp.error?.message || String(resp.error);
              console.error(`Failed to send to token ${tokenSafe.substring(0, 20)}...:`, errorMessage);
            }
          }
        }
      }
    }

    return response;
  } catch (error) {
    console.error('❌ Error sending multicast notification:', error);
    throw error;
  }
};

export const sendTopicNotification = async (
  topic: string,
  notification: { title: string; body: string },
  data?: { [key: string]: string }
): Promise<string> => {
  try {
    const messaging = getMessaging();

    const message: admin.messaging.Message = {
      topic,
      notification,
      data,
      android: { priority: 'high' },
      apns: { payload: { aps: { sound: 'default' } } },
    };

    const response = await messaging.send(message);
    console.log(`✅ Topic notification sent to ${topic}:`, response);
    return response;
  } catch (error) {
    console.error('❌ Error sending topic notification:', error);
    throw error;
  }
};

export const subscribeToTopic = async (
  tokens: string[],
  topic: string
): Promise<admin.messaging.MessagingTopicManagementResponse> => {
  try {
    const messaging = getMessaging();
    const response = await messaging.subscribeToTopic(tokens, topic);
    console.log(`✅ ${response.successCount} tokens subscribed to topic ${topic}`);

    if (response.failureCount > 0) {
      console.error(`Failed subscriptions: ${response.failureCount}`);
    }

    return response;
  } catch (error) {
    console.error('❌ Error subscribing to topic:', error);
    throw error;
  }
};

export const unsubscribeFromTopic = async (
  tokens: string[],
  topic: string
): Promise<admin.messaging.MessagingTopicManagementResponse> => {
  try {
    const messaging = getMessaging();
    const response = await messaging.unsubscribeFromTopic(tokens, topic);
    console.log(`✅ ${response.successCount} tokens unsubscribed from topic ${topic}`);
    return response;
  } catch (error) {
    console.error('❌ Error unsubscribing from topic:', error);
    throw error;
  }
};

export default {
  initializeFirebase,
  getMessaging,
  getFirestore,
  sendPushNotification,
  sendMulticastNotification,
  sendTopicNotification,
  subscribeToTopic,
  unsubscribeFromTopic,
};