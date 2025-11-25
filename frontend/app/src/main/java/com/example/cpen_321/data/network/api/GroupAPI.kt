package com.example.cpen_321.data.network.api

import com.example.cpen_321.data.model.Group
import com.example.cpen_321.data.model.InitializeVotingResponse
import com.example.cpen_321.data.model.SubmitSequentialVoteRequest
import com.example.cpen_321.data.model.SubmitVoteResponse
import com.example.cpen_321.data.model.VotingRoundStatus
import com.example.cpen_321.data.network.dto.ApiResponse
import com.example.cpen_321.data.network.dto.LeaveGroupRequest
import com.example.cpen_321.data.network.dto.LeaveGroupResponse
import com.example.cpen_321.data.network.dto.VoteRestaurantRequest
import com.example.cpen_321.data.network.dto.VoteRestaurantResponse
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path

/**
 * Group API endpoints
 */
interface GroupAPI {

    /**
     * GET /api/group/status
     * Get current user's group status
     */
    @GET("api/group/status")
    suspend fun getGroupStatus(): Response<ApiResponse<Group>>

    /**
     * POST /api/group/vote/:groupId
     * Vote for a restaurant (LEGACY - list-based voting)
     */
    @POST("api/group/vote/{groupId}")
    suspend fun voteForRestaurant(
        @Path("groupId") groupId: String,
        @Body request: VoteRestaurantRequest
    ): Response<ApiResponse<VoteRestaurantResponse>>

    /**
     * POST /api/group/leave/:groupId
     * Leave a group
     */
    @POST("api/group/leave/{groupId}")
    suspend fun leaveGroup(
        @Path("groupId") groupId: String,
        @Body request: LeaveGroupRequest = LeaveGroupRequest()
    ): Response<ApiResponse<LeaveGroupResponse>>

    // ==================== NEW: SEQUENTIAL VOTING ENDPOINTS ====================

    /**
     * POST /api/groups/:groupId/voting/initialize
     * Initialize sequential voting for a group
     */
    @POST("api/groups/{groupId}/voting/initialize")
    suspend fun initializeSequentialVoting(
        @Path("groupId") groupId: String
    ): Response<ApiResponse<InitializeVotingResponse>>

    /**
     * POST /api/groups/:groupId/voting/vote
     * Submit a yes/no vote for the current restaurant
     */
    @POST("api/groups/{groupId}/voting/vote")
    suspend fun submitSequentialVote(
        @Path("groupId") groupId: String,
        @Body request: SubmitSequentialVoteRequest
    ): Response<ApiResponse<SubmitVoteResponse>>

    /**
     * GET /api/groups/:groupId/voting/current
     * Get current voting round status
     */
    @GET("api/groups/{groupId}/voting/current")
    suspend fun getCurrentVotingRound(
        @Path("groupId") groupId: String
    ): Response<ApiResponse<VotingRoundStatus>>
}