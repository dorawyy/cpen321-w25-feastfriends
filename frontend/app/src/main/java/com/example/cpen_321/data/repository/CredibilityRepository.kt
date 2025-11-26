package com.example.cpen_321.data.repository

import com.example.cpen_321.data.model.CredibilityCode
import com.example.cpen_321.data.model.CredibilityDeductResponse
import com.example.cpen_321.data.model.CredibilityVerifyResponse
import com.example.cpen_321.data.network.dto.ApiResult

/**
 * Repository for credibility operations
 */
interface CredibilityRepository {

    /**
     * Generate credibility code
     */
    suspend fun generateCode(): ApiResult<CredibilityCode>

    /**
     * Verify another user's code
     */
    suspend fun verifyCode(code: String): ApiResult<CredibilityVerifyResponse>

    /**
     * Deduct score when leaving without verification
     */
    suspend fun deductScore(): ApiResult<CredibilityDeductResponse>
}