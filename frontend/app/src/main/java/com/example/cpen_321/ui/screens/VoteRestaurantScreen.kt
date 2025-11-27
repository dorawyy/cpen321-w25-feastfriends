package com.example.cpen_321.ui.screens

import android.Manifest
import android.annotation.SuppressLint
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Star
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.NavController
import coil.compose.AsyncImage
import com.example.cpen_321.data.model.Restaurant
import com.example.cpen_321.ui.viewmodels.GroupViewModel
import com.example.cpen_321.ui.viewmodels.RestaurantViewModel
import com.example.cpen_321.utils.LocationHelper
import kotlinx.coroutines.launch
import android.util.Log

import com.example.cpen_321.ui.theme.*

@SuppressLint("MissingPermission")
@Composable
fun VoteRestaurantScreen(
    navController: NavController,
    groupId: String? = null,
    groupViewModel: GroupViewModel = hiltViewModel(),
    restaurantViewModel: RestaurantViewModel = hiltViewModel()
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val snackbarHostState = remember { SnackbarHostState() }

    var selectedRestaurantForVote by remember { mutableStateOf<Restaurant?>(null) }
    var userLocation by remember { mutableStateOf<Pair<Double, Double>?>(null) }
    var locationPermissionGranted by remember { mutableStateOf(false) }
    var isGettingLocation by remember { mutableStateOf(false) }

    // ✅ Location permission launcher using LocationHelper
    val locationPermissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        Log.d("LocationDebug", "=== PERMISSION RESULT ===")
        Log.d("LocationDebug", "Permissions: $permissions")

        val granted = permissions[Manifest.permission.ACCESS_FINE_LOCATION] == true ||
                permissions[Manifest.permission.ACCESS_COARSE_LOCATION] == true

        Log.d("LocationDebug", "Permission granted: $granted")
        locationPermissionGranted = granted

        if (granted) {
            // Get fresh location immediately after permission is granted
            scope.launch {
                isGettingLocation = true
                try {
                    val location = LocationHelper.getCurrentLocation(context)
                    if (location != null) {
                        Log.d("LocationDebug", "✅ Fresh location: ${location.first}, ${location.second}")
                        userLocation = location
                    } else {
                        Log.e("LocationDebug", "❌ Could not get fresh location")
                        scope.launch {
                            snackbarHostState.showSnackbar("Unable to get your current location. Please check GPS settings.")
                        }
                    }
                } catch (e: Exception) {
                    Log.e("LocationDebug", "Exception getting location", e)
                    scope.launch {
                        snackbarHostState.showSnackbar("Location error: ${e.message}")
                    }
                } finally {
                    isGettingLocation = false
                }
            }
        }
    }

    VoteScreenEffects(
        groupViewModel = groupViewModel,
        restaurantViewModel = restaurantViewModel,
        navController = navController,
        snackbarHostState = snackbarHostState,
        userLocation = userLocation,
        locationPermissionLauncher = locationPermissionLauncher,
        locationPermissionGranted = locationPermissionGranted,
        isGettingLocation = isGettingLocation,
        onLocationUpdate = { userLocation = it },
        onLocationLoadingUpdate = { isGettingLocation = it },
        onPermissionUpdate = { locationPermissionGranted = it }
    )

    VoteScreenContent(
        groupViewModel = groupViewModel,
        restaurantViewModel = restaurantViewModel,
        snackbarHostState = snackbarHostState,
        selectedRestaurantForVote = selectedRestaurantForVote,
        userLocation = userLocation,
        locationPermissionGranted = locationPermissionGranted,
        isGettingLocation = isGettingLocation,
        locationPermissionLauncher = locationPermissionLauncher,
        onRestaurantSelected = { selectedRestaurantForVote = it },
        onVoteSubmitted = { selectedRestaurantForVote = null }
    )
}

@Composable
private fun VoteScreenEffects(
    groupViewModel: GroupViewModel,
    restaurantViewModel: RestaurantViewModel,
    navController: NavController,
    snackbarHostState: SnackbarHostState,
    userLocation: Pair<Double, Double>?,
    locationPermissionLauncher: androidx.activity.result.ActivityResultLauncher<Array<String>>,
    locationPermissionGranted: Boolean,
    isGettingLocation: Boolean,
    onLocationUpdate: (Pair<Double, Double>?) -> Unit,
    onLocationLoadingUpdate: (Boolean) -> Unit,
    onPermissionUpdate: (Boolean) -> Unit
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val currentGroup by groupViewModel.currentGroup.collectAsState()
    val selectedRestaurant by groupViewModel.selectedRestaurant.collectAsState()
    val restaurantError by restaurantViewModel.errorMessage.collectAsState()

    // ✅ FIXED: Use callback functions for state updates
    LaunchedEffect(Unit) {
        groupViewModel.loadGroupStatus()

        val hasPermission = LocationHelper.hasLocationPermission(context)
        onPermissionUpdate(hasPermission)

        if (hasPermission) {
            Log.d("LocationDebug", "Permission already granted, getting fresh location...")
            onLocationLoadingUpdate(true)
            try {
                val location = LocationHelper.getCurrentLocation(context)
                if (location != null) {
                    Log.d("LocationDebug", "✅ Got fresh location on startup: ${location.first}, ${location.second}")
                    onLocationUpdate(location)
                } else {
                    Log.e("LocationDebug", "❌ Could not get location on startup")
                }
            } catch (e: Exception) {
                Log.e("LocationDebug", "Exception getting location on startup", e)
            } finally {
                onLocationLoadingUpdate(false)
            }
        } else {
            Log.d("LocationDebug", "Requesting location permission...")
            locationPermissionLauncher.launch(
                arrayOf(
                    Manifest.permission.ACCESS_FINE_LOCATION,
                    Manifest.permission.ACCESS_COARSE_LOCATION
                )
            )
        }
    }

    LaunchedEffect(currentGroup) {
        currentGroup?.groupId?.let { gId ->
            groupViewModel.subscribeToGroup(gId)
        }
    }

    DisposableEffect(Unit) {
        onDispose {
            currentGroup?.groupId?.let { gId ->
                groupViewModel.unsubscribeFromGroup(gId)
            }
        }
    }

    // ✅ Search restaurants when location is available
    LaunchedEffect(userLocation, currentGroup) {
        val group = currentGroup

        if (userLocation != null && group != null) {
            val (latitude, longitude) = userLocation

            Log.d("VoteDebug", "=== SEARCHING RESTAURANTS WITH FRESH LOCATION ===")
            Log.d("VoteDebug", "Current location: $latitude, $longitude")

            // Use the GROUP's cuisine preference (from the room)
            val cuisineTypes = group.cuisines ?: emptyList()
            val radius = ((group.averageRadius ?: 5.0) * 1000).toInt() // Convert km to meters

            Log.d("VoteDebug", "Group's cuisines: $cuisineTypes")
            Log.d("VoteDebug", "Group's budget: ${group.averageBudget}")
            Log.d("VoteDebug", "Group's radius: ${group.averageRadius} km")

            restaurantViewModel.searchRestaurants(
                latitude = latitude,
                longitude = longitude,
                radius = radius,
                cuisineTypes = cuisineTypes,
                priceLevel = null
            )
        }
    }

    LaunchedEffect(selectedRestaurant) {
        selectedRestaurant?.let { restaurant ->
            try {
                snackbarHostState.showSnackbar("${restaurant.name} has been selected!")
                kotlinx.coroutines.delay(1500)
                navController.navigate("group") {
                    popUpTo(0)
                }
            } catch (e: Exception) {
                Log.e("VoteRestaurantScreen", "Navigation error", e)
            }
        }
    }

    LaunchedEffect(restaurantError) {
        restaurantError?.let { message ->
            snackbarHostState.showSnackbar(message)
            restaurantViewModel.clearError()
        }
    }
}

@Composable
private fun VoteScreenContent(
    groupViewModel: GroupViewModel,
    restaurantViewModel: RestaurantViewModel,
    snackbarHostState: SnackbarHostState,
    selectedRestaurantForVote: Restaurant?,
    userLocation: Pair<Double, Double>?,
    locationPermissionGranted: Boolean,
    isGettingLocation: Boolean,
    locationPermissionLauncher: androidx.activity.result.ActivityResultLauncher<Array<String>>,
    onRestaurantSelected: (Restaurant?) -> Unit,
    onVoteSubmitted: () -> Unit
) {
    Scaffold(
        snackbarHost = { 
            SnackbarHost(hostState = snackbarHostState) { data ->
                Snackbar(
                    snackbarData = data,
                    containerColor = VividPurple,
                    contentColor = Color.White
                )
            }
        }
    ) { innerPadding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .background(
                    Brush.verticalGradient(
                        colors = listOf(
                            GradientTop,
                            GradientMiddle,
                            GradientBottom
                        )
                    )
                )
        ) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(16.dp)
            ) {
                VoteScreenHeader()
                VoteStatusCard(groupViewModel)
                VoteScreenBody(
                    groupViewModel = groupViewModel,
                    restaurantViewModel = restaurantViewModel,
                    selectedRestaurantForVote = selectedRestaurantForVote,
                    userLocation = userLocation,
                    locationPermissionGranted = locationPermissionGranted,
                    isGettingLocation = isGettingLocation,
                    locationPermissionLauncher = locationPermissionLauncher,
                    onRestaurantSelected = onRestaurantSelected,
                    onVoteSubmitted = onVoteSubmitted
                )
            }
        }
    }
}

@Composable
private fun VoteScreenHeader() {
    Text(
        text = "Vote for Restaurant",
        fontSize = 24.sp,
        fontWeight = FontWeight.Bold,
        color = TextPrimary,
        modifier = Modifier.padding(bottom = 8.dp)
    )
}

@Composable
private fun VoteStatusCard(groupViewModel: GroupViewModel) {
    val currentGroup by groupViewModel.currentGroup.collectAsState()
    val currentVotes by groupViewModel.currentVotes.collectAsState()
    val userVote by groupViewModel.userVote.collectAsState()

    currentGroup?.let { group ->
        Card(
            modifier = Modifier
                .fillMaxWidth()
                .padding(bottom = 16.dp),
            colors = CardDefaults.cardColors(
                containerColor = GlassWhite
            )
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text(
                        text = "Group: ${group.groupId?.take(8) ?: ""}",
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Medium
                    )
                    Text(
                        text = "${currentVotes.values.sum()}/${group.numMembers} voted",
                        fontSize = 14.sp,
                        color = if (currentVotes.values.sum() == group.numMembers)
                            VividPurple else TextPrimary.copy(alpha = 0.7f)
                    )
                }

                if (userVote != null) {
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = "✓ You have voted",
                        fontSize = 14.sp,
                        color = VividPurple,
                        fontWeight = FontWeight.Bold
                    )
                }
            }
        }
    }
}

@Composable
private fun VoteScreenBody(
    groupViewModel: GroupViewModel,
    restaurantViewModel: RestaurantViewModel,
    selectedRestaurantForVote: Restaurant?,
    userLocation: Pair<Double, Double>?,
    locationPermissionGranted: Boolean,
    isGettingLocation: Boolean,
    locationPermissionLauncher: androidx.activity.result.ActivityResultLauncher<Array<String>>,
    onRestaurantSelected: (Restaurant?) -> Unit,
    onVoteSubmitted: () -> Unit
) {
    val restaurants by restaurantViewModel.restaurants.collectAsState()
    val isLoadingRestaurants by restaurantViewModel.isLoading.collectAsState()

    when {
        isLoadingRestaurants -> LoadingState("Loading restaurants...")
        isGettingLocation || userLocation == null -> LocationLoadingState(
            locationPermissionGranted = locationPermissionGranted,
            isGettingLocation = isGettingLocation,
            locationPermissionLauncher = locationPermissionLauncher
        )
        restaurants.isEmpty() -> EmptyRestaurantsState(restaurantViewModel, userLocation)
        else -> RestaurantListWithVoteButton(
            restaurants = restaurants,
            selectedRestaurantForVote = selectedRestaurantForVote,
            groupViewModel = groupViewModel,
            onRestaurantSelected = onRestaurantSelected,
            onVoteSubmitted = onVoteSubmitted
        )
    }
}

@Composable
private fun LoadingState(message: String = "Loading...", modifier: Modifier = Modifier) {
    Box(
        modifier = modifier.fillMaxWidth(),
        contentAlignment = Alignment.Center
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            CircularProgressIndicator()
            Spacer(modifier = Modifier.height(16.dp))
            Text(
                text = message,
                fontSize = 16.sp,
                color = TextPrimary.copy(alpha = 0.7f)
            )
        }
    }
}

@Composable
private fun LocationLoadingState(
    locationPermissionGranted: Boolean,
    isGettingLocation: Boolean,
    locationPermissionLauncher: androidx.activity.result.ActivityResultLauncher<Array<String>>
) {
    Box(
        modifier = Modifier.fillMaxWidth(),
        contentAlignment = Alignment.Center
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            CircularProgressIndicator(color = VividPurple)
            Spacer(modifier = Modifier.height(16.dp))
            Text(
                text = if (isGettingLocation) "Getting your current location..." else "Waiting for location...",
                fontSize = 16.sp,
                color = TextPrimary.copy(alpha = 0.7f)
            )
            if (!locationPermissionGranted) {
                Spacer(modifier = Modifier.height(8.dp))
                Button(
                    onClick = {
                        locationPermissionLauncher.launch(
                            arrayOf(
                                Manifest.permission.ACCESS_FINE_LOCATION,
                                Manifest.permission.ACCESS_COARSE_LOCATION
                            )
                        )
                    }
                ) {
                    Text("Grant Location Permission")
                }
            }
        }
    }
}

@Composable
private fun EmptyRestaurantsState(
    restaurantViewModel: RestaurantViewModel,
    userLocation: Pair<Double, Double>?
) {
    Box(
        modifier = Modifier.fillMaxWidth(),
        contentAlignment = Alignment.Center
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(
                text = "No restaurants found nearby",
                fontSize = 16.sp,
                color = TextPrimary.copy(alpha = 0.7f)
            )
            Spacer(modifier = Modifier.height(8.dp))
            Button(
                onClick = {
                    userLocation?.let { (lat, lon) ->
                        restaurantViewModel.searchRestaurants(
                            latitude = lat,
                            longitude = lon,
                            radius = 5000
                        )
                    }
                }
            ) {
                Text("Retry")
            }
        }
    }
}

@Composable
private fun RestaurantListWithVoteButton(
    restaurants: List<Restaurant>,
    selectedRestaurantForVote: Restaurant?,
    groupViewModel: GroupViewModel,
    onRestaurantSelected: (Restaurant?) -> Unit,
    onVoteSubmitted: () -> Unit,
    modifier: Modifier = Modifier
) {
    val currentVotes by groupViewModel.currentVotes.collectAsState()
    val userVote by groupViewModel.userVote.collectAsState()

    Column(modifier = modifier) {
        LazyColumn(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            items(restaurants) { restaurant ->
                val effectiveId = restaurant.restaurantId ?: generateDeterministicId(restaurant)
                RestaurantCard(
                    restaurant = restaurant.copy(restaurantId = effectiveId),
                    isSelected = selectedRestaurantForVote?.let {
                        it.restaurantId == effectiveId ||
                                (it.name == restaurant.name && it.location == restaurant.location)
                    } ?: false,
                    hasVoted = userVote != null,
                    voteCount = currentVotes[effectiveId] ?: 0,
                    onClick = {
                        if (userVote == null) {
                            onRestaurantSelected(restaurant.copy(restaurantId = effectiveId))
                        }
                    }
                )
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        VoteButton(
            selectedRestaurantForVote = selectedRestaurantForVote,
            userVote = userVote,
            groupViewModel = groupViewModel,
            onVoteSubmitted = onVoteSubmitted
        )
    }
}

@Composable
private fun VoteButton(
    selectedRestaurantForVote: Restaurant?,
    userVote: String?,
    groupViewModel: GroupViewModel,
    onVoteSubmitted: () -> Unit
) {
    Button(
        onClick = {
            selectedRestaurantForVote?.let { restaurant ->
                val restId = restaurant.restaurantId ?: generateDeterministicId(restaurant)
                groupViewModel.voteForRestaurant(
                    restId,
                    restaurant.copy(restaurantId = restId)
                )
                onVoteSubmitted()
            }
        },
        modifier = Modifier.fillMaxWidth().height(56.dp),
        enabled = selectedRestaurantForVote != null && userVote == null,
        colors = ButtonDefaults.buttonColors(
            containerColor = VividPurple,
            disabledContainerColor = TextPrimary.copy(alpha = 0.5f)
        )
    ) {
        if (groupViewModel.isLoading.collectAsState().value) {
            CircularProgressIndicator(
                modifier = Modifier.size(24.dp),
                color = Color.White
            )
        } else {
            Text(
                text = if (userVote != null) "Already Voted" else "Submit Vote",
                fontSize = 18.sp,
                fontWeight = FontWeight.Bold,
                color = Color.White
            )
        }
    }
}

fun generateDeterministicId(restaurant: Restaurant): String {
    val combined = "${restaurant.name}_${restaurant.location}".replace(" ", "").toLowerCase()
    return combined.hashCode().toString()
}

@Composable
fun RestaurantCard(
    restaurant: Restaurant,
    isSelected: Boolean,
    hasVoted: Boolean,
    voteCount: Int,
    onClick: () -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(enabled = !hasVoted, onClick = onClick),
        colors = CardDefaults.cardColors(
            containerColor = if (isSelected) PurpleLight else GlassWhite
        ),
        elevation = CardDefaults.cardElevation(
            defaultElevation = if (isSelected) 8.dp else 2.dp
        ),
        border = if (isSelected) {
            androidx.compose.foundation.BorderStroke(2.dp, VividPurple)
        } else null
    ) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            RestaurantImage(restaurant)
            RestaurantInfo(restaurant, voteCount)
            if (isSelected) {
                Icon(
                    imageVector = Icons.Default.Check,
                    contentDescription = "Selected",
                    tint = VividPurple,
                    modifier = Modifier.size(32.dp)
                )
            }
        }
    }
}

@Composable
private fun RestaurantImage(restaurant: Restaurant) {
    restaurant.getMainPhotoUrl()?.let { photoUrl ->
        AsyncImage(
            model = photoUrl,
            contentDescription = restaurant.name,
            contentScale = ContentScale.Crop,
            modifier = Modifier
                .size(80.dp)
                .clip(RoundedCornerShape(8.dp))
                .background(Color.LightGray)
        )
        Spacer(modifier = Modifier.width(12.dp))
    }
}

@Composable
private fun RowScope.RestaurantInfo(restaurant: Restaurant, voteCount: Int) {
    Column(modifier = Modifier.weight(1f)) {
        Text(
            text = restaurant.name,
            fontSize = 18.sp,
            fontWeight = FontWeight.Bold,
            color = TextPrimary,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis
        )
        Spacer(modifier = Modifier.height(4.dp))
        RestaurantRatingAndPrice(restaurant)
        Spacer(modifier = Modifier.height(4.dp))
        Text(
            text = restaurant.location,
            fontSize = 12.sp,
            color = TextPrimary.copy(alpha = 0.7f),
            maxLines = 1,
            overflow = TextOverflow.Ellipsis
        )
        if (voteCount > 0) {
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = "$voteCount vote${if (voteCount != 1) "s" else ""}",
                fontSize = 12.sp,
                color = Color(0xFF9D4EDD),
                fontWeight = FontWeight.Bold
            )
        }
    }
}

@Composable
private fun RestaurantRatingAndPrice(restaurant: Restaurant) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        restaurant.rating?.let { rating ->
            Icon(
                imageVector = Icons.Default.Star,
                contentDescription = "Rating",
                tint = Color(0xFF9D4EDD),
                modifier = Modifier.size(16.dp)
            )
            Spacer(modifier = Modifier.width(4.dp))
            Text(
                text = restaurant.getRatingString(),
                fontSize = 14.sp,
                color = TextPrimary.copy(alpha = 0.7f)
            )
            Spacer(modifier = Modifier.width(8.dp))
        }
        restaurant.priceLevel?.let {
            Text(
                text = restaurant.getPriceLevelString(),
                fontSize = 14.sp,
                color = TextPrimary.copy(alpha = 0.7f)
            )
        }
    }
}