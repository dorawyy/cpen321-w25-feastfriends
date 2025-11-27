package com.example.cpen_321.ui.screens.profile

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.example.cpen_321.ui.viewmodels.UserViewModel

// Purple Color Palette (matching app theme)
private val PurpleLight = Color(0xFFE6E6FA) // Lavender
private val PurpleMedium = Color(0xFFC8B6FF) // Light purple
private val PurpleDark = Color(0xFF9D8AC7) // Medium purple
private val PurpleAccent = Color(0xFFB39DDB) // Purple accent
private val PurpleGradientStart = Color(0xFFE8DAFF)
private val PurpleGradientEnd = Color(0xFFD4C5F9)
private val GlassWhite = Color(0xCCFFFFFF) // Semi-transparent white for glass effect

@Composable
fun CredibilityScreen(
    onNavigateBack: () -> Unit,
    viewModel: UserViewModel = hiltViewModel()
) {
    val userSettings by viewModel.userSettings.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()
    val errorMessage by viewModel.errorMessage.collectAsState()

    LaunchedEffect(Unit) {
        viewModel.loadUserSettings()
    }

    Scaffold { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.SpaceBetween
        ) {
            CredibilityContent(
                isLoading = isLoading,
                errorMessage = errorMessage,
                credibilityScore = userSettings?.credibilityScore?.toInt() ?: 0
            )
            
            BackButton(onNavigateBack = onNavigateBack)
        }
    }
}

@Composable
private fun CredibilityContent(
    isLoading: Boolean,
    errorMessage: String?,
    credibilityScore: Int
) {
    Column(
        modifier = Modifier.fillMaxWidth(),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Spacer(modifier = Modifier.height(48.dp))
        
        Text(
            text = "Credibility Score",
            fontSize = 28.sp,
            fontWeight = FontWeight.Bold,
            color = PurpleDark,
            textAlign = TextAlign.Center
        )
        
        Spacer(modifier = Modifier.height(48.dp))
        
        CredibilityScoreDisplay(
            isLoading = isLoading,
            errorMessage = errorMessage,
            credibilityScore = credibilityScore
        )
    }
}

@Composable
private fun CredibilityScoreDisplay(
    isLoading: Boolean,
    errorMessage: String?,
    credibilityScore: Int
) {
    when {
        isLoading -> LoadingIndicator()
        errorMessage != null -> ErrorDisplay(errorMessage)
        else -> CircularScoreDisplay(credibilityScore)
    }
}

@Composable
private fun LoadingIndicator() {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier.padding(32.dp)
    ) {
        CircularProgressIndicator(
            color = PurpleAccent,
            modifier = Modifier.size(64.dp)
        )
        Spacer(modifier = Modifier.height(16.dp))
        Text(
            text = "Loading your credibility score...",
            fontSize = 16.sp,
            color = PurpleDark.copy(alpha = 0.7f)
        )
    }
}

@Composable
private fun ErrorDisplay(errorMessage: String) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 32.dp)
            .background(GlassWhite, RoundedCornerShape(12.dp))
            .border(1.dp, Color(0xFFD88BB7), RoundedCornerShape(12.dp))
            .padding(24.dp),
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = errorMessage,
            fontSize = 16.sp,
            color = Color(0xFFD88BB7),
            textAlign = TextAlign.Center,
            fontWeight = FontWeight.Medium
        )
    }
}

@Composable
private fun CircularScoreDisplay(credibilityScore: Int) {
    val scoreColor = when {
        credibilityScore >= 80 -> Color(0xFF4CAF50) // Green for high
        credibilityScore >= 50 -> Color(0xFFFF9800) // Orange for medium
        credibilityScore >= 20 -> Color(0xFFFFC107) // Yellow for low-medium
        else -> Color(0xFF9D4EDD) // Purple for very low
    }
    
    val message = when {
        credibilityScore >= 80 -> "You have excellent credibility! Keep it up!"
        credibilityScore >= 50 -> "You're doing well. There's room for improvement."
        credibilityScore >= 20 -> "Your credibility needs attention. Focus on building trust."
        else -> "Your credibility is very low. Start building trust with others."
    }
    
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier.fillMaxWidth()
    ) {
        // Circular Score Display
        Box(
            modifier = Modifier.size(200.dp),
            contentAlignment = Alignment.Center
        ) {
            // Outer circle (background)
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(
                        color = scoreColor.copy(alpha = 0.1f),
                        shape = CircleShape
                    )
            )
            
            // Inner circle with score
            Box(
                modifier = Modifier
                    .size(160.dp)
                    .background(
                        Brush.linearGradient(
                            colors = listOf(
                                scoreColor.copy(alpha = 0.3f),
                                scoreColor.copy(alpha = 0.1f)
                            )
                        ),
                        shape = CircleShape
                    )
                    .border(
                        width = 4.dp,
                        color = scoreColor,
                        shape = CircleShape
                    ),
                contentAlignment = Alignment.Center
            ) {
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text(
                        text = "$credibilityScore",
                        fontSize = 64.sp,
                        fontWeight = FontWeight.Bold,
                        color = scoreColor
                    )
                    Text(
                        text = "out of 100",
                        fontSize = 14.sp,
                        color = PurpleDark.copy(alpha = 0.7f),
                        fontWeight = FontWeight.Medium
                    )
                }
            }
        }
        
        Spacer(modifier = Modifier.height(32.dp))
        
        // Message
        Text(
            text = message,
            fontSize = 18.sp,
            fontWeight = FontWeight.Medium,
            color = PurpleDark,
            textAlign = TextAlign.Center,
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 32.dp)
        )
        
        Spacer(modifier = Modifier.height(24.dp))
        
        // Additional info card
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 32.dp)
                .background(
                    PurpleLight.copy(alpha = 0.5f),
                    RoundedCornerShape(12.dp)
                )
                .padding(16.dp)
        ) {
            Column(
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Text(
                    text = "How to improve",
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Bold,
                    color = PurpleDark
                )
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = when {
                        credibilityScore >= 80 -> "Continue being reliable and trustworthy!"
                        credibilityScore >= 50 -> "Complete more group activities and verify codes"
                        credibilityScore >= 20 -> "Be active in groups and follow through on commitments"
                        else -> "Start by joining groups and being reliable"
                    },
                    fontSize = 14.sp,
                    color = PurpleDark.copy(alpha = 0.8f),
                    textAlign = TextAlign.Center
                )
            }
        }
    }
}

@Composable
private fun BackButton(onNavigateBack: () -> Unit) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .height(80.dp)
            .padding(bottom = 16.dp)
            .background(
                Brush.linearGradient(
                    colors = listOf(
                        Color(0xFF7B2CBF), // Dark purple
                        Color(0xFF5A189A), // Darker purple
                        Color(0xFF290C2F)  // Very dark purple
                    )
                ),
                RoundedCornerShape(12.dp)
            )
            .clickable(onClick = onNavigateBack),
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = "Go Back",
            color = Color.White,
            fontSize = 20.sp,
            fontWeight = FontWeight.Bold
        )
    }
}