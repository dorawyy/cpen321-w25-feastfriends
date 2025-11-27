package com.example.cpen_321.data.model

import com.google.gson.annotations.SerializedName

/**
 * Credibility log entry
 */
data class CredibilityLog(
    @SerializedName("logId")
    val logId: String,

    @SerializedName("userId")
    val userId: String,

    @SerializedName("action")
    val action: CredibilityAction,

    @SerializedName("scoreChange")
    val scoreChange: Int,

    @SerializedName("groupId")
    val groupId: String? = null,

    @SerializedName("roomId")
    val roomId: String? = null,

    @SerializedName("previousScore")
    val previousScore: Double,

    @SerializedName("newScore")
    val newScore: Double,

    @SerializedName("notes")
    val notes: String? = null,

    @SerializedName("createdAt")
    val createdAt: String
)

/**
 * Credibility action enum
 */
enum class CredibilityAction {
    @SerializedName("check_in")
    CHECK_IN,

    @SerializedName("left_without_checkin")
    LEFT_WITHOUT_CHECKIN
}

/**
 * Credibility statistics
 */
data class CredibilityStats(
    @SerializedName("currentScore")
    val currentScore: Double,

    @SerializedName("totalLogs")
    val totalLogs: Int,

    @SerializedName("positiveActions")
    val positiveActions: Int,

    @SerializedName("negativeActions")
    val negativeActions: Int,

    @SerializedName("recentTrend")
    val recentTrend: String // "improving", "stable", "declining"
)