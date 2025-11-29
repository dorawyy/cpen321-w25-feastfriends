package com.example.cpen_321

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.util.Log
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import androidx.navigation.compose.rememberNavController
import com.example.cpen_321.data.local.TokenManager
import com.example.cpen_321.data.network.RetrofitClient
import com.example.cpen_321.data.network.dto.RegisterFcmTokenRequest
import com.example.cpen_321.ui.navigation.AppNavGraph
import com.example.cpen_321.ui.theme.ProvideFontSizes
import com.example.cpen_321.ui.theme.ProvideSpacing
import com.example.cpen_321.ui.theme.Cpen321Theme
import com.google.firebase.messaging.FirebaseMessaging
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.launch
import com.google.android.gms.common.GoogleApiAvailability
import com.google.android.gms.common.ConnectionResult
@AndroidEntryPoint
class MainActivity : ComponentActivity() {

    companion object {
        private const val TAG = "MainActivity"
    }

    // Permission launcher for Android 13+
    private val requestPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { isGranted ->
        if (isGranted) {
            Log.d(TAG, "✅ Notification permission granted")
            setupFcmToken()
        } else {
            Log.w(TAG, "⚠️ Notification permission denied")
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        // Request notification permission and setup FCM
        requestNotificationPermissionAndSetupFcm()

        // Handle notification intent if app was opened from notification
        handleNotificationIntent(intent)


        // In onCreate(), add:
        val googleApiAvailability = GoogleApiAvailability.getInstance()
        val resultCode = googleApiAvailability.isGooglePlayServicesAvailable(this)
        if (resultCode != ConnectionResult.SUCCESS) {
            Log.e("MainActivity", "❌ Google Play Services not available: $resultCode")
            if (googleApiAvailability.isUserResolvableError(resultCode)) {
                Log.e("MainActivity", "   This is a user-resolvable error")
            }
        } else {
            Log.d("MainActivity", "✅ Google Play Services available")
        }

        setContent {
            Cpen321Theme {
                Cpen321App()
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        handleNotificationIntent(intent)
    }

    /**
     * Request notification permission (Android 13+) and setup FCM
     */
    private fun requestNotificationPermissionAndSetupFcm() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            when {
                ContextCompat.checkSelfPermission(
                    this,
                    Manifest.permission.POST_NOTIFICATIONS
                ) == PackageManager.PERMISSION_GRANTED -> {
                    Log.d(TAG, "✅ Notification permission already granted")
                    setupFcmToken()
                }
                shouldShowRequestPermissionRationale(Manifest.permission.POST_NOTIFICATIONS) -> {
                    // Show explanation dialog if needed
                    Log.d(TAG, "ℹ️ Showing permission rationale")
                    // TODO: Show dialog explaining why we need permission
                    requestPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
                }
                else -> {
                    Log.d(TAG, "📱 Requesting notification permission")
                    requestPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
                }
            }
        } else {
            Log.d(TAG, "✅ Notification permission not required (Android < 13)")
            setupFcmToken()
        }
    }

    /**
     * Get FCM token and register with backend
     */
    private fun setupFcmToken() {
        FirebaseMessaging.getInstance().token.addOnCompleteListener { task ->
            if (!task.isSuccessful) {
                Log.w(TAG, "❌ Fetching FCM token failed", task.exception)
                return@addOnCompleteListener
            }

            val token = task.result
            Log.d(TAG, "✅ FCM Token: ${token?.take(20)}...")

            lifecycleScope.launch {
                try {
                    val tokenManager = TokenManager.getInstance(applicationContext)
                    val userId = tokenManager.getUserId()

                    if (userId != null && token != null) {
                        Log.d(TAG, "📤 Registering FCM token with backend...")

                        val response = RetrofitClient.userAPI.registerFcmToken(
                            RegisterFcmTokenRequest(userId = userId, token = token)
                        )

                        if (response.isSuccessful) {
                            Log.d(TAG, "✅ FCM token registered with backend")
                            tokenManager.saveFcmToken(token)
                        } else {
                            Log.e(TAG, "❌ Failed to register FCM token: ${response.code()}")
                        }
                    } else {
                        if (userId == null) {
                            Log.d(TAG, "ℹ️ User not logged in, will register token after login")
                        }
                        if (token != null) {
                            // Save token locally for later registration
                            tokenManager.saveFcmToken(token)
                        }
                    }
                } catch (e: Exception) {
                    Log.e(TAG, "❌ Error registering FCM token", e)
                }
            }
        }
    }

    /**
     * Handle notification intent when app is opened from notification
     */
    private fun handleNotificationIntent(intent: Intent?) {
        intent?.let {
            val navigateTo = it.getStringExtra("navigate_to")

            if (navigateTo != null) {
                Log.d(TAG, "📱 Handling notification navigation: $navigateTo")

                when (navigateTo) {
                    "voting" -> {
                        val roomId = it.getStringExtra("room_id")
                        val groupId = it.getStringExtra("group_id")
                        Log.d(TAG, "→ Navigate to voting: roomId=$roomId, groupId=$groupId")
                    }
                    "matching" -> {
                        Log.d(TAG, "→ Navigate to matching screen")
                    }
                    "group_details" -> {
                        val groupId = it.getStringExtra("group_id")
                        Log.d(TAG, "→ Navigate to group details: groupId=$groupId")
                    }
                    "waiting_room" -> {
                        val roomId = it.getStringExtra("room_id")
                        Log.d(TAG, "→ Navigate to waiting room: roomId=$roomId")
                    }
                }
            }
        }
    }
}

@Composable
fun Cpen321App() {
    ProvideSpacing {
        ProvideFontSizes {
            Surface(
                modifier = Modifier.fillMaxSize(),
                color = MaterialTheme.colorScheme.background
            ) {
                val navController = rememberNavController()
                AppNavGraph(navController = navController)
            }
        }
    }
}