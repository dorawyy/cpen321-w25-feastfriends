package com.example.cpen_321.data.network.dto

import com.google.gson.annotations.SerializedName

/**
 * Request to register FCM token
 */
data class RegisterFcmTokenRequest(
    @SerializedName("userId")
    val userId: String,
    @SerializedName("token")
    val token: String
)

/**
 * Request to unregister FCM token
 */
data class UnregisterFcmTokenRequest(
    @SerializedName("userId")
    val userId: String
)

/**
 * Simple API response for FCM operations
 */
data class FcmApiResponse(
    @SerializedName("success")
    val success: Boolean,
    @SerializedName("message")
    val message: String?
)