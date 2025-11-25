package com.example.cpen_321.data.repository

import com.example.cpen_321.data.local.PreferencesManager
import com.example.cpen_321.data.model.Group
import com.example.cpen_321.data.model.InitializeVotingResponse
import com.example.cpen_321.data.model.Restaurant
import com.example.cpen_321.data.model.SubmitSequentialVoteRequest
import com.example.cpen_321.data.model.SubmitVoteResponse
import com.example.cpen_321.data.model.VotingRoundStatus
import com.example.cpen_321.data.network.RetrofitClient
import com.example.cpen_321.data.network.dto.ApiResult
import com.example.cpen_321.data.network.dto.LeaveGroupRequest
import com.example.cpen_321.data.network.dto.VoteRestaurantRequest
import com.example.cpen_321.data.network.dto.map
import com.example.cpen_321.data.network.safeApiCall
import android.util.Log

/**
 * Implementation of GroupRepository
 */
class GroupRepositoryImpl(
    private val preferencesManager: PreferencesManager
) : GroupRepository {

    private val groupAPI = RetrofitClient.groupAPI

    override suspend fun getGroupStatus(): ApiResult<Group> {
        return try {
            val response = groupAPI.getGroupStatus()

            // Add debug logging
            Log.d("GroupRepo", "🐛 Raw response: ${response.raw()}")
            Log.d("GroupRepo", "🐛 Response body: ${response.body()}")

            // Continue with your existing safeApiCall...
            safeApiCall(
                apiCall = { groupAPI.getGroupStatus() },
                customErrorCode = "Failed to get group status"
            ).also { apiResult ->
                // Your existing logic
            }
        } catch (e: Exception) {
            Log.e("GroupRepo", "Exception in getGroupStatus", e)
            ApiResult.Error("Failed to get group status: ${e.message}", null)
        }
    }

    override suspend fun voteForRestaurant(
        groupId: String,
        restaurantId: String,
        restaurant: Restaurant?
    ): ApiResult<Map<String, Int>> {

        val request = VoteRestaurantRequest(
            restaurantID = restaurantId,
            restaurant = restaurant
        )

        val response = safeApiCall(
            apiCall = { groupAPI.voteForRestaurant(groupId, request) },
            customErrorCode = "Failed to vote"
        ).map { apiResponse -> apiResponse.currentVotes }

        return response
    }

    override suspend fun leaveGroup(groupId: String): ApiResult<String> {

        val request = LeaveGroupRequest()
        val response = safeApiCall(
            apiCall = {
                groupAPI.leaveGroup(
                    groupId = groupId,
                    request = request
                )
            },
            customErrorCode = "Failed to leave group"
        ).map { "Left group successfully" }

        // Clear local group ID
        saveCurrentGroupId(null)
        return response
    }

    // ==================== NEW: SEQUENTIAL VOTING METHODS ====================

    /**
     * Initialize sequential voting for a group
     */
    override suspend fun initializeSequentialVoting(groupId: String): ApiResult<InitializeVotingResponse> {
        return safeApiCall(
            apiCall = { groupAPI.initializeSequentialVoting(groupId) },
            customErrorCode = "Failed to initialize voting"
        )
    }

    /**
     * Submit a sequential vote (yes/no)
     */
    override suspend fun submitSequentialVote(
        groupId: String,
        request: SubmitSequentialVoteRequest
    ): ApiResult<SubmitVoteResponse> {
        return safeApiCall(
            apiCall = { groupAPI.submitSequentialVote(groupId, request) },
            customErrorCode = "Failed to submit vote"
        )
    }

    /**
     * Get current voting round status
     */
    override suspend fun getCurrentVotingRound(groupId: String): ApiResult<VotingRoundStatus> {
        return safeApiCall(
            apiCall = { groupAPI.getCurrentVotingRound(groupId) },
            customErrorCode = "Failed to get voting round"
        )
    }

    override fun saveCurrentGroupId(groupId: String?) {
        preferencesManager.saveCurrentGroupId(groupId)
    }

    override fun getCurrentGroupId(): String? {
        return preferencesManager.getCurrentGroupId()
    }
}