package com.example.cpen_321.ui.viewmodels

import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.cpen_321.data.model.Restaurant
import com.example.cpen_321.data.model.SubmitSequentialVoteRequest
import com.example.cpen_321.data.model.VotingRoundStatus
import com.example.cpen_321.data.network.dto.ApiResult
import com.example.cpen_321.data.repository.GroupRepository
import com.example.cpen_321.utils.JsonUtils.getBooleanSafe
import com.example.cpen_321.utils.JsonUtils.getIntSafe
import com.example.cpen_321.utils.JsonUtils.getJSONObjectSafe
import com.example.cpen_321.utils.JsonUtils.getStringSafe
import com.example.cpen_321.utils.SocketManager
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import org.json.JSONObject
import javax.inject.Inject

/**
 * ViewModel for sequential (Tinder-style) voting
 */
@HiltViewModel
class SequentialVotingViewModel @Inject constructor(
    private val groupRepository: GroupRepository,
    private val socketManager: SocketManager
) : ViewModel() {

    companion object {
        private const val TAG = "SequentialVotingVM"
    }

    // Current restaurant being voted on
    private val _currentRestaurant = MutableStateFlow<Restaurant?>(null)
    val currentRestaurant: StateFlow<Restaurant?> = _currentRestaurant.asStateFlow()

    // Current round number
    private val _roundNumber = MutableStateFlow(0)
    val roundNumber: StateFlow<Int> = _roundNumber.asStateFlow()

    // Total rounds
    private val _totalRounds = MutableStateFlow(0)
    val totalRounds: StateFlow<Int> = _totalRounds.asStateFlow()

    // Time remaining in seconds
    private val _timeRemaining = MutableStateFlow(0)
    val timeRemaining: StateFlow<Int> = _timeRemaining.asStateFlow()

    // Yes votes count
    private val _yesVotes = MutableStateFlow(0)
    val yesVotes: StateFlow<Int> = _yesVotes.asStateFlow()

    // No votes count
    private val _noVotes = MutableStateFlow(0)
    val noVotes: StateFlow<Int> = _noVotes.asStateFlow()

    // Total members in group
    private val _totalMembers = MutableStateFlow(0)
    val totalMembers: StateFlow<Int> = _totalMembers.asStateFlow()

    // Current user's vote (null = not voted, true = yes, false = no)
    private val _userVote = MutableStateFlow<Boolean?>(null)
    val userVote: StateFlow<Boolean?> = _userVote.asStateFlow()

    // Selected restaurant (when voting complete)
    private val _selectedRestaurant = MutableStateFlow<Restaurant?>(null)
    val selectedRestaurant: StateFlow<Restaurant?> = _selectedRestaurant.asStateFlow()

    // Voting complete flag
    private val _votingComplete = MutableStateFlow(false)
    val votingComplete: StateFlow<Boolean> = _votingComplete.asStateFlow()

    // Loading state
    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    // Error message
    private val _errorMessage = MutableStateFlow<String?>(null)
    val errorMessage: StateFlow<String?> = _errorMessage.asStateFlow()

    // Success message
    private val _successMessage = MutableStateFlow<String?>(null)
    val successMessage: StateFlow<String?> = _successMessage.asStateFlow()

    // Timer job
    private var timerJob: Job? = null

    init {
        setupSocketListeners()
    }

    private fun setupSocketListeners() {
        // Listen for new voting round
        socketManager.onNewVotingRound { data ->
            handleNewVotingRound(data)
        }

        // Listen for vote updates
        socketManager.onSequentialVoteUpdate { data ->
            handleVoteUpdate(data)
        }

        // Listen for majority reached
        socketManager.onMajorityReached { data ->
            handleMajorityReached(data)
        }

        // Listen for round timeout
        socketManager.onVotingRoundTimeout { data ->
            handleRoundTimeout(data)
        }

        // Listen for restaurant selected (final)
        socketManager.onRestaurantSelected { data ->
            handleRestaurantSelected(data)
        }
    }

    /**
     * Smart initialization - checks if voting is already active before initializing
     * ✅ RECOMMENDED: Use this instead of initializeVoting() to avoid "already initialized" issues
     */
    fun smartInitializeVoting(groupId: String) {
        viewModelScope.launch {
            _isLoading.value = true
            _errorMessage.value = null

            // First, check if there's already an active round
            when (val roundResult = groupRepository.getCurrentVotingRound(groupId)) {
                is ApiResult.Success -> {
                    val status = roundResult.data

                    if (status.hasActiveRound) {
                        // Already initialized and active!
                        Log.d(TAG, "✅ Voting already active, loading current state")

                        // Subscribe to group for real-time updates
                        socketManager.subscribeToGroup(groupId)

                        // Set the state from current round
                        _currentRestaurant.value = status.currentRestaurant
                        _yesVotes.value = status.yesVotes ?: 0
                        _noVotes.value = status.noVotes ?: 0
                        _roundNumber.value = status.roundNumber ?: 0
                        _totalRounds.value = status.totalRounds ?: 0
                        _timeRemaining.value = status.timeRemaining ?: 0

                        // Check if user has voted
                        status.votes?.find {
                            // You'd need to get current userId here
                            // For now, we'll rely on socket updates
                            false
                        }?.let { voteEntry ->
                            _userVote.value = voteEntry.vote
                        }

                        // Start timer
                        startTimer(status.timeRemaining ?: 0)

                        _successMessage.value = "Voting ready"
                        _isLoading.value = false

                        Log.d(TAG, "📊 Loaded active round: ${status.currentRestaurant?.name}, " +
                                "round ${status.roundNumber}/${status.totalRounds}")
                    } else {
                        // Not initialized yet, initialize now
                        Log.d(TAG, "📍 No active round found, initializing voting")
                        initializeVotingInternal(groupId)
                    }
                }
                is ApiResult.Error -> {
                    // Can't check status, try to initialize anyway
                    Log.d(TAG, "⚠️ Couldn't check status (${roundResult.message}), attempting to initialize")
                    initializeVotingInternal(groupId)
                }
                is ApiResult.Loading -> {}
            }
        }
    }

    /**
     * Initialize sequential voting for a group
     * ⚠️ INTERNAL: Use smartInitializeVoting() instead to avoid "already initialized" errors
     */
    @Deprecated("Use smartInitializeVoting() instead", ReplaceWith("smartInitializeVoting(groupId)"))
    fun initializeVoting(groupId: String) {
        initializeVotingInternal(groupId)
    }

    /**
     * Internal initialization - only call this if you know it's not initialized
     */
    private fun initializeVotingInternal(groupId: String) {
        viewModelScope.launch {
            _isLoading.value = true
            _errorMessage.value = null

            when (val result = groupRepository.initializeSequentialVoting(groupId)) {
                is ApiResult.Success -> {
                    val response = result.data
                    if (response.success) {
                        Log.d(TAG, "✅ Voting initialized: ${response.message}")

                        // Subscribe to group for real-time updates
                        socketManager.subscribeToGroup(groupId)

                        // If we got a restaurant in the response, set it
                        response.currentRestaurant?.let { restaurant ->
                            _currentRestaurant.value = restaurant
                            _roundNumber.value = 1
                            Log.d(TAG, "Got restaurant from init: ${restaurant.name}")
                        }

                        // Always load current round details to get full state
                        loadCurrentRound(groupId)

                        _successMessage.value = "Voting ready"
                    } else {
                        _errorMessage.value = response.message
                        Log.e(TAG, "❌ Voting initialization returned success=false: ${response.message}")
                    }
                }
                is ApiResult.Error -> {
                    _errorMessage.value = result.message
                    Log.e(TAG, "❌ Failed to initialize voting: ${result.message}")
                }
                is ApiResult.Loading -> {}
            }

            _isLoading.value = false
        }
    }

    /**
     * Submit a yes/no vote
     */
    fun submitVote(groupId: String, vote: Boolean) {
        viewModelScope.launch {
            _isLoading.value = true
            _errorMessage.value = null

            val request = SubmitSequentialVoteRequest(vote = vote)

            when (val result = groupRepository.submitSequentialVote(groupId, request)) {
                is ApiResult.Success -> {
                    val response = result.data

                    // ✅ CRITICAL FIX: DO NOT set _userVote here!
                    // The WebSocket events will handle updating the state.
                    // Setting it here causes a race condition where we set the vote
                    // AFTER the new_round event has already cleared it.

                    // OLD CODE (REMOVE THIS):
                    // _userVote.value = vote  ← THIS WAS THE BUG!

                    Log.d(TAG, "Vote API response received, majority: ${response.majorityReached}")

                    // The rest is fine - these are handled by the next round
                    if (response.majorityReached) {
                        if (response.result == "yes" && response.selectedRestaurant != null) {
                            // Restaurant accepted!
                            _selectedRestaurant.value = response.selectedRestaurant
                            _votingComplete.value = true
                            _successMessage.value = "Restaurant selected!"
                            stopTimer()
                        }
                        // Note: We don't need to handle the "no" case here
                        // because the new_round WebSocket event will arrive
                    }
                }
                is ApiResult.Error -> {
                    _errorMessage.value = result.message
                    Log.e(TAG, "Failed to submit vote: ${result.message}")
                }
                is ApiResult.Loading -> {}
            }

            _isLoading.value = false
        }
    }

    /**
     * Load current voting round status
     */
    fun loadCurrentRound(groupId: String) {
        viewModelScope.launch {
            when (val result = groupRepository.getCurrentVotingRound(groupId)) {
                is ApiResult.Success -> {
                    val status = result.data

                    if (status.hasActiveRound) {
                        _currentRestaurant.value = status.currentRestaurant
                        _yesVotes.value = status.yesVotes ?: 0
                        _noVotes.value = status.noVotes ?: 0
                        _roundNumber.value = status.roundNumber ?: 0
                        _totalRounds.value = status.totalRounds ?: 0
                        _timeRemaining.value = status.timeRemaining ?: 0

                        // Check if user has voted
                        status.votes?.find {
                            // You'd need to get current userId here
                            // For now, we'll rely on socket updates
                            false
                        }?.let { voteEntry ->
                            _userVote.value = voteEntry.vote
                        }

                        // Start timer
                        startTimer(status.timeRemaining ?: 0)

                        Log.d(TAG, "📊 Loaded round: ${status.currentRestaurant?.name}, " +
                                "round ${status.roundNumber}/${status.totalRounds}, " +
                                "time: ${status.timeRemaining}s")
                    } else {
                        Log.d(TAG, "⚠️ No active round found")
                    }
                }
                is ApiResult.Error -> {
                    _errorMessage.value = result.message
                    Log.e(TAG, "Failed to load current round: ${result.message}")
                }
                is ApiResult.Loading -> {}
            }
        }
    }

    private fun handleNewVotingRound(data: JSONObject) {
        viewModelScope.launch {
            Log.d(TAG, "═══════════════════════════════════")
            Log.d(TAG, "🎯 NEW VOTING ROUND RECEIVED")
            Log.d(TAG, "📦 Full JSON data: $data")
            Log.d(TAG, "🔍 Current state BEFORE reset:")
            Log.d(TAG, "   userVote: ${_userVote.value}")
            Log.d(TAG, "   isLoading: ${_isLoading.value}")
            Log.d(TAG, "   yesVotes: ${_yesVotes.value}")
            Log.d(TAG, "   noVotes: ${_noVotes.value}")

            // ✅ FORCE CLEAR VOTE STATE IMMEDIATELY - before parsing anything
            clearVotingState()

            val restaurantJson = data.getJSONObjectSafe("restaurant")
            val roundNumber = data.getIntSafe("roundNumber")
            val totalRounds = data.getIntSafe("totalRounds")
            val timeoutSeconds = data.getIntSafe("timeoutSeconds")

            restaurantJson?.let { json ->
                val restaurant = Restaurant(
                    restaurantId = json.getStringSafe("restaurantId"),
                    name = json.getStringSafe("name") ?: "",
                    location = json.getStringSafe("location") ?: "",
                    address = json.getStringSafe("address"),
                    priceLevel = json.getIntSafe("priceLevel"),
                    rating = json.optDouble("rating", 0.0),
                    photos = json.optJSONArray("photos")?.let { photosArray ->
                        (0 until photosArray.length()).map { i ->
                            photosArray.getString(i)
                        }
                    },
                    phoneNumber = json.getStringSafe("phoneNumber"),
                    website = json.getStringSafe("website"),
                    url = json.getStringSafe("url")
                )

                _currentRestaurant.value = restaurant
                _roundNumber.value = roundNumber
                _totalRounds.value = totalRounds

                Log.d(TAG, "✅ State after new round setup:")
                Log.d(TAG, "   userVote: ${_userVote.value}")
                Log.d(TAG, "   isLoading: ${_isLoading.value}")
                Log.d(TAG, "   yesVotes: ${_yesVotes.value}")
                Log.d(TAG, "   noVotes: ${_noVotes.value}")
                Log.d(TAG, "   restaurant: ${restaurant.name}")
                Log.d(TAG, "   round: $roundNumber/$totalRounds")

                // Start countdown timer
                startTimer(timeoutSeconds)

                Log.d(TAG, "═══════════════════════════════════")
            } ?: run {
                Log.e(TAG, "❌ ERROR: No restaurant data in new_round event!")
                Log.e(TAG, "Raw data: $data")
            }
        }
    }

    /**
     * ✅ NEW: Helper function to clear all voting state
     */
    private fun clearVotingState() {
        Log.d(TAG, "🧹 Clearing voting state...")
        _userVote.value = null
        _yesVotes.value = 0
        _noVotes.value = 0
        _isLoading.value = false
        Log.d(TAG, "✅ Voting state cleared")
    }

    private fun handleVoteUpdate(data: JSONObject) {
        viewModelScope.launch {
            Log.d(TAG, "🗳️ Vote update received")
            Log.d(TAG, "Current userVote state: ${_userVote.value}")

            val yesVotes = data.getIntSafe("yesVotes")
            val noVotes = data.getIntSafe("noVotes")
            val totalMembers = data.getIntSafe("totalMembers")

            _yesVotes.value = yesVotes
            _noVotes.value = noVotes
            _totalMembers.value = totalMembers

            Log.d(TAG, "Votes: $yesVotes yes, $noVotes no (${yesVotes + noVotes}/$totalMembers)")
            Log.d(TAG, "userVote remains: ${_userVote.value}")
        }
    }

    private fun handleMajorityReached(data: JSONObject) {
        viewModelScope.launch {
            Log.d(TAG, "🎉 Majority reached")

            val result = data.getStringSafe("result") // "yes" or "no"
            val restaurantId = data.getStringSafe("restaurantId")

            if (result == "yes") {
                // Restaurant accepted - wait for restaurant_selected event
                _successMessage.value = "Majority voted YES!"
            } else {
                // Restaurant rejected - will get next restaurant from new_round event
                _successMessage.value = "Moving to next restaurant..."
            }

            stopTimer()
        }
    }

    private fun handleRoundTimeout(data: JSONObject) {
        viewModelScope.launch {
            Log.d(TAG, "⏰ Round timeout")

            _successMessage.value = "Time's up! Moving to next restaurant..."
            stopTimer()
        }
    }

    private fun handleRestaurantSelected(data: JSONObject) {
        viewModelScope.launch {
            Log.d(TAG, "🏆 Restaurant selected (final)")

            val restaurantId = data.getStringSafe("restaurantId")
            val restaurantName = data.getStringSafe("restaurantName")

            val restaurant = Restaurant(
                restaurantId = restaurantId,
                name = restaurantName ?: "",
                location = ""
            )

            _selectedRestaurant.value = restaurant
            _votingComplete.value = true
            stopTimer()

            _successMessage.value = "Restaurant selected: $restaurantName"
        }
    }

    private fun startTimer(initialSeconds: Int) {
        stopTimer()

        timerJob = viewModelScope.launch {
            var remaining = initialSeconds
            _timeRemaining.value = remaining

            while (remaining > 0) {
                delay(1000)
                remaining--
                _timeRemaining.value = remaining
            }

            Log.d(TAG, "Timer expired locally")
        }
    }

    private fun stopTimer() {
        timerJob?.cancel()
        timerJob = null
    }

    /**
     * Clear error message
     */
    fun clearError() {
        _errorMessage.value = null
    }

    /**
     * Clear success message
     */
    fun clearSuccess() {
        _successMessage.value = null
    }

    override fun onCleared() {
        super.onCleared()
        stopTimer()

        // Clean up socket listeners
        socketManager.off("voting:new_round")
        socketManager.off("voting:vote_update")
        socketManager.off("voting:majority_reached")
        socketManager.off("voting:round_timeout")
    }
}