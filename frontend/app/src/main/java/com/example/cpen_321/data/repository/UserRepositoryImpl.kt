package com.example.cpen_321.data.repository

import android.util.Log
import com.example.cpen_321.data.local.PreferencesManager
import com.example.cpen_321.data.local.TokenManager
import com.example.cpen_321.data.model.UserProfile
import com.example.cpen_321.data.model.UserSettings
import com.example.cpen_321.data.network.api.UserAPI
import com.example.cpen_321.data.network.dto.ApiResult
import com.example.cpen_321.data.network.dto.RegisterFcmTokenRequest
import com.example.cpen_321.data.network.dto.UnregisterFcmTokenRequest
import com.example.cpen_321.data.network.dto.UpdateProfileRequest
import com.example.cpen_321.data.network.dto.UpdateSettingsRequest
import com.example.cpen_321.data.network.dto.map
import com.example.cpen_321.data.network.safeApiCall
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import javax.inject.Inject

/**
 * Implementation of UserRepository
 */
class UserRepositoryImpl @Inject constructor(
    private val preferencesManager: PreferencesManager,
    private val tokenManager: TokenManager,
    private val userAPI: UserAPI
) : UserRepository {

    companion object {
        private const val TAG = "UserRepository"
    }

    override suspend fun getUserProfiles(userIds: List<String>): ApiResult<List<UserProfile>> {
        val idsString = userIds.joinToString(",")
        val response = safeApiCall(
            apiCall = { userAPI.getUserProfiles(idsString) },
            customErrorCode = "Failed to fetch profiles"
        )
        return response
    }

    override suspend fun getUserSettings(): ApiResult<UserSettings> {
        val apiResult = safeApiCall(
            apiCall = { userAPI.getUserSettings() },
            customErrorCode = "Failed to fetch settings"
        )
        if (apiResult is ApiResult.Success) {
            val settings = apiResult.data
            // Save preferences locally
            preferencesManager.saveCuisines(settings.preference.toSet())
            preferencesManager.saveBudget(settings.budget)
            preferencesManager.saveRadius(settings.radiusKm)
        }
        return apiResult
    }

    override suspend fun updateUserProfile(
        name: String?,
        bio: String?,
        profilePicture: String?,
        contactNumber: String?
    ): ApiResult<UserProfile> {
        val request = UpdateProfileRequest(
            name = name,
            bio = bio,
            profilePicture = profilePicture,
            contactNumber = contactNumber
        )

        val apiResult = safeApiCall(
            apiCall = { userAPI.updateUserProfile(request) },
            customErrorCode = "Failed to update profile"
        )

        return apiResult
    }

    override suspend fun updateUserSettings(
        name: String?,
        bio: String?,
        preference: List<String>?,
        profilePicture: String?,
        contactNumber: String?,
        budget: Double?,
        radiusKm: Double?
    ): ApiResult<UserSettings> {
        val request = UpdateSettingsRequest(
            name = name,
            bio = bio,
            preference = preference,
            profilePicture = profilePicture,
            contactNumber = contactNumber,
            budget = budget,
            radiusKm = radiusKm
        )

        val apiResult = safeApiCall(
            apiCall = { userAPI.updateUserSettings(request) },
            customErrorCode = "Failed to update settings"
        )

        if (apiResult is ApiResult.Success) {
            val settings = apiResult.data

            preferencesManager.saveCuisines(settings.preference.toSet())
            preferencesManager.saveBudget(settings.budget)
            preferencesManager.saveRadius(settings.radiusKm)
        }

        return apiResult
    }

    override suspend fun deleteUser(userId: String): ApiResult<Boolean> {
        /* map makes success api.body.deleted */
        return safeApiCall(
            apiCall = { userAPI.deleteUser(userId) },
            customErrorCode = "Failed to delete user"
        ).map { it.deleted }
    }

    // ==================== NEW: FCM TOKEN METHODS ====================

    /**
     * Register FCM token with backend
     */
    override suspend fun registerFcmToken(userId: String, token: String): ApiResult<Boolean> {
        return withContext(Dispatchers.IO) {
            try {
                Log.d(TAG, "Registering FCM token for user: $userId")

                val request = RegisterFcmTokenRequest(userId = userId, token = token)
                val response = userAPI.registerFcmToken(request)

                if (response.isSuccessful && response.body()?.success == true) {
                    Log.d(TAG, "✅ FCM token registered successfully")
                    // Save token locally
                    tokenManager.saveFcmToken(token)
                    ApiResult.Success(true)
                } else {
                    val errorMsg = response.body()?.message ?: "Failed to register FCM token"
                    Log.e(TAG, "❌ Failed to register FCM token: $errorMsg")
                    ApiResult.Error(errorMsg, response.code())
                }
            } catch (e: Exception) {
                Log.e(TAG, "❌ Error registering FCM token", e)
                ApiResult.Error("Network error: ${e.localizedMessage}")
            }
        }
    }

    /**
     * Unregister FCM token from backend (on logout)
     */
    override suspend fun unregisterFcmToken(userId: String): ApiResult<Boolean> {
        return withContext(Dispatchers.IO) {
            try {
                Log.d(TAG, "Unregistering FCM token for user: $userId")

                val request = UnregisterFcmTokenRequest(userId = userId)
                val response = userAPI.unregisterFcmToken(request)

                if (response.isSuccessful && response.body()?.success == true) {
                    Log.d(TAG, "✅ FCM token unregistered successfully")
                    // Clear local token
                    tokenManager.clearFcmToken()
                    ApiResult.Success(true)
                } else {
                    val errorMsg = response.body()?.message ?: "Failed to unregister FCM token"
                    Log.e(TAG, "❌ Failed to unregister FCM token: $errorMsg")
                    ApiResult.Error(errorMsg, response.code())
                }
            } catch (e: Exception) {
                Log.e(TAG, "❌ Error unregistering FCM token", e)
                // Even if unregistration fails, clear local token
                tokenManager.clearFcmToken()
                ApiResult.Error("Network error: ${e.localizedMessage}")
            }
        }
    }

    // ================================================================
}