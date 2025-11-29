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

    if (projectId && clientEmail && privateKey) {
      credential = admin.credential.cert({
        projectId: projectId,
        clientEmail: clientEmail,
        privateKey: privateKey.replace(/\\n/g, '\n'),
      });
    } else if (serviceAccountPath) {
      credential = admin.credential.cert(serviceAccountPath);
    } else {
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

    return firebaseApp;
  } catch (error) {
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
      notification: {
        title: notification.title,
        body: notification.body,
      },
      android: {
        priority: 'high',
        notification: { 
          sound: 'default',
          priority: 'high',
        },
      },
      apns: { 
        payload: { 
          aps: { 
            sound: 'default',
            badge: 1,
          } 
        } 
      },
    };

    if (data && Object.keys(data).length > 0) {
      message.data = data;
    }

    const response = await messaging.send(message);
    return response;
  } catch (error) {
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
      notification: {
        title: notification.title,
        body: notification.body,
      },
      android: { 
        priority: 'high',
        notification: { 
          sound: 'default',
          priority: 'high',
        } 
      },
      apns: { 
        payload: { 
          aps: { 
            sound: 'default',
            badge: 1,
          } 
        } 
      },
    };

    if (data && Object.keys(data).length > 0) {
      message.data = data;
    }

    const response = await messaging.sendEachForMulticast(message);

    return response;
  } catch (error) {
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
      notification: {
        title: notification.title,
        body: notification.body,
      },
      android: { priority: 'high' },
      apns: { payload: { aps: { sound: 'default' } } },
    };

    if (data && Object.keys(data).length > 0) {
      message.data = data;
    }

    const response = await messaging.send(message);
    return response;
  } catch (error) {
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
    return response;
  } catch (error) {
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
    return response;
  } catch (error) {
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
