package com.example.cpen_321.ui.screens

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Star
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.hilt.navigation.compose.hiltViewModel
import coil.compose.AsyncImage
import com.example.cpen_321.data.model.GroupMember
import com.example.cpen_321.data.model.UserProfile
import com.example.cpen_321.ui.viewmodels.UserViewModel
import com.example.cpen_321.utils.rememberBase64ImagePainter
import kotlinx.coroutines.launch

// Purple Color Palette (matching app theme)
private val PurpleLight = Color(0xFFE6E6FA) // Lavender
private val PurpleMedium = Color(0xFFC8B6FF) // Light purple
private val PurpleDark = Color(0xFF9D8AC7) // Medium purple
private val PurpleAccent = Color(0xFFB39DDB) // Purple accent
private val PurpleGradientStart = Color(0xFFE8DAFF)
private val PurpleGradientEnd = Color(0xFFD4C5F9)
private val GlassWhite = Color(0xCCFFFFFF) // Semi-transparent white for glass effect

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MemberProfileScreen(
    userId: String,
    memberDetails: GroupMember? = null,
    onNavigateBack: () -> Unit,
    viewModel: UserViewModel = hiltViewModel()
) {
    val isLoading by viewModel.isLoading.collectAsState()
    val errorMessage by viewModel.errorMessage.collectAsState()
    
    var userProfile by remember { mutableStateOf<UserProfile?>(null) }
    var loadingProfile by remember { mutableStateOf(true) }
    val scope = rememberCoroutineScope()

    // If we have member details, use them; otherwise fetch from API
    LaunchedEffect(userId, memberDetails) {
        if (memberDetails != null) {
            // Convert GroupMember to UserProfile
            userProfile = UserProfile(
                userId = memberDetails.userId,
                name = memberDetails.name,
                bio = null, // GroupMember doesn't have bio
                profilePicture = memberDetails.profilePicture,
                contactNumber = memberDetails.phoneNumber
            )
            loadingProfile = false
            
            // Try to fetch full profile to get bio
            scope.launch {
                val fullProfile = viewModel.getUserProfile(userId)
                if (fullProfile != null) {
                    userProfile = fullProfile
                }
            }
        } else {
            // Fetch profile from API
            loadingProfile = true
            scope.launch {
                val fetchedProfile = viewModel.getUserProfile(userId)
                userProfile = fetchedProfile
                loadingProfile = false
            }
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Member Profile") },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(
                            imageVector = Icons.Default.ArrowBack,
                            contentDescription = "Back"
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = PurpleAccent,
                    titleContentColor = Color.White,
                    navigationIconContentColor = Color.White
                )
            )
        }
    ) { innerPadding ->
        when {
            loadingProfile || isLoading -> {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(innerPadding),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator(color = PurpleAccent)
                }
            }
            userProfile == null -> {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(innerPadding),
                    contentAlignment = Alignment.Center
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(
                            text = "Profile not found",
                            fontSize = 18.sp,
                            fontWeight = FontWeight.Bold,
                            color = PurpleDark
                        )
                        Spacer(modifier = Modifier.height(16.dp))
                        Button(
                            onClick = onNavigateBack,
                            colors = ButtonDefaults.buttonColors(
                                containerColor = PurpleAccent
                            )
                        ) {
                            Text("Go Back", color = Color.White)
                        }
                    }
                }
            }
            else -> {
                MemberProfileContent(
                    modifier = Modifier.padding(innerPadding),
                    userProfile = userProfile!!,
                    credibilityScore = memberDetails?.credibilityScore
                )
            }
        }
    }
}

@Composable
private fun MemberProfileContent(
    modifier: Modifier,
    userProfile: UserProfile,
    credibilityScore: Double?
) {
    val scrollState = rememberScrollState()

    Column(
        modifier = modifier
            .fillMaxSize()
            .verticalScroll(scrollState)
            .padding(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Spacer(modifier = Modifier.height(24.dp))

        // Profile Picture
        ProfilePictureSection(profilePicture = userProfile.profilePicture)

        Spacer(modifier = Modifier.height(24.dp))

        // Name
        Text(
            text = userProfile.name,
            fontSize = 28.sp,
            fontWeight = FontWeight.Bold,
            color = PurpleDark,
            textAlign = TextAlign.Center
        )

        Spacer(modifier = Modifier.height(32.dp))

        // Profile Details Card
        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(containerColor = GlassWhite),
            shape = RoundedCornerShape(16.dp),
            border = androidx.compose.foundation.BorderStroke(2.dp, PurpleAccent)
        ) {
            Column(
                modifier = Modifier.padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                // Credibility Score
                credibilityScore?.let { score ->
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Icon(
                            imageVector = Icons.Default.Star,
                            contentDescription = "Credibility Score",
                            tint = Color(0xFF9D4EDD),
                            modifier = Modifier.size(24.dp)
                        )
                        Spacer(modifier = Modifier.width(12.dp))
                        Text(
                            text = "Credibility Score: ${score.toInt()}",
                            fontSize = 18.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = PurpleDark
                        )
                    }
                }

                // Bio
                userProfile.bio?.let { bio ->
                    if (bio.isNotEmpty()) {
                        Column {
                            Text(
                                text = "Bio",
                                fontSize = 16.sp,
                                fontWeight = FontWeight.Bold,
                                color = PurpleDark
                            )
                            Spacer(modifier = Modifier.height(8.dp))
                            Text(
                                text = bio,
                                fontSize = 16.sp,
                                color = PurpleDark.copy(alpha = 0.8f),
                                lineHeight = 24.sp
                            )
                        }
                    }
                }

                // Contact Number
                userProfile.contactNumber?.let { phone ->
                    if (phone.isNotEmpty()) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Text(
                                text = "📞",
                                fontSize = 20.sp
                            )
                            Spacer(modifier = Modifier.width(12.dp))
                            Text(
                                text = phone,
                                fontSize = 16.sp,
                                color = PurpleDark.copy(alpha = 0.8f)
                            )
                        }
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(32.dp))
    }
}

@Composable
private fun ProfilePictureSection(profilePicture: String?) {
    if (profilePicture != null && profilePicture.isNotEmpty()) {
        if (profilePicture.startsWith("data:image/")) {
            // Base64 image
            val painter = rememberBase64ImagePainter(profilePicture)
            Image(
                painter = painter,
                contentDescription = "Profile picture",
                modifier = Modifier
                    .size(120.dp)
                    .clip(CircleShape)
                    .border(4.dp, PurpleAccent, CircleShape)
                    .background(Color.LightGray),
                contentScale = ContentScale.Crop
            )
        } else {
            // Regular URL
            AsyncImage(
                model = profilePicture,
                contentDescription = "Profile picture",
                modifier = Modifier
                    .size(120.dp)
                    .clip(CircleShape)
                    .border(4.dp, PurpleAccent, CircleShape)
                    .background(Color.LightGray),
                contentScale = ContentScale.Crop
            )
        }
    } else {
        // Default avatar
        Box(
            modifier = Modifier
                .size(120.dp)
                .clip(CircleShape)
                .background(
                    Brush.linearGradient(
                        colors = listOf(
                            Color(0xFF9D4EDD),
                            Color(0xFF7B2CBF)
                        )
                    )
                )
                .border(4.dp, PurpleAccent, CircleShape),
            contentAlignment = Alignment.Center
        ) {
            Icon(
                imageVector = Icons.Default.Person,
                contentDescription = "Default profile",
                modifier = Modifier.size(64.dp),
                tint = Color.White
            )
        }
    }
}

