package com.example.cpen_321.data.model

import com.google.gson.annotations.SerializedName

/**
 * Voting round status for sequential voting
 */
data class VotingRoundStatus(
    @SerializedName("hasActiveRound")
    val hasActiveRound: Boolean,

    @SerializedName("currentRestaurant")
    val currentRestaurant: Restaurant? = null,

    @SerializedName("votes")
    val votes: List<VoteEntry>? = null,

    @SerializedName("yesVotes")
    val yesVotes: Int? = null,

    @SerializedName("noVotes")
    val noVotes: Int? = null,

    @SerializedName("expiresAt")
    val expiresAt: String? = null,

    @SerializedName("roundNumber")
    val roundNumber: Int? = null,

    @SerializedName("totalRounds")
    val totalRounds: Int? = null,

    @SerializedName("timeRemaining")
    val timeRemaining: Int? = null // seconds
)

/**
 * Individual vote entry
 */
data class VoteEntry(
    @SerializedName("userId")
    val userId: String,

    @SerializedName("vote")
    val vote: Boolean // true = yes, false = no
)

/**
 * Response from initialize voting endpoint
 */
data class InitializeVotingResponse(
    @SerializedName("success")
    val success: Boolean,

    @SerializedName("currentRestaurant")
    val currentRestaurant: Restaurant? = null,

    @SerializedName("message")
    val message: String
)

/**
 * Response from submit vote endpoint
 */
data class SubmitVoteResponse(
    @SerializedName("success")
    val success: Boolean,

    @SerializedName("majorityReached")
    val majorityReached: Boolean,

    @SerializedName("result")
    val result: String? = null, // "yes" or "no"

    @SerializedName("nextRestaurant")
    val nextRestaurant: Restaurant? = null,

    @SerializedName("selectedRestaurant")
    val selectedRestaurant: Restaurant? = null,

    @SerializedName("votingComplete")
    val votingComplete: Boolean? = null,

    @SerializedName("message")
    val message: String
)

/**
 * Request body for submitting a sequential vote
 */
data class SubmitSequentialVoteRequest(
    @SerializedName("vote")
    val vote: Boolean // true = yes, false = no
)