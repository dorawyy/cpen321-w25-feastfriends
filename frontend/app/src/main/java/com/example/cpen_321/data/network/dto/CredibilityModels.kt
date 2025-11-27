package com.example.cpen_321.data.network.dto

import com.google.gson.annotations.SerializedName

/**
 * Request to verify a credibility code
 * POST /api/credibility/verify
 */
data class VerifyCodeRequest(
    @SerializedName("code")
    val code: String
)