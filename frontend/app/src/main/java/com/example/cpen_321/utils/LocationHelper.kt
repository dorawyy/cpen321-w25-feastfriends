package com.example.cpen_321.utils

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import androidx.core.content.ContextCompat
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.google.android.gms.tasks.CancellationTokenSource
import kotlinx.coroutines.tasks.await
import android.util.Log

object LocationHelper {
    @SuppressLint("MissingPermission")  // ← ADD THIS
    suspend fun getCurrentLocation(context: Context): Pair<Double, Double>? {
        return try {
            val fusedLocationClient = LocationServices.getFusedLocationProviderClient(context)

            // Check permission first
            if (!hasLocationPermission(context)) {
                Log.e("LocationHelper", "No location permission")
                return null
            }

            // Try to get current location with timeout
            val location = fusedLocationClient.getCurrentLocation(
                Priority.PRIORITY_HIGH_ACCURACY,
                CancellationTokenSource().token
            ).await()

            location?.let {
                Log.d("LocationHelper", "Got fresh location: ${it.latitude}, ${it.longitude}")
                Pair(it.latitude, it.longitude)
            }
        } catch (e: Exception) {
            Log.e("LocationHelper", "Error getting location", e)
            null
        }
    }

    fun hasLocationPermission(context: Context): Boolean {
        return ContextCompat.checkSelfPermission(
            context,
            Manifest.permission.ACCESS_FINE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED ||
                ContextCompat.checkSelfPermission(
                    context,
                    Manifest.permission.ACCESS_COARSE_LOCATION
                ) == PackageManager.PERMISSION_GRANTED
    }
}