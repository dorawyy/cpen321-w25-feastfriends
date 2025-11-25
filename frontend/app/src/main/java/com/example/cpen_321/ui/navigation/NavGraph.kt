package com.example.cpen_321.ui.navigation

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.navArgument
import com.example.cpen_321.ui.screens.*
import com.example.cpen_321.ui.screens.profile.CredibilityScreen
import com.example.cpen_321.ui.screens.profile.PreferencesScreen
import com.example.cpen_321.ui.screens.profile.ProfileScreen
import com.example.cpen_321.ui.viewmodels.AuthViewModel

@Composable
fun AppNavGraph(navController: NavHostController) {
    val authViewModel: AuthViewModel = hiltViewModel()
    NavHost(
        navController = navController,
        startDestination = NavRoutes.SPLASH_SCREEN
    ) {
        composable("splash") {
            SplashScreen(navController = navController)
        }

        composable(NavRoutes.AUTH) {
            val shouldRedirectToPreferences by authViewModel.shouldRedirectToPreferences.collectAsState()
            
            AuthScreen(
                viewModel = authViewModel,
                onNavigateToHome = {
                    val shouldRedirect = shouldRedirectToPreferences
                    if (shouldRedirect) {
                        authViewModel.clearRedirectToPreferences()
                        navController.navigate(NavRoutes.PREFERENCES) {
                            popUpTo(NavRoutes.AUTH) { inclusive = true }
                        }
                    } else {
                        navController.navigate(NavRoutes.HOME) {
                            popUpTo(NavRoutes.AUTH) { inclusive = true }
                        }
                    }
                }
            )
        }

        composable(NavRoutes.HOME) {
            HomeScreen(navController = navController, authViewModel = authViewModel)
        }

        composable(NavRoutes.WAITING_ROOM) {
            WaitingRoomScreen(navController = navController)
        }

        composable(NavRoutes.GROUP) {
            GroupScreen(navController = navController)
        }

        composable(
            route = "group/{groupId}",
            arguments = listOf(navArgument("groupId") { type = NavType.StringType })
        ) { backStackEntry ->
            GroupScreenWithId(navController, backStackEntry.arguments?.getString("groupId"))
        }

        composable(NavRoutes.VOTE_RESTAURANT) {
            VoteRestaurantScreen(navController = navController)
        }

        composable(
            route = "vote_restaurant/{groupId}",
            arguments = listOf(navArgument("groupId") { type = NavType.StringType })
        ) { backStackEntry ->
            VoteRestaurantScreenWithId(navController, backStackEntry.arguments?.getString("groupId"))
        }

        composable(NavRoutes.PROFILE_CONFIG) {
            ProfileConfigScreen(navController = navController, authViewModel = authViewModel)
        }

        composable(NavRoutes.PROFILE) {
            ProfileScreen(onNavigateBack = { navController.popBackStack() })
        }

        composable(NavRoutes.PREFERENCES) {
            PreferencesScreen(
                onNavigateBack = {
                    // If we can pop back, do it. Otherwise navigate to HOME
                    // This handles the case where user was redirected from AUTH (which was popped)
                    if (navController.previousBackStackEntry != null) {
                        navController.popBackStack()
                    } else {
                        navController.navigate(NavRoutes.HOME) {
                            popUpTo(NavRoutes.PREFERENCES) { inclusive = true }
                        }
                    }
                }
            )
        }

        composable(NavRoutes.CREDIBILITY_SCORE) {
            CredibilityScreen(onNavigateBack = { navController.popBackStack() })
        }

        composable(NavRoutes.VIEW_GROUPS) {
            ViewGroupsScreen(navController = navController)
        }
    }
}

@Composable
private fun GroupScreenWithId(navController: NavHostController, groupId: String?) {
    groupId?.let {
        GroupScreen(navController = navController, groupId = it)
    }
}

@Composable
private fun VoteRestaurantScreenWithId(navController: NavHostController, groupId: String?) {
    groupId?.let {
        VoteRestaurantScreen(navController = navController, groupId = it)
    }
}