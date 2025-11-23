package com.example.cpen_321.data.model

data class CleanupResponse(
    val cleaned: Boolean,
    val hasActiveGroup: Boolean,
    val status: Int
)
