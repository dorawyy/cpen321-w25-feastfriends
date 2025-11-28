package com.example.cpen_321.ui.screens

import android.content.Context
import android.util.Log
import androidx.activity.ComponentActivity
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.credentials.CredentialManager
import androidx.credentials.GetCredentialRequest
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.lifecycleScope
import com.example.cpen_321.BuildConfig
import com.example.cpen_321.R
import com.example.cpen_321.ui.viewmodels.AuthViewModel
import com.example.cpen_321.ui.viewmodels.AuthState
import com.example.cpen_321.ui.theme.*
import com.google.android.libraries.identity.googleid.GetGoogleIdOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

// ========================= MAIN SCREEN =========================

@Composable
fun AuthScreen(
    viewModel: AuthViewModel = hiltViewModel(),
    onNavigateToHome: () -> Unit
) {
    val context = LocalContext.current

    val authState by viewModel.authState.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()
    val errorMessage by viewModel.errorMessage.collectAsState()
    val successMessage by viewModel.successMessage.collectAsState()

    val snackBarHostState = remember { SnackbarHostState() }

    var hasNavigated by remember { mutableStateOf(false) }

    LaunchedEffect(authState) {
        if (authState is AuthState.Authenticated && !hasNavigated) {
            delay(150)
            hasNavigated = true
            onNavigateToHome()
        }
    }

    LaunchedEffect(errorMessage) {
        errorMessage?.let {
            snackBarHostState.showSnackbar(it)
            viewModel.clearError()
        }
    }

    LaunchedEffect(successMessage) {
        successMessage?.let {
            snackBarHostState.showSnackbar(it)
            viewModel.clearSuccess()
        }
    }

    AuthScreenMainContent(
        viewModel = viewModel,
        snackBarHostState = snackBarHostState,
        isLoading = isLoading,
        context = context
    )
}

// ======================= MAIN UI =========================

@Composable
fun AuthScreenMainContent(
    viewModel: AuthViewModel,
    snackBarHostState: SnackbarHostState,
    isLoading: Boolean,
    context: Context
) {
    Scaffold(
        snackbarHost = { SnackbarHost(hostState = snackBarHostState) }
    ) { paddingValues ->

        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(Color.White)
                .padding(paddingValues)
        ) {

            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(horizontal = 28.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.SpaceBetween
            ) {

                Spacer(modifier = Modifier.height(32.dp))

                // 🔥 Bigger Logo
                Image(
                    painter = painterResource(id = R.drawable.logo),
                    contentDescription = "FeastFriends Logo",
                    modifier = Modifier
                        .fillMaxWidth()
                        .aspectRatio(1.3f),
                    contentScale = ContentScale.Fit
                )

                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(20.dp)
                ) {

                    AuthButtons(
                        isLoading = isLoading,
                        onSignInClick = {
                            handleGoogleSignIn(
                                context = context as? ComponentActivity,
                                viewModel = viewModel,
                                snackBarHostState = snackBarHostState,
                                isSignUp = false
                            )
                        },
                        onSignUpClick = {
                            handleGoogleSignIn(
                                context = context as? ComponentActivity,
                                viewModel = viewModel,
                                snackBarHostState = snackBarHostState,
                                isSignUp = true
                            )
                        }
                    )

                    if (isLoading) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(36.dp),
                            color = Color.Black
                        )
                    }
                }

                Spacer(modifier = Modifier.height(40.dp))
            }
        }
    }
}

// ======================= BUTTONS =========================

@Composable
private fun AuthButtons(
    isLoading: Boolean,
    onSignInClick: () -> Unit,
    onSignUpClick: () -> Unit
) {
    Column(
        modifier = Modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(20.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {

        GradientButton(
            text = "SIGN IN",
            colors = listOf(
                SoftViolet,
                MediumPurple,
                VividPurple
            ),
            enabled = !isLoading,
            onClick = onSignInClick
        )

        GradientButton(
            text = "SIGN UP",
            colors = listOf(
                VividPurple,
                MediumPurple,
                SoftViolet
            ),
            enabled = !isLoading,
            onClick = onSignUpClick
        )
    }
}

@Composable
private fun GradientButton(
    text: String,
    colors: List<Color>,
    enabled: Boolean,
    onClick: () -> Unit
) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .height(62.dp)
            .background(
                brush = Brush.linearGradient(colors),
                shape = MaterialTheme.shapes.medium
            )
            .clickable(enabled = enabled) { onClick() },
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = text,
            color = Color.White,
            fontSize = 18.sp,
            fontWeight = FontWeight.Bold
        )
    }
}

// ================= GOOGLE SIGN-IN HANDLER ====================

private fun handleGoogleSignIn(
    context: ComponentActivity?,
    viewModel: AuthViewModel,
    snackBarHostState: SnackbarHostState,
    isSignUp: Boolean
) {
    if (context == null) {
        Log.e("AuthScreen", "❌ Context is not ComponentActivity")
        return
    }

    context.lifecycleScope.launch {
        try {
            val clientId = BuildConfig.GOOGLE_CLIENT_ID

            if (clientId.isBlank() || !clientId.endsWith(".apps.googleusercontent.com")) {
                viewModel.clearLoading()
                snackBarHostState.showSnackbar("Google Sign-In client ID not configured.")
                return@launch
            }

            val credentialManager = CredentialManager.create(context)

            val googleIdOption = GetGoogleIdOption.Builder()
                .setFilterByAuthorizedAccounts(false)
                .setServerClientId(clientId)
                .setAutoSelectEnabled(false)
                .build()

            val request = GetCredentialRequest.Builder()
                .addCredentialOption(googleIdOption)
                .build()

            val result = credentialManager.getCredential(
                request = request,
                context = context
            )

            val credential = GoogleIdTokenCredential.createFrom(result.credential.data)
            val idToken = credential.idToken

            if (isSignUp) {
                viewModel.signUpWithGoogle(idToken)
            } else {
                viewModel.signInWithGoogle(idToken)
            }

        } catch (e: Exception) {
            viewModel.clearLoading()
            snackBarHostState.showSnackbar("Google Sign-In failed. Try again.")
        }
    }
}
