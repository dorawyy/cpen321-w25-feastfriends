
object NavRoutes {
    const val AUTH = "auth"
    const val HOME = "home"
    const val WAITING_ROOM = "waiting_room"
    const val GROUP = "group"
    const val VOTE_RESTAURANT = "vote_restaurant"
    const val SEQUENTIAL_VOTING = "sequential_voting"
    const val PROFILE_CONFIG = "profile_config"
    const val PROFILE = "profile"
    const val PREFERENCES = "preferences"
    const val CREDIBILITY_SCORE = "credibility_score"
    const val VIEW_GROUPS = "view_groups"
    const val SPLASH_SCREEN = "splash"

    // Navigation helpers with parameters
    @Suppress("unused")
    fun groupWithId(groupId: String) = "group/$groupId"

    @Suppress("unused")
    fun voteRestaurantWithId(groupId: String) = "vote_restaurant/$groupId"

    @Suppress("unused")
    fun sequentialVotingWithId(groupId: String) = "sequential_voting/$groupId"
}