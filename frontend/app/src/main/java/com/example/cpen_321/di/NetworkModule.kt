package com.example.cpen_321.di

import com.example.cpen_321.BuildConfig
import com.example.cpen_321.data.local.TokenManager
import com.example.cpen_321.data.network.RetrofitClient
import com.example.cpen_321.data.network.api.AuthAPI
import com.example.cpen_321.data.network.api.CredibilityAPI  // ← ADD THIS IMPORT
import com.example.cpen_321.data.network.api.GroupAPI
import com.example.cpen_321.data.network.api.MatchAPI
import com.example.cpen_321.data.network.api.RestaurantAPI
import com.example.cpen_321.data.network.api.UserAPI
import com.example.cpen_321.data.network.interceptors.AuthInterceptor
import com.google.gson.Gson
import com.google.gson.GsonBuilder
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.util.concurrent.TimeUnit
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object NetworkModule {

    private const val BASE_URL = BuildConfig.IMAGE_BASE_URL

    @Provides
    @Singleton
    fun provideGson(): Gson {
        return GsonBuilder()
            .setLenient()
            .serializeNulls()
            .create()
    }

    @Provides
    @Singleton
    fun provideAuthInterceptor(tokenManager: TokenManager): AuthInterceptor {
        return AuthInterceptor(tokenManager)
    }

    @Provides
    @Singleton
    fun provideLoggingInterceptor(): HttpLoggingInterceptor {
        return HttpLoggingInterceptor().apply {
            level = HttpLoggingInterceptor.Level.BODY
        }
    }

    @Provides
    @Singleton
    fun provideOkHttpClient(
        authInterceptor: AuthInterceptor,
        loggingInterceptor: HttpLoggingInterceptor
    ): OkHttpClient {
        return OkHttpClient.Builder()
            .connectTimeout(30, TimeUnit.SECONDS)
            .readTimeout(30, TimeUnit.SECONDS)
            .writeTimeout(30, TimeUnit.SECONDS)
            .addInterceptor(authInterceptor)
            .addInterceptor(loggingInterceptor)
            .build()
    }

    @Provides
    @Singleton
    fun provideRetrofit(
        okHttpClient: OkHttpClient,
        gson: Gson
    ): Retrofit {
        return Retrofit.Builder()
            .baseUrl(BASE_URL)
            .client(okHttpClient)
            .addConverterFactory(GsonConverterFactory.create(gson))
            .build()
    }

    @Provides
    @Singleton
    fun provideAuthAPI(retrofit: Retrofit): AuthAPI {
        return retrofit.create(AuthAPI::class.java)
    }

    @Provides
    @Singleton
    fun provideUserAPI(retrofit: Retrofit): UserAPI {
        return retrofit.create(UserAPI::class.java)
    }

    @Provides
    @Singleton
    fun provideMatchAPI(retrofit: Retrofit): MatchAPI {
        return retrofit.create(MatchAPI::class.java)
    }

    @Provides
    @Singleton
    fun provideGroupAPI(retrofit: Retrofit): GroupAPI {
        return retrofit.create(GroupAPI::class.java)
    }

    @Provides
    @Singleton
    fun provideRestaurantAPI(retrofit: Retrofit): RestaurantAPI {
        return retrofit.create(RestaurantAPI::class.java)
    }

    // ← ADD THIS METHOD
    @Provides
    @Singleton
    fun provideCredibilityAPI(retrofit: Retrofit): CredibilityAPI {
        return retrofit.create(CredibilityAPI::class.java)
    }
}