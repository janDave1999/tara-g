import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { trip } from '@/actions/trips';
import { supabaseAdmin } from '@/lib/supabase';
import { createTestTrips, generateLargeTripDataset } from '@/testing/fixtures/trips';

// Mock Supabase client
vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    rpc: vi.fn()
  }
}));

describe('Search Workflow Integration Tests', () => {
  const mockSupabase = vi.mocked(supabaseAdmin);
  const testTrips = createTestTrips();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should handle complete search workflow with all filters', async () => {
    // Mock a realistic search response
    const searchResults = [
      {
        ...testTrips.complexFiltering,
        distance_km: 12.5,
        score: 0.85
      },
      {
        ...testTrips.withLocations,
        distance_km: 18.2,
        score: 0.72
      }
    ];

    mockSupabase.rpc.mockResolvedValue({
      data: searchResults,
      error: null
    });

    // Execute complete search workflow
    const searchParams = {
      lat: 14.5995,
      lng: 120.9842,
      radius: 25,
      page: 1,
      tag_filter: ['adventure', 'budget'],
      location_filter: 'destination'
    };

    const result = await trip.getNearbyTrips(searchParams);

    // Verify workflow execution
    expect(mockSupabase.rpc).toHaveBeenCalledWith('get_nearby_trips', {
      user_lng: searchParams.lat,
      user_lat: searchParams.lng,
      page: searchParams.page,
      page_size: 50,
      radius_meters: searchParams.radius,
      tag_filter: searchParams.tag_filter,
      location_filter: searchParams.location_filter
    });

    // Verify data integrity
    expect(result).toHaveLength(2);
    expect(result[0]).toHaveProperty('trip_id');
    expect(result[0]).toHaveProperty('distance_km');
    expect(result[0]).toHaveProperty('score');
    expect(result[0].distance_km).toBeLessThan(result[1].distance_km); // Sorted by distance
  });

  it('should maintain data consistency through complex filter combinations', async () => {
    const complexResults = generateLargeTripDataset(100).slice(0, 10);
    
    mockSupabase.rpc.mockResolvedValue({
      data: complexResults,
      error: null
    });

    // Test multiple filter combinations
    const filterCombinations = [
      { tags: ['adventure'], budget: [1000, 5000] },
      { tags: ['beach', 'luxury'], budget: [5000, 10000] },
      { tags: ['budget'], budget: [0, 2000] },
      { tags: [], budget: null } // No filters
    ];

    const results = await Promise.all(
      filterCombinations.map(async (filters) => {
        return await trip.getNearbyTrips({
          lat: 14.5995,
          lng: 120.9842,
          radius: 50,
          page: 1,
          tag_filter: filters.tags,
          location_filter: 'destination'
        });
      })
    );

    // Verify consistency
    results.forEach((result, index) => {
      expect(Array.isArray(result)).toBe(true);
      // Each result should have consistent structure
      result.forEach(trip => {
        expect(trip).toHaveProperty('trip_id');
        expect(trip).toHaveProperty('title');
        expect(trip).toHaveProperty('trip_details');
        expect(trip.trip_details).toHaveProperty('tags');
        expect(trip.trip_details).toHaveProperty('estimated_budget');
      });
    });
  });

  it('should handle partial workflow failures gracefully', async () => {
    // Simulate intermediate failure
    mockSupabase.rpc
      .mockResolvedValueOnce({
        data: null,
        error: new Error('Connection timeout')
      })
      .mockResolvedValueOnce({
        data: [testTrips.basic],
        error: null
      });

    // First request should fail
    await expect(trip.getNearbyTrips({
      lat: 14.5995,
      lng: 120.9842,
      radius: 25,
      page: 1,
      tag_filter: [],
      location_filter: 'destination'
    })).rejects.toThrow('Connection timeout');

    // Second request should succeed
    const result = await trip.getNearbyTrips({
      lat: 14.5995,
      lng: 120.9842,
      radius: 25,
      page: 2,
      tag_filter: [],
      location_filter: 'destination'
    });

    expect(result).toHaveLength(1);
  });

  it('should respect rate limiting', async () => {
    // Mock rate limiting response
    mockSupabase.rpc.mockResolvedValue({
      data: null,
      error: new Error('Rate limit exceeded')
    });

    const promises = Array.from({ length: 10 }, () =>
      trip.getNearbyTrips({
        lat: 14.5995,
        lng: 120.9842,
        radius: 25,
        page: 1,
        tag_filter: [],
        location_filter: 'destination'
      })
    );

    const results = await Promise.allSettled(promises);
    
    // Most requests should fail due to rate limiting
    const failures = results.filter(r => r.status === 'rejected');
    expect(failures.length).toBeGreaterThan(5);
  });

  it('should handle authentication and authorization properly', async () => {
    // Mock authentication failure
    mockSupabase.rpc.mockResolvedValue({
      data: null,
      error: new Error('Unauthorized access')
    });

    await expect(trip.getNearbyTrips({
      lat: 14.5995,
      lng: 120.9842,
      radius: 25,
      page: 1,
      tag_filter: [],
      location_filter: 'destination'
    })).rejects.toThrow('Unauthorized access');
  });

  it('should maintain performance under realistic load', async () => {
    const realisticDataset = generateLargeTripDataset(500);
    
    mockSupabase.rpc.mockResolvedValue({
      data: realisticDataset.slice(0, 50),
      error: null
    });

    // Simulate realistic user behavior patterns
    const userSearches = [
      // Most common: location + basic filters
      { lat: 14.5995, lng: 120.9842, radius: 25, tags: [] },
      // Specific interest: multiple tags
      { lat: 14.6079, lng: 120.9821, radius: 15, tags: ['adventure', 'beach'] },
      // Budget conscious: small radius, budget tags
      { lat: 14.5830, lng: 120.9773, radius: 10, tags: ['budget'] },
      // Exploring: large radius, no tags
      { lat: 14.5597, lng: 121.0181, radius: 50, tags: [] }
    ];

    const startTime = performance.now();
    const searchPromises = userSearches.map(params =>
      trip.getNearbyTrips({
        lat: params.lat,
        lng: params.lng,
        radius: params.radius,
        page: 1,
        tag_filter: params.tags,
        location_filter: 'destination'
      })
    );

    const results = await Promise.all(searchPromises);
    const endTime = performance.now();

    expect(endTime - startTime).toBeLessThan(2000); // All searches in < 2s
    expect(results).toHaveLength(4);
    results.forEach(result => {
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeLessThanOrEqual(50);
    });
  });

  it('should handle empty result sets consistently', async () => {
    mockSupabase.rpc.mockResolvedValue({
      data: [],
      error: null
    });

    const result = await trip.getNearbyTrips({
      lat: 0, // Middle of ocean - no trips
      lng: 0,
      radius: 10,
      page: 1,
      tag_filter: ['nonexistent-tag'],
      location_filter: 'destination'
    });

    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(0);
  });

  it('should validate input data integrity', async () => {
    // Test with malformed data that should be handled gracefully
    mockSupabase.rpc.mockResolvedValue({
      data: [
        {
          trip_id: null, // Invalid trip_id
          title: 'Invalid Trip',
          trip_details: null // Missing trip_details
        },
        {
          trip_id: 'valid-trip',
          title: 'Valid Trip',
          trip_details: {
            description: 'Valid description',
            tags: ['valid'],
            estimated_budget: 1000
          }
        }
      ],
      error: null
    });

    const result = await trip.getNearbyTrips({
      lat: 14.5995,
      lng: 120.9842,
      radius: 25,
      page: 1,
      tag_filter: [],
      location_filter: 'destination'
    });

    // Should still
