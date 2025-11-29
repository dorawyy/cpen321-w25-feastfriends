package com.example.cpen_321.ui.viewmodels

import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.cpen_321.data.model.CredibilityState
import com.example.cpen_321.data.model.Group
import com.example.cpen_321.data.model.GroupMember
import com.example.cpen_321.data.model.Restaurant
import com.example.cpen_321.data.network.dto.ApiResult
import com.example.cpen_321.data.repository.CredibilityRepository
import com.example.cpen_321.data.repository.GroupRepository
import com.example.cpen_321.data.repository.UserRepository
import com.example.cpen_321.utils.JsonUtils.getIntSafe
import com.example.cpen_321.utils.JsonUtils.getJSONObjectSafe
import com.example.cpen_321.utils.JsonUtils.getStringSafe
import com.example.cpen_321.utils.SocketManager
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import org.json.JSONObject

/** ViewModel for group management and voting */
@HiltViewModel
class GroupViewModel
@Inject
constructor(
    private val groupRepository: GroupRepository,
    private val userRepository: UserRepository,
    private val socketManager: SocketManager,
    private val credibilityRepository: CredibilityRepository
) : ViewModel() {

    // Current group
    private val _currentGroup = MutableStateFlow<Group?>(null)
    val currentGroup: StateFlow<Group?> = _currentGroup.asStateFlow()

    // Group members with details
    private val _groupMembers = MutableStateFlow<List<GroupMember>>(emptyList())
    val groupMembers: StateFlow<List<GroupMember>> = _groupMembers.asStateFlow()

    // Current votes (restaurantId -> vote count)
    private val _currentVotes = MutableStateFlow<Map<String, Int>>(emptyMap())
    val currentVotes: StateFlow<Map<String, Int>> = _currentVotes.asStateFlow()

    // Selected restaurant (after voting)
    private val _selectedRestaurant = MutableStateFlow<Restaurant?>(null)
    val selectedRestaurant: StateFlow<Restaurant?> = _selectedRestaurant.asStateFlow()

    // User's vote
    private val _userVote = MutableStateFlow<String?>(null)
    val userVote: StateFlow<String?> = _userVote.asStateFlow()

    // Time remaining in milliseconds
    private val _timeRemaining = MutableStateFlow<Long>(0L)
    val timeRemaining: StateFlow<Long> = _timeRemaining.asStateFlow()

    // Credibility state
    private val _credibilityState = MutableStateFlow(CredibilityState())
    val credibilityState: StateFlow<CredibilityState> = _credibilityState.asStateFlow()

    // ✅ NEW: Track if user has successfully verified a code in this group
    private val _hasVerifiedCode = MutableStateFlow(false)
    val hasVerifiedCode: StateFlow<Boolean> = _hasVerifiedCode.asStateFlow()

    // Loading state
    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    // Error message
    private val _errorMessage = MutableStateFlow<String?>(null)
    val errorMessage: StateFlow<String?> = _errorMessage.asStateFlow()

    // Success message
    private val _successMessage = MutableStateFlow<String?>(null)
    val successMessage: StateFlow<String?> = _successMessage.asStateFlow()

    init {
        setupSocketListeners()
    }

    private fun setupSocketListeners() {
        socketManager.onVoteUpdate { data -> handleVoteUpdate(data) }
        socketManager.onRestaurantSelected { data -> handleRestaurantSelected(data) }
        socketManager.onMemberLeft { data -> handleMemberLeft(data) }
    }

    /** Load group status - handles 404 "Not in a group" as a normal state */
    fun loadGroupStatus() {
        viewModelScope.launch {
            _isLoading.value = true
            _errorMessage.value = null

            when (val result = groupRepository.getGroupStatus()) {
                is ApiResult.Success -> {
                    val group = result.data
                    _currentGroup.value = group

                    // ✅ NEW: Reset verification state when loading a new group
                    _hasVerifiedCode.value = false

                    // Subscribe to group updates via socket
                    group.groupId?.let { groupId -> socketManager.subscribeToGroup(groupId) }

                    // Load group members
                    loadGroupMembers(group.getAllMembers())

                    // Update votes
                    _currentVotes.value = group.restaurantVotes ?: emptyMap()

                    // Update selected restaurant
                    _selectedRestaurant.value = group.restaurant

                    // Calculate time remaining
                    _timeRemaining.value = group.completionTime - System.currentTimeMillis()

                    // Generate credibility code when user is in a group
                    generateCredibilityCode()
                }
                is ApiResult.Error -> {
                    // Check if this is a 404 "not in group" error
                    if (result.code == 404 &&
                        result.message.contains("not in a group", ignoreCase = true)
                    ) {
                        // User is not in a group - this is a normal state, not an error
                        _currentGroup.value = null
                        clearGroupState()
                    } else {
                        // This is an actual error
                        _errorMessage.value = result.message
                    }
                }
                is ApiResult.Loading -> {}
            }

            _isLoading.value = false
        }
    }

    /** Generate credibility code */
    fun generateCredibilityCode() {
        viewModelScope.launch {
            when (val result = credibilityRepository.generateCode()) {
                is ApiResult.Success -> {
                    val codeData = result.data
                    _credibilityState.value = CredibilityState(
                        hasActiveCode = true,
                        currentCode = codeData.code,
                        codeExpiresAt = codeData.expiresAt
                    )
                    Log.d("CredibilityDebug", "Generated code: ${codeData.code}")
                }
                is ApiResult.Error -> {
                    Log.e("CredibilityDebug", "Failed to generate code: ${result.message}")
                    // Don't show error to user, it's optional
                }
                is ApiResult.Loading -> {}
            }
        }
    }

    /**
     * Verify credibility code - WITH BETTER ERROR HANDLING
     */
    fun verifyCredibilityCode(code: String) {
        viewModelScope.launch {
            // Check if user is trying to enter their own code
            if (code.uppercase() == _credibilityState.value.currentCode) {
                _errorMessage.value = "You cannot verify your own code."
                return@launch
            }

            _isLoading.value = true

            when (val result = credibilityRepository.verifyCode(code)) {
                is ApiResult.Success -> {
                    val response = result.data
                    _successMessage.value = response.message
                    Log.d("CredibilityDebug", "Code verified successfully")

                    // ✅ NEW: Mark that user has successfully verified a code
                    _hasVerifiedCode.value = true

                    // Refresh user settings to update credibility score
                    userRepository.getUserSettings()
                }
                is ApiResult.Error -> {
                    // ✅ IMPROVED: Show user-friendly error message
                    val friendlyMessage = when {
                        result.message.contains("not valid", ignoreCase = true) ||
                                result.message.contains("Invalid", ignoreCase = true) ->
                            "This code is not valid. Please check and try again."

                        result.message.contains("expired", ignoreCase = true) ->
                            "This code has expired. Please ask for a new code."

                        result.message.contains("already verified", ignoreCase = true) ->
                            "You have already verified this code."

                        result.message.contains("own code", ignoreCase = true) ->
                            "You cannot verify your own code."

                        else -> result.message
                    }

                    _errorMessage.value = friendlyMessage
                    Log.e("CredibilityDebug", "Verification failed: ${result.message}")
                }
                is ApiResult.Loading -> {}
            }

            _isLoading.value = false
        }
    }

    /**
     * Leave current group
     */
    fun leaveGroup(onSuccess: () -> Unit) {
        viewModelScope.launch {
            val groupId = _currentGroup.value?.groupId
            if (groupId == null) {
                Log.e("LeaveDebug", "groupId is NULL")
                return@launch
            }

            _isLoading.value = true

            // First check if code needs deduction
            val shouldDeduct = _credibilityState.value.hasActiveCode

            // Deduct score if code wasn't verified
            if (shouldDeduct) {
                when (val deductResult = credibilityRepository.deductScore()) {
                    is ApiResult.Success -> {
                        val response = deductResult.data
                        Log.d("CredibilityDebug", "Score deducted: ${response.scoreDeducted}")
                        if (response.scoreDeducted > 0) {
                            _successMessage.value = response.message
                        }

                        // Refresh user settings to update credibility score
                        userRepository.getUserSettings()
                    }
                    is ApiResult.Error -> {
                        Log.e("CredibilityDebug", "Failed to deduct score: ${deductResult.message}")
                        // Continue with leaving even if deduction fails
                    }
                    is ApiResult.Loading -> {}
                }
            }

            // Now leave the group
            when (val result = groupRepository.leaveGroup(groupId)) {
                is ApiResult.Success -> {
                    socketManager.unsubscribeFromGroup(groupId)
                    clearGroupState()
                    _successMessage.value = "Left group successfully"
                    onSuccess()
                }
                is ApiResult.Error -> {
                    _errorMessage.value = result.message
                }
                is ApiResult.Loading -> {}
            }

            _isLoading.value = false
        }
    }

    /** Vote for a restaurant */
    fun voteForRestaurant(restaurantId: String, restaurant: Restaurant) {
        viewModelScope.launch {
            val groupId = _currentGroup.value?.groupId
            if (groupId == null) {
                Log.e("VoteDebug", "ERROR: groupId is null!")
                return@launch
            }

            _isLoading.value = true
            _errorMessage.value = null

            when (val result = groupRepository.voteForRestaurant(groupId, restaurantId, restaurant)) {
                is ApiResult.Success -> {
                    Log.d("VoteDebug", "✅ Vote API Success")
                    Log.d("VoteDebug", "Returned votes: ${result.data}")

                    // Update votes immediately
                    _currentVotes.value = result.data.toMap()
                    _userVote.value = restaurantId
                    _successMessage.value = "Vote submitted successfully"
                }
                is ApiResult.Error -> {
                    Log.e("VoteDebug", "❌ Vote API Error: ${result.message}")
                    _errorMessage.value = result.message
                }
                is ApiResult.Loading -> {}
            }

            _isLoading.value = false
        }
    }

    /** Subscribe to group socket channel */
    fun subscribeToGroup(groupId: String) {
        Log.d("SocketDebug", "=== SUBSCRIBING TO GROUP ===")
        Log.d("SocketDebug", "groupId: $groupId")
        Log.d("SocketDebug", "Socket connected: ${socketManager.isConnected()}")

        val userId = _currentGroup.value?.members?.firstOrNull()
        socketManager.subscribeToGroup(groupId, userId)
        Log.d("SocketDebug", "Subscription command sent with userId: $userId")
    }

    /** Unsubscribe from group socket channel */
    fun unsubscribeFromGroup(groupId: String) {
        val userId = _currentGroup.value?.members?.firstOrNull()
        socketManager.unsubscribeFromGroup(groupId, userId)
    }

    private fun loadGroupMembers(memberIds: List<String>) {
        viewModelScope.launch {
            if (memberIds.isEmpty()) {
                Log.e("LoadDebug", "memberIds is empty")
                return@launch
            }

            when (val result = userRepository.getUserProfiles(memberIds)) {
                is ApiResult.Success -> {
                    val profiles = result.data
                    val votes = _currentGroup.value?.votes ?: emptyMap()

                    val members = profiles.map { profile ->
                        GroupMember(
                            userId = profile.userId,
                            name = profile.name,
                            credibilityScore = profile.credibilityScore,
                            phoneNumber = profile.contactNumber,
                            profilePicture = profile.profilePicture,
                            hasVoted = votes.containsKey(profile.userId)
                        )
                    }

                    _groupMembers.value = members
                }
                is ApiResult.Error -> {}
                is ApiResult.Loading -> {}
            }
        }
    }

    private fun handleVoteUpdate(data: JSONObject) {
        Log.d("SocketDebug", "🔔 VOTE_UPDATE EVENT RECEIVED")
        Log.d("SocketDebug", "Raw data: $data")

        viewModelScope.launch {
            val restaurantId = data.getStringSafe("restaurantId")
            val votes = data.getJSONObjectSafe("votes")

            Log.d("SocketDebug", "restaurantId: $restaurantId")
            Log.d("SocketDebug", "votes JSON: $votes")

            votes?.let { votesJson ->
                val votesMap = mutableMapOf<String, Int>()
                votesJson.keys().forEach { key ->
                    val keyStr = key.toString()
                    val count = votesJson.getIntSafe(keyStr)
                    votesMap[keyStr] = count
                    Log.d("SocketDebug", "Vote: $keyStr -> $count")
                }

                Log.d("SocketDebug", "Setting votes: $votesMap")
                _currentVotes.value = votesMap.toMap()
                Log.d("SocketDebug", "Votes updated. Current: ${_currentVotes.value}")
            }

            updateMemberVoteStatus()
        }
    }

    private fun handleRestaurantSelected(data: JSONObject) {
        viewModelScope.launch {
            Log.d("GroupViewModel", "═══════════════════════════════════")
            Log.d("GroupViewModel", "🎉 RESTAURANT_SELECTED EVENT RECEIVED!")
            Log.d("GroupViewModel", "Raw data: $data")

            val restaurantId = data.getStringSafe("restaurantId")
            val restaurantName = data.getStringSafe("restaurantName")
            val votes = data.getJSONObjectSafe("votes")

            Log.d("GroupViewModel", "restaurantId: $restaurantId")
            Log.d("GroupViewModel", "restaurantName: $restaurantName")
            Log.d("GroupViewModel", "votes: $votes")

            val restaurant = Restaurant(
                restaurantId = restaurantId,
                name = restaurantName,
                location = ""
            )

            Log.d("GroupViewModel", "🏪 Created restaurant object: $restaurant")
            Log.d("GroupViewModel", "⬆️ Setting _selectedRestaurant.value...")

            _selectedRestaurant.value = restaurant

            Log.d("GroupViewModel", "✅ _selectedRestaurant.value SET!")
            Log.d("GroupViewModel", "Current value: ${_selectedRestaurant.value}")

            _currentGroup.value = _currentGroup.value?.copy(
                restaurantSelected = true,
                restaurant = restaurant
            )

            _successMessage.value = "Restaurant selected: $restaurantName"
            Log.d("GroupViewModel", "═══════════════════════════════════")
        }
    }

    private fun handleMemberLeft(data: JSONObject) {
        viewModelScope.launch {
            val userId = data.getStringSafe("userId")
            _groupMembers.value = _groupMembers.value.filter { it.userId != userId }
            _currentGroup.value = _currentGroup.value?.copy(numMembers = _groupMembers.value.size)
        }
    }

    private fun updateMemberVoteStatus() {
        val votes = _currentGroup.value?.votes ?: emptyMap()
        _groupMembers.value = _groupMembers.value.map { member ->
            member.copy(hasVoted = votes.containsKey(member.userId))
        }
    }

    private fun clearGroupState() {
        _currentGroup.value = null
        _groupMembers.value = emptyList()
        _currentVotes.value = emptyMap()
        _selectedRestaurant.value = null
        _userVote.value = null
        _timeRemaining.value = 0L
        _credibilityState.value = CredibilityState()
        _hasVerifiedCode.value = false
    }

    /** Clear error message */
    fun clearError() {
        _errorMessage.value = null
    }

    /** Clear success message */
    fun clearSuccess() {
        _successMessage.value = null
    }

    override fun onCleared() {
        super.onCleared()
        socketManager.off("vote_update")
        socketManager.off("restaurant_selected")
        socketManager.off("member_left")
    }
}