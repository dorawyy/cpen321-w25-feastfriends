package com.example.cpen_321.ui.viewmodels

import android.os.Build
import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.cpen_321.data.model.Room
import com.example.cpen_321.data.model.UserProfile
import com.example.cpen_321.data.network.dto.ApiResult
import com.example.cpen_321.data.repository.MatchRepository
import com.example.cpen_321.data.repository.UserRepository
import com.example.cpen_321.utils.JsonUtils.getBooleanSafe
import com.example.cpen_321.utils.JsonUtils.getJSONArraySafe
import com.example.cpen_321.utils.JsonUtils.getStringSafe
import com.example.cpen_321.utils.JsonUtils.toStringList
import com.example.cpen_321.utils.SocketManager
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import org.json.JSONObject
import java.text.ParseException
import javax.inject.Inject
import java.util.concurrent.atomic.AtomicInteger

/**
 * ViewModel for matching/waiting room
 */
@HiltViewModel
class MatchViewModel @Inject constructor(
    private val matchRepository: MatchRepository,
    private val userRepository: UserRepository,
    private val socketManager: SocketManager
) : ViewModel() {

    // Timer management - use AtomicInteger for thread safety
    private var timerJob: Job? = null
    private val timerGeneration = AtomicInteger(0)

    // Server time offset (serverTime - localTime) for clock synchronization
    @Volatile
    private var serverTimeOffset: Long = 0L

    // Store the target completion time
    @Volatile
    private var currentCompletionTime: Long = 0L

    // Current room
    private val _currentRoom = MutableStateFlow<Room?>(null)
    val currentRoom: StateFlow<Room?> = _currentRoom.asStateFlow()

    // Room members (user profiles)
    private val _roomMembers = MutableStateFlow<List<UserProfile>>(emptyList())
    val roomMembers: StateFlow<List<UserProfile>> = _roomMembers.asStateFlow()

    // Time remaining in milliseconds
    private val _timeRemaining = MutableStateFlow<Long>(0L)
    val timeRemaining: StateFlow<Long> = _timeRemaining.asStateFlow()

    // Group ready status
    private val _groupReady = MutableStateFlow(false)
    val groupReady: StateFlow<Boolean> = _groupReady.asStateFlow()

    // Group ID when matched
    private val _groupId = MutableStateFlow<String?>(null)
    val groupId: StateFlow<String?> = _groupId.asStateFlow()

    // Loading state
    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    // Error message
    private val _errorMessage = MutableStateFlow<String?>(null)
    val errorMessage: StateFlow<String?> = _errorMessage.asStateFlow()

    // Room expired flag
    private val _roomExpired = MutableStateFlow(false)
    val roomExpired: StateFlow<Boolean> = _roomExpired.asStateFlow()

    private val _leaveRoomSuccess = MutableStateFlow(false)
    val leaveRoomSuccess: StateFlow<Boolean> = _leaveRoomSuccess.asStateFlow()

    companion object {
        private const val TAG = "MatchViewModel"
    }

    init {
        setupSocketListeners()
    }

    /**
     * Start the countdown timer - ONLY call this from joinMatching with server time
     */
    /**
     * Start the countdown timer - ONLY call this from joinMatching with server time
     */
    private fun startTimerWithServerTime(completionTime: Long, serverCurrentTimeMillis: Long) {
        timerJob?.cancel()
        val myGeneration = timerGeneration.incrementAndGet()

        val localTime = System.currentTimeMillis()
        serverTimeOffset = serverCurrentTimeMillis - localTime
        currentCompletionTime = completionTime

        val serverNow = localTime + serverTimeOffset
        val initialRemaining = completionTime - serverNow

        Log.d(TAG, "Starting timer (gen=$myGeneration):")
        Log.d(TAG, "  - Local time: $localTime")
        Log.d(TAG, "  - Server time: $serverCurrentTimeMillis")
        Log.d(TAG, "  - Server offset: ${serverTimeOffset}ms (${serverTimeOffset / 1000}s)")
        Log.d(TAG, "  - Completion time: $completionTime")
        Log.d(TAG, "  - Initial remaining: ${initialRemaining / 1000}s")

        if (initialRemaining <= 0) {
            Log.w(TAG, "⚠️ Timer already expired - checking room immediately")
            _timeRemaining.value = 0
            _currentRoom.value?.roomId?.let { roomId ->
                checkRoomCompletion(roomId)
            }
            return
        }

        _timeRemaining.value = initialRemaining
        Log.d(TAG, "📺 Set initial timeRemaining to ${initialRemaining}ms (${initialRemaining / 1000}s)")

        timerJob = viewModelScope.launch {
            Log.d(TAG, "✅ Timer loop started (gen=$myGeneration)")

            while (isActive) {
                if (timerGeneration.get() != myGeneration) {
                    Log.d(TAG, "⏹️ Timer gen=$myGeneration stopped (current gen=${timerGeneration.get()})")
                    break
                }

                delay(1000)

                val now = System.currentTimeMillis() + serverTimeOffset
                val remaining = currentCompletionTime - now

                if (remaining <= 0) {
                    _timeRemaining.value = 0
                    Log.d(TAG, "⏰ Timer expired (gen=$myGeneration) - triggering room completion check")

                    _currentRoom.value?.roomId?.let { roomId ->
                        checkRoomCompletion(roomId)
                    }
                    break
                }

                _timeRemaining.value = remaining

                val remainingSeconds = remaining / 1000
                if (remainingSeconds % 5 == 0L) {
                    Log.d(TAG, "⏱️ Timer (gen=$myGeneration): ${remainingSeconds}s remaining")
                }
            }
        }

        Log.d(TAG, "✅ Timer job created (gen=$myGeneration)")
    }
    /**
     * Check room completion status with backend
     */
    private fun checkRoomCompletion(roomId: String) {
        viewModelScope.launch {
            Log.d(TAG, "🔍 Checking room completion for: $roomId")

            when (val result = matchRepository.checkRoomCompletion(roomId)) {
                is ApiResult.Success -> {
                    val response = result.data
                    Log.d(TAG, "📬 Room completion response: status=${response.status}, groupId=${response.groupId}")

                    when (response.status) {
                        "group_created" -> {
                            Log.d(TAG, "🎉 Group created! ID: ${response.groupId}")
                            _groupReady.value = true
                            _groupId.value = response.groupId
                            timerJob?.cancel()
                            timerGeneration.incrementAndGet()
                        }

                        "expired" -> {
                            Log.d(TAG, "❌ Room expired - not enough members")
                            _roomExpired.value = true
                            timerJob?.cancel()
                            timerGeneration.incrementAndGet()
                        }

                        "waiting" -> {
                            Log.d(TAG, "⏳ Room still waiting - retrying in 1 second")
                            delay(1000)
                            checkRoomCompletion(roomId)
                        }

                        "not_found" -> {
                            Log.e(TAG, "❌ Room not found")
                            _roomExpired.value = true
                            _errorMessage.value = "Room no longer exists"
                            timerJob?.cancel()
                            timerGeneration.incrementAndGet()
                        }

                        else -> {
                            Log.w(TAG, "⚠️ Unknown status: ${response.status}")
                            _roomExpired.value = true
                        }
                    }
                }

                is ApiResult.Error -> {
                    Log.e(TAG, "❌ Failed to check room completion: ${result.message}")
                    _roomExpired.value = true
                    _errorMessage.value = "Failed to check room status"
                }

                is ApiResult.Loading -> {}
            }
        }
    }

    private fun setupSocketListeners() {
        socketManager.onRoomUpdate { data ->
            handleRoomUpdate(data)
        }

        socketManager.onGroupReady { data ->
            handleGroupReady(data)
        }

        socketManager.onRoomExpired { data ->
            handleRoomExpired(data)
        }

        socketManager.onMemberJoined { data ->
            handleMemberJoined(data)
        }

        socketManager.onMemberLeft { data ->
            handleMemberLeft(data)
        }
    }

    /**
     * Join matching pool
     */
    fun joinMatching(
        cuisine: List<String>? = null,
        budget: Double? = null,
        radiusKm: Double? = null,
        latitude: Double? = null,
        longitude: Double? = null
    ) {
        viewModelScope.launch {
            _isLoading.value = true
            _errorMessage.value = null
            _roomExpired.value = false

            // Reset all timer state for new room
            timerJob?.cancel()
            timerGeneration.incrementAndGet()
            serverTimeOffset = 0L
            currentCompletionTime = 0L
            _timeRemaining.value = 0L

            // ADD THESE LINES - Reset group/room state from previous session
            _groupReady.value = false
            _groupId.value = null
            _currentRoom.value = null
            _roomMembers.value = emptyList()
            _leaveRoomSuccess.value = false

            // Clean up stale state before joining
            try {
                Log.d(TAG, "🧹 Cleaning up stale state before joining matching...")
                when (val cleanupResult = matchRepository.cleanupUserState()) {
                    is ApiResult.Success -> {
                        val cleanupData = cleanupResult.data
                        Log.d(TAG, "Cleanup response: cleaned=${cleanupData.cleaned}, hasActiveGroup=${cleanupData.hasActiveGroup}")

                        if (cleanupData.hasActiveGroup) {
                            _errorMessage.value = "You are already in an active group. Please complete or leave your current group before joining matching."
                            _isLoading.value = false
                            return@launch
                        }
                    }
                    is ApiResult.Error -> {
                        Log.w(TAG, "⚠️ Cleanup warning: ${cleanupResult.message}")
                    }
                    is ApiResult.Loading -> {}
                }
            } catch (e: Exception) {
                Log.w(TAG, "⚠️ Cleanup exception: ${e.message}")
            }

            when (val result = matchRepository.joinMatching(cuisine, budget, radiusKm, latitude, longitude)) {
                is ApiResult.Success -> {
                    val joinResponse = result.data
                    val roomId = joinResponse.first
                    val room = joinResponse.second
                    val serverTime = joinResponse.third

                    _currentRoom.value = room

                    // Subscribe to room updates via socket
                    socketManager.subscribeToRoom(roomId)
                    Log.d(TAG, "Subscribed to room: $roomId")

                    // Load room members
                    loadRoomMembers(room.members)

                    val completionTime = room.getCompletionTimeMillis()
                    val currentTime = System.currentTimeMillis()

                    Log.d(TAG, "Room completion time string: ${room.completionTime}")
                    Log.d(TAG, "Parsed completion time (ms): $completionTime")
                    Log.d(TAG, "Current time (ms): $currentTime")
                    Log.d(TAG, "Server time (ms): $serverTime")

                    // ONLY start timer if we have server time
                    if (completionTime > 0 && serverTime != null) {
                        startTimerWithServerTime(completionTime, serverTime)
                        Log.d(TAG, "✅ Timer started with server time sync")
                    } else if (completionTime > 0) {
                        // Fallback: use local time (less accurate)
                        Log.w(TAG, "⚠️ No server time, using local time")
                        startTimerWithServerTime(completionTime, currentTime)
                    } else {
                        Log.e(TAG, "❌ Invalid completion time!")
                    }

                    // Fetch latest room status to sync member list
                    viewModelScope.launch {
                        delay(500)
                        getRoomStatus(roomId, updateTimer = false)
                        Log.d(TAG, "Initial room status synced")
                    }
                }
                is ApiResult.Error -> {
                    _errorMessage.value = result.message
                    Log.e(TAG, "Failed to join matching: ${result.message}")
                }
                is ApiResult.Loading -> {}
            }

            _isLoading.value = false
        }
    }

    /**
     * Leave current room
     */
    fun leaveRoom() {
        Log.d(TAG, "🔴 leaveRoom() method ENTERED")

        viewModelScope.launch {
            var roomId = _currentRoom.value?.roomId

            if (roomId == null) {
                roomId = matchRepository.getCurrentRoomId()
                Log.d(TAG, "🔴 Current room was null, got roomId from preferences: $roomId")
            } else {
                Log.d(TAG, "🔴 Got roomId from currentRoom: $roomId")
            }

            if (roomId == null) {
                Log.e(TAG, "🔴 ERROR: Could not find roomId anywhere!")
                _errorMessage.value = "Unable to leave room: Room not found"
                return@launch
            }

            _isLoading.value = true
            Log.d(TAG, "🔴 Calling matchRepository.leaveRoom($roomId)")

            when (val result = matchRepository.leaveRoom(roomId)) {
                is ApiResult.Success -> {
                    Log.d(TAG, "🔴 SUCCESS: Leave room API returned success")

                    socketManager.unsubscribeFromRoom(roomId)
                    timerJob?.cancel()
                    timerGeneration.incrementAndGet()

                    _currentRoom.value = null
                    _roomMembers.value = emptyList()
                    _timeRemaining.value = 0L
                    _groupReady.value = false
                    _groupId.value = null

                    _leaveRoomSuccess.value = true
                    Log.d(TAG, "✅ Set leaveRoomSuccess flag")
                }
                is ApiResult.Error -> {
                    Log.e(TAG, "🔴 ERROR: Leave room failed: ${result.message}")
                    _errorMessage.value = result.message

                    _currentRoom.value = null
                    _roomMembers.value = emptyList()
                    _timeRemaining.value = 0L
                    _groupReady.value = false
                    _groupId.value = null
                    timerJob?.cancel()
                    timerGeneration.incrementAndGet()
                    _leaveRoomSuccess.value = true
                }
                is ApiResult.Loading -> {}
            }

            _isLoading.value = false
        }
    }

    /**
     * Get room status - only updates members, NOT timer
     */
    fun getRoomStatus(roomId: String, updateTimer: Boolean = false) {
        viewModelScope.launch {
            when (val result = matchRepository.getRoomStatus(roomId)) {
                is ApiResult.Success -> {
                    val status = result.data

                    if (!_groupReady.value && status.groupReady) {
                        _groupReady.value = true
                    }

                    if (_roomMembers.value.isEmpty() || _roomMembers.value.size < status.members.size) {
                        loadRoomMembers(status.members)
                    }
                }
                is ApiResult.Error -> {
                    Log.e(TAG, "Failed to get room status: ${result.message}")
                }
                is ApiResult.Loading -> {}
            }
        }
    }

    private fun loadRoomMembers(memberIds: List<String>) {
        viewModelScope.launch {
            if (memberIds.isEmpty()) {
                _roomMembers.value = emptyList()
                return@launch
            }

            when (val result = userRepository.getUserProfiles(memberIds)) {
                is ApiResult.Success -> {
                    _roomMembers.value = result.data.toList()
                    Log.d(TAG, "Loaded ${result.data.size} room members")
                }
                is ApiResult.Error -> {
                    Log.e(TAG, "Failed to load members: ${result.message}")
                }
                is ApiResult.Loading -> {}
            }
        }
    }

    /**
     * Handle room update from socket - ONLY updates members, NOT timer
     */
    private fun handleRoomUpdate(data: JSONObject) {
        viewModelScope.launch {
            val members = data.getJSONArraySafe("members")?.toStringList() ?: emptyList()
            val status = data.getStringSafe("status")

            Log.d(TAG, "Room update received - Members: ${members.size}, Status: $status")

            _currentRoom.value = _currentRoom.value?.copy(members = members)

            if (members.isNotEmpty()) {
                loadRoomMembers(members)
            }

            if (status == "matched") {
                _groupReady.value = true
                timerJob?.cancel()
                timerGeneration.incrementAndGet()
            }
        }
    }

    private fun handleGroupReady(data: JSONObject) {
        viewModelScope.launch {
            val groupId = data.getStringSafe("groupId")
            val ready = data.getBooleanSafe("ready", false)

            Log.d(TAG, "Group ready: $groupId")

            _groupReady.value = ready
            _groupId.value = groupId

            timerJob?.cancel()
            timerGeneration.incrementAndGet()
        }
    }

    private fun handleRoomExpired(data: JSONObject) {
        viewModelScope.launch {
            Log.d(TAG, "Room expired")

            _roomExpired.value = true
            _errorMessage.value = data.getStringSafe("reason", "Room expired")

            timerJob?.cancel()
            timerGeneration.incrementAndGet()
        }
    }

    private fun handleMemberJoined(data: JSONObject) {
        viewModelScope.launch {
            val userName = data.getStringSafe("userName")
            val userId = data.getStringSafe("userId")
            Log.d(TAG, "Member joined: $userName ($userId)")

            _currentRoom.value?.roomId?.let { roomId ->
                getRoomStatus(roomId, updateTimer = false)
            }
        }
    }

    private fun handleMemberLeft(data: JSONObject) {
        viewModelScope.launch {
            val userId = data.getStringSafe("userId")
            val userName = data.getStringSafe("userName")

            Log.d(TAG, "Member left: $userName")

            _roomMembers.value = _roomMembers.value.filter { it.userId != userId }.toList()

            _currentRoom.value = _currentRoom.value?.copy(
                members = _currentRoom.value?.members?.filter { it != userId } ?: emptyList()
            )
        }
    }


    fun clearLocalRoomState() {
        Log.d("MatchViewModel", "Clearing local room state")
        _currentRoom.value = null
        _roomMembers.value = emptyList()
        _timeRemaining.value = 0L
        _groupReady.value = false
        _groupId.value = null
        _roomExpired.value = false
    }

    fun clearError() {
        _errorMessage.value = null
    }

    fun clearRoomExpired() {
        _roomExpired.value = false
    }

    override fun onCleared() {
        super.onCleared()

        timerJob?.cancel()
        timerGeneration.incrementAndGet()

        socketManager.off("room_update")
        socketManager.off("group_ready")
        socketManager.off("room_expired")
        socketManager.off("member_joined")
        socketManager.off("member_left")

        Log.d(TAG, "ViewModel cleared")
    }

    fun clearLeaveRoomSuccess() {
        _leaveRoomSuccess.value = false
    }
}