
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
import androidx.compose.material.icons.filled.Group
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.blur
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
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
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
import com.example.cpen_321.ui.theme.*
import com.example.cpen_321.ui.theme.Typography

// Circular Timer Ring Gradient (specific to timer)
private val PinkViolet = Color(0xFFE178C5) // Pink-Violet
private val PurplePink = Color(0xFFB56CFF) // Purple-Pink
private val LightLavender = Color(0xFFD9B3FF) // Light Lavender

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
            .background(Color.White)
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = 24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Top
        ) {
            Spacer(modifier = Modifier.height(48.dp))
            
            // "X friends joined" badge at the top
            Box(
                modifier = Modifier
                    .background(
                        color = OffWhiteTint,
                        shape = RoundedCornerShape(20.dp)
                    )
                    .border(
                        width = 1.dp,
                        color = LightBorder,
                        shape = RoundedCornerShape(20.dp)
                    )
                    .padding(horizontal = 16.dp, vertical = 8.dp)
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.Group,
                        contentDescription = "Friends",
                        modifier = Modifier.size(18.dp),
                        tint = VividPurple
                    )
                    Text(
                        text = "${roomMembers.size} friends joined",
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Medium,
                        color = TextSecondary,
                        fontFamily = InterFontFamily
                    )
                }
            }
            
            Spacer(modifier = Modifier.height(24.dp))
            
            // FeastFriends title
            Text(
                text = "FeastFriends",
                fontSize = 24.sp,
                fontWeight = FontWeight.SemiBold,
                color = TextPrimary,
                letterSpacing = 0.5.sp,
                fontFamily = InterFontFamily
            )
            
            Spacer(modifier = Modifier.height(48.dp))
            
            // Large circular timer ring with profile pictures around it
            BoxWithConstraints(
                modifier = Modifier.size(320.dp)
            ) {
                val centerX = constraints.maxWidth / 2f
                val centerY = constraints.maxHeight / 2f
                
                // Remember the initial time remaining based on the room to calculate total time
                // Use roomId as key so it resets when joining a new room
                val roomId = (currentRoom as? com.example.cpen_321.data.model.Room)?.roomId ?: ""
                val totalTime = remember(roomId) {
                    // Capture the first timeRemaining value when room changes
                    // Backend sets ROOM_DURATION_MS = 15 seconds (15000ms)
                    if (timeRemaining > 0) {
                        timeRemaining
                    } else {
                        15000L // Fallback to 15 seconds matching backend ROOM_DURATION_MS
                    }
                }
                
                // Circular progress ring (incomplete circle)
                CircularTimerRing(
                    timeRemaining = timeRemaining,
                    totalTime = totalTime,
                    modifier = Modifier.fillMaxSize()
                )
                
                // Profile pictures positioned on triangular orbit with floating animation (matching Figma)
                roomMembers.forEachIndexed { index, user ->
                    // Triangular orbit: 3 positions - one at top, two at bottom forming equilateral triangle
                    val triangleAngles = listOf(-90f, 30f, 150f) // Top, bottom-right, bottom-left
                    val angle = if (index < 3) {
                        triangleAngles[index]
                    } else {
                        // For more than 3 members, distribute evenly around circle
                        (index * 360f / maxOf(roomMembers.size, 1)) - 90f
                    }
                    val radius = 120.dp // Positioned on the circle edge
                    val density = LocalDensity.current
                    val radiusPx = with(density) { radius.toPx() }
                    val profileWidthPx = with(density) { 90.dp.toPx() } // Width for avatar + name
                    val profileHeightPx = with(density) { 100.dp.toPx() } // Height for avatar + name
                    val angleRad = (angle * PI / 180).toFloat()
                    val xPx = centerX + (cos(angleRad) * radiusPx) - (profileWidthPx / 2)
                    val yPx = centerY + (sin(angleRad) * radiusPx) - (profileHeightPx / 2)
                    
                    // Faster floating animation with more movement
                    val infiniteTransition = rememberInfiniteTransition(label = "float_$index")
                    val floatOffset by infiniteTransition.animateFloat(
                        initialValue = -6f,
                        targetValue = 6f,
                        animationSpec = infiniteRepeatable(
                            animation = tween(
                                durationMillis = 1500 + (index * 150),
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
                            .width(90.dp)
                    ) {
                        ProfilePictureOnRing(
                            user = user,
                            angle = angle,
                            radius = radius
                        )
                    }
                }
                
                // "Waiting Room" text and timer in center
                Column(
                    modifier = Modifier.align(Alignment.Center),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text(
                        text = "Waiting Room",
                        fontSize = 20.sp,
                        fontWeight = FontWeight.Medium,
                        color = VividPurple,
                        letterSpacing = 0.5.sp,
                        fontFamily = InterFontFamily
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    val timeRemainingSeconds = (timeRemaining / 1000).toInt()
                    val minutes = timeRemainingSeconds / 60
                    val seconds = timeRemainingSeconds % 60
                    Text(
                        text = String.format("%d:%02d", minutes, seconds),
                        fontSize = 48.sp,
                        fontWeight = FontWeight.Bold,
                        color = TextPrimary,
                        fontFamily = InterFontFamily
                    )
                }
            }
            
            Spacer(modifier = Modifier.height(24.dp))
            
            // "Your table will be ready soon..." message
            Text(
                text = "Your table will be ready soon...",
                fontSize = 16.sp,
                fontWeight = FontWeight.Medium,
                color = VividPurple,
                letterSpacing = 0.2.sp,
                fontFamily = InterFontFamily
            )
            
            Spacer(modifier = Modifier.height(80.dp))
            
            // Leave Room button - light background with purple outline (bigger like Figma)
            OutlinedButton(
                onClick = onLeaveClick,
                modifier = Modifier
                    .fillMaxWidth(0.9f)
                    .height(110.dp)
                    .padding(bottom = 50.dp),
                colors = ButtonDefaults.outlinedButtonColors(
                    containerColor = OffWhiteTint,
                    contentColor = TextPrimary
                ),
                border = androidx.compose.foundation.BorderStroke(
                    width = 2.dp,
                    color = LightBorder
                ),
                shape = RoundedCornerShape(36.dp),
                elevation = ButtonDefaults.buttonElevation(
                    defaultElevation = 0.dp,
                    pressedElevation = 2.dp
                )
            ) {
                Text(
                    text = "Leave Room",
                    fontSize = 22.sp,
                    fontWeight = FontWeight.Normal,
                    color = TextPrimary,
                    fontFamily = InterFontFamily,
                    letterSpacing = 0.5.sp
                )
            }
        }
    }
}

@Composable
private fun CircularTimerRing(
    timeRemaining: Long,
    totalTime: Long,
    modifier: Modifier = Modifier
) {
    // Total time comes from backend (15 seconds = 15000ms) or initial time remaining
    // Progress shows remaining time - starts at 1.0 (full) and decreases to 0.0
    val progress = if (totalTime > 0) {
        (timeRemaining.toFloat() / totalTime.toFloat()).coerceIn(0f, 1f)
    } else {
        0f
    }
    
    // Draw circular progress ring with gradient
    Canvas(
        modifier = modifier
    ) {
        val strokeWidth = 16.dp.toPx()
        val radius = (size.minDimension - strokeWidth) / 2
        val center = Offset(size.width / 2, size.height / 2)
        
        // Background ring (full circle, very light)
        drawCircle(
            color = LightLavender.copy(alpha = 0.15f),
            radius = radius,
            center = center,
            style = Stroke(width = strokeWidth, cap = androidx.compose.ui.graphics.StrokeCap.Round)
        )
        
        // Progress ring - starts FULL and decreases as time runs out
        // When progress = 1.0 (full time), sweepAngle = 360f (full circle)
        // As time decreases, progress decreases, sweepAngle decreases
        val sweepAngle = progress * 360f
        
        // Always draw the progress ring (even if 0, but we check > 0)
        if (sweepAngle > 0) {
            // Create gradient effect using the three colors from Figma
            // Gradient: PinkViolet (#E178C5) → PurplePink (#B56CFF) → LightLavender (#D9B3FF)
            val startAngle = -90f // Start from top
            
            // For a full circle (360 degrees), we need to ensure it draws completely
            // Use enough segments for smooth gradient
            val numSegments = if (sweepAngle >= 359.9f) {
                120 // More segments for full circle to ensure smoothness
            } else {
                90
            }
            val anglePerSegment = sweepAngle / numSegments
            
            for (i in 0 until numSegments) {
                val segmentStart = startAngle + (i * anglePerSegment)
                val segmentSweep = anglePerSegment
                
                // Calculate color based on position in the gradient (0.0 to 1.0)
                // Position is based on the FULL circle, not just the current sweep
                val gradientPosition = (i * anglePerSegment) / 360f
                val color = when {
                    gradientPosition < 0.4f -> {
                        // First 40%: PinkViolet to PurplePink
                        val t = gradientPosition / 0.4f
                        Color(
                            red = PinkViolet.red + (PurplePink.red - PinkViolet.red) * t,
                            green = PinkViolet.green + (PurplePink.green - PinkViolet.green) * t,
                            blue = PinkViolet.blue + (PurplePink.blue - PinkViolet.blue) * t,
                            alpha = 1f
                        )
                    }
                    else -> {
                        // Last 60%: PurplePink to LightLavender
                        val t = ((gradientPosition - 0.4f) / 0.6f).coerceIn(0f, 1f)
                        Color(
                            red = PurplePink.red + (LightLavender.red - PurplePink.red) * t,
                            green = PurplePink.green + (LightLavender.green - PurplePink.green) * t,
                            blue = PurplePink.blue + (LightLavender.blue - PurplePink.blue) * t,
                            alpha = 1f
                        )
                    }
                }
                
                drawArc(
                    color = color,
                    startAngle = segmentStart,
                    sweepAngle = segmentSweep,
                    useCenter = false,
                    style = Stroke(width = strokeWidth, cap = androidx.compose.ui.graphics.StrokeCap.Round),
                    topLeft = Offset(center.x - radius, center.y - radius),
                    size = Size(radius * 2, radius * 2)
                )
            }
        }
    }
}

@Composable
private fun ProfilePictureOnRing(
    user: UserProfile,
    angle: Float,
    radius: androidx.compose.ui.unit.Dp
) {
    Column(
        modifier = Modifier.width(110.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        // Profile picture
        Box(
            modifier = Modifier.size(90.dp)
        ) {
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
                                    VividPurple,
                                    MediumPurple
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
                        modifier = Modifier.size(45.dp),
                        tint = Color.White
                    )
                }
            }
        }
        
        Spacer(modifier = Modifier.height(6.dp))
        
        // Name below avatar with glassmorphism effect
        Box(
            modifier = Modifier
                .shadow(
                    elevation = 4.dp,
                    shape = RoundedCornerShape(12.dp),
                    spotColor = Color.Black.copy(alpha = 0.1f)
                )
                .background(
                    brush = Brush.linearGradient(
                        colors = listOf(
                            GlassWhite.copy(alpha = 0.9f),
                            GlassWhite.copy(alpha = 0.7f)
                        )
                    ),
                    shape = RoundedCornerShape(12.dp)
                )
                .border(
                    width = 1.dp,
                    brush = Brush.linearGradient(
                        colors = listOf(
                            Color.White.copy(alpha = 0.5f),
                            Color.White.copy(alpha = 0.3f)
                        )
                    ),
                    shape = RoundedCornerShape(12.dp)
                )
                .padding(horizontal = 12.dp, vertical = 5.dp)
        ) {
            Text(
                text = user.name.split(" ").firstOrNull() ?: user.name.take(10),
                fontSize = 12.sp,
                fontWeight = FontWeight.Medium,
                color = TextPrimary,
                fontFamily = InterFontFamily,
                maxLines = 1,
                textAlign = TextAlign.Center
            )
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
                                VividPurple.copy(alpha = 0.4f),
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
                            .border(3.dp, VividPurple.copy(alpha = 0.8f), CircleShape)
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
                            .border(3.dp, VividPurple.copy(alpha = 0.8f), CircleShape)
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
                color = TextPrimary
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
                        GradientTop,
                        GradientMiddle,
                        GradientBottom
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
                colors = CardDefaults.cardColors(containerColor = VividPurple),
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
                color = TextPrimary
            )

            Spacer(modifier = Modifier.height(16.dp))

            CircularProgressIndicator(
                modifier = Modifier.size(40.dp),
                color = VividPurple,
                strokeWidth = 4.dp
            )

            Spacer(modifier = Modifier.height(16.dp))

            Text(
                "Preparing your group...",
                fontSize = 16.sp,
                color = TextPrimary.copy(alpha = 0.7f)
            )

            Spacer(modifier = Modifier.height(8.dp))

            Text(
                "You'll be redirected shortly",
                fontSize = 14.sp,
                color = TextPrimary.copy(alpha = 0.5f)
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
                    color = VividPurple
                )
                Spacer(modifier = Modifier.height(12.dp))
                Text(
                    "Loading members...",
                    fontSize = 14.sp,
                    color = TextPrimary.copy(alpha = 0.7f)
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
                        VividPurple,
                        TextPrimary
                    )
                )
            )
            .border(3.dp, VividPurple.copy(alpha = 0.8f), CircleShape)
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
                    color = TextPrimary
                )
            },
            text = {
                Text(
                    "Are you sure you want to leave? You'll lose your spot in this room.",
                    color = TextPrimary.copy(alpha = 0.8f)
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
                    Text("Stay", color = TextPrimary)
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
                        color = TextPrimary.copy(alpha = 0.8f)
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        "Minimum $minNumberOfPeople members required to form a group.",
                        fontWeight = FontWeight.SemiBold,
                        color = TextPrimary
                    )
                }
            },
            confirmButton = {
                TextButton(onClick = onConfirm) {
                    Text("Try Again", color = TextPrimary, fontWeight = FontWeight.Bold)
                }
            },
            containerColor = PurpleLight,
            shape = RoundedCornerShape(24.dp)
        )
    }
}
