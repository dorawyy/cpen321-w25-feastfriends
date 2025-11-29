package com.example.cpen_321.ui.viewmodels

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.cpen_321.data.local.TokenManager
import com.example.cpen_321.data.network.dto.ApiResult
import com.example.cpen_321.data.network.dto.AuthUser
import com.example.cpen_321.data.repository.AuthRepository
import com.example.cpen_321.data.repository.UserRepository
import com.example.cpen_321.utils.SocketManager
import dagger.hilt.android.lifecycle.HiltViewModel
import android.util.Log
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.delay
import java.io.IOException
import javax.inject.Inject

/**
 * ViewModel for authentication
 */
@HiltViewModel
class AuthViewModel @Inject constructor(
    private val authRepository: AuthRepository,
    private val userRepository: UserRepository,
    private val socketManager: SocketManager,
    private val tokenManager: TokenManager
) : ViewModel() {

    companion object {
        private const val TAG = "AuthViewModel"
    }

    // Authentication state
    private val _authState = MutableStateFlow<AuthState>(AuthState.Initial)
    val authState: StateFlow<AuthState> = _authState.asStateFlow()

    // Current user
    private val _currentUser = MutableStateFlow<AuthUser?>(null)
    val currentUser: StateFlow<AuthUser?> = _currentUser.asStateFlow()

    // Loading state
    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    // Error message
    private val _errorMessage = MutableStateFlow<String?>(null)
    val errorMessage: StateFlow<String?> = _errorMessage.asStateFlow()

    // Success message (for signup success, etc.)
    private val _successMessage = MutableStateFlow<String?>(null)
    val successMessage: StateFlow<String?> = _successMessage.asStateFlow()

    // Show alert for delete account while in group
    private val _showDeleteInGroupAlert = MutableStateFlow(false)
    val showDeleteInGroupAlert: StateFlow<Boolean> = _showDeleteInGroupAlert.asStateFlow()

    // Redirect to preferences on first sign-in after sign-up
    private val _shouldRedirectToPreferences = MutableStateFlow(false)
    val shouldRedirectToPreferences: StateFlow<Boolean> = _shouldRedirectToPreferences.asStateFlow()

    init {
        // Initialize state from stored data
        initializeAuthState()
    }

    private fun initializeAuthState() {
        if (authRepository.isLoggedIn()) {
            _authState.value = AuthState.Authenticated
        } else {
            _authState.value = AuthState.Unauthenticated
            _currentUser.value = null
        }
    }

    /**
     * Check if user is logged in (has token)
     * PUBLIC - Used by SplashScreen
     */
    fun isLoggedIn(): Boolean {
        return authRepository.isLoggedIn()
    }

    /**
     * Verify current token with backend
     * PUBLIC - Used by SplashScreen
     */
    suspend fun verifyToken(): ApiResult<AuthUser> {
        val result = authRepository.verifyToken()

        when (result) {
            is ApiResult.Success -> {
                _currentUser.value = result.data
                _authState.value = AuthState.Authenticated

                // Connect to socket with JWT token
                if (!socketManager.isConnected()) {
                    val token = tokenManager.getToken()
                    if (token != null) {
                        socketManager.connect(token)
                    }
                }

                // ✅ NEW: Register FCM token if available
                registerFcmTokenAfterLogin()
            }
            is ApiResult.Error -> {
                // Token is invalid
                _authState.value = AuthState.Unauthenticated
                _currentUser.value = null
            }
            is ApiResult.Loading -> {
                // Ignore
            }
        }

        return result
    }

    /**
     * Clear authentication data
     * PUBLIC - Used by SplashScreen
     */
    fun clearAuthData() {
        authRepository.clearAuthData()
        _currentUser.value = null
        _authState.value = AuthState.Unauthenticated
        _errorMessage.value = null
        socketManager.disconnect()
    }

    /**
     * Sign up with Google ID token (create new account)
     * Note: Does NOT automatically sign the user in - they must sign in separately
     */
    fun signUpWithGoogle(idToken: String) {
        viewModelScope.launch {
            _isLoading.value = true
            _errorMessage.value = null
            _successMessage.value = null

            when (val result = authRepository.signUp(idToken)) {
                is ApiResult.Success -> {
                    // Signup successful - show success message (not as error)
                    // User is NOT automatically signed in - they must sign in separately
                    _authState.value = AuthState.Unauthenticated
                    _successMessage.value = result.data.message
                }
                is ApiResult.Error -> {
                    _authState.value = AuthState.Error(result.message)
                    _errorMessage.value = "Sign up failed: ${result.message}"
                }
                is ApiResult.Loading -> {
                    // Already handled by _isLoading
                }
            }

            _isLoading.value = false
        }
    }

    /**
     * Sign in with Google ID token (existing account)
     */
    fun signInWithGoogle(idToken: String) {
        viewModelScope.launch {
            _isLoading.value = true
            _errorMessage.value = null
            _shouldRedirectToPreferences.value = false

            when (val result = authRepository.signIn(idToken)) {
                is ApiResult.Success -> {
                    _currentUser.value = result.data.user

                    // Connect to socket with token
                    socketManager.connect(result.data.token)

                    // Sync profile picture to backend if available
                    result.data.user.profilePicture?.let { profilePicture ->
                        syncProfilePictureToBackend(profilePicture)
                    }

                    // Check if user has preferences set (first-time user check)
                    checkIfFirstTimeUser()

                    // ✅ NEW: Register FCM token after successful login
                    registerFcmTokenAfterLogin()

                    // Small delay to ensure the check completes and flag is set
                    delay(100)

                    // Now set authenticated state (this will trigger navigation)
                    _authState.value = AuthState.Authenticated

                    _errorMessage.value = null
                }
                is ApiResult.Error -> {
                    _authState.value = AuthState.Error(result.message)
                    _errorMessage.value = "Sign in failed: ${result.message}"
                }
                is ApiResult.Loading -> {
                    // Already handled by _isLoading
                }
            }

            _isLoading.value = false
        }
    }

    /**
     * Check if user is a first-time user (no preferences set)
     * and set redirect flag if needed
     */
    private suspend fun checkIfFirstTimeUser() {
        when (val settingsResult = userRepository.getUserSettings()) {
            is ApiResult.Success -> {
                val settings = settingsResult.data
                // Check if user has no preferences set (empty preference list)
                val hasNoPreferences = settings.preference.isEmpty()

                if (hasNoPreferences) {
                    _shouldRedirectToPreferences.value = true
                }
            }
            is ApiResult.Error -> {
                // If we can't fetch settings, don't redirect (fail silently)
            }
            is ApiResult.Loading -> {
                // Ignore
            }
        }
    }

    /**
     * Clear the redirect to preferences flag
     */
    fun clearRedirectToPreferences() {
        _shouldRedirectToPreferences.value = false
    }

    /**
     * Authenticate with Google ID token (legacy - find or create)
     */
    fun authenticateWithGoogle(idToken: String) {
        viewModelScope.launch {
            _isLoading.value = true
            _errorMessage.value = null

            when (val result = authRepository.googleAuth(idToken)) {
                is ApiResult.Success -> {
                    _currentUser.value = result.data.user
                    _authState.value = AuthState.Authenticated

                    // Connect to socket with token
                    socketManager.connect(result.data.token)

                    // ✅ NEW: Register FCM token after successful authentication
                    registerFcmTokenAfterLogin()

                    _errorMessage.value = null
                }
                is ApiResult.Error -> {
                    _authState.value = AuthState.Error(result.message)
                    _errorMessage.value = result.message
                }
                is ApiResult.Loading -> {
                    // Already handled by _isLoading
                }
            }

            _isLoading.value = false
        }
    }

    /**
     * Logout user
     */
    fun logout() {
        viewModelScope.launch {
            _isLoading.value = true

            // ✅ NEW: Unregister FCM token before logout
            unregisterFcmTokenBeforeLogout()

            // Disconnect socket
            socketManager.disconnect()

            // Logout from backend
            authRepository.logout()

            // Update state
            _currentUser.value = null
            _authState.value = AuthState.Unauthenticated
            _errorMessage.value = null
            _isLoading.value = false
        }
    }

    /**
     * Update FCM token for push notifications
     */
    fun updateFcmToken(fcmToken: String) {
        viewModelScope.launch {
            authRepository.updateFcmToken(fcmToken)
        }
    }

    /**
     * Delete user account
     */
    fun deleteAccount(onSuccess: () -> Unit) {
        viewModelScope.launch {
            _isLoading.value = true
            _errorMessage.value = null
            _showDeleteInGroupAlert.value = false

            when (val result = authRepository.deleteAccount()) {
                is ApiResult.Success -> {
                    // ✅ NEW: Unregister FCM token
                    unregisterFcmTokenBeforeLogout()

                    // Disconnect socket
                    socketManager.disconnect()

                    // Clear state (auth data already cleared in repository)
                    _currentUser.value = null
                    _authState.value = AuthState.Unauthenticated
                    _errorMessage.value = null

                    onSuccess()
                }
                is ApiResult.Error -> {
                    // Check if error is about being in a room or group
                    if (result.message.contains("room or group", ignoreCase = true) ||
                        result.message.contains("Cannot delete", ignoreCase = true)) {
                        _showDeleteInGroupAlert.value = true
                    } else {
                        _authState.value = AuthState.Error(result.message)
                        _errorMessage.value = "Failed to delete account: ${result.message}"
                    }
                }
                is ApiResult.Loading -> {
                    // Already handled by _isLoading
                }
            }

            _isLoading.value = false
        }
    }

    /**
     * Dismiss the delete in group alert
     */
    fun dismissDeleteInGroupAlert() {
        _showDeleteInGroupAlert.value = false
    }

    /**
     * Clear error message
     */
    fun clearError() {
        _errorMessage.value = null
        _showDeleteInGroupAlert.value = false
    }

    /**
     * Clear success message
     */
    fun clearSuccess() {
        _successMessage.value = null
    }

    /**
     * Clear loading state (used when user cancels sign-in)
     */
    fun clearLoading() {
        _isLoading.value = false
    }

    private fun syncProfilePictureToBackend(profilePicture: String) {
        viewModelScope.launch {
            try {
                Log.d(TAG, "Syncing profile picture to backend (${profilePicture.length} chars)")
                val result = userRepository.updateUserProfile(
                    name = null,
                    bio = null,
                    profilePicture = profilePicture,
                    contactNumber = null
                )

                when (result) {
                    is ApiResult.Success -> {
                        Log.d(TAG, "Profile picture synced successfully")
                    }
                    is ApiResult.Error -> {
                        Log.w(TAG, "Failed to sync profile picture: ${result.message}")
                    }
                    is ApiResult.Loading -> {
                    }
                }
            } catch (e: IOException) {
                Log.w(TAG, "Network error syncing profile picture: ${e.message}")
            } catch (e: IllegalStateException) {
                Log.w(TAG, "Invalid state while syncing profile picture: ${e.message}")
            }
        }
    }

    // ==================== NEW: FCM TOKEN METHODS ====================

    /**
     * Register FCM token with backend after successful login
     */
    private fun registerFcmTokenAfterLogin() {
        viewModelScope.launch {
            try {
                Log.d(TAG, "🔍 Checking for FCM token...")

                var fcmToken = tokenManager.getFcmToken()
                val userId = tokenManager.getUserId()

                if (fcmToken != null && userId != null) {
                    Log.d(TAG, "📤 Found saved FCM token, registering...")

                    when (val result = userRepository.registerFcmToken(userId, fcmToken)) {
                        is ApiResult.Success -> {
                            Log.d(TAG, "✅ FCM token registered successfully")
                        }
                        is ApiResult.Error -> {
                            Log.e(TAG, "⚠️ Failed to register FCM token: ${result.message}")
                        }
                        is ApiResult.Loading -> {
                        }
                    }
                } else {
                    Log.d(TAG, "📲 No saved token, requesting fresh token from Firebase...")

                    com.google.firebase.messaging.FirebaseMessaging.getInstance().token
                        .addOnCompleteListener { task ->
                            if (!task.isSuccessful) {
                                Log.e(TAG, "❌ Failed to get FCM token", task.exception)
                                return@addOnCompleteListener
                            }

                            val token = task.result
                            if (token != null && userId != null) {
                                Log.d(TAG, "✅ Fresh FCM token received: ${token.take(20)}...")

                                tokenManager.saveFcmToken(token)

                                viewModelScope.launch {
                                    when (val result = userRepository.registerFcmToken(userId, token)) {
                                        is ApiResult.Success -> {
                                            Log.d(TAG, "✅ Fresh FCM token registered successfully")
                                        }
                                        is ApiResult.Error -> {
                                            Log.e(TAG, "⚠️ Failed to register fresh FCM token: ${result.message}")
                                        }
                                        is ApiResult.Loading -> {
                                        }
                                    }
                                }
                            }
                        }
                }
            } catch (e: Exception) {
                Log.e(TAG, "❌ Error during FCM token registration", e)
            }
        }
    }

    /**
     * Unregister FCM token from backend before logout
     */
    private suspend fun unregisterFcmTokenBeforeLogout() {
        try {
            val userId = tokenManager.getUserId()

            if (userId != null) {
                Log.d(TAG, "📤 Unregistering FCM token from backend...")

                when (val result = userRepository.unregisterFcmToken(userId)) {
                    is ApiResult.Success -> {
                        Log.d(TAG, "✅ FCM token unregistered successfully")
                    }
                    is ApiResult.Error -> {
                        Log.e(TAG, "⚠️ Failed to unregister FCM token: ${result.message}")
                        // Don't block logout if unregistration fails
                    }
                    is ApiResult.Loading -> {
                        // Ignore
                    }
                }
            } else {
                Log.d(TAG, "ℹ️ No user ID available for FCM unregistration")
            }
        } catch (e: Exception) {
            Log.e(TAG, "❌ Error during FCM token unregistration", e)
            // Don't throw - FCM unregistration shouldn't block logout
        }
    }

    // ================================================================

    /**
     * Get current user ID
     */
    fun getCurrentUserId(): String? {
        return authRepository.getCurrentUserId()
    }
}

/**
 * Authentication state sealed class
 */
sealed class AuthState {
    object Initial : AuthState()
    object Authenticated : AuthState()
    object Unauthenticated : AuthState()
    data class Error(val message: String) : AuthState()
}