package com.example.cpen_321.ui.screens

import androidx.compose.animation.*
import androidx.compose.animation.core.*
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.NavController
import coil.compose.AsyncImage
import com.example.cpen_321.data.model.Restaurant
import com.example.cpen_321.ui.viewmodels.SequentialVotingViewModel
import com.example.cpen_321.ui.theme.*
import kotlinx.coroutines.launch

@Composable
fun SequentialVotingScreen(
    navController: NavController,
    groupId: String,
    viewModel: SequentialVotingViewModel = hiltViewModel()
) {
    val snackbarHostState = remember { SnackbarHostState() }
    val scope = rememberCoroutineScope()

    // State
    val currentRestaurant by viewModel.currentRestaurant.collectAsState()
    val roundNumber by viewModel.roundNumber.collectAsState()
    val totalRounds by viewModel.totalRounds.collectAsState()
    val timeRemaining by viewModel.timeRemaining.collectAsState()
    val yesVotes by viewModel.yesVotes.collectAsState()
    val noVotes by viewModel.noVotes.collectAsState()
    val totalMembers by viewModel.totalMembers.collectAsState()
    val userVote by viewModel.userVote.collectAsState()
    val selectedRestaurant by viewModel.selectedRestaurant.collectAsState()
    val votingComplete by viewModel.votingComplete.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()
    val errorMessage by viewModel.errorMessage.collectAsState()
    val successMessage by viewModel.successMessage.collectAsState()

    // Initialize voting on first load
    LaunchedEffect(Unit) {
        viewModel.smartInitializeVoting(groupId)
    }

    // Handle errors
    LaunchedEffect(errorMessage) {
        errorMessage?.let { message ->
            snackbarHostState.showSnackbar(message)
            viewModel.clearError()
        }
    }

    // Handle success messages
    LaunchedEffect(successMessage) {
        successMessage?.let { message ->
            snackbarHostState.showSnackbar(message)
            viewModel.clearSuccess()
        }
    }

    // Navigate when voting complete
    LaunchedEffect(votingComplete) {
        if (votingComplete && selectedRestaurant != null) {
            kotlinx.coroutines.delay(2000)
            navController.navigate("group/$groupId") {
                popUpTo(0)
            }
        }
    }

    Scaffold(
        snackbarHost = { SnackbarHost(hostState = snackbarHostState) },
        containerColor = GradientTop
    ) { padding ->
        if (votingComplete && selectedRestaurant != null) {
            // Show success screen
            RestaurantSelectedScreen(
                restaurant = selectedRestaurant!!,
                modifier = Modifier.padding(padding)
            )
        } else if (currentRestaurant != null) {
            // Show voting screen
            VotingContent(
                restaurant = currentRestaurant!!,
                roundNumber = roundNumber,
                totalRounds = totalRounds,
                timeRemaining = timeRemaining,
                yesVotes = yesVotes,
                noVotes = noVotes,
                totalMembers = totalMembers,
                userVote = userVote,
                isLoading = isLoading,
                onVoteYes = { viewModel.submitVote(groupId, true) },
                onVoteNo = { viewModel.submitVote(groupId, false) },
                modifier = Modifier.padding(padding)
            )
        } else {
            // Loading state
            LoadingVotingScreen(modifier = Modifier.padding(padding))
        }
    }
}

@Composable
private fun VotingContent(
    restaurant: Restaurant,
    roundNumber: Int,
    totalRounds: Int,
    timeRemaining: Int,
    yesVotes: Int,
    noVotes: Int,
    totalMembers: Int,
    userVote: Boolean?,
    isLoading: Boolean,
    onVoteYes: () -> Unit,
    onVoteNo: () -> Unit,
    modifier: Modifier = Modifier
) {
    Box(
        modifier = modifier
            .fillMaxSize()
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
                .padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
        // Progress indicator
        ProgressIndicator(
            roundNumber = roundNumber,
            totalRounds = totalRounds,
            modifier = Modifier.fillMaxWidth()
        )

        Spacer(modifier = Modifier.height(16.dp))

        // Countdown timer
        CountdownTimer(
            timeRemaining = timeRemaining,
            modifier = Modifier.fillMaxWidth()
        )

        Spacer(modifier = Modifier.height(24.dp))

        // Restaurant card
        RestaurantVoteCard(
            restaurant = restaurant,
            modifier = Modifier
                .fillMaxWidth()
                .weight(1f)
        )

        Spacer(modifier = Modifier.height(24.dp))

        // Vote status
        VoteStatus(
            yesVotes = yesVotes,
            noVotes = noVotes,
            totalMembers = totalMembers,
            userVote = userVote,
            modifier = Modifier.fillMaxWidth()
        )

        Spacer(modifier = Modifier.height(24.dp))

        // Vote buttons
        VoteButtons(
            userVote = userVote,
            isLoading = isLoading,
            onVoteYes = onVoteYes,
            onVoteNo = onVoteNo,
            modifier = Modifier.fillMaxWidth()
        )
        }
    }
}

@Composable
private fun ProgressIndicator(
    roundNumber: Int,
    totalRounds: Int,
    modifier: Modifier = Modifier
) {
    Column(modifier = modifier) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = "Restaurant $roundNumber of $totalRounds",
                fontSize = 16.sp,
                fontWeight = FontWeight.Bold,
                color = TextPrimary
            )

            Text(
                text = "${((roundNumber.toFloat() / totalRounds) * 100).toInt()}%",
                fontSize = 14.sp,
                color = TextSecondary
            )
        }

        Spacer(modifier = Modifier.height(8.dp))

        LinearProgressIndicator(
            progress = if (totalRounds > 0) roundNumber.toFloat() / totalRounds else 0f,
            modifier = Modifier
                .fillMaxWidth()
                .height(8.dp)
                .clip(RoundedCornerShape(4.dp)),
            color = VividPurple,
            trackColor = LightBorder
        )
    }
}

@Composable
private fun CountdownTimer(
    timeRemaining: Int,
    modifier: Modifier = Modifier
) {
    val timerColor = when {
        timeRemaining > 30 -> VividPurple
        timeRemaining > 10 -> MediumPurple
        else -> SoftViolet
    }

    // Pulse animation when time is low
    val infiniteTransition = rememberInfiniteTransition(label = "timer")
    val alpha by infiniteTransition.animateFloat(
        initialValue = if (timeRemaining <= 10) 0.3f else 1f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(
            animation = tween(500),
            repeatMode = RepeatMode.Reverse
        ),
        label = "alpha"
    )

    Card(
        modifier = modifier,
        colors = CardDefaults.cardColors(
            containerColor = timerColor.copy(alpha = if (timeRemaining <= 10) alpha else 1f)
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 4.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            horizontalArrangement = Arrangement.Center,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                imageVector = Icons.Default.Timer,
                contentDescription = "Timer",
                tint = Color.White,
                modifier = Modifier.size(24.dp)
            )

            Spacer(modifier = Modifier.width(12.dp))

            Text(
                text = formatTime(timeRemaining),
                fontSize = 24.sp,
                fontWeight = FontWeight.Bold,
                color = Color.White
            )
        }
    }
}

@Composable
private fun RestaurantVoteCard(
    restaurant: Restaurant,
    modifier: Modifier = Modifier
) {
    // ✅ ADD THIS LOGGING HERE - right at the start
    val photoUrl = restaurant.getMainPhotoUrl()
    android.util.Log.d("RestaurantCard", "🖼️ Restaurant: ${restaurant.name}")
    android.util.Log.d("RestaurantCard", "🖼️ Photo URL: $photoUrl")
    android.util.Log.d("RestaurantCard", "🖼️ Photos array: ${restaurant.photos}")

    Card(
        modifier = modifier,
        shape = RoundedCornerShape(16.dp),
        elevation = CardDefaults.cardElevation(defaultElevation = 8.dp),
        colors = CardDefaults.cardColors(
            containerColor = SoftWhite
        )
    ) {
        Column(
            modifier = Modifier.fillMaxSize()
        ) {
            // Restaurant image
            restaurant.getMainPhotoUrl()?.let { photoUrl ->
                AsyncImage(
                    model = photoUrl,
                    contentDescription = restaurant.name,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(200.dp)
                        .clip(RoundedCornerShape(topStart = 16.dp, topEnd = 16.dp))
                        .background(Color.LightGray),
                    onError = { error ->
                        android.util.Log.e("RestaurantCard", "❌ Failed to load image: $photoUrl")
                        android.util.Log.e("RestaurantCard", "❌ Error: ${error.result.throwable.message}")
                    },
                    onSuccess = {
                        android.util.Log.d("RestaurantCard", "✅ Image loaded successfully!")
                    }
                )
            } ?: Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(300.dp)
                    .background(Color.LightGray),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = Icons.Default.Restaurant,
                    contentDescription = null,
                    modifier = Modifier.size(64.dp),
                    tint = TextSecondary
                )
            }

            // Restaurant info
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(20.dp)
            ) {
                Text(
                    text = restaurant.name,
                    fontSize = 28.sp,
                    fontWeight = FontWeight.Bold,
                    color = TextPrimary,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis
                )

                Spacer(modifier = Modifier.height(8.dp))

                // Rating and price
                Row(
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    restaurant.rating?.let { rating ->
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(
                                imageVector = Icons.Default.Star,
                                contentDescription = "Rating",
                                tint = VividPurple,
                                modifier = Modifier.size(20.dp)
                            )
                            Spacer(modifier = Modifier.width(4.dp))
                            Text(
                                text = restaurant.getRatingString(),
                                fontSize = 16.sp,
                                color = TextSecondary
                            )
                        }
                    }

                    restaurant.priceLevel?.let {
                        Spacer(modifier = Modifier.width(16.dp))
                        Text(
                            text = restaurant.getPriceLevelString(),
                            fontSize = 16.sp,
                            color = TextSecondary,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }

                Spacer(modifier = Modifier.height(12.dp))

                // Location
                Row(
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(
                        imageVector = Icons.Default.LocationOn,
                        contentDescription = "Location",
                        tint = TextSecondary,
                        modifier = Modifier.size(18.dp)
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(
                        text = restaurant.location,
                        fontSize = 14.sp,
                        color = TextSecondary,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis
                    )
                }
            }
        }
    }
}

@Composable
private fun VoteStatus(
    yesVotes: Int,
    noVotes: Int,
    totalMembers: Int,
    userVote: Boolean?,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier,
        colors = CardDefaults.cardColors(
            containerColor = SoftWhite
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text(
                    text = "${yesVotes + noVotes}/$totalMembers members voted",
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Medium,
                    color = TextSecondary
                )
            }

            Spacer(modifier = Modifier.height(8.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceEvenly
            ) {
                VoteCount(
                    count = yesVotes,
                    label = "Yes",
                    color = VividPurple,
                    icon = Icons.Default.ThumbUp
                )

                VoteCount(
                    count = noVotes,
                    label = "No",
                    color = MediumPurple,
                    icon = Icons.Default.ThumbDown
                )
            }

            if (userVote != null) {
                Spacer(modifier = Modifier.height(12.dp))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.Center,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(
                        imageVector = Icons.Default.Check,
                        contentDescription = null,
                        tint = if (userVote) VividPurple else MediumPurple,
                        modifier = Modifier.size(16.dp)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = "You voted ${if (userVote) "YES" else "NO"}",
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Bold,
                        color = if (userVote) VividPurple else MediumPurple
                    )
                }
            }
        }
    }
}

@Composable
private fun VoteCount(
    count: Int,
    label: String,
    color: Color,
    icon: androidx.compose.ui.graphics.vector.ImageVector
) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Icon(
            imageVector = icon,
            contentDescription = label,
            tint = color,
            modifier = Modifier.size(24.dp)
        )
        Spacer(modifier = Modifier.height(4.dp))
        Text(
            text = count.toString(),
            fontSize = 20.sp,
            fontWeight = FontWeight.Bold,
            color = color
        )
        Text(
            text = label,
            fontSize = 12.sp,
            color = TextSecondary
        )
    }
}

@Composable
private fun VoteButtons(
    userVote: Boolean?,
    isLoading: Boolean,
    onVoteYes: () -> Unit,
    onVoteNo: () -> Unit,
    modifier: Modifier = Modifier
) {
    Row(
        modifier = modifier,
        horizontalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // NO button
        Button(
            onClick = onVoteNo,
            modifier = Modifier
                .weight(1f)
                .height(70.dp),
            enabled = userVote == null && !isLoading,
            colors = ButtonDefaults.buttonColors(
                containerColor = MediumPurple,
                disabledContainerColor = TextSecondary
            ),
            shape = RoundedCornerShape(35.dp),
            elevation = ButtonDefaults.buttonElevation(
                defaultElevation = 8.dp,
                pressedElevation = 12.dp
            )
        ) {
            if (isLoading && userVote == false) {
                CircularProgressIndicator(
                    modifier = Modifier.size(24.dp),
                    color = Color.White
                )
            } else {
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Icon(
                        imageVector = Icons.Default.ThumbDown,
                        contentDescription = "Vote No",
                        modifier = Modifier.size(32.dp),
                        tint = Color.White
                    )
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = "NO",
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color.White
                    )
                }
            }
        }

        // YES button
        Button(
            onClick = onVoteYes,
            modifier = Modifier
                .weight(1f)
                .height(70.dp),
            enabled = userVote == null && !isLoading,
            colors = ButtonDefaults.buttonColors(
                containerColor = VividPurple,
                disabledContainerColor = TextSecondary
            ),
            shape = RoundedCornerShape(35.dp),
            elevation = ButtonDefaults.buttonElevation(
                defaultElevation = 8.dp,
                pressedElevation = 12.dp
            )
        ) {
            if (isLoading && userVote == true) {
                CircularProgressIndicator(
                    modifier = Modifier.size(24.dp),
                    color = Color.White
                )
            } else {
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Icon(
                        imageVector = Icons.Default.ThumbUp,
                        contentDescription = "Vote Yes",
                        modifier = Modifier.size(32.dp),
                        tint = Color.White
                    )
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = "YES",
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color.White
                    )
                }
            }
        }
    }
}

@Composable
private fun LoadingVotingScreen(modifier: Modifier = Modifier) {
    Box(
        modifier = modifier.fillMaxSize(),
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            CircularProgressIndicator(
                modifier = Modifier.size(64.dp),
                color = VividPurple
            )
            Spacer(modifier = Modifier.height(16.dp))
            Text(
                text = "Preparing restaurants...",
                fontSize = 18.sp,
                color = TextSecondary
            )
        }
    }
}

@Composable
private fun RestaurantSelectedScreen(
    restaurant: Restaurant,
    modifier: Modifier = Modifier
) {
    Box(
        modifier = modifier.fillMaxSize(),
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            modifier = Modifier.padding(32.dp)
        ) {
            // Success icon with animation
            val infiniteTransition = rememberInfiniteTransition(label = "success")
            val scale by infiniteTransition.animateFloat(
                initialValue = 1f,
                targetValue = 1.1f,
                animationSpec = infiniteRepeatable(
                    animation = tween(800),
                    repeatMode = RepeatMode.Reverse
                ),
                label = "scale"
            )

            Box(
                modifier = Modifier
                    .size(120.dp)
                    .background(VividPurple, CircleShape),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = Icons.Default.Check,
                    contentDescription = "Success",
                    tint = Color.White,
                    modifier = Modifier.size(80.dp)
                )
            }

            Spacer(modifier = Modifier.height(32.dp))

            Text(
                text = "Restaurant Selected!",
                fontSize = 28.sp,
                fontWeight = FontWeight.Bold,
                color = Color(0xFF333333),
                textAlign = TextAlign.Center
            )

            Spacer(modifier = Modifier.height(16.dp))

            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(
                    containerColor = SoftWhite
                ),
                elevation = CardDefaults.cardElevation(defaultElevation = 4.dp)
            ) {
                Column(
                    modifier = Modifier.padding(24.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text(
                        text = restaurant.name,
                        fontSize = 24.sp,
                        fontWeight = FontWeight.Bold,
                        textAlign = TextAlign.Center,
                        color = Color(0xFF333333)
                    )

                    Spacer(modifier = Modifier.height(8.dp))

                    Text(
                        text = "Redirecting to group...",
                        fontSize = 14.sp,
                        color = TextSecondary,
                        textAlign = TextAlign.Center
                    )
                }
            }
        }
    }
}

private fun formatTime(seconds: Int): String {
    val mins = seconds / 60
    val secs = seconds % 60
    return String.format("%d:%02d", mins, secs)
}