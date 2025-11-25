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
import com.example.cpen_321.R
import androidx.compose.ui.window.Dialog
import androidx.credentials.CredentialManager
import androidx.credentials.GetCredentialRequest
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.lifecycleScope
import com.example.cpen_321.BuildConfig
import com.example.cpen_321.ui.viewmodels.AuthViewModel
import com.example.cpen_321.ui.viewmodels.AuthState
import com.google.android.libraries.identity.googleid.GetGoogleIdOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

/**
 * Authentication Screen - Login with Google
 * Matches original FeastFriends design with yellow/beige color scheme
 */

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
    val shouldRedirectToPreferences by viewModel.shouldRedirectToPreferences.collectAsState()
    val snackBarHostState = remember { SnackbarHostState() }

    // Navigate when authenticated - only trigger once per authentication
    var hasNavigated = remember { false }
    LaunchedEffect(authState) {
        if (authState is AuthState.Authenticated && !hasNavigated) {
            // Wait a bit for the preferences check to complete
            delay(150)
            hasNavigated = true
            onNavigateToHome()
        }
    }

    // Show success messages as snackbars (not error dialogs)
    LaunchedEffect(successMessage) {
        successMessage?.let { message ->
            snackBarHostState.showSnackbar(
                message = message,
                duration = SnackbarDuration.Long
            )
            viewModel.clearSuccess()
        }
    }

    // Show error messages as snackbars
    LaunchedEffect(errorMessage) {
        errorMessage?.let { message ->
            snackBarHostState.showSnackbar(
                message = message,
                duration = SnackbarDuration.Long,
                actionLabel = "Dismiss"
            )
            viewModel.clearError()
        }
    }

    // Main Content with beige background
    AuthScreenMainContent ( viewModel = viewModel,
                            snackBarHostState = snackBarHostState,
                            isLoading = isLoading,
                            context = context)
}

// =================== AuthScreen Helpers ===============

@Composable
fun AuthScreenMainContent(
    viewModel: AuthViewModel = hiltViewModel(),
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
                .background(Color(0xFFFFFFFF)) // Beige/tan background from original design
                .padding(paddingValues),
            contentAlignment = Alignment.Center
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 32.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center
            ) {
                // Logo image
                Image(
                    painter = painterResource(id = R.drawable.logo),
                    contentDescription = "FeastFriends Logo",
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(550.dp),
                    contentScale = ContentScale.Fit
                )

                Spacer(modifier = Modifier.height(120.dp))

                // Auth Buttons - Original Yellow Design
                AuthButtons(
                    isLoading = isLoading,
                    onSignInClick = {
                        handleGoogleSignIn(
                            context = context as? ComponentActivity,
                            viewModel = viewModel,
                            snackbarHostState = snackBarHostState,
                            isSignUp = false
                        )
                    },
                    onSignUpClick = {
                        handleGoogleSignIn(
                            context = context as? ComponentActivity,
                            viewModel = viewModel,
                            snackbarHostState = snackBarHostState,
                            isSignUp = true
                        )
                    }
                )

                if (isLoading) {
                    Spacer(modifier = Modifier.height(24.dp))
                    CircularProgressIndicator(
                        modifier = Modifier.size(40.dp),
                        color = Color.Black,
                        strokeWidth = 3.dp
                    )
                }

                // Error dialog will be shown separately
            }
        }
    }
}


// ========================= UI COMPONENTS =========================

@Composable
private fun AuthButtons(
    isLoading: Boolean,
    onSignInClick: () -> Unit,
    onSignUpClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier.fillMaxWidth(),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(24.dp)
    ) {
        // Login Button - Ombre gradient
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
                .clickable(enabled = !isLoading) {
                    onSignInClick()
                },
            contentAlignment = Alignment.Center
        ) {
            Text(
                text = "SIGN IN",
                color = Color.White,
                fontSize = 18.sp,
                fontWeight = FontWeight.Bold,
                textAlign = TextAlign.Center
            )
        }

        // Sign Up Button - Ombre gradient
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(60.dp)
                .background(
                    brush = Brush.linearGradient(
                        colors = listOf(
                            Color(0xFF7B2CBF), // Dark purple
                            Color(0xFF5A189A), // Darker purple
                            Color(0xFF290C2F)  // Very dark purple
                        )
                    ),
                    shape = MaterialTheme.shapes.medium
                )
                .clickable(enabled = !isLoading) {
                    onSignUpClick()
                },
            contentAlignment = Alignment.Center
        ) {
            Text(
                text = "SIGN UP",
                color = Color.White,
                fontSize = 18.sp,
                fontWeight = FontWeight.Bold,
                textAlign = TextAlign.Center
            )
        }
    }
}

// ========================= GOOGLE SIGN-IN LOGIC =========================


private fun handleGoogleSignIn(
    context: ComponentActivity?,
    viewModel: AuthViewModel,
    snackbarHostState: SnackbarHostState,
    isSignUp: Boolean
) {
    if (context == null) {
        Log.e("AuthScreen", "❌ Context is not a ComponentActivity")
        return
    }

    context.lifecycleScope.launch {
        try {
            Log.d("AuthScreen", "🔄 Starting Google Sign-In...")

            // Validate Google Client ID
            val clientId = BuildConfig.GOOGLE_CLIENT_ID
            Log.d("AuthScreen", "🔑 Using Google Client ID: ${clientId.take(20)}...")
            
            if (clientId.isBlank() || clientId.contains("PASTE_YOUR") || !clientId.endsWith(".apps.googleusercontent.com")) {
                Log.e("AuthScreen", "❌ Invalid Google Client ID: $clientId")
                viewModel.clearLoading()
                snackbarHostState.showSnackbar(
                    "Google Sign-In is not configured. Please check your GOOGLE_CLIENT_ID in local.properties",
                    duration = SnackbarDuration.Long
                )
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

            Log.d("AuthScreen", "📱 Requesting Google credentials with Client ID: ${clientId.take(30)}...")
            Log.d("AuthScreen", "📦 Package name: ${context.packageName}")

            val result = credentialManager.getCredential(
                request = request,
                context = context
            )

            val credential = GoogleIdTokenCredential.createFrom(result.credential.data)
            val idToken = credential.idToken

            Log.d("AuthScreen", "✅ Got Google ID token, ${if (isSignUp) "signing up" else "signing in"} with backend...")

            if (isSignUp) {
                viewModel.signUpWithGoogle(idToken)
            } else {
                viewModel.signInWithGoogle(idToken)
            }

        } catch (e: androidx.credentials.exceptions.GetCredentialCancellationException) {
            Log.e("AuthScreen", "❌ Sign-in cancelled")
            Log.e("AuthScreen", "   Exception type: ${e.javaClass.simpleName}")
            Log.e("AuthScreen", "   Exception message: ${e.message}")
            Log.e("AuthScreen", "   Exception cause: ${e.cause?.message}")
            Log.e("AuthScreen", "   Stack trace: ${e.stackTrace.take(5).joinToString("\n")}")
            
            // Clear loading state
            viewModel.clearLoading()
            
            // User cancelled - no alert shown

        } catch (e: androidx.credentials.exceptions.NoCredentialException) {
            Log.e("AuthScreen", "❌ No Google account available")
            viewModel.clearLoading()
            context.lifecycleScope.launch {
                try {
                    val credentialManager = CredentialManager.create(context)
                    val googleIdOption = GetGoogleIdOption.Builder()
                        .setFilterByAuthorizedAccounts(false)
                        .setServerClientId(BuildConfig.GOOGLE_CLIENT_ID)
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
                } catch (retryException: androidx.credentials.exceptions.GetCredentialException) {
                    Log.e("AuthScreen", "❌ Retry failed: ${retryException.message}")
                    viewModel.clearLoading()
                    snackbarHostState.showSnackbar(
                        "Please add a Google account: Settings → Accounts → Add Account → Google",
                        duration = SnackbarDuration.Long
                    )
                } catch (retryException: java.io.IOException) {
                    Log.e("AuthScreen", "❌ Network error during retry: ${retryException.message}")
                    viewModel.clearLoading()
                    snackbarHostState.showSnackbar(
                        "Network error. Please check your connection and try again.",
                        duration = SnackbarDuration.Long
                    )
                }
            }

        } catch (e: androidx.credentials.exceptions.GetCredentialException) {
            Log.e("AuthScreen", "❌ Credential error: ${e.message}", e)
            viewModel.clearLoading()
            snackbarHostState.showSnackbar(
                "Sign-in failed: ${e.message ?: "Unknown error"}",
                duration = SnackbarDuration.Long
            )

        } catch (e: java.io.IOException) {
            Log.e("AuthScreen", "❌ Network error: ${e.message}", e)
            viewModel.clearLoading()
            snackbarHostState.showSnackbar(
                "Network error. Please check your connection and try again.",
                duration = SnackbarDuration.Long
            )
        } catch (e: Exception) {
            Log.e("AuthScreen", "❌ Unexpected error: ${e.message}", e)
            viewModel.clearLoading()
            snackbarHostState.showSnackbar(
                "An unexpected error occurred. Please try again.",
                duration = SnackbarDuration.Long
            )
        }
    }
}