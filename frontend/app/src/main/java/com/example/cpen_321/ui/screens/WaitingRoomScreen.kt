
package com.example.cpen_321.ui.screens

// ===============================================
// NEW CODE - FIXED VERSION WITH GLASSMORPHISM
// BoxWithConstraints error has been FIXED
// ===============================================

import android.annotation.SuppressLint
import android.util.Log
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.*
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.scaleIn
import androidx.compose.animation.scaleOut
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ExitToApp
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Restaurant
import androidx.compose.material.icons.filled.Timer
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.foundation.Canvas
import kotlin.math.cos
import kotlin.math.sin
import kotlin.math.PI
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.NavController
import coil.compose.AsyncImage
import com.example.cpen_321.data.model.UserProfile
import com.example.cpen_321.ui.viewmodels.MatchViewModel
import com.example.cpen_321.utils.rememberBase64ImagePainter
import androidx.compose.foundation.Image
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlin.math.roundToInt
import kotlin.random.Random

// Purple Color Palette
private val PurpleLight = Color(0xFFE6E6FA) // Lavender
private val PurpleMedium = Color(0xFFC8B6FF) // Light purple
private val PurpleDark = Color(0xFF9D8AC7) // Medium purple
private val PurpleAccent = Color(0xFFB39DDB) // Purple accent
private val PurpleGradientStart = Color(0xFFE8DAFF)
private val PurpleGradientEnd = Color(0xFFD4C5F9)
private val GlassWhite = Color(0xCCFFFFFF) // Semi-transparent white for glass effect
private val GlassBorder = Color(0x33FFFFFF) // Subtle white border
private val CarbonBlack = Color(0xFF1C1D21) // Dark gray/black

@Composable
fun WaitingRoomScreen(
    navController: NavController,
    viewModel: MatchViewModel = hiltViewModel()
) {
    // ✅ ADD THIS at the very top
    val viewModelHashCode = viewModel.hashCode()
    LaunchedEffect(Unit) {
        Log.d("WaitingRoom", "🟢 ViewModel instance: $viewModelHashCode")
        Log.d("WaitingRoom", "🟢 ViewModel class: ${viewModel::class.java.simpleName}")
    }

    val scope = rememberCoroutineScope()  // ✅ Add this at the top

    val currentRoom by viewModel.currentRoom.collectAsState()
    val roomMembers by viewModel.roomMembers.collectAsState()
    val timeRemaining by viewModel.timeRemaining.collectAsState()
    val groupReady by viewModel.groupReady.collectAsState()
    val groupId by viewModel.groupId.collectAsState()
    val roomExpired by viewModel.roomExpired.collectAsState()
    val errorMessage by viewModel.errorMessage.collectAsState()
    val leaveRoomSuccess by viewModel.leaveRoomSuccess.collectAsState()

    var showLeaveDialog by remember { mutableStateOf(false) }
    var showFailureDialog by remember { mutableStateOf(false) }
    val snackbarHostState = remember { SnackbarHostState() }

    val minNumberOfPeople = 2

//    // ✅ NEW: Reload room status when screen is opened
//    LaunchedEffect(Unit) {
//        Log.d("WaitingRoom", "Screen opened/resumed - checking current room status")
//        (currentRoom as? com.example.cpen_321.data.model.Room)?.let { room ->
//            Log.d("WaitingRoom", "Reloading room status for: ${room.roomId}")
//            viewModel.getRoomStatus(room.roomId)
//        } ?: run {
//            Log.w("WaitingRoom", "No current room found - user may need to leave")
//            // Optionally navigate back to home if no room exists
//            delay(500)
//            if (currentRoom == null) {
//                Log.w("WaitingRoom", "Still no room after delay - navigating to home")
//                navController.navigate("home") {
//                    popUpTo("home") { inclusive = true }
//                }
//            }
//        }
//    }


    // ✅ FIX: Navigate immediately when leaveRoom succeeds
    LaunchedEffect(leaveRoomSuccess) {
        if (leaveRoomSuccess) {
            Log.d("WaitingRoom", "leaveRoomSuccess is true - navigating back to home")
            // Small delay to ensure state is cleared
            delay(100)
            // Navigate to home and clear back stack
            navController.navigate("home") {
                popUpTo("home") { inclusive = true }
            }
            viewModel.clearLeaveRoomSuccess() // Reset the state
        }
    }

    WaitingRoomEffects(
        currentRoom = currentRoom,
        timeRemaining = timeRemaining,
        groupReady = groupReady,
        groupId = groupId,
        roomExpired = roomExpired,
        roomMembers = roomMembers,
        errorMessage = errorMessage,
        minNumberOfPeople = minNumberOfPeople,
        viewModel = viewModel,
        navController = navController,
        snackbarHostState = snackbarHostState,
        onShowFailureDialog = { showFailureDialog = true }
    )

    Scaffold(
        snackbarHost = {
            SnackbarHost(hostState = snackbarHostState) { data ->
                Snackbar(
                    snackbarData = data,
                    containerColor = Color(0xFFB39DDB),
                    contentColor = Color.White
                )
            }
        }
    ) { innerPadding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
        ) {
            if (!groupReady) {
                WaitingRoomContent(
                    currentRoom = currentRoom,
                    roomMembers = roomMembers,
                    timeRemaining = timeRemaining,
                    minNumberOfPeople = minNumberOfPeople,
                    onLeaveClick = { showLeaveDialog = true }
                )
            } else {
                GroupReadyContent()
            }
        }
    }

    LeaveRoomDialog(
        showDialog = showLeaveDialog,
        onDismiss = { showLeaveDialog = false },
        onConfirm = {
            showLeaveDialog = false
            Log.d("WaitingRoom", "Leave confirmed, calling leaveRoom()")

            // ✅ FIX: Call leaveRoom() - navigation will happen automatically via leaveRoomSuccess
            viewModel.leaveRoom()
        }
    )

    FailureDialog(
        showDialog = showFailureDialog,
        minNumberOfPeople = minNumberOfPeople,
        onConfirm = {
            showFailureDialog = false
            Log.d("WaitingRoom", "Try Again clicked - leaving room and navigating home")

            // ✅ FIX: Call leaveRoom() to clean up backend state before navigating
            // Navigation will happen automatically via leaveRoomSuccess flag
            viewModel.leaveRoom()
        }
    )
}

@Composable
private fun WaitingRoomEffects(
    currentRoom: Any?,
    timeRemaining: Long,
    groupReady: Boolean,
    groupId: String?,
    roomExpired: Boolean,
    roomMembers: List<UserProfile>,
    errorMessage: String?,
    minNumberOfPeople: Int,
    viewModel: MatchViewModel,
    navController: NavController,
    snackbarHostState: SnackbarHostState,
    onShowFailureDialog: () -> Unit
) {
    val timeRemainingSeconds = (timeRemaining / 1000).toInt()

    LaunchedEffect(timeRemaining) {
        if (timeRemaining > 0) {
            Log.d("WaitingRoom", "Timer: ${timeRemainingSeconds / 60}:${String.format("%02d", timeRemainingSeconds % 60)}")
        }
    }

    // ✅ FIX: Track if we've already shown the failure dialog to prevent duplicates
    var hasShownFailureDialog by remember { mutableStateOf(false) }

    LaunchedEffect(currentRoom) {
        (currentRoom as? com.example.cpen_321.data.model.Room)?.let { room ->
            Log.d("WaitingRoom", "Loading room status for: ${room.roomId}")
            viewModel.getRoomStatus(room.roomId)
            // Reset the failure dialog flag when room changes (new room joined)
            hasShownFailureDialog = false
        }
    }

    LaunchedEffect(groupReady, groupId) {
        if (groupReady && groupId != null) {
            delay(1000L)
            navController.navigate("sequential_voting/$groupId") {
                popUpTo("waiting_room") { inclusive = true }
            }
        }
    }

    LaunchedEffect(roomExpired, roomMembers.size, currentRoom) {
        if (roomExpired && !hasShownFailureDialog) {
            // Check both roomMembers and currentRoom.members to ensure we have the latest count
            val currentRoomMembers = (currentRoom as? com.example.cpen_321.data.model.Room)?.members?.size ?: roomMembers.size
            val memberCount = maxOf(roomMembers.size, currentRoomMembers)

            if (memberCount < minNumberOfPeople) {
                hasShownFailureDialog = true
                onShowFailureDialog()
            }
        }
    }

    LaunchedEffect(errorMessage) {
        errorMessage?.let { message ->
            snackbarHostState.showSnackbar(
                message = message,
                duration = SnackbarDuration.Short
            )
            viewModel.clearError()
        }
    }
}

@Composable
private fun WaitingRoomContent(
    currentRoom: Any?,
    roomMembers: List<UserProfile>,
    timeRemaining: Long,
    minNumberOfPeople: Int,
    onLeaveClick: () -> Unit
) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(
                Brush.verticalGradient(
                    colors = listOf(
                        PurpleGradientStart,
                        PurpleGradientEnd
                    )
                )
            )
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Spacer(modifier = Modifier.height(16.dp))
            
            // Top banner with "X friends joined"
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = Color.White),
                shape = RoundedCornerShape(12.dp),
                border = androidx.compose.foundation.BorderStroke(2.dp, PurpleAccent)
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.Center
                ) {
                    Icon(
                        imageVector = Icons.Default.Person,
                        contentDescription = "Friends",
                        modifier = Modifier.size(20.dp),
                        tint = PurpleAccent
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = "${roomMembers.size} friend${if (roomMembers.size != 1) "s" else ""} joined",
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Medium,
                        color = PurpleAccent
                    )
                }
            }
            
            Spacer(modifier = Modifier.height(24.dp))
            
            // FeastFriends title
            Text(
                text = "FeastFriends",
                fontSize = 32.sp,
                fontWeight = FontWeight.Bold,
                color = CarbonBlack,
                letterSpacing = 0.5.sp
            )
            
            Spacer(modifier = Modifier.height(32.dp))
            
            // Large circular timer ring with profile pictures around it
            BoxWithConstraints(
                modifier = Modifier.size(320.dp)
            ) {
                val centerX = constraints.maxWidth / 2f
                val centerY = constraints.maxHeight / 2f
                
                // Circular progress ring (incomplete circle)
                CircularTimerRing(
                    timeRemaining = timeRemaining,
                    modifier = Modifier.fillMaxSize()
                )
                
                // Profile pictures positioned around the ring with floating animation
                roomMembers.forEachIndexed { index, user ->
                    val angle = (index * 360f / maxOf(roomMembers.size, 1)) - 90f // Start from top
                    val radius = 140.dp
                    val density = LocalDensity.current
                    val radiusPx = with(density) { radius.toPx() }
                    val profileSizePx = with(density) { 60.dp.toPx() }
                    val angleRad = (angle * PI / 180).toFloat()
                    val xPx = centerX + (cos(angleRad) * radiusPx) - (profileSizePx / 2)
                    val yPx = centerY + (sin(angleRad) * radiusPx) - (profileSizePx / 2)
                    
                    // Floating animation
                    val infiniteTransition = rememberInfiniteTransition(label = "float_$index")
                    val floatOffset by infiniteTransition.animateFloat(
                        initialValue = -5f,
                        targetValue = 5f,
                        animationSpec = infiniteRepeatable(
                            animation = tween(
                                durationMillis = 2000 + (index * 200),
                                easing = FastOutSlowInEasing
                            ),
                            repeatMode = RepeatMode.Reverse
                        ),
                        label = "float_offset"
                    )
                    
                    Box(
                        modifier = Modifier
                            .offset { 
                                IntOffset(
                                    xPx.toInt(), 
                                    (yPx + floatOffset).toInt()
                                ) 
                            }
                            .size(60.dp)
                            .shadow(8.dp, CircleShape)
                    ) {
                        ProfilePictureOnRing(
                            user = user,
                            angle = angle,
                            radius = radius
                        )
                    }
                }
                
                // Timer and "Waiting Room" text in center
                Column(
                    modifier = Modifier.align(Alignment.Center),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text(
                        text = "Waiting Room",
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Bold,
                        color = PurpleAccent
                    )
                    Spacer(modifier = Modifier.height(12.dp))
                    val timeRemainingSeconds = (timeRemaining / 1000).toInt()
                    val minutes = timeRemainingSeconds / 60
                    val seconds = timeRemainingSeconds % 60
                    Text(
                        text = String.format("%d:%02d", minutes, seconds),
                        fontSize = 56.sp,
                        fontWeight = FontWeight.Bold,
                        color = CarbonBlack,
                        letterSpacing = 2.sp
                    )
                }
            }
            
            Spacer(modifier = Modifier.height(24.dp))
            
            // "Your table will be ready soon..." message
            Text(
                text = "Your table will be ready soon...",
                fontSize = 16.sp,
                color = PurpleAccent,
                fontWeight = FontWeight.Normal
            )
            
            Spacer(modifier = Modifier.weight(1f))
            
            // Leave Room button
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(56.dp)
                    .clickable(onClick = onLeaveClick),
                colors = CardDefaults.cardColors(containerColor = Color.White),
                shape = RoundedCornerShape(12.dp),
                border = androidx.compose.foundation.BorderStroke(1.dp, Color.Gray.copy(alpha = 0.3f))
            ) {
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = "Leave Room",
                        fontSize = 16.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = CarbonBlack
                    )
                }
            }
            
            Spacer(modifier = Modifier.height(16.dp))
        }
    }
}

@Composable
private fun CircularTimerRing(
    timeRemaining: Long,
    modifier: Modifier = Modifier
) {
    val totalTime = 300000L // 5 minutes in milliseconds
    val progress = if (totalTime > 0) {
        (totalTime - timeRemaining).toFloat() / totalTime.toFloat()
    } else {
        0f
    }
    
    // Draw incomplete circular progress ring
    Canvas(
        modifier = modifier
    ) {
        val strokeWidth = 12.dp.toPx()
        val radius = (size.minDimension - strokeWidth) / 2
        val center = Offset(size.width / 2, size.height / 2)
        
        // Background ring (full circle, light)
        drawCircle(
            color = PurpleAccent.copy(alpha = 0.2f),
            radius = radius,
            center = center,
            style = Stroke(width = strokeWidth)
        )
        
        // Progress ring (incomplete, based on time)
        val sweepAngle = progress * 360f
        drawArc(
            color = PurpleAccent,
            startAngle = -90f, // Start from top
            sweepAngle = sweepAngle,
            useCenter = false,
            style = Stroke(width = strokeWidth),
            topLeft = Offset(
                center.x - radius,
                center.y - radius
            ),
            size = Size(radius * 2, radius * 2)
        )
    }
}

@Composable
private fun ProfilePictureOnRing(
    user: UserProfile,
    angle: Float,
    radius: androidx.compose.ui.unit.Dp
) {
    Box(
        modifier = Modifier.size(60.dp)
    ) {
        // Profile picture
        if (user.profilePicture?.isNotEmpty() == true) {
            if (user.profilePicture.startsWith("data:image/")) {
                val painter = rememberBase64ImagePainter(user.profilePicture)
                Image(
                    painter = painter,
                    contentDescription = user.name,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier
                        .fillMaxSize()
                        .clip(CircleShape)
                        .border(3.dp, Color.White, CircleShape)
                )
            } else {
                AsyncImage(
                    model = user.profilePicture,
                    contentDescription = user.name,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier
                        .fillMaxSize()
                        .clip(CircleShape)
                        .border(3.dp, Color.White, CircleShape)
                )
            }
        } else {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(
                        Brush.linearGradient(
                            colors = listOf(
                                Color(0xFF9D4EDD),
                                Color(0xFF7B2CBF)
                            )
                        ),
                        CircleShape
                    )
                    .border(3.dp, Color.White, CircleShape),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = Icons.Default.Person,
                    contentDescription = "Profile",
                    modifier = Modifier.size(30.dp),
                    tint = Color.White
                )
            }
        }
        
        // Name tag below profile picture
        Column(
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .offset(y = 8.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Box(
                modifier = Modifier
                    .background(
                        GlassWhite,
                        RoundedCornerShape(8.dp)
                    )
                    .border(1.dp, PurpleAccent.copy(alpha = 0.5f), RoundedCornerShape(8.dp))
                    .padding(horizontal = 6.dp, vertical = 3.dp)
            ) {
                Text(
                    text = user.name.split(" ").firstOrNull() ?: user.name.take(8),
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Medium,
                    color = PurpleDark,
                    maxLines = 1
                )
            }
        }
    }
}

// NEW: Animated floating bubbles
@SuppressLint("UnusedBoxWithConstraintsScope")
@Composable
private fun AnimatedUserBubbles(users: List<UserProfile>) {
    if (users.isEmpty()) {
        EmptyMembersPlaceholder()
    } else {
        Card(
            modifier = Modifier
                .size(350.dp), // Changed to size() for a square/circle instead of fillMaxWidth + height
            colors = CardDefaults.cardColors(containerColor = GlassWhite),
            shape = CircleShape, // Changed from RoundedCornerShape to CircleShape
            elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)
        ) {
            // ✅ NEW CODE FIX - Using key() to properly use BoxWithConstraints scope
            BoxWithConstraints(
                modifier = Modifier
                    .fillMaxSize()
                    .border(
                        width = 1.dp,
                        color = GlassBorder,
                        shape = CircleShape // Changed to CircleShape to match outer shape
                    )
            ) {
                val containerWidth = constraints.maxWidth.toFloat()
                val containerHeight = constraints.maxHeight.toFloat()
                val bubbleSize = 70.dp
                val bubbleSizePx = with(LocalDensity.current) { bubbleSize.toPx() }

                // ✅ Using key() composable to iterate - this properly uses the scope
                users.forEachIndexed { index, user ->
                    key(user.userId) {
                        AnimatedFloatingBubble(
                            user = user,
                            index = index,
                            containerWidth = containerWidth,
                            containerHeight = containerHeight,
                            bubbleSize = bubbleSizePx
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun AnimatedFloatingBubble(
    user: UserProfile,
    index: Int,
    containerWidth: Float,
    containerHeight: Float,
    bubbleSize: Float
) {
    // Create unique random seed per user
    val seed = user.userId.hashCode() + index
    val random = remember(seed) { Random(seed) }

    // Initialize random starting position
    val initialX = remember(seed) {
        random.nextFloat() * (containerWidth - bubbleSize)
    }
    val initialY = remember(seed) {
        random.nextFloat() * (containerHeight - bubbleSize)
    }

    // Animated position
    val offsetX = remember { Animatable(initialX) }
    val offsetY = remember { Animatable(initialY) }

    // Animated scale for pulsing effect
    val scale = remember { Animatable(1f) }

    // Start animations
    LaunchedEffect(user.userId) {

        launch {
            while (true) {
                val targetX = random.nextFloat() * (containerWidth - bubbleSize)
                val targetY = random.nextFloat() * (containerHeight - bubbleSize)
                val duration = 2000 + random.nextInt(2000) // 2-4 seconds

                launch {
                    offsetX.animateTo(
                        targetValue = targetX,
                        animationSpec = tween(
                            durationMillis = duration,
                            easing = FastOutSlowInEasing
                        )
                    )
                }

                offsetY.animateTo(
                    targetValue = targetY,
                    animationSpec = tween(
                        durationMillis = duration,
                        easing = FastOutSlowInEasing
                    )
                )
            }
        }

        // Scale animation - gentle pulsing
        launch {
            while (true) {
                scale.animateTo(
                    targetValue = 1.1f,
                    animationSpec = tween(
                        durationMillis = 1000 + random.nextInt(500),
                        easing = FastOutSlowInEasing
                    )
                )
                scale.animateTo(
                    targetValue = 0.95f,
                    animationSpec = tween(
                        durationMillis = 1000 + random.nextInt(500),
                        easing = FastOutSlowInEasing
                    )
                )
            }
        }
    }

    // Render the bubble with animations
    Box(
        modifier = Modifier
            .offset { IntOffset(offsetX.value.roundToInt(), offsetY.value.roundToInt()) }
            .scale(scale.value)
    ) {
        UserBubbleAnimated(user = user)
    }
}

@Composable
private fun UserBubbleAnimated(user: UserProfile) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier.width(90.dp)
    ) {
        Box {
            // Outer glow effect
            Box(
                modifier = Modifier
                    .size(78.dp)
                    .clip(CircleShape)
                    .background(
                        Brush.radialGradient(
                            colors = listOf(
                                PurpleAccent.copy(alpha = 0.4f),
                                Color.Transparent
                            )
                        )
                    )
            )

            // Profile picture with glass border
            if (user.profilePicture?.isNotEmpty() == true) {
                if (user.profilePicture.startsWith("data:image/")) {
                    val painter = rememberBase64ImagePainter(user.profilePicture)
                    Image(
                        painter = painter,
                        contentDescription = user.name,
                        contentScale = ContentScale.Crop,
                        modifier = Modifier
                            .size(70.dp)
                            .align(Alignment.Center)
                            .clip(CircleShape)
                            .border(3.dp, PurpleAccent.copy(alpha = 0.8f), CircleShape)
                            .border(1.dp, GlassWhite, CircleShape)
                    )
                } else {
                    AsyncImage(
                        model = user.profilePicture,
                        contentDescription = user.name,
                        contentScale = ContentScale.Crop,
                        modifier = Modifier
                            .size(70.dp)
                            .align(Alignment.Center)
                            .clip(CircleShape)
                            .border(3.dp, PurpleAccent.copy(alpha = 0.8f), CircleShape)
                            .border(1.dp, GlassWhite, CircleShape)
                    )
                }
            } else {
                DefaultUserAvatar()
            }
        }

        Spacer(modifier = Modifier.height(8.dp))

        // Glass effect text background
        Box(
            modifier = Modifier
                .clip(RoundedCornerShape(12.dp))
                .background(GlassWhite)
                .padding(horizontal = 8.dp, vertical = 4.dp)
        ) {
            Text(
                text = user.name,
                fontSize = 12.sp,
                maxLines = 2,
                textAlign = TextAlign.Center,
                fontWeight = FontWeight.Medium,
                color = PurpleDark
            )
        }
    }
}

@Composable
private fun GroupReadyContent() {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(
                Brush.verticalGradient(
                    colors = listOf(
                        PurpleGradientStart,
                        PurpleGradientEnd
                    )
                )
            ),
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            Card(
                modifier = Modifier.size(120.dp),
                shape = CircleShape,
                colors = CardDefaults.cardColors(containerColor = PurpleAccent),
                elevation = CardDefaults.cardElevation(defaultElevation = 12.dp)
            ) {
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.Default.Restaurant,
                        contentDescription = "Restaurant",
                        modifier = Modifier.size(60.dp),
                        tint = Color.White
                    )
                }
            }

            Spacer(modifier = Modifier.height(32.dp))

            Text(
                "Group Ready!",
                fontWeight = FontWeight.Bold,
                fontSize = 28.sp,
                color = PurpleDark
            )

            Spacer(modifier = Modifier.height(16.dp))

            CircularProgressIndicator(
                modifier = Modifier.size(40.dp),
                color = PurpleAccent,
                strokeWidth = 4.dp
            )

            Spacer(modifier = Modifier.height(16.dp))

            Text(
                "Preparing your group...",
                fontSize = 16.sp,
                color = PurpleDark.copy(alpha = 0.7f)
            )

            Spacer(modifier = Modifier.height(8.dp))

            Text(
                "You'll be redirected shortly",
                fontSize = 14.sp,
                color = PurpleDark.copy(alpha = 0.5f)
            )
        }
    }
}

@Composable
fun UserBubbleRow(users: List<UserProfile>) {
    if (users.isEmpty()) {
        EmptyMembersPlaceholder()
    } else {
        MembersList(users = users)
    }
}

@Composable
private fun EmptyMembersPlaceholder() {
    Card(
        modifier = Modifier
            .size(350.dp), // Changed to size() for circular shape
        colors = CardDefaults.cardColors(containerColor = GlassWhite),
        shape = CircleShape, // Changed to CircleShape
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)
    ) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .border(
                    width = 1.dp,
                    color = GlassBorder,
                    shape = CircleShape // Changed to CircleShape
                ),
            contentAlignment = Alignment.Center
        ) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                CircularProgressIndicator(
                    modifier = Modifier.size(40.dp),
                    color = PurpleAccent
                )
                Spacer(modifier = Modifier.height(12.dp))
                Text(
                    "Loading members...",
                    fontSize = 14.sp,
                    color = PurpleDark.copy(alpha = 0.7f)
                )
            }
        }
    }
}

@Composable
private fun MembersList(users: List<UserProfile>) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        LazyRow(
            horizontalArrangement = Arrangement.spacedBy(16.dp),
            contentPadding = PaddingValues(16.dp),
            modifier = Modifier.fillMaxWidth()
        ) {
            items(users, key = { it.userId }) { user ->
                AnimatedVisibility(
                    visible = true,
                    enter = fadeIn() + scaleIn(),
                    exit = fadeOut() + scaleOut()
                ) {
                    UserBubble(user = user)
                }
            }
        }
    }
}

@Composable
private fun UserBubble(user: UserProfile) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier.width(90.dp)
    ) {
        if (user.profilePicture?.isNotEmpty() == true) {
            if (user.profilePicture.startsWith("data:image/")) {
                val painter = rememberBase64ImagePainter(user.profilePicture)
                Image(
                    painter = painter,
                    contentDescription = user.name,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier
                        .size(70.dp)
                        .clip(CircleShape)
                        .border(3.dp, Color(0xFFFFD54F), CircleShape)
                )
            } else {
                AsyncImage(
                    model = user.profilePicture,
                    contentDescription = user.name,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier
                        .size(70.dp)
                        .clip(CircleShape)
                        .border(3.dp, Color(0xFFFFD54F), CircleShape)
                )
            }
        } else {
            DefaultUserAvatar()
        }

        Spacer(modifier = Modifier.height(8.dp))

        Text(
            text = user.name,
            fontSize = 12.sp,
            maxLines = 2,
            textAlign = TextAlign.Center,
            fontWeight = FontWeight.Medium,
            color = Color.Black
        )
    }
}

@Composable
private fun DefaultUserAvatar() {
    Box(
        modifier = Modifier
            .size(70.dp)
            .clip(CircleShape)
            .background(
                Brush.radialGradient(
                    colors = listOf(
                        PurpleAccent,
                        PurpleDark
                    )
                )
            )
            .border(3.dp, PurpleAccent.copy(alpha = 0.8f), CircleShape)
            .border(1.dp, GlassWhite, CircleShape),
        contentAlignment = Alignment.Center
    ) {
        Icon(
            imageVector = Icons.Default.Person,
            contentDescription = "Default avatar",
            modifier = Modifier.size(40.dp),
            tint = Color.White
        )
    }
}

@Composable
private fun LeaveRoomDialog(
    showDialog: Boolean,
    onDismiss: () -> Unit,
    onConfirm: () -> Unit
) {
    if (showDialog) {
        AlertDialog(
            onDismissRequest = onDismiss,
            title = {
                Text(
                    "Leave Waiting Room?",
                    fontWeight = FontWeight.Bold,
                    color = PurpleDark
                )
            },
            text = {
                Text(
                    "Are you sure you want to leave? You'll lose your spot in this room.",
                    color = PurpleDark.copy(alpha = 0.8f)
                )
            },
            confirmButton = {
                TextButton(
                    onClick = onConfirm
                ) {
                    Text("Leave", color = Color(0xFFD88BB7), fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(onClick = onDismiss) {
                    Text("Stay", color = PurpleDark)
                }
            },
            containerColor = GlassWhite,
            shape = RoundedCornerShape(24.dp)
        )
    }
}

@Composable
private fun FailureDialog(
    showDialog: Boolean,
    minNumberOfPeople: Int,
    onConfirm: () -> Unit
) {
    if (showDialog) {
        AlertDialog(
            onDismissRequest = { },
            title = {
                Text(
                    "Unable to Create Group",
                    fontWeight = FontWeight.Bold,
                    color = Color(0xFFD88BB7)
                )
            },
            text = {
                Column {
                    Text(
                        "The waiting room timer expired, but not enough people joined.",
                        color = PurpleDark.copy(alpha = 0.8f)
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        "Minimum $minNumberOfPeople members required to form a group.",
                        fontWeight = FontWeight.SemiBold,
                        color = PurpleDark
                    )
                }
            },
            confirmButton = {
                TextButton(onClick = onConfirm) {
                    Text("Try Again", color = PurpleDark, fontWeight = FontWeight.Bold)
                }
            },
            containerColor = PurpleLight,
            shape = RoundedCornerShape(24.dp)
        )
    }
}
