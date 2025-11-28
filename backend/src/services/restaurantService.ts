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
      if (!this.GOOGLE_PLACES_API_KEY) {
        return this.getMockRestaurants();
      }

      let allResults: GooglePlace[] = [];

      if (cuisineTypes && cuisineTypes.length > 0) {
        // ✅ Store results per cuisine separately
        let cuisineResults = new Map<string, GooglePlace[]>();

        for (const cuisine of cuisineTypes) {
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

          if (response.data.status === 'OK') {
            const results = response.data.results || [];
            cuisineResults.set(cuisine, results);
          } 
        }

        allResults = this.interleaveResults(cuisineResults, limit * 2);
        
      } else {
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

        if (response.data.status === 'OK') {
          allResults = response.data.results || [];
        } else if (response.data.status !== 'ZERO_RESULTS') {
          throw new AppError(`Google Places API error: ${response.data.status}`, 500);
        }
      }

      const uniquePlaces = new Map<string, GooglePlace>();
      allResults.forEach(place => {
        if (!uniquePlaces.has(place.place_id)) {
          uniquePlaces.set(place.place_id, place);
        }
      });
      
      allResults = Array.from(uniquePlaces.values());

      if (priceLevel) {
        allResults = allResults.filter((place: GooglePlace) => {
          if (place.price_level === undefined || place.price_level === null) {
            return true;
          }
          return Math.abs(place.price_level - priceLevel) <= 1;
        });
      }

      allResults = allResults.slice(0, limit);

      return allResults.map((place: GooglePlace) => this.formatPlaceData(place));
      
    } catch (error: unknown) {
      if (error instanceof AppError) throw error;
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
    
    return result;
  }

  /**
   * Get restaurant details by place ID
   */
  async getRestaurantDetails(placeId: string): Promise<RestaurantType> {
  try {
    if (!this.GOOGLE_PLACES_API_KEY) {
      return this.getMockRestaurant(placeId);
    }

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

    if (response.data.status !== 'OK') {
      throw new AppError(`Restaurant not found: ${response.data.status}`, 404);
    }

    const place = response.data.result as GooglePlace;
    const formatted = this.formatPlaceData(place);
    
    formatted.restaurantId = placeId;
    
    return formatted;
  } catch (error: unknown) {
    if (error instanceof AppError) throw error;
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
      20
    );
    
    const detailedRestaurants = await Promise.all(
      basicRestaurants.map(async (restaurant) => {
          if (restaurant.restaurantId) {
            const details = await this.getRestaurantDetails(restaurant.restaurantId);
            return details;
          }
          return restaurant;
      })
    );

    const validRestaurants = detailedRestaurants.filter(r => {
      if (!r.restaurantId) {
        return false;
      }
      return true;
    });

    return validRestaurants;
  }

  /**
   * Get next restaurant for sequential voting
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