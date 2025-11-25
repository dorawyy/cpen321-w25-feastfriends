package com.example.cpen_321.data.repository

import com.example.cpen_321.data.model.Group
import com.example.cpen_321.data.model.InitializeVotingResponse
import com.example.cpen_321.data.model.Restaurant
import com.example.cpen_321.data.model.SubmitSequentialVoteRequest
import com.example.cpen_321.data.model.SubmitVoteResponse
import com.example.cpen_321.data.model.VotingRoundStatus
import com.example.cpen_321.data.network.dto.ApiResult

/**
 * Repository for group-related operations
 */
interface GroupRepository {

    /**
     * Get current user's group status
     */
    suspend fun getGroupStatus(): ApiResult<Group>

    /**
     * Vote for a restaurant (LEGACY - list-based voting)
     */
    suspend fun voteForRestaurant(
        groupId: String,
        restaurantId: String,
        restaurant: Restaurant?
    ): ApiResult<Map<String, Int>>

    /**
     * Leave a group
     */
    suspend fun leaveGroup(groupId: String): ApiResult<String>

    // ==================== NEW: SEQUENTIAL VOTING METHODS ====================

    /**
     * Initialize sequential voting for a group
     */
    suspend fun initializeSequentialVoting(groupId: String): ApiResult<InitializeVotingResponse>

    /**
     * Submit a sequential vote (yes/no)
     */
    suspend fun submitSequentialVote(
        groupId: String,
        request: SubmitSequentialVoteRequest
    ): ApiResult<SubmitVoteResponse>

    /**
     * Get current voting round status
     */
    suspend fun getCurrentVotingRound(groupId: String): ApiResult<VotingRoundStatus>

    /**
     * Save current group ID to local storage
     */
    fun saveCurrentGroupId(groupId: String?)

    /**
     * Get current group ID from local storage
     */
    fun getCurrentGroupId(): String?
}