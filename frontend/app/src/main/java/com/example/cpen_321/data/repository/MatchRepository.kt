package com.example.cpen_321.data.repository

import com.example.cpen_321.data.model.Room
import com.example.cpen_321.data.model.RoomStatusResponse
import com.example.cpen_321.data.model.RoomCompletionResponse
import com.example.cpen_321.data.network.dto.ApiResult

/**
 * Repository interface for matching/room operations
 */
interface MatchRepository {

    /**
     * Join the matching pool
     */
    // Change joinMatching return type
    suspend fun joinMatching(
        cuisine: List<String>? = null,
        budget: Double? = null,
        radiusKm: Double? = null,
        latitude: Double? = null,
        longitude: Double? = null
    ): ApiResult<Triple<String, Room, Long?>>


    /**
     * Leave a waiting room
     */
    suspend fun leaveRoom(roomId: String): ApiResult<String>

    /**
     * Get room status
     */
    suspend fun getRoomStatus(roomId: String): ApiResult<RoomStatusResponse>

    /**
     * Get users in a room
     */
    suspend fun getRoomUsers(roomId: String): ApiResult<List<String>>

    /**
     * Save current room ID locally
     */
    fun saveCurrentRoomId(roomId: String?)

    /**
     * Get current room ID from local storage
     */
    fun getCurrentRoomId(): String?


    // ✅ ADD THIS
    /**
     * Clean up stale user state before joining matching
     */
    suspend fun cleanupUserState(): ApiResult<CleanupStateData>

    // Add to MatchRepository interface
    suspend fun checkRoomCompletion(roomId: String): ApiResult<RoomCompletionResponse>
}

// ✅ ADD THIS DATA CLASS at the bottom of the file (outside the interface)
data class CleanupStateData(
    val cleaned: Boolean,
    val hasActiveGroup: Boolean,
    val status: Int
)