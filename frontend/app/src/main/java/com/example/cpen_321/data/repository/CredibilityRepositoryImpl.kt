package com.example.cpen_321.data.repository

import com.example.cpen_321.data.model.CredibilityCode
import com.example.cpen_321.data.model.CredibilityDeductResponse
import com.example.cpen_321.data.model.CredibilityVerifyResponse
import com.example.cpen_321.data.network.api.CredibilityAPI
import com.example.cpen_321.data.network.dto.ApiResult
import com.example.cpen_321.data.network.dto.VerifyCodeRequest
import com.example.cpen_321.data.network.safeApiCall
import javax.inject.Inject

/**
 * Implementation of CredibilityRepository
 */
class CredibilityRepositoryImpl @Inject constructor(
    private val credibilityAPI: CredibilityAPI
) : CredibilityRepository {

    override suspend fun generateCode(): ApiResult<CredibilityCode> {
        return safeApiCall(
            apiCall = { credibilityAPI.generateCode() },
            customErrorCode = "Failed to generate credibility code"
        )
    }

    override suspend fun verifyCode(code: String): ApiResult<CredibilityVerifyResponse> {
        val request = VerifyCodeRequest(code)
        return safeApiCall(
            apiCall = { credibilityAPI.verifyCode(request) },
            customErrorCode = "Failed to verify code"
        )
    }

    override suspend fun deductScore(): ApiResult<CredibilityDeductResponse> {
        return safeApiCall(
            apiCall = { credibilityAPI.deductScore() },
            customErrorCode = "Failed to deduct score"
        )
    }
}