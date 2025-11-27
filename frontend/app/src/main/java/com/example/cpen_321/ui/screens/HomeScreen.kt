package com.example.cpen_321.ui.screens

import android.Manifest
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AccountCircle
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.NavController
import com.example.cpen_321.R
import com.example.cpen_321.ui.components.MainBottomBar
import com.example.cpen_321.ui.viewmodels.AuthViewModel
import com.example.cpen_321.ui.viewmodels.MatchViewModel
import com.example.cpen_321.ui.viewmodels.GroupViewModel
import com.example.cpen_321.ui.viewmodels.UserViewModel
import com.example.cpen_321.utils.LocationHelper
import kotlinx.coroutines.launch
import android.util.Log
import NavRoutes

// Add font
val PlaywriteFontFamily = FontFamily(
    Font(R.font.playwrite_usmodern_variablefont_wght)
)


private fun isTestEnvironment(): Boolean {
    return try {
        Class.forName("androidx.test.espresso.Espresso")
        true
    } catch (e: ClassNotFoundException) {
        false
    }
}

@Composable
fun HomeScreen(
    navController: NavController,
    authViewModel: AuthViewModel = hiltViewModel(),
    matchViewModel: MatchViewModel = hiltViewModel(),
    groupViewModel: GroupViewModel = hiltViewModel(),
    userViewModel: UserViewModel = hiltViewModel()
) {
    // Collect states
    val currentUser by authViewModel.currentUser.collectAsState()
    val userSettings by userViewModel.userSettings.collectAsState()
    val currentGroup by groupViewModel.currentGroup.collectAsState()
    val snackbarHostState = remember { SnackbarHostState() }
    val isTest = remember { isTestEnvironment() }

    // ✅ ADD THESE FOR LOCATION HANDLING
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var locationPermissionGranted by remember { mutableStateOf(false) }
    var isJoiningMatch by remember { mutableStateOf(false) }

    // ✅ ADD LOCATION PERMISSION LAUNCHER
    val locationPermissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        locationPermissionGranted = permissions[Manifest.permission.ACCESS_FINE_LOCATION] == true ||
                permissions[Manifest.permission.ACCESS_COARSE_LOCATION] == true
        Log.d("HomeScreen", "Location permission granted: $locationPermissionGranted")
    }

    // Check location permission on startup
    LaunchedEffect(Unit) {
        locationPermissionGranted = LocationHelper.hasLocationPermission(context)
    }

    // FIXED: Only verify token in production, skip in tests
    LaunchedEffect(Unit) {
        if (!isTest && currentUser == null) {
            println("HomeScreen: Verifying token (production)")
            authViewModel.verifyToken()
        } else if (isTest) {
            println("🧪 HomeScreen: Skipping token verification (test mode)")
        }
    }

    // ✅ Load user settings when screen opens - this refreshes name and credibility score
    LaunchedEffect(Unit) {
        userViewModel.loadUserSettings()
    }

    // Check if user has an active group
    LaunchedEffect(Unit) {
        groupViewModel.loadGroupStatus()
    }

    Scaffold(
        bottomBar = { MainBottomBar(navController = navController) },
        snackbarHost = { SnackbarHost(hostState = snackbarHostState) }
    ) { innerPadding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(Color(0xFFFFFFFF)) // White background to match AuthScreen
                .padding(innerPadding)
        ) {
            // Profile icon in top right
            IconButton(
                onClick = {
                    navController.navigate("profile_config")
                },
                modifier = Modifier
                    .align(Alignment.TopEnd)
                    .padding(16.dp)
            ) {
                Icon(
                    Icons.Filled.AccountCircle,
                    contentDescription = "Profile",
                    modifier = Modifier
                        .width(48.dp)
                        .height(48.dp)
                        .testTag("home_profile")
                )
            }

            // Center content with buttons
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(horizontal = 32.dp),
                verticalArrangement = Arrangement.Center,
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                // ✅ FIXED: Welcome text with user's name from userSettings
                Text(
                    text = "Welcome${userSettings?.name?.let { ", $it" } ?: ""}!",
                    fontSize = 28.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color.Black,
                    fontFamily = PlaywriteFontFamily,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.fillMaxWidth()
                )

                Spacer(modifier = Modifier.height(16.dp))

                // ✅ FIXED: Show credibility score from userSettings
                userSettings?.credibilityScore?.let { score ->
                    Text(
                        text = "Credibility Score: ${score.toInt()}",
                        fontSize = 16.sp,
                        color = Color.Gray,
                        textAlign = TextAlign.Center
                    )
                }

                Spacer(modifier = Modifier.height(48.dp))

                // Start Matchmaking Button
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(60.dp)
                        .background(
                            brush = Brush.linearGradient(
                                colors = listOf(
                                    Color(0xFFE596FF), // Light purple
                                    Color(0xFF9D4EDD), // Medium purple
                                    Color(0xFF7B2CBF)  // Dark purple
                                )
                            ),
                            shape = MaterialTheme.shapes.medium
                        )
                        .clickable(enabled = !isJoiningMatch) {
                            if (isJoiningMatch) return@clickable  // Prevent double clicks

                            // Check if user is already in a room or group
                            val isInRoom = !userSettings?.roomID.isNullOrEmpty()
                            val isInGroup = currentGroup != null || !userSettings?.groupID.isNullOrEmpty()

                            if (isInGroup) {
                                scope.launch {
                                    snackbarHostState.showSnackbar("You cannot join matchmaking because you are already in a group")
                                }
                                return@clickable
                            }

                            if (isInRoom) {
                                scope.launch {
                                    snackbarHostState.showSnackbar("You cannot join matchmaking because you are already in a room")
                                }
                                return@clickable
                            }

                            val cuisines = userSettings?.preference ?: emptyList()
                            val budget = userSettings?.budget ?: 50.0
                            val radius = userSettings?.radiusKm ?: 5.0

                            if (cuisines.isEmpty()) {
                                navController.navigate("preferences")
                            } else {
                                // Check location permission first
                                if (!locationPermissionGranted) {
                                    // Request location permission
                                    locationPermissionLauncher.launch(
                                        arrayOf(
                                            Manifest.permission.ACCESS_FINE_LOCATION,
                                            Manifest.permission.ACCESS_COARSE_LOCATION
                                        )
                                    )
                                } else {
                                    // Permission granted - get location and join matching
                                    isJoiningMatch = true
                                    scope.launch {
                                        try {
                                            val location = LocationHelper.getCurrentLocation(context)
                                            if (location != null) {
                                                val (lat, lng) = location
                                                Log.d("HomeScreen", "Got location: $lat, $lng")
                                                matchViewModel.joinMatching(
                                                    cuisine = cuisines,
                                                    budget = budget,
                                                    radiusKm = radius,
                                                    latitude = lat,
                                                    longitude = lng
                                                )
                                                navController.navigate("waiting_room")
                                            } else {
                                                Log.e("HomeScreen", "Could not get location")
                                                isJoiningMatch = false
                                                snackbarHostState.showSnackbar(
                                                    "Unable to get your location. Please check your GPS settings."
                                                )
                                            }
                                        } catch (e: Exception) {
                                            Log.e("HomeScreen", "Location error", e)
                                            isJoiningMatch = false
                                            snackbarHostState.showSnackbar(
                                                "Location error: ${e.message}"
                                            )
                                        }
                                    }
                                }
                            }
                        },
                    contentAlignment = Alignment.Center
                ) {
                    if (isJoiningMatch) {
                        CircularProgressIndicator(
                            color = Color.White,
                            modifier = Modifier.size(24.dp)
                        )
                    } else {
                        Text(
                            text = "START MATCHMAKING",
                            color = Color.White,
                            fontSize = 18.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }


                Spacer(modifier = Modifier.height(32.dp))

                // Current Groups Button
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(60.dp)
                        .background(
                            brush = Brush.linearGradient(
                                colors = if (currentGroup != null) {
                                    listOf(
                                        Color(0xFF7B2CBF), // Dark purple
                                        Color(0xFF5A189A), // Darker purple
                                        Color(0xFF290C2F)  // Very dark purple
                                    )
                                } else {
                                    listOf(
                                        Color(0xFFE596FF), // Light purple
                                        Color(0xFF9D4EDD), // Medium purple
                                        Color(0xFF7B2CBF)  // Dark purple
                                    )
                                }
                            ),
                            shape = MaterialTheme.shapes.medium
                        )
                        .clickable {
                            val group = currentGroup

                            // Check if user has an active group
                            if (group != null) {
                                val groupId = group.groupId

                                // Check if voting is in progress
                                if (group.restaurantSelected == false && groupId != null) {
                                    // Voting still in progress - go to sequential voting
                                    navController.navigate("sequential_voting/$groupId")
                                } else if (groupId != null) {
                                    // Restaurant already selected - go to group screen
                                    navController.navigate("group/$groupId")
                                } else {
                                    // Fallback to view groups
                                    navController.navigate(NavRoutes.VIEW_GROUPS)
                                }
                            } else {
                                // No active group - show all groups
                                navController.navigate(NavRoutes.VIEW_GROUPS)
                            }
                        },
                    contentAlignment = Alignment.Center
                ) {
                    val group = currentGroup
                    val buttonText = when {
                        group?.restaurantSelected == false -> "CONTINUE VOTING"
                        group != null -> "VIEW ACTIVE GROUP"
                        else -> "CURRENT GROUPS"
                    }

                    Text(
                        text = buttonText,
                        color = Color.White,
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Bold
                    )
                }
            }
        }
    }
}