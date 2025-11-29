package com.example.cpen_321.services

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationCompat
import com.example.cpen_321.MainActivity
import com.example.cpen_321.R
import com.example.cpen_321.data.local.TokenManager
import com.example.cpen_321.data.network.RetrofitClient
import com.example.cpen_321.data.network.dto.RegisterFcmTokenRequest
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.coroutines.cancel
/**
 * Firebase Cloud Messaging Service
 * Handles incoming push notifications and token refresh
 */
class MyFirebaseMessagingService : FirebaseMessagingService() {

    private val serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    companion object {
        private const val TAG = "FCMService"
        private const val CHANNEL_ID = "restaurant_notifications"
        private const val CHANNEL_NAME = "Restaurant Notifications"
    }

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
        Log.d(TAG, "FirebaseMessagingService created")
    }

    /**
     * Called when a new FCM token is generated
     * This happens on first app install and when token is refreshed
     */
    override fun onNewToken(token: String) {
        super.onNewToken(token)
        Log.d(TAG, "New FCM token generated: ${token.take(20)}...")

        // Send token to backend
        serviceScope.launch {
            try {
                val tokenManager = TokenManager.getInstance(applicationContext)
                val userId = tokenManager.getUserId()

                if (userId != null) {
                    // Save token locally
                    tokenManager.saveFcmToken(token)

                    // Send to backend
                    val response = RetrofitClient.userAPI.registerFcmToken(
                        RegisterFcmTokenRequest(userId = userId, token = token)
                    )

                    if (response.isSuccessful) {
                        Log.d(TAG, "✅ FCM token registered with backend")
                    } else {
                        Log.e(TAG, "❌ Failed to register FCM token: ${response.code()}")
                    }
                } else {
                    Log.w(TAG, "⚠️ User not logged in, saving token locally for later")
                    tokenManager.saveFcmToken(token)
                }
            } catch (e: Exception) {
                Log.e(TAG, "❌ Error registering FCM token", e)
            }
        }
    }

    /**
     * Called when a message is received
     */
    override fun onMessageReceived(message: RemoteMessage) {
        super.onMessageReceived(message)
        Log.d(TAG, "📩 Message received from: ${message.from}")

        // Handle notification payload
        message.notification?.let { notification ->
            val title = notification.title ?: "Notification"
            val body = notification.body ?: ""
            val data = message.data

            Log.d(TAG, "📩 Notification: $title - $body")
            Log.d(TAG, "📩 Data: $data")

            showNotification(title, body, data)
        }

        // Handle data-only messages (when app is in foreground)
        if (message.data.isNotEmpty() && message.notification == null) {
            Log.d(TAG, "📦 Data-only message: ${message.data}")
            handleDataPayload(message.data)
        }
    }

    /**
     * Create notification channel for Android 8.0+
     */
    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                CHANNEL_NAME,
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Notifications for restaurant matching and group updates"
                enableVibration(true)
                enableLights(true)
            }

            val notificationManager = getSystemService(NotificationManager::class.java)
            notificationManager?.createNotificationChannel(channel)
            Log.d(TAG, "✅ Notification channel created")
        }
    }

    /**
     * Show notification in system tray
     */
    private fun showNotification(
        title: String,
        body: String,
        data: Map<String, String>
    ) {
        val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        val intent = createIntentForNotification(data)
        val pendingIntent = PendingIntent.getActivity(
            this,
            System.currentTimeMillis().toInt(),
            intent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        val notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(title)
            .setContentText(body)
            .setSmallIcon(R.drawable.ic_notification) // You'll need to create this
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setDefaults(NotificationCompat.DEFAULT_ALL)
            .build()

        notificationManager.notify(System.currentTimeMillis().toInt(), notification)
        Log.d(TAG, "✅ Notification shown: $title")
    }

    /**
     * Create appropriate intent based on notification data
     */
    private fun createIntentForNotification(data: Map<String, String>): Intent {
        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }

        when (data["type"]) {
            "room_matched" -> {
                intent.putExtra("navigate_to", "voting")
                intent.putExtra("room_id", data["roomId"])
                intent.putExtra("group_id", data["groupId"])
            }
            "room_expired" -> {
                intent.putExtra("navigate_to", "matching")
                intent.putExtra("room_id", data["roomId"])
            }
            "restaurant_selected" -> {
                intent.putExtra("navigate_to", "group_details")
                intent.putExtra("group_id", data["groupId"])
                intent.putExtra("restaurant_name", data["restaurantName"])
            }
            "user_joined" -> {
                intent.putExtra("navigate_to", "waiting_room")
                intent.putExtra("room_id", data["roomId"])
            }
            "group_expired" -> {
                intent.putExtra("navigate_to", "matching")
                intent.putExtra("group_id", data["groupId"])
            }
        }

        Log.d(TAG, "📱 Created intent with type: ${data["type"]}")
        return intent
    }

    /**
     * Handle data-only messages when app is in foreground
     */
    private fun handleDataPayload(data: Map<String, String>) {
        Log.d(TAG, "📦 Handling data payload: $data")
    }

    override fun onDestroy() {
        super.onDestroy()
        serviceScope.coroutineContext.cancel()
        Log.d(TAG, "FirebaseMessagingService destroyed")
    }
}