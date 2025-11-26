package com.example.cpen_321.data.model

import com.google.gson.annotations.SerializedName

/**
 * Credibility code response from backend
 */
data class CredibilityCode(
    @SerializedName("code")
    val code: String,

    @SerializedName("expiresAt")
    val expiresAt: Long,

    @SerializedName("groupId")
    val groupId: String
)

/**
 * Verify code response
 */
data class CredibilityVerifyResponse(
    @SerializedName("success")
    val success: Boolean,

    @SerializedName("message")
    val message: String,

    @SerializedName("verifiedUserId")
    val verifiedUserId: String
)

/**
 * Deduct score response
 */
data class CredibilityDeductResponse(
    @SerializedName("success")
    val success: Boolean,

    @SerializedName("message")
    val message: String,

    @SerializedName("scoreDeducted")
    val scoreDeducted: Int,

    @SerializedName("newScore")
    val newScore: Double
)

/**
 * UI state for credibility code
 */
data class CredibilityState(
    val hasActiveCode: Boolean = false,
    val currentCode: String? = null,
    val codeExpiresAt: Long? = null
)