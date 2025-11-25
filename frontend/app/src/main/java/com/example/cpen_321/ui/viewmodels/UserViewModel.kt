package com.example.cpen_321.ui.viewmodels

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.cpen_321.data.local.PreferencesManager
import com.example.cpen_321.data.model.UserProfile
import com.example.cpen_321.data.model.UserSettings
import com.example.cpen_321.data.network.dto.ApiResult
import com.example.cpen_321.data.repository.UserRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * ViewModel for user profile and settings
 */
@HiltViewModel
class UserViewModel @Inject constructor(
    private val userRepository: UserRepository,
    private val preferencesManager: PreferencesManager
) : ViewModel() {

    // User settings
    private val _userSettings = MutableStateFlow<UserSettings?>(null)
    val userSettings: StateFlow<UserSettings?> = _userSettings.asStateFlow()

    // User profile
    private val _userProfile = MutableStateFlow<UserProfile?>(null)
    val userProfile: StateFlow<UserProfile?> = _userProfile.asStateFlow()

    // Loading state
    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    // Error message
    private val _errorMessage = MutableStateFlow<String?>(null)
    val errorMessage: StateFlow<String?> = _errorMessage.asStateFlow()

    // Success message
    private val _successMessage = MutableStateFlow<String?>(null)
    val successMessage: StateFlow<String?> = _successMessage.asStateFlow()

    // Selected cuisines
    private val _selectedCuisines = MutableStateFlow<Set<String>>(emptySet())
    val selectedCuisines: StateFlow<Set<String>> = _selectedCuisines.asStateFlow()

    // Budget
    private val _budget = MutableStateFlow(50.0)
    val budget: StateFlow<Double> = _budget.asStateFlow()

    // Radius
    private val _radius = MutableStateFlow(5.0)
    val radius: StateFlow<Double> = _radius.asStateFlow()

    // Original values for change tracking
    private var originalCuisines: Set<String> = emptySet()
    private var originalBudget: Double = 50.0
    private var originalRadius: Double = 5.0

    // Check if there are unsaved changes
    private val _hasUnsavedChanges = MutableStateFlow(false)
    val hasUnsavedChanges: StateFlow<Boolean> = _hasUnsavedChanges.asStateFlow()
    
    private fun updateHasUnsavedChanges() {
        _hasUnsavedChanges.value = _selectedCuisines.value != originalCuisines ||
                                   _budget.value != originalBudget ||
                                   _radius.value != originalRadius
    }

    init {
        loadLocalPreferences()
    }


    private fun loadLocalPreferences() {
        val cuisines = preferencesManager.getCuisines()
        val budget = preferencesManager.getBudget().coerceAtLeast(5.0)
        val radius = preferencesManager.getRadius()
        
        _selectedCuisines.value = cuisines
        _budget.value = budget
        _radius.value = radius
        
        // Initialize original values from local preferences
        originalCuisines = cuisines
        originalBudget = budget
        originalRadius = radius
        
        updateHasUnsavedChanges()
    }

    /**
     * Load user settings from backend
     */
    fun loadUserSettings() {
        viewModelScope.launch {
            _isLoading.value = true
            _errorMessage.value = null

            when (val result = userRepository.getUserSettings()) {
                is ApiResult.Success -> {
                    _userSettings.value = result.data

                    // Update local state
                    val cuisines = result.data.preference.toSet()
                    val budget = result.data.budget.coerceAtLeast(5.0)
                    val radius = result.data.radiusKm
                    
                    _selectedCuisines.value = cuisines
                    _budget.value = budget
                    _radius.value = radius
                    
                    // Save original values for change tracking
                    originalCuisines = cuisines
                    originalBudget = budget
                    originalRadius = radius
                    
                    updateHasUnsavedChanges()
                }
                is ApiResult.Error -> {
                    _errorMessage.value = result.message
                }
                is ApiResult.Loading -> {
                    // Already handled
                }
            }

            _isLoading.value = false
        }
    }

    /**
     * Load user profiles by IDs
     */
    fun loadUserProfiles(userIds: List<String>) {
        viewModelScope.launch {
            when (val result = userRepository.getUserProfiles(userIds)) {
                is ApiResult.Success -> {
                    // Handle profiles if needed
                }
                is ApiResult.Error -> {
                    _errorMessage.value = result.message
                }
                is ApiResult.Loading -> {
                    // Ignore
                }
            }
        }
    }

    /**
     * Get a single user profile by ID
     * Returns the profile or null if not found/error
     */
    suspend fun getUserProfile(userId: String): UserProfile? {
        return when (val result = userRepository.getUserProfiles(listOf(userId))) {
            is ApiResult.Success -> {
                result.data.firstOrNull()
            }
            is ApiResult.Error -> {
                _errorMessage.value = result.message
                null
            }
            is ApiResult.Loading -> {
                null
            }
        }
    }

    /**
     * Update user profile
     */
    fun updateProfile(
        name: String? = null,
        bio: String? = null,
        profilePicture: String? = null,
        contactNumber: String? = null
    ) {
        viewModelScope.launch {
            _isLoading.value = true
            _errorMessage.value = null

            when (val result = userRepository.updateUserProfile(
                name = name,
                bio = bio,
                profilePicture = profilePicture,
                contactNumber = contactNumber
            )) {
                is ApiResult.Success -> {
                    _userProfile.value = result.data
                    _successMessage.value = "Profile updated successfully"
                    // Reload user settings to update the UI
                    loadUserSettings()
                }
                is ApiResult.Error -> {
                    _errorMessage.value = result.message
                }
                is ApiResult.Loading -> {
                    // Already handled
                }
            }

            _isLoading.value = false
        }
    }

    /**
     * Update user settings
     */
    fun updateSettings(
        name: String? = null,
        bio: String? = null,
        preference: List<String>? = null,
        profilePicture: String? = null,
        contactNumber: String? = null,
        budget: Double? = null,
        radiusKm: Double? = null
    ) {
        viewModelScope.launch {
            _isLoading.value = true
            _errorMessage.value = null

            when (val result = userRepository.updateUserSettings(
                name = name,
                bio = bio,
                preference = preference,
                profilePicture = profilePicture,
                contactNumber = contactNumber,
                budget = budget,
                radiusKm = radiusKm
            )) {
                is ApiResult.Success -> {
                    _userSettings.value = result.data
                    _successMessage.value = "Settings updated successfully"

                    // Update local state
                    val cuisines = result.data.preference.toSet()
                    val budget = result.data.budget.coerceAtLeast(5.0)
                    val radius = result.data.radiusKm
                    
                    _selectedCuisines.value = cuisines
                    _budget.value = budget
                    _radius.value = radius
                    
                    // Update original values after successful save
                    originalCuisines = cuisines
                    originalBudget = budget
                    originalRadius = radius
                    
                    updateHasUnsavedChanges()
                }
                is ApiResult.Error -> {
                    _errorMessage.value = result.message
                }
                is ApiResult.Loading -> {
                    // Already handled
                }
            }

            _isLoading.value = false
        }
    }

    /**
     * Toggle cuisine selection
     */
    fun toggleCuisine(cuisine: String) {
        val currentCuisines = _selectedCuisines.value.toMutableSet()
        if (currentCuisines.contains(cuisine)) {
            currentCuisines.remove(cuisine)
        } else {
            currentCuisines.add(cuisine)
        }
        _selectedCuisines.value = currentCuisines

        // Save to local preferences
        preferencesManager.saveCuisines(currentCuisines)
        updateHasUnsavedChanges()
    }

    /**
     * Update budget
     */
    fun updateBudget(newBudget: Double) {
        // Ensure budget is at least $5
        val validatedBudget = newBudget.coerceAtLeast(5.0)
        _budget.value = validatedBudget
        preferencesManager.saveBudget(validatedBudget)
        updateHasUnsavedChanges()
    }

    /**
     * Update radius
     */
    fun updateRadius(newRadius: Double) {
        _radius.value = newRadius
        preferencesManager.saveRadius(newRadius)
        updateHasUnsavedChanges()
    }

    /**
     * Save preferences (cuisines, budget, radius)
     * FIXED: Now includes existing user data to avoid validation errors
     */
    fun savePreferences() {
        val currentSettings = _userSettings.value

        updateSettings(
            // Include existing data to avoid backend validation errors
            name = currentSettings?.name,
            bio = currentSettings?.bio,
            profilePicture = currentSettings?.profilePicture,
            contactNumber = currentSettings?.contactNumber,
            // New preference data
            preference = _selectedCuisines.value.toList(),
            budget = _budget.value,
            radiusKm = _radius.value
        )
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
}