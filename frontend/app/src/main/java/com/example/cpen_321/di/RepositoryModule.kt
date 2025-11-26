package com.example.cpen_321.di

import com.example.cpen_321.data.local.PreferencesManager
import com.example.cpen_321.data.local.TokenManager
import com.example.cpen_321.data.network.api.CredibilityAPI  // ← ADD THIS IMPORT
import com.example.cpen_321.data.repository.AuthRepository
import com.example.cpen_321.data.repository.AuthRepositoryImpl
import com.example.cpen_321.data.repository.CredibilityRepository  // ← ADD THIS IMPORT
import com.example.cpen_321.data.repository.CredibilityRepositoryImpl  // ← ADD THIS IMPORT
import com.example.cpen_321.data.repository.GroupRepository
import com.example.cpen_321.data.repository.GroupRepositoryImpl
import com.example.cpen_321.data.repository.MatchRepository
import com.example.cpen_321.data.repository.MatchRepositoryImpl
import com.example.cpen_321.data.repository.RestaurantRepository
import com.example.cpen_321.data.repository.RestaurantRepositoryImpl
import com.example.cpen_321.data.repository.UserRepository
import com.example.cpen_321.data.repository.UserRepositoryImpl
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object RepositoryModule {

    @Provides
    @Singleton
    fun provideAuthRepository(
        tokenManager: TokenManager,
        preferencesManager: PreferencesManager
    ): AuthRepository {
        return AuthRepositoryImpl(tokenManager, preferencesManager)
    }

    @Provides
    @Singleton
    fun provideUserRepository(
        preferencesManager: PreferencesManager,
        tokenManager: TokenManager,
        userAPI: com.example.cpen_321.data.network.api.UserAPI
    ): UserRepository {
        return UserRepositoryImpl(preferencesManager, tokenManager, userAPI)
    }

    @Provides
    @Singleton
    fun provideMatchRepository(
        preferencesManager: PreferencesManager,
        userRepository: UserRepository
    ): MatchRepository {
        return MatchRepositoryImpl(preferencesManager, userRepository)
    }

    @Provides
    @Singleton
    fun provideGroupRepository(
        preferencesManager: PreferencesManager
    ): GroupRepository {
        return GroupRepositoryImpl(preferencesManager)
    }

    @Provides
    @Singleton
    fun provideRestaurantRepository(): RestaurantRepository {
        return RestaurantRepositoryImpl()
    }

    // ← ADD THIS METHOD
    @Provides
    @Singleton
    fun provideCredibilityRepository(
        credibilityAPI: CredibilityAPI
    ): CredibilityRepository {
        return CredibilityRepositoryImpl(credibilityAPI)
    }
}