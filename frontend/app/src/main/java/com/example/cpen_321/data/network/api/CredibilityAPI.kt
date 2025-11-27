package com.example.cpen_321.data.network.api

import com.example.cpen_321.data.model.CredibilityCode
import com.example.cpen_321.data.model.CredibilityDeductResponse
import com.example.cpen_321.data.model.CredibilityVerifyResponse
import com.example.cpen_321.data.network.dto.ApiResponse
import com.example.cpen_321.data.network.dto.VerifyCodeRequest
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST

/**
 * Credibility API endpoints
 */
interface CredibilityAPI {

    /**
     * GET /api/credibility/code
     * Generate credibility code for current user
     */
    @GET("api/credibility/code")
    suspend fun generateCode(): Response<ApiResponse<CredibilityCode>>

    /**
     * POST /api/credibility/verify
     * Verify another user's credibility code
     */
    @POST("api/credibility/verify")
    suspend fun verifyCode(
        @Body request: VerifyCodeRequest
    ): Response<ApiResponse<CredibilityVerifyResponse>>

    /**
     * POST /api/credibility/deduct
     * Deduct credibility score when leaving without verification
     */
    @POST("api/credibility/deduct")
    suspend fun deductScore(): Response<ApiResponse<CredibilityDeductResponse>>
}