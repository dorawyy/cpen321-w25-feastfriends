package com.example.cpen_321.ui.navigation

import androidx.navigation.NavController

object VotingNavigationHelper {

    /**
     * Navigate to vote restaurant screen (legacy list-based)
     */
    fun navigateToVoteRestaurant(navController: NavController, groupId: String) {
        navController.navigate("vote_restaurant/$groupId")
    }

    /**
     * Navigate to sequential voting screen (NEW Tinder-style)
     */
    fun navigateToSequentialVoting(navController: NavController, groupId: String) {
        navController.navigate("sequential_voting/$groupId")
    }

    /**
     * Navigate back to group screen after voting
     */
    fun navigateBackToGroup(navController: NavController) {
        navController.navigate(NavRoutes.GROUP) {
            popUpTo(NavRoutes.GROUP) { inclusive = true }
        }
    }

    /**
     * Navigate to group screen with specific ID
     */
    fun navigateToGroup(navController: NavController, groupId: String) {
        navController.navigate("group/$groupId")
    }
}
