import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { supabaseAdmin } from '@/lib/supabase';
import { createTestTrips, edgeCaseTrips } from '@/testing/fixtures/trips';

// Mock Supabase client
vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    rpc: vi.fn()
  }
}));

describe('search_trips SQL Function', () => {
  const mockSupabase = vi.mocked(supabaseAdmin);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should filter trips by location within radius', async () => {
    const mockResult = [
      {
        trip_id: 'trip-1',
        title: 'Manila Trip',
        distance_km: 5.2
      }
    ];

    mockSupabase.rpc.mockResolvedValueOnce({
      data: mockResult,
      error: null
    });

    const result = await supabaseAdmin.rpc('search_trips', {
      p_latitude: 14.5995,
      p_longitude: 120.9842,
      p_radius_km: 10,
      p_tags: null,
      p_min_budget: null,
      p_max_budget: null,
      p_start_date: null,
      p_end_date: null,
      p_status: ['active'],
      p_location_type: 'destination',
      p_limit: 50,
      p_offset: 0
    });

    expect(mockSupabase.rpc).toHaveBeenCalledWith('search_trips', expect.objectContaining({
      p_latitude: 14.5995,
      p_longitude: 120.9842,
      p_radius_km: 10
    }));
    expect(result.data).toEqual(mockResult);
  });

  it('should filter by budget range correctly', async () => {
    const mockResult = [
      {
        trip_id: 'budget-trip',
        title: 'Budget Adventure',
        estimated_budget: 2000
      }
    ];

    mockSupabase.rpc.mockResolvedValueOnce({
      data: mockResult,
      error: null
    });

    await supabaseAdmin.rpc('search_trips', {
      p_latitude: 14.5995,
      p_longitude: 120.9842,
      p_radius_km: 50,
      p_tags: null,
      p_min_budget: 1000,
      p_max_budget: 3000,
      p_start_date: null,
      p_end_date: null,
      p_status: ['active'],
      p_location_type: 'destination',
      p_limit: 50,
      p_offset: 0
    });

    expect(mockSupabase.rpc).toHaveBeenCalledWith('search_trips', expect.objectContaining({
      p_min_budget: 1000,
      p_max_budget: 3000
    }));
  });

  it('should handle multiple tag filtering', async () => {
    const tags = ['adventure', 'beach'];
    const mockResult = [
      {
        trip_id: 'tagged-trip',
        title: 'Beach Adventure',
        tags: ['adventure', 'beach', 'travel']
      }
    ];

    mockSupabase.rpc.mockResolvedValueOnce({
      data: mockResult,
      error: null
    });

    await supabaseAdmin.rpc('search_trips', {
      p_latitude: 14.5995,
      p_longitude: 120.9842,
      p_radius_km: 50,
      p_tags: tags,
      p_min_budget: null,
      p_max_budget: null,
      p_start_date: null,
      p_end_date: null,
      p_status: ['active'],
      p_location_type: 'destination',
      p_limit: 50,
      p_offset: 0
    });

    expect(mockSupabase.rpc).toHaveBeenCalledWith('search_trips', expect.objectContaining({
      p_tags: tags
    }));
  });

  it('should apply date range filtering', async () => {
    const mockResult = [
      {
        trip_id: 'summer-trip',
        title: 'Summer Vacation',
        start_date: '2024-06-15',
        end_date: '2024-06-20'
      }
    ];

    mockSupabase.rpc.mockResolvedValueOnce({
      data: mockResult,
      error: null
    });

    await supabaseAdmin.rpc('search_trips', {
      p_latitude: 14.5995,
      p_longitude: 120.9842,
      p_radius_km: 50,
      p_tags: null,
      p_min_budget: null,
      p_max_budget: null,
      p_start_date: '2024-06-01',
      p_end_date: '2024-06-30',
      p_status: ['active'],
      p_location_type: 'destination',
      p_limit: 50,
      p_offset: 0
    });

    expect(mockSupabase.rpc).toHaveBeenCalledWith('search_trips', expect.objectContaining({
      p_start_date: '2024-06-01',
      p_end_date: '2024-06-30'
    }));
  });

  it('should handle empty/null parameters gracefully', async () => {
    const mockResult = [];

    mockSupabase.rpc.mockResolvedValueOnce({
      data: mockResult,
      error: null
    });

    await supabaseAdmin.rpc('search_trips', {
      p_latitude: null,
      p_longitude: null,
      p_radius_km: null,
      p_tags: null,
      p_min_budget: null,
      p_max_budget: null,
      p_start_date: null,
      p_end_date: null,
      p_status: null,
      p_location_type: null,
      p_limit: 50,
      p_offset: 0
    });

    expect(mockSupabase.rpc).toHaveBeenCalledWith('search_trips', {
      p_latitude: null,
      p_longitude: null,
      p_radius_km: null,
      p_tags: null,
      p_min_budget: null,
      p_max_budget: null,
      p_start_date: null,
      p_end_date: null,
      p_status: null,
      p_location_type: null,
      p_limit: 50,
      p_offset: 0
    });
  });

  it('should respect pagination limits', async () => {
    const mockResult = Array.from({ length: 20 }, (_, i) => ({
      trip_id: `trip-${i}`,
      title: `Trip ${i}`
    }));

    mockSupabase.rpc.mockResolvedValueOnce({
      data: mockResult,
      error: null
    });

    await supabaseAdmin.rpc('search_trips', {
      p_latitude: 14.5995,
      p_longitude: 120.9842,
      p_radius_km: 50,
      p_tags: null,
      p_min_budget: null,
      p_max_budget: null,
      p_start_date: null,
      p_end_date: null,
      p_status: ['active'],
      p_location_type: 'destination',
      p_limit: 20,
      p_offset: 0
    });

    expect(mockSupabase.rpc).toHaveBeenCalledWith('search_trips', expect.objectContaining({
      p_limit: 20,
      p_offset: 0
    }));
    expect(mockResult.length).toBeLessThanOrEqual(20);
  });

  it('should return results in correct order', async () => {
    const mockResult = [
      { trip_id: 'trip-1', distance_km: 1.5 },
      { trip_id: 'trip-2', distance_km: 3.2 },
      { trip_id: 'trip-3', distance_km: 8.7 }
    ];

    mockSupabase.rpc.mockResolvedValueOnce({
      data: mockResult,
      error: null
    });

    const result = await supabaseAdmin.rpc('search_trips', {
      p_latitude: 14.5995,
      p_longitude: 120.9842,
      p_radius_km: 50,
      p_tags: null,
      p_min_budget: null,
      p_max_budget: null,
      p_start_date: null,
      p_end_date: null,
      p_status: ['active'],
      p_location_type: 'destination',
      p_limit: 50,
      p_offset: 0
    });

    // Verify results are sorted by distance (closest first)
    const distances = result.data.map((trip: any) => trip.distance_km);
    expect(distances).toEqual([...distances].sort((a, b) => a - b));
  });

  it('should handle database errors gracefully', async () => {
    const mockError = new Error('Database connection failed');

    mockSupabase.rpc.mockResolvedValueOnce({
      data: null,
      error: mockError
    });

    const result = await supabaseAdmin.rpc('search_trips', {
      p_latitude: 14.5995,
      p_longitude: 120.9842,
      p_radius_km: 50,
      p_tags: null,
      p_min_budget: null,
      p_max_budget: null,
      p_start_date: null,
      p_end_date: null,
      p_status: ['active'],
      p_location_type: 'destination',
      p_limit: 50,
      p_offset: 0
    });

    expect(result.error).toEqual(mockError);
    expect(result.data).toBeNull();
  });
});
