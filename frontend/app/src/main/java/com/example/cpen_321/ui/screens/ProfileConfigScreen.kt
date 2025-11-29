package com.example.cpen_321.ui.screens

import NavRoutes
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.Spacer
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.NavController
import com.example.cpen_321.ui.components.MainBottomBar
import com.example.cpen_321.ui.viewmodels.AuthViewModel
import com.example.cpen_321.ui.viewmodels.AuthState
import com.example.cpen_321.ui.theme.*

@Composable
fun ProfileConfigScreen(
    navController: NavController,
    authViewModel: AuthViewModel = hiltViewModel()
) {
    val authState = authViewModel.authState.collectAsState()
    val showDeleteInGroupAlert = authViewModel.showDeleteInGroupAlert.collectAsState().value
    
    LaunchedEffect(authState.value) {
        if (authState.value is AuthState.Unauthenticated) {
            navController.navigate(NavRoutes.AUTH) {
                popUpTo(0) { inclusive = true }
            }
        }
    }
    
    Scaffold(
        bottomBar = { MainBottomBar(navController = navController) }
    ) { innerPadding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(Color.White)
                .padding(innerPadding)
        ) {
            ProfileConfigContent(
                navController = navController,
                authViewModel = authViewModel,
                modifier = Modifier
                    .fillMaxSize()
                    .padding(horizontal = 32.dp)
            )
        }
    }
    
    // Alert dialog for delete account while in group
    if (showDeleteInGroupAlert) {
        DeleteInGroupAlertDialog(
            onDismiss = { authViewModel.dismissDeleteInGroupAlert() }
        )
    }
}

@Composable
private fun ProfileConfigContent(
    navController: NavController,
    authViewModel: AuthViewModel,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier,
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        ConfigButton(
            text = "PROFILE",
            onClick = { navController.navigate(NavRoutes.PROFILE) },
            isPrimary = true
        )
        ConfigButton(
            text = "PREFERENCES",
            onClick = { navController.navigate(NavRoutes.PREFERENCES) },
            isPrimary = true
        )
        ConfigButton(
            text = "CREDIBILITY SCORE",
            onClick = { navController.navigate(NavRoutes.CREDIBILITY_SCORE) },
            isPrimary = true
        )

        ConfigButton(
            text = "LOGOUT",
            onClick = { authViewModel.logout() },
            isPrimary = false
        )
        ConfigButton(
            text = "DELETE ACCOUNT",
            onClick = {
                authViewModel.deleteAccount() {
                    navController.navigate(NavRoutes.SPLASH_SCREEN) {
                        popUpTo(0) { inclusive = true }
                    }
                }
            },
            isPrimary = false
        )
    }
}

@Composable
private fun ConfigButton(
    text: String,
    onClick: () -> Unit,
    isPrimary: Boolean = true
) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .height(60.dp)
            .background(
                brush = if (isPrimary) {
                    Brush.linearGradient(
                        colors = listOf(
                            SoftViolet,
                            MediumPurple,
                            VividPurple
                        )
                    )
                } else {
                    Brush.linearGradient(
                        colors = listOf(
                            VividPurple,
                            MediumPurple,
                            SoftViolet
                        )
                    )
                },
                shape = RoundedCornerShape(30.dp)
            )
            .clickable(onClick = onClick),
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = text,
            color = Color.White,
            fontSize = 18.sp,
            fontWeight = FontWeight.Bold,
            textAlign = TextAlign.Center
        )
    }
    Spacer(modifier = Modifier.height(16.dp))
}

@Composable
private fun DeleteInGroupAlertDialog(
    onDismiss: () -> Unit
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Text(
                "Cannot Delete Account",
                fontWeight = FontWeight.Bold,
                color = VividPurple
            )
        },
        text = {
            Text("You cannot delete your account while you are in a room or group. Please leave the room or group first, then try again.")
        },
        confirmButton = {
            TextButton(onClick = onDismiss) {
                Text("OK", color = VividPurple, fontWeight = FontWeight.Bold)
            }
        },
        containerColor = SoftWhite
    )
}