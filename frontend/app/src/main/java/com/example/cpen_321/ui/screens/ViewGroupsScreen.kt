package com.example.cpen_321.ui.screens

import androidx.compose.animation.core.animateDpAsState
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectVerticalDragGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.KeyboardArrowUp
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Restaurant
import androidx.compose.material.icons.filled.Shield
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.NavController
import coil.compose.AsyncImage
import com.example.cpen_321.data.model.GroupMember
import com.example.cpen_321.ui.components.MainBottomBar
import com.example.cpen_321.ui.viewmodels.GroupViewModel
import com.example.cpen_321.utils.rememberBase64ImagePainter
import kotlin.math.roundToInt

@Composable
fun ViewGroupsScreen(
    navController: NavController,
    viewModel: GroupViewModel = hiltViewModel()
) {
    val currentGroup by viewModel.currentGroup.collectAsState()
    val groupMembers by viewModel.groupMembers.collectAsState()
    val selectedRestaurant by viewModel.selectedRestaurant.collectAsState()
    val credibilityState by viewModel.credibilityState.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()
    val errorMessage by viewModel.errorMessage.collectAsState()
    val successMessage by viewModel.successMessage.collectAsState()

    val snackbarHostState = remember { SnackbarHostState() }
    var showLeaveDialog by remember { mutableStateOf(false) }
    var showVerifyDialog by remember { mutableStateOf(false) }

    // ✅ NEW: Track if bottom sheet is expanded
    var isBottomSheetExpanded by remember { mutableStateOf(true) }

    ViewGroupsEffects(
        viewModel = viewModel,
        errorMessage = errorMessage,
        successMessage = successMessage,
        snackbarHostState = snackbarHostState
    )

    Scaffold(
        snackbarHost = { SnackbarHost(snackbarHostState) },
        bottomBar = { MainBottomBar(navController = navController) }
    ) { innerPadding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
        ) {
            ViewGroupsContent(
                currentGroup = currentGroup,
                groupMembers = groupMembers,
                selectedRestaurant = selectedRestaurant,
                credibilityState = credibilityState,
                isLoading = isLoading,
                navController = navController,
                onLeaveClick = { showLeaveDialog = true },
                onVerifyCodeClick = { showVerifyDialog = true },
                isBottomSheetExpanded = isBottomSheetExpanded,
                onToggleBottomSheet = { isBottomSheetExpanded = !isBottomSheetExpanded }
            )

            if (isLoading && currentGroup != null) {
                LoadingOverlay()
            }
        }

        if (showLeaveDialog) {
            LeaveGroupDialog(
                onDismiss = { showLeaveDialog = false },
                onConfirm = {
                    showLeaveDialog = false
                    viewModel.leaveGroup(
                        onSuccess = { navController.popBackStack() }
                    )
                }
            )
        }

        if (showVerifyDialog) {
            VerifyCodeDialog(
                onDismiss = { showVerifyDialog = false },
                onVerify = { code ->
                    viewModel.verifyCredibilityCode(code)
                    showVerifyDialog = false
                }
            )
        }
    }
}

@Composable
private fun ViewGroupsEffects(
    viewModel: GroupViewModel,
    errorMessage: String?,
    successMessage: String?,
    snackbarHostState: SnackbarHostState
) {
    LaunchedEffect(Unit) {
        viewModel.loadGroupStatus()
    }

    LaunchedEffect(errorMessage) {
        errorMessage?.let { error ->
            snackbarHostState.showSnackbar(error)
            viewModel.clearError()
        }
    }

    LaunchedEffect(successMessage) {
        successMessage?.let { success ->
            snackbarHostState.showSnackbar(success)
            viewModel.clearSuccess()
        }
    }
}

@Composable
private fun ViewGroupsContent(
    currentGroup: com.example.cpen_321.data.model.Group?,
    groupMembers: List<GroupMember>,
    selectedRestaurant: com.example.cpen_321.data.model.Restaurant?,
    credibilityState: com.example.cpen_321.data.model.CredibilityState,
    isLoading: Boolean,
    navController: NavController,
    onLeaveClick: () -> Unit,
    onVerifyCodeClick: () -> Unit,
    isBottomSheetExpanded: Boolean,
    onToggleBottomSheet: () -> Unit
) {
    when {
        isLoading && currentGroup == null -> LoadingContent()
        currentGroup == null -> NoGroupContent(navController = navController)
        else -> GroupContentWithCollapsibleButtons(
            currentGroup = currentGroup,
            groupMembers = groupMembers,
            selectedRestaurant = selectedRestaurant,
            credibilityState = credibilityState,
            navController = navController,
            onLeaveClick = onLeaveClick,
            onVerifyCodeClick = onVerifyCodeClick,
            isBottomSheetExpanded = isBottomSheetExpanded,
            onToggleBottomSheet = onToggleBottomSheet
        )
    }
}

@Composable
private fun GroupContentWithCollapsibleButtons(
    currentGroup: com.example.cpen_321.data.model.Group,
    groupMembers: List<GroupMember>,
    selectedRestaurant: com.example.cpen_321.data.model.Restaurant?,
    credibilityState: com.example.cpen_321.data.model.CredibilityState,
    navController: NavController,
    onLeaveClick: () -> Unit,
    onVerifyCodeClick: () -> Unit,
    isBottomSheetExpanded: Boolean,
    onToggleBottomSheet: () -> Unit
) {
    Box(modifier = Modifier.fillMaxSize()) {
        // Main scrollable content
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(16.dp)
                .padding(bottom = if (isBottomSheetExpanded) 260.dp else 60.dp), // Space for bottom sheet
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Credibility Code Card
            item {
                CredibilityCodeCard(credibilityState = credibilityState)
            }

            // Group Header Card
            item {
                GroupHeaderCard(
                    currentGroup = currentGroup,
                    selectedRestaurant = selectedRestaurant
                )
            }

            // Members Section Header
            item {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "Group Members",
                        fontSize = 20.sp,
                        fontWeight = FontWeight.Bold
                    )

                    val votedCount = groupMembers.count { it.hasVoted }
                    Text(
                        text = "$votedCount/${groupMembers.size} voted",
                        fontSize = 14.sp,
                        color = if (votedCount == groupMembers.size) Color(0xFF4CAF50) else Color.Gray
                    )
                }
            }

            // Member Cards
            items(groupMembers) { member ->
                MemberCard(
                    member = member,
                    navController = navController
                )
            }

            // Extra spacing at bottom
            item {
                Spacer(modifier = Modifier.height(16.dp))
            }
        }

        // ✅ NEW: Collapsible Bottom Sheet with Action Buttons
        CollapsibleBottomSheet(
            isExpanded = isBottomSheetExpanded,
            onToggle = onToggleBottomSheet,
            currentGroup = currentGroup,
            navController = navController,
            onLeaveClick = onLeaveClick,
            onVerifyCodeClick = onVerifyCodeClick
        )
    }
}

@Composable
private fun CollapsibleBottomSheet(
    isExpanded: Boolean,
    onToggle: () -> Unit,
    currentGroup: com.example.cpen_321.data.model.Group,
    navController: NavController,
    onLeaveClick: () -> Unit,
    onVerifyCodeClick: () -> Unit
) {
    // Animate the offset
    val offsetY by animateDpAsState(
        targetValue = if (isExpanded) 0.dp else 200.dp,
        label = "bottomSheetOffset"
    )

    var dragOffset by remember { mutableStateOf(0f) }

    // ✅ FIXED: Use Column at parent level, then Box for positioning
    Column(
        modifier = Modifier.fillMaxWidth()
    ) {
        Spacer(modifier = Modifier.weight(1f)) // Push content to bottom

        Box(
            modifier = Modifier
                .fillMaxWidth()
                .offset { IntOffset(0, (offsetY.value + dragOffset).roundToInt()) }
                .shadow(8.dp, RoundedCornerShape(topStart = 16.dp, topEnd = 16.dp))
                .background(
                    Color.White,
                    RoundedCornerShape(topStart = 16.dp, topEnd = 16.dp)
                )
                .pointerInput(Unit) {
                    detectVerticalDragGestures(
                        onDragEnd = {
                            if (dragOffset > 50) {
                                // Dragged down - collapse
                                if (isExpanded) onToggle()
                            } else if (dragOffset < -50) {
                                // Dragged up - expand
                                if (!isExpanded) onToggle()
                            }
                            dragOffset = 0f
                        },
                        onVerticalDrag = { _, dragAmount ->
                            dragOffset = (dragOffset + dragAmount).coerceIn(-200f, 200f)
                        }
                    )
                }
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(16.dp)
            ) {
                // ✅ Handle with icon
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { onToggle() },
                    contentAlignment = Alignment.Center
                ) {
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        // Drag handle line
                        Box(
                            modifier = Modifier
                                .width(40.dp)
                                .height(4.dp)
                                .background(Color.Gray.copy(alpha = 0.3f), RoundedCornerShape(2.dp))
                        )

                        Spacer(modifier = Modifier.height(8.dp))

                        // Arrow icon
                        Icon(
                            imageVector = if (isExpanded) Icons.Default.KeyboardArrowDown else Icons.Default.KeyboardArrowUp,
                            contentDescription = if (isExpanded) "Collapse" else "Expand",
                            tint = Color.Gray,
                            modifier = Modifier.size(24.dp)
                        )

                        Text(
                            text = if (isExpanded) "Tap to hide" else "Tap to show actions",
                            fontSize = 12.sp,
                            color = Color.Gray
                        )
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))

                // ✅ Action Buttons (only show when expanded)
                if (isExpanded) {
                    GroupActionButtons(
                        currentGroup = currentGroup,
                        navController = navController,
                        onLeaveClick = onLeaveClick,
                        onVerifyCodeClick = onVerifyCodeClick
                    )
                }
            }
        }
    }
}

@Composable
private fun VerifyCodeDialog(
    onDismiss: () -> Unit,
    onVerify: (String) -> Unit
) {
    var code by remember { mutableStateOf("") }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Verify Credibility Code") },
        text = {
            Column {
                Text("Enter another member's code to verify their attendance:")
                Spacer(modifier = Modifier.height(16.dp))
                OutlinedTextField(
                    value = code,
                    onValueChange = { code = it.uppercase() },
                    label = { Text("Code") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                    placeholder = { Text("ABC123") }
                )
            }
        },
        confirmButton = {
            TextButton(
                onClick = { onVerify(code) },
                enabled = code.isNotBlank()
            ) {
                Text("Verify")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancel")
            }
        }
    )
}

@Composable
private fun LoadingOverlay() {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Black.copy(alpha = 0.3f)),
        contentAlignment = Alignment.Center
    ) {
        CircularProgressIndicator(
            modifier = Modifier.size(48.dp),
            color = Color(0xFFFFD54F)
        )
    }
}

@Composable
private fun LeaveGroupDialog(
    onDismiss: () -> Unit,
    onConfirm: () -> Unit
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Leave Group") },
        text = {
            Text("Are you sure you want to leave this group? If your code hasn't been verified by others, your credibility score will be reduced.")
        },
        confirmButton = {
            TextButton(onClick = onConfirm) {
                Text("Leave", color = Color(0xFFFF6B6B))
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancel")
            }
        }
    )
}

@Composable
private fun LoadingContent() {
    Box(
        modifier = Modifier.fillMaxSize(),
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            CircularProgressIndicator(
                modifier = Modifier.size(48.dp),
                color = Color(0xFFFFD54F)
            )
            Spacer(modifier = Modifier.height(16.dp))
            Text(
                text = "Loading group...",
                fontSize = 16.sp,
                color = Color.Gray
            )
        }
    }
}

@Composable
private fun NoGroupContent(navController: NavController) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Icon(
            imageVector = Icons.Default.Person,
            contentDescription = null,
            modifier = Modifier.size(80.dp),
            tint = Color.Gray
        )

        Spacer(modifier = Modifier.height(24.dp))

        Text(
            text = "You are not in a group",
            fontSize = 24.sp,
            fontWeight = FontWeight.Bold,
            textAlign = TextAlign.Center
        )

        Spacer(modifier = Modifier.height(16.dp))

        Text(
            text = "Join a waiting room to get matched with a group!",
            fontSize = 16.sp,
            color = Color.Gray,
            textAlign = TextAlign.Center
        )

        Spacer(modifier = Modifier.height(32.dp))

        Button(
            onClick = { navController.popBackStack() },
            modifier = Modifier
                .fillMaxWidth(0.7f)
                .height(56.dp),
            colors = ButtonDefaults.buttonColors(
                containerColor = Color(0xFFFFD54F)
            )
        ) {
            Text(
                text = "Go Back",
                color = Color.Black,
                fontSize = 18.sp
            )
        }
    }
}

@Composable
private fun CredibilityCodeCard(
    credibilityState: com.example.cpen_321.data.model.CredibilityState
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = Color(0xFFE3F2FD)
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 4.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically
            ) {
                Icon(
                    imageVector = Icons.Default.Shield,
                    contentDescription = null,
                    tint = Color(0xFF1976D2),
                    modifier = Modifier.size(24.dp)
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = "Your Credibility Code",
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color(0xFF1976D2)
                )
            }

            Spacer(modifier = Modifier.height(12.dp))

            if (credibilityState.hasActiveCode && credibilityState.currentCode != null) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(
                            color = Color.White,
                            shape = RoundedCornerShape(8.dp)
                        )
                        .border(
                            width = 2.dp,
                            color = Color(0xFF1976D2),
                            shape = RoundedCornerShape(8.dp)
                        )
                        .padding(16.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = credibilityState.currentCode,
                        fontSize = 32.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color(0xFF1976D2),
                        letterSpacing = 4.sp
                    )
                }

                Spacer(modifier = Modifier.height(8.dp))

                Text(
                    text = "Share this code with other members",
                    fontSize = 12.sp,
                    color = Color.Gray,
                    textAlign = TextAlign.Center
                )
            } else {
                CircularProgressIndicator(
                    modifier = Modifier.size(32.dp),
                    color = Color(0xFF1976D2)
                )
            }
        }
    }
}

@Composable
private fun GroupHeaderCard(
    currentGroup: com.example.cpen_321.data.model.Group,
    selectedRestaurant: com.example.cpen_321.data.model.Restaurant?
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = Color(0xFFFFF9C4)
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 4.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(
                text = "Welcome to your Group!",
                fontSize = 24.sp,
                fontWeight = FontWeight.Bold,
                color = Color.Black,
                textAlign = TextAlign.Center
            )

            Spacer(modifier = Modifier.height(8.dp))

            Text(
                text = "${currentGroup.numMembers} members",
                fontSize = 16.sp,
                color = Color.Gray
            )

            RestaurantSelectionStatus(
                currentGroup = currentGroup,
                selectedRestaurant = selectedRestaurant
            )
        }
    }
}

@Composable
private fun RestaurantSelectionStatus(
    currentGroup: com.example.cpen_321.data.model.Group,
    selectedRestaurant: com.example.cpen_321.data.model.Restaurant?
) {
    if (currentGroup.restaurantSelected && selectedRestaurant != null) {
        Spacer(modifier = Modifier.height(12.dp))
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.Center
        ) {
            Icon(
                imageVector = Icons.Default.Restaurant,
                contentDescription = null,
                tint = Color(0xFF4CAF50),
                modifier = Modifier.size(20.dp)
            )
            Spacer(modifier = Modifier.width(8.dp))
            Text(
                text = "Selected: ${selectedRestaurant.name}",
                fontSize = 16.sp,
                color = Color(0xFF4CAF50),
                fontWeight = FontWeight.SemiBold
            )
        }
    } else {
        Spacer(modifier = Modifier.height(8.dp))
        Text(
            text = "Voting in progress...",
            fontSize = 14.sp,
            color = Color(0xFFFF9800),
            fontStyle = androidx.compose.ui.text.font.FontStyle.Italic
        )
    }
}

@Composable
private fun GroupActionButtons(
    currentGroup: com.example.cpen_321.data.model.Group,
    navController: NavController,
    onLeaveClick: () -> Unit,
    onVerifyCodeClick: () -> Unit
) {
    Column(
        modifier = Modifier.fillMaxWidth(),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        // Verify Code Button
        Button(
            onClick = onVerifyCodeClick,
            modifier = Modifier
                .fillMaxWidth()
                .height(56.dp),
            colors = ButtonDefaults.buttonColors(
                containerColor = Color(0xFF1976D2)
            )
        ) {
            Icon(
                imageVector = Icons.Default.CheckCircle,
                contentDescription = null,
                modifier = Modifier.size(20.dp)
            )
            Spacer(modifier = Modifier.width(8.dp))
            Text(
                text = "Verify Member Code",
                color = Color.White,
                fontSize = 18.sp,
                fontWeight = FontWeight.SemiBold
            )
        }

        Spacer(modifier = Modifier.height(12.dp))

        ViewOrVoteButton(
            currentGroup = currentGroup,
            navController = navController
        )

        Spacer(modifier = Modifier.height(12.dp))

        Button(
            onClick = onLeaveClick,
            modifier = Modifier
                .fillMaxWidth()
                .height(56.dp),
            colors = ButtonDefaults.buttonColors(
                containerColor = Color(0xFFFF6B6B)
            )
        ) {
            Text(
                text = "Leave Group",
                color = Color.White,
                fontSize = 18.sp,
                fontWeight = FontWeight.SemiBold
            )
        }
    }
}

@Composable
private fun ViewOrVoteButton(
    currentGroup: com.example.cpen_321.data.model.Group,
    navController: NavController
) {
    Button(
        onClick = {
            currentGroup.groupId?.let { groupId ->
                if (currentGroup.restaurantSelected) {
                    navController.navigate("group")
                } else {
                    navController.navigate("sequential_voting/$groupId")
                }
            }
        },
        modifier = Modifier
            .fillMaxWidth()
            .height(56.dp),
        colors = ButtonDefaults.buttonColors(
            containerColor = Color(0xFFFFD54F)
        )
    ) {
        Text(
            text = if (currentGroup.restaurantSelected) "View Details" else "Vote Now",
            color = Color.Black,
            fontSize = 18.sp,
            fontWeight = FontWeight.SemiBold
        )
    }
}

@Composable
private fun MemberCard(
    member: GroupMember,
    navController: NavController
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .height(80.dp)
            .clickable {
                navController.navigate("member_profile/${member.userId}")
            },
        colors = CardDefaults.cardColors(
            containerColor = if (member.hasVoted) Color(0xFFE8F5E9) else Color.White
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxSize()
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            MemberInfo(member = member)
            VoteStatusIndicator(hasVoted = member.hasVoted)
        }
    }
}

@Composable
private fun MemberInfo(member: GroupMember) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier.fillMaxWidth()
    ) {
        MemberProfilePicture(
            profilePicture = member.profilePicture,
            memberName = member.name
        )

        Spacer(modifier = Modifier.width(12.dp))

        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = member.name,
                fontSize = 18.sp,
                fontWeight = FontWeight.SemiBold,
                color = Color.Black
            )

            Spacer(modifier = Modifier.height(4.dp))

            Text(
                text = "Credibility: ${String.format("%.1f", member.credibilityScore)}",
                fontSize = 14.sp,
                color = Color.Gray
            )
        }
    }
}

@Composable
private fun MemberProfilePicture(
    profilePicture: String?,
    memberName: String
) {
    if (profilePicture != null && profilePicture.isNotEmpty()) {
        if (profilePicture.startsWith("data:image/")) {
            val painter = rememberBase64ImagePainter(profilePicture)
            Image(
                painter = painter,
                contentDescription = "Profile picture",
                modifier = Modifier
                    .size(56.dp)
                    .clip(CircleShape)
                    .background(Color.LightGray),
                contentScale = ContentScale.Crop
            )
        } else {
            AsyncImage(
                model = profilePicture,
                contentDescription = "Profile picture",
                modifier = Modifier
                    .size(56.dp)
                    .clip(CircleShape)
                    .background(Color.LightGray),
                contentScale = ContentScale.Crop
            )
        }
    } else {
        Box(
            modifier = Modifier
                .size(56.dp)
                .clip(CircleShape)
                .background(Color(0xFFFFD54F)),
            contentAlignment = Alignment.Center
        ) {
            Icon(
                imageVector = Icons.Default.Person,
                contentDescription = "Default profile",
                modifier = Modifier.size(32.dp),
                tint = Color.White
            )
        }
    }
}

@Composable
private fun VoteStatusIndicator(hasVoted: Boolean) {
    if (hasVoted) {
        Icon(
            imageVector = Icons.Default.CheckCircle,
            contentDescription = "Has voted",
            tint = Color(0xFF4CAF50),
            modifier = Modifier.size(32.dp)
        )
    } else {
        Box(
            modifier = Modifier
                .size(32.dp)
                .clip(CircleShape)
                .background(Color(0xFFE0E0E0)),
            contentAlignment = Alignment.Center
        ) {
            Text(
                text = "?",
                fontSize = 18.sp,
                color = Color.Gray,
                fontWeight = FontWeight.Bold
            )
        }
    }
}