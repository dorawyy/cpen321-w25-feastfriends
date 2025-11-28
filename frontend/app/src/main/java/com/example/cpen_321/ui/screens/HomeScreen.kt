package com.example.cpen_321.ui.screens

import android.Manifest
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AccountCircle
import androidx.compose.material.icons.filled.Star
import androidx.compose.material.icons.outlined.Favorite
import androidx.compose.material.icons.outlined.Group
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.activity.ComponentActivity
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
import com.example.cpen_321.ui.theme.*

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
    matchViewModel: MatchViewModel = hiltViewModel(
        viewModelStoreOwner = LocalContext.current as ComponentActivity
    ),
    groupViewModel: GroupViewModel = hiltViewModel(),
    userViewModel: UserViewModel = hiltViewModel()
) {
    val currentUser by authViewModel.currentUser.collectAsState()
    val userSettings by userViewModel.userSettings.collectAsState()
    val currentGroup by groupViewModel.currentGroup.collectAsState()
    val snackbarHostState = remember { SnackbarHostState() }
    val isTest = remember { isTestEnvironment() }

    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var locationPermissionGranted by remember { mutableStateOf(false) }
    var isJoiningMatch by remember { mutableStateOf(false) }

    val locationPermissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        locationPermissionGranted = permissions[Manifest.permission.ACCESS_FINE_LOCATION] == true ||
                permissions[Manifest.permission.ACCESS_COARSE_LOCATION] == true
        Log.d("HomeScreen", "Location permission granted: $locationPermissionGranted")
    }

    LaunchedEffect(Unit) {
        locationPermissionGranted = LocationHelper.hasLocationPermission(context)
    }

    LaunchedEffect(Unit) {
        if (!isTest && currentUser == null) {
            println("HomeScreen: Verifying token (production)")
            authViewModel.verifyToken()
        } else if (isTest) {
            println("🧪 HomeScreen: Skipping token verification (test mode)")
        }
    }

    LaunchedEffect(Unit) {
        userViewModel.loadUserSettings()
    }

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
                .background(Color.White)
                .padding(innerPadding)
        ) {
            // Credibility Score badge on top left
            userSettings?.credibilityScore?.let { score ->
                Box(
                    modifier = Modifier
                        .align(Alignment.TopStart)
                        .padding(16.dp)
                        .background(
                            color = SoftViolet.copy(alpha = 0.2f),
                            shape = RoundedCornerShape(20.dp)
                        )
                        .padding(horizontal = 12.dp, vertical = 6.dp)
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Filled.Star,
                            contentDescription = "Credibility Score",
                            modifier = Modifier.size(16.dp),
                            tint = VividPurple
                        )
                        Text(
                            text = "Credibility Score: ${score.toInt()}",
                            fontSize = 14.sp,
                            fontWeight = FontWeight.Medium,
                            color = TextPrimary
                        )
                    }
                }
            }

            // Profile icon on top right
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

            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(horizontal = 32.dp),
                verticalArrangement = Arrangement.Center,
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Spacer(modifier = Modifier.height(40.dp))
                
                Text(
                    text = "Welcome${userSettings?.name?.let { ", $it" } ?: ""}!",
                    fontSize = 28.sp,
                    fontWeight = FontWeight.Bold,
                    color = TextPrimary,
                    fontFamily = PlaywriteFontFamily,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.fillMaxWidth()
                )

                Spacer(modifier = Modifier.height(32.dp))

                // ✅ FIXED: Check if user is in a room and show appropriate button
                val isInRoom = !userSettings?.roomID.isNullOrEmpty()
                val isInGroup = currentGroup != null || !userSettings?.groupID.isNullOrEmpty()

                // Start/Resume Matchmaking Button
                Button(
                    onClick = {
                        if (!isJoiningMatch) {
                            // ✅ NEW: If already in a room, navigate directly to waiting room
                            if (isInRoom) {
                                Log.d("HomeScreen", "User already in room, navigating to waiting_room")
                                navController.navigate("waiting_room")
                            } else if (isInGroup) {
                                // Check if user is in a group
                                scope.launch {
                                    snackbarHostState.showSnackbar("You cannot join matchmaking because you are already in a group")
                                }
                            } else {
                                val cuisines = userSettings?.preference ?: emptyList()
                                val budget = userSettings?.budget ?: 50.0
                                val radius = userSettings?.radiusKm ?: 5.0

                                if (cuisines.isEmpty()) {
                                    navController.navigate("preferences")
                                } else {
                                    if (!locationPermissionGranted) {
                                        locationPermissionLauncher.launch(
                                            arrayOf(
                                                Manifest.permission.ACCESS_FINE_LOCATION,
                                                Manifest.permission.ACCESS_COARSE_LOCATION
                                            )
                                        )
                                    } else {
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
                            }
                        }
                    },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(60.dp)
                        .shadow(
                            elevation = 4.dp,
                            shape = RoundedCornerShape(30.dp),
                            spotColor = VividPurple.copy(alpha = 0.3f)
                        ),
                    enabled = !isJoiningMatch,
                    colors = ButtonDefaults.buttonColors(
                        containerColor = Color.Transparent
                    ),
                    shape = RoundedCornerShape(30.dp),
                    contentPadding = PaddingValues(0.dp)
                ) {
                    Box(
                        modifier = Modifier
                            .fillMaxSize()
                            .background(
                                brush = Brush.horizontalGradient(
                                    colors = if (isInRoom) {
                                        listOf(
                                            Color(0xFFFFB347),
                                            Color(0xFFFF8C42)
                                        )
                                    } else {
                                        listOf(
                                            VividPurple,
                                            MediumPurple
                                        )
                                    }
                                ),
                                shape = RoundedCornerShape(30.dp)
                            ),
                        contentAlignment = Alignment.Center
                    ) {
                        if (isJoiningMatch) {
                            CircularProgressIndicator(
                                color = Color.White,
                                modifier = Modifier.size(24.dp)
                            )
                        } else {
                            Row(
                                horizontalArrangement = Arrangement.Center,
                                verticalAlignment = Alignment.CenterVertically,
                                modifier = Modifier.padding(horizontal = 24.dp)
                            ) {
                                Icon(
                                    imageVector = Icons.Filled.Star,
                                    contentDescription = null,
                                    tint = Color.White,
                                    modifier = Modifier.size(20.dp)
                                )
                                Spacer(modifier = Modifier.width(10.dp))
                                Text(
                                    text = "Start Match",
                                    color = Color.White,
                                    fontSize = 18.sp,
                                    fontWeight = FontWeight.SemiBold
                                )
                            }
                        }
                    }
                }

                Spacer(modifier = Modifier.height(24.dp))

                // Current Groups Button
                OutlinedButton(
                    onClick = {
                        val group = currentGroup

                        if (group != null) {
                            val groupId = group.groupId

                            if (group.restaurantSelected == false && groupId != null) {
                                navController.navigate("sequential_voting/$groupId")
                            } else if (groupId != null) {
                                navController.navigate(NavRoutes.VIEW_GROUPS)
                            } else {
                                navController.navigate(NavRoutes.VIEW_GROUPS)
                            }
                        } else {
                            navController.navigate(NavRoutes.VIEW_GROUPS)
                        }
                    },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(60.dp)
                        .shadow(
                            elevation = 2.dp,
                            shape = RoundedCornerShape(30.dp),
                            spotColor = Color.Black.copy(alpha = 0.1f)
                        ),
                    colors = ButtonDefaults.outlinedButtonColors(
                        containerColor = if (currentGroup != null) {
                            VividPurple.copy(alpha = 0.1f)
                        } else {
                            Color.White
                        },
                        contentColor = if (currentGroup != null) {
                            VividPurple
                        } else {
                            TextSecondary
                        }
                    ),
                    border = androidx.compose.foundation.BorderStroke(
                        width = 1.dp,
                        color = if (currentGroup != null) {
                            VividPurple
                        } else {
                            LightBorder
                        }
                    ),
                    shape = RoundedCornerShape(30.dp),
                    contentPadding = PaddingValues(horizontal = 24.dp)
                ) {
                    val group = currentGroup
                    val buttonText = when {
                        group?.restaurantSelected == false -> "Continue Voting"
                        group != null -> "View Active Group"
                        else -> "Current Groups"
                    }

                    Row(
                        horizontalArrangement = Arrangement.Center,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(
                            imageVector = Icons.Outlined.Group,
                            contentDescription = null,
                            tint = if (currentGroup != null) VividPurple else TextSecondary,
                            modifier = Modifier.size(20.dp)
                        )
                        Spacer(modifier = Modifier.width(10.dp))
                        Text(
                            text = buttonText,
                            color = if (currentGroup != null) VividPurple else TextSecondary,
                            fontSize = 18.sp,
                            fontWeight = FontWeight.SemiBold
                        )
                    }
                }
            }
        }
    }
}