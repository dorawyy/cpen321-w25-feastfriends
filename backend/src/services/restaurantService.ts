import axios from 'axios';
import { AppError } from '../middleware/errorHandler';
import { RestaurantType } from '../types';

// Google Places API response types
interface GooglePlacePhoto {
  photo_reference: string;
  width?: number;
  height?: number;
}

interface GooglePlace {
  place_id: string;
  name?: string;
  formatted_address?: string;
  vicinity?: string;
  price_level?: number;
  rating?: number;
  photos?: GooglePlacePhoto[];
  formatted_phone_number?: string;
  website?: string;
  url?: string;
}

export class RestaurantService {
  private readonly GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY || '';

  async searchRestaurants(
    latitude: number,
    longitude: number,
    radius: number = 5000,
    cuisineTypes?: string[],
    priceLevel?: number,
    limit: number = 20
  ): Promise<RestaurantType[]> {
    try {
      // If no API key, return mock data
      if (!this.GOOGLE_PLACES_API_KEY) {
        console.warn('⚠️  No Google Places API key - returning mock data');
        return this.getMockRestaurants();
      }

      console.log('✅ Using Google Places API with key');
      console.log('🔍 Cuisine filters:', cuisineTypes);
      console.log('🎯 Target limit:', limit);

      let allResults: GooglePlace[] = [];

      if (cuisineTypes && cuisineTypes.length > 0) {
        // ✅ Store results per cuisine separately
        let cuisineResults = new Map<string, GooglePlace[]>();

        // Make separate API call for each cuisine
        for (const cuisine of cuisineTypes) {
          console.log(`📡 Searching for: ${cuisine}`);
          
          const response = await axios.get(
            'https://maps.googleapis.com/maps/api/place/nearbysearch/json',
            {
              params: {
                location: `${latitude},${longitude}`,
                radius: radius,
                type: 'restaurant',
                keyword: cuisine,
                key: this.GOOGLE_PLACES_API_KEY,
              },
            }
          );

          console.log(`📡 Google API Response for "${cuisine}":`, response.data.status);

          if (response.data.status === 'OK') {
            const results = response.data.results || [];
            console.log(`  Found ${results.length} restaurants for ${cuisine}`);
            cuisineResults.set(cuisine, results);
          } else if (response.data.status !== 'ZERO_RESULTS') {
            console.warn(`  Warning for ${cuisine}:`, response.data.status);
          }
        }

        // ✅ Interleave results to ensure variety from each cuisine
        allResults = this.interleaveResults(cuisineResults, limit * 2); // Get more to account for filtering
        
      } else {
        // No cuisine filter - search all restaurants
        console.log('📡 Searching all restaurants (no cuisine filter)');
        
        const response = await axios.get(
          'https://maps.googleapis.com/maps/api/place/nearbysearch/json',
          {
            params: {
              location: `${latitude},${longitude}`,
              radius: radius,
              type: 'restaurant',
              key: this.GOOGLE_PLACES_API_KEY,
            },
          }
        );

        console.log('📡 Google API Response Status:', response.data.status);

        if (response.data.status === 'OK') {
          allResults = response.data.results || [];
        } else if (response.data.status !== 'ZERO_RESULTS') {
          throw new AppError(`Google Places API error: ${response.data.status}`, 500);
        }
      }

      // ✅ Remove duplicates based on place_id
      const uniquePlaces = new Map<string, GooglePlace>();
      allResults.forEach(place => {
        if (!uniquePlaces.has(place.place_id)) {
          uniquePlaces.set(place.place_id, place);
        }
      });
      
      allResults = Array.from(uniquePlaces.values());
      console.log(`🍽️ After deduplication: ${allResults.length} unique restaurants`);

      // ✅ Apply price level filter (if specified) - FLEXIBLE FILTERING
      if (priceLevel) {
        const beforeFilter = allResults.length;
        allResults = allResults.filter((place: GooglePlace) => {
          // If restaurant has no price level, keep it (many restaurants don't have this data)
          if (place.price_level === undefined || place.price_level === null) {
            return true;
          }
          // Allow restaurants within ±1 price level for more variety
          return Math.abs(place.price_level - priceLevel) <= 1;
        });
        console.log(`💰 Price filter (±1 level): ${beforeFilter} → ${allResults.length} restaurants`);
      }

      // ✅ Apply final limit
      allResults = allResults.slice(0, limit);

      console.log(`✅ Final result: ${allResults.length} restaurants (limited to ${limit})`);
      return allResults.map((place: GooglePlace) => this.formatPlaceData(place));
      
    } catch (error: unknown) {
      if (error instanceof AppError) throw error;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ Failed to search restaurants:', errorMessage);
      // Return mock data on error
      return this.getMockRestaurants();
    }
  }

  /**
   * Helper method to interleave results from different cuisines
   * This ensures we get a balanced representation from each cuisine type
   */
  private interleaveResults(cuisineResults: Map<string, GooglePlace[]>, maxTotal: number): GooglePlace[] {
    const result: GooglePlace[] = [];
    const cuisines = Array.from(cuisineResults.keys());
    
    if (cuisines.length === 0) {
      return result;
    }

    const maxPerCuisine = Math.ceil(maxTotal / cuisines.length);
    
    console.log(`🔄 Interleaving results from ${cuisines.length} cuisines (max ${maxPerCuisine} per cuisine)`);
    
    // Take turns picking from each cuisine
    let round = 0;
    
    while (result.length < maxTotal && round < maxPerCuisine) {
      for (const cuisine of cuisines) {
        const restaurants = cuisineResults.get(cuisine);
        if (restaurants && restaurants[round]) {
          result.push(restaurants[round]);
          if (result.length >= maxTotal) break;
        }
      }
      round++;
    }
    
    // Log the distribution
    const distribution: Record<string, number> = {};
    cuisines.forEach(cuisine => {
      const count = result.filter(place => {
        return cuisineResults.get(cuisine)?.some(r => r.place_id === place.place_id) || false;
      }).length;
      distribution[cuisine] = count;
    });
    
    console.log(`🍽️ Interleaved distribution:`, distribution);
    console.log(`📊 Total restaurants after interleaving: ${result.length}`);
    
    return result;
  }

  /**
   * Get restaurant details by place ID
   */
  async getRestaurantDetails(placeId: string): Promise<RestaurantType> {
  try {
    if (!this.GOOGLE_PLACES_API_KEY) {
      console.log('⚠️ No API key, returning mock');
      return this.getMockRestaurant(placeId);
    }

    console.log(`🔍 Fetching details for place_id: ${placeId}`);

    const response = await axios.get(
      'https://maps.googleapis.com/maps/api/place/details/json',
      {
        params: {
          place_id: placeId,
          fields: 'name,formatted_address,geometry,photos,price_level,rating,formatted_phone_number,website,opening_hours,types',
          key: this.GOOGLE_PLACES_API_KEY,
        },
      }
    );

    console.log(`📡 Details API status: ${response.data.status}`);

    if (response.data.status !== 'OK') {
      throw new AppError(`Restaurant not found: ${response.data.status}`, 404);
    }

    const place = response.data.result as GooglePlace;
    const formatted = this.formatPlaceData(place);
    
    // ✅ CRITICAL FIX: Always use the placeId parameter, not the response
    formatted.restaurantId = placeId;
    
    console.log(`✅ Formatted restaurant: ${formatted.name}, ID: ${formatted.restaurantId}, photos: ${formatted.photos?.length || 0}`);
    
    return formatted;
  } catch (error: unknown) {
    if (error instanceof AppError) throw error;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`❌ Failed to get restaurant details:`, errorMessage);
    return this.getMockRestaurant(placeId);
  }
}


  /**
   * Format place data from Google Places API
   */
  private formatPlaceData(place: GooglePlace): RestaurantType {
    const formatted: RestaurantType = {
      name: place.name || '',
      location: place.formatted_address || place.vicinity || '',
      restaurantId: place.place_id || '',  // Ensure it's always set
      address: place.formatted_address || place.vicinity || '',
      priceLevel: place.price_level,
      rating: place.rating,
      photos: place.photos?.map((photo: GooglePlacePhoto) => this.getPhotoUrl(photo.photo_reference)) || [],
      phoneNumber: place.formatted_phone_number,
      website: place.website,
      url: place.url,
    };
    
    // Debug logging
    console.log(`📦 Formatted restaurant: ${formatted.name}`);
    console.log(`   - restaurantId: ${formatted.restaurantId}`);
    console.log(`   - rating: ${formatted.rating}`);
    console.log(`   - priceLevel: ${formatted.priceLevel}`);
    console.log(`   - photos: ${formatted.photos?.length || 0}`);
    console.log(`   - address: ${formatted.address}`);
    
    return formatted;
}

  /**
   * Get photo URL from photo reference
   */
  private getPhotoUrl(photoReference: string, maxWidth: number = 400): string {
    return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${maxWidth}&photo_reference=${photoReference}&key=${this.GOOGLE_PLACES_API_KEY}`;
  }

  /**
   * Get recommended restaurants for a group
   * ✅ Uses Details API for each restaurant to ensure photos (like old Android implementation)
   */
  async getRecommendationsForGroup(
    _groupId: string,
    userPreferences: Array<{
      cuisineTypes: string[];
      budget: number;
      location: { coordinates: [number, number] };
      radiusKm: number;
    }>
  ): Promise<RestaurantType[]> {
    // Calculate average location
    const avgLat = userPreferences.reduce((sum, p) => sum + p.location.coordinates[1], 0) / userPreferences.length;
    const avgLng = userPreferences.reduce((sum, p) => sum + p.location.coordinates[0], 0) / userPreferences.length;

    // Get all cuisine preferences
    const allCuisines = [...new Set(userPreferences.flatMap(p => p.cuisineTypes))];

    // Calculate average budget (convert to price level 1-4)
    const avgBudget = userPreferences.reduce((sum, p) => sum + p.budget, 0) / userPreferences.length;
    const priceLevel = Math.ceil(avgBudget / 25); // Rough conversion

    // Get average radius
    const avgRadius = userPreferences.reduce((sum, p) => sum + p.radiusKm, 0) / userPreferences.length;

    // Search for restaurants (gets basic info)
    const basicRestaurants = await this.searchRestaurants(
      avgLat,
      avgLng,
      avgRadius * 1000, // Convert km to meters
      allCuisines,
      Math.min(4, priceLevel),
      20 // Get 20 restaurants
    );

    // ✅ Fetch full details (including photos) for each restaurant using Details API
    console.log(`📸 Fetching full details with photos for ${basicRestaurants.length} restaurants...`);
    
    const detailedRestaurants = await Promise.all(
      basicRestaurants.map(async (restaurant) => {
        try {
          if (restaurant.restaurantId) {
            console.log(`📸 Fetching details for: ${restaurant.name} (ID: ${restaurant.restaurantId})`);
            const details = await this.getRestaurantDetails(restaurant.restaurantId);
            
            // ✅ CRITICAL: Ensure restaurantId is preserved
            if (!details.restaurantId) {
              console.warn(`⚠️ Details missing restaurantId for ${restaurant.name}, using original`);
              details.restaurantId = restaurant.restaurantId;
            }
            
            console.log(`✅ Got details: ${details.name}, ID: ${details.restaurantId}, photos: ${details.photos?.length || 0}`);
            return details;
          }
          console.warn(`⚠️ Restaurant missing ID: ${restaurant.name}`);
          return restaurant;
        } catch (error) {
          console.error(`❌ Failed to get details for ${restaurant.name}:`, error);
          return restaurant; // Return original if details fetch fails
        }
      })
    );

    // ✅ Filter out any restaurants without restaurantId
    const validRestaurants = detailedRestaurants.filter(r => {
      if (!r.restaurantId) {
        console.error(`❌ Filtering out restaurant without ID: ${r.name}`);
        return false;
      }
      return true;
    });

    console.log(`✅ Fetched full details for ${validRestaurants.length} valid restaurants`);
    return validRestaurants;
  }

  /**
   * NEW: Get next restaurant for sequential voting
   * Returns the next unvoted restaurant from the pool
   */
  async getNextRestaurant(
    restaurantPool: RestaurantType[],
    excludedIds: string[]
  ): Promise<RestaurantType | null> {
    // Filter out already-voted restaurants
    const unvoted = restaurantPool.filter(r => 
      r.restaurantId && !excludedIds.includes(r.restaurantId)
    );
    
    return unvoted.length > 0 ? unvoted[0] : null;
  }

  /**
   * Mock data for testing without API key
   */
  private getMockRestaurants(): RestaurantType[] {
    return [
      {
        name: 'Sushi Paradise',
        location: '123 Main St, Vancouver, BC',
        restaurantId: 'mock_001',
        priceLevel: 2,
        rating: 4.5,
        phoneNumber: '+1-604-555-0001',
        url: 'https://example.com/sushi-paradise',
      },
      {
        name: 'Italian Bistro',
        location: '456 Oak Ave, Vancouver, BC',
        restaurantId: 'mock_002',
        priceLevel: 3,
        rating: 4.7,
        phoneNumber: '+1-604-555-0002',
        url: 'https://example.com/italian-bistro',
      },
      {
        name: 'Burger Joint',
        location: '789 Elm St, Vancouver, BC',
        restaurantId: 'mock_003',
        priceLevel: 1,
        rating: 4.2,
        phoneNumber: '+1-604-555-0003',
        url: 'https://example.com/burger-joint',
      },
      {
        name: 'Thai Express',
        location: '321 Pine St, Vancouver, BC',
        restaurantId: 'mock_004',
        priceLevel: 2,
        rating: 4.3,
        phoneNumber: '+1-604-555-0004',
        url: 'https://example.com/thai-express',
      },
      {
        name: 'Mexican Cantina',
        location: '654 Maple Ave, Vancouver, BC',
        restaurantId: 'mock_005',
        priceLevel: 2,
        rating: 4.6,
        phoneNumber: '+1-604-555-0005',
        url: 'https://example.com/mexican-cantina',
      },
    ];
  }

  private getMockRestaurant(id: string): RestaurantType {
    return {
      name: 'Sample Restaurant',
      location: '123 Sample St, Vancouver, BC',
      restaurantId: id,
      priceLevel: 2,
      rating: 4.5,
      phoneNumber: '+1-604-555-0000',
      url: 'https://example.com/sample-restaurant',
    };
  }
}

export default new RestaurantService();