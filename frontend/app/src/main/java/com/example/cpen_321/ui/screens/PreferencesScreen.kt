package com.example.cpen_321.ui.screens.profile

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Slider
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.example.cpen_321.ui.viewmodels.UserViewModel
import com.example.cpen_321.ui.theme.*

@Composable
fun PreferencesScreen(
    onNavigateBack: () -> Unit,
    viewModel: UserViewModel = hiltViewModel()
) {
    val selectedCuisines by viewModel.selectedCuisines.collectAsState()
    val budget by viewModel.budget.collectAsState()
    val radius by viewModel.radius.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()
    val errorMessage by viewModel.errorMessage.collectAsState()
    val successMessage by viewModel.successMessage.collectAsState()

    val snackbarHostState = remember { SnackbarHostState() }

    PreferencesEffects(
        viewModel = viewModel,
        successMessage = successMessage,
        errorMessage = errorMessage,
        snackbarHostState = snackbarHostState
    )

    Scaffold(
        snackbarHost = { SnackbarHost(snackbarHostState) }
    ) { innerPadding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(
                    Brush.verticalGradient(
                        colors = listOf(
                            WaitlistGradientTop,
                            WaitlistGradientMiddle,
                            WaitlistGradientBottom
                        )
                    )
                )
                .padding(innerPadding)
        ) {
            PreferencesContent(
                modifier = Modifier.padding(innerPadding),
                selectedCuisines = selectedCuisines.toList(),  // Convert Set to List
                budget = budget,
                radius = radius,
                isLoading = isLoading,
                viewModel = viewModel,
                onNavigateBack = onNavigateBack
            )
        }
    }
}

@Composable
private fun PreferencesEffects(
    viewModel: UserViewModel,
    successMessage: String?,
    errorMessage: String?,
    snackbarHostState: SnackbarHostState
) {
    LaunchedEffect(Unit) {
        viewModel.loadUserSettings()
    }

    LaunchedEffect(successMessage) {
        successMessage?.let {
            snackbarHostState.showSnackbar(it)
            viewModel.clearSuccess()
        }
    }

    LaunchedEffect(errorMessage) {
        errorMessage?.let {
            snackbarHostState.showSnackbar("Error: $it")
            viewModel.clearError()
        }
    }
}

@Composable
private fun PreferencesContent(
    modifier: Modifier,
    selectedCuisines: List<String>,
    budget: Double,
    radius: Double,
    isLoading: Boolean,
    viewModel: UserViewModel,
    onNavigateBack: () -> Unit
) {
    Column(
        modifier = modifier
            .fillMaxSize()
            .padding(horizontal = 16.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Spacer(modifier = Modifier.height(16.dp))

        Text(
            text = "Preferences (Select)",
            fontSize = 20.sp,
            modifier = Modifier
                .fillMaxWidth()
                .padding(vertical = 16.dp),
            textAlign = TextAlign.Center
        )

        if (isLoading) {
            LoadingState()
        } else {
            PreferencesForm(
                selectedCuisines = selectedCuisines,
                budget = budget,
                radius = radius,
                isLoading = isLoading,
                viewModel = viewModel,
                onNavigateBack = onNavigateBack
            )
        }
    }
}

@Composable
private fun LoadingState() {
    Column(
        modifier = Modifier.fillMaxSize(),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        CircularProgressIndicator()
        Spacer(modifier = Modifier.height(16.dp))
        Text("Loading preferences...")
    }
}

@Composable
private fun PreferencesForm(
    selectedCuisines: List<String>,
    budget: Double,
    radius: Double,
    isLoading: Boolean,
    viewModel: UserViewModel,
    onNavigateBack: () -> Unit
) {
    Column {  // Add Column wrapper
        CuisineGrid(
            selectedCuisines = selectedCuisines,
            onToggleCuisine = { viewModel.toggleCuisine(it) }
        )

        Spacer(modifier = Modifier.height(24.dp))

        BudgetSection(
            budget = budget,
            onBudgetChange = { viewModel.updateBudget(it.toDouble()) }
        )

        Spacer(modifier = Modifier.height(24.dp))

        RadiusSection(
            radius = radius,
            onRadiusChange = { viewModel.updateRadius(it.toDouble()) }
        )

        Spacer(modifier = Modifier.weight(1f))
        
        ActionButtons(
            isLoading = isLoading,
            onSave = { viewModel.savePreferences() },
            onNavigateBack = onNavigateBack
        )

        Spacer(modifier = Modifier.height(16.dp))
    }
}

@Composable
private fun CuisineGrid(
    selectedCuisines: List<String>,
    onToggleCuisine: (String) -> Unit
) {
    val cuisineOptions = listOf(
        "Italian", "Japanese",
        "Chinese", "Korean",
        "Indian", "Mexican",
        "Thai", "French",
        "Mediterranean", "American",
        "Middle Eastern", "Vietnamese"
    )

    Column(
        modifier = Modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        cuisineOptions.chunked(3).forEach { rowItems ->
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                rowItems.forEach { cuisine ->
                    CuisineButton(
                        cuisine = cuisine,
                        isSelected = selectedCuisines.contains(cuisine),
                        onClick = { onToggleCuisine(cuisine) }
                    )
                }
            }
        }
    }
}

@Composable
private fun RowScope.CuisineButton(
    cuisine: String,
    isSelected: Boolean,
    onClick: () -> Unit
) {
    Box(
        modifier = Modifier
            .weight(1f)
            .height(70.dp)
            .background(
                brush = Brush.linearGradient(
                    colors = if (isSelected)
                        listOf(
                            Color(0xFF6B2CD9), // Darker purple
                            Color(0xFF7B3DFF), // Dark vivid purple
                            Color(0xFF8B3DFF)  // VividPurple
                        )
                    else
                        listOf(
                            SoftViolet,
                            MediumPurple,
                            VividPurple
                        )
                ),
                shape = RoundedCornerShape(30.dp)
            )
            .clickable(onClick = onClick),
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = cuisine,
            color = Color.White,
            fontSize = 12.sp,
            fontWeight = FontWeight.Bold,
            textAlign = TextAlign.Center
        )
    }
}

@Composable
private fun BudgetSection(
    budget: Double,
    onBudgetChange: (Float) -> Unit
) {
    Text(
        text = "Max amount of money to spend: $${budget.toInt()}",
        fontSize = 16.sp,
        modifier = Modifier.fillMaxWidth()
    )

    Spacer(modifier = Modifier.height(8.dp))

    Slider(
        value = budget.toFloat(),
        onValueChange = onBudgetChange,
        valueRange = 5f..200f,
        modifier = Modifier.fillMaxWidth()
    )
}

@Composable
private fun RadiusSection(
    radius: Double,
    onRadiusChange: (Float) -> Unit
) {
    Text(
        text = "Search radius: ${radius.toInt()} km",
        fontSize = 16.sp,
        modifier = Modifier.fillMaxWidth()
    )

    Spacer(modifier = Modifier.height(8.dp))

    Slider(
        value = radius.toFloat(),
        onValueChange = onRadiusChange,
        valueRange = 1f..50f,
        modifier = Modifier.fillMaxWidth()
    )
}

@Composable
private fun ActionButtons(
    isLoading: Boolean,
    onSave: () -> Unit,
    onNavigateBack: () -> Unit
) {
    Column(
        modifier = Modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        // Save Preferences Button
        Button(
            onClick = onSave,
            enabled = !isLoading,
            modifier = Modifier
                .fillMaxWidth()
                .height(56.dp),
            colors = ButtonDefaults.buttonColors(
                containerColor = VividPurple
            ),
            shape = RoundedCornerShape(30.dp)
        ) {
            if (isLoading) {
                CircularProgressIndicator(
                    color = Color.White,
                    modifier = Modifier.size(24.dp)
                )
            } else {
                Text(
                    text = "Save Preferences",
                    color = Color.White,
                    fontSize = 18.sp,
                    fontWeight = FontWeight.SemiBold
                )
            }
        }

        // Go Back Button
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
                    shape = RoundedCornerShape(30.dp)
                )
                .clickable(onClick = onNavigateBack),
            contentAlignment = Alignment.Center
        ) {
            Text(
                text = "GO BACK",
                color = Color.White,
                fontSize = 18.sp,
                fontWeight = FontWeight.Bold
            )
        }
    }
}