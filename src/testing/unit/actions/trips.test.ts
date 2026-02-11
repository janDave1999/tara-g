import { describe, it, expect, vi, beforeEach } from 'vitest';
import { trip } from '@/actions/trips';
import { supabaseAdmin } from '@/lib/supabase';
import { createTestTrips } from '@/testing/fixtures/trips';

// Mock Supabase client
vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    rpc: vi.fn()
  }
}));

describe('Trip Actions - getNearbyTrips', () => {
  const mockSupabase = vi.mocked(supabaseAdmin);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should validate input parameters correctly', async () => {
    const mockResult = createTestTrips().withLocations;
    
    mockSupabase.rpc.mockResolvedValue({
      data: [mockResult],
      error: null
    });

    const result = await trip.getNearbyTrips({
      lat: 14.5995,
      lng: 120.9842,
      radius: 10,
      page: 1,
      tag_filter: [],
      location_filter: 'destination'
    });

    expect(mockSupabase.rpc).toHaveBeenCalledWith('get_nearby_trips', {
      user_lng: 14.5995,
      user_lat: 120.9842,
      page: 1,
      page_size: 50,
      radius_meters: 10,
      tag_filter: null,
      location_filter: 'destination'
    });
    expect(result).toEqual([mockResult]);
  });

  it('should handle database errors gracefully', async () => {
    const mockError = new Error('Database connection failed');

    mockSupabase.rpc.mockResolvedValue({
      data: null,
      error: mockError
    });

    await expect(trip.getNearbyTrips({
      lat: 14.5995,
      lng: 120.9842,
      radius: 10,
      page: 1,
      tag_filter: [],
      location_filter: 'destination'
    })).rejects.toThrow('Database connection failed');
  });

  it('should handle empty results correctly', async () => {
    mockSupabase.rpc.mockResolvedValue({
      data: [],
      error: null
    });

    const result = await trip.getNearbyTrips({
      lat: 14.5995,
      lng: 120.9842,
      radius: 1,
      page: 1,
      tag_filter: [],
      location_filter: 'destination'
    });

    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(0);
  });

  it('should handle invalid coordinates', async () => {
    await expect(trip.getNearbyTrips({
      lat: NaN,
      lng: 120.9842,
      radius: 10,
      page: 1,
      tag_filter: [],
      location_filter: 'destination'
    })).rejects.toThrow();

    await expect(trip.getNearbyTrips({
      lat: 14.5995,
      lng: Infinity,
      radius: 10,
      page: 1,
      tag_filter: [],
      location_filter: 'destination'
    })).rejects.toThrow();
  });

  it('should handle negative radius', async () => {
    await expect(trip.getNearbyTrips({
      lat: 14.5995,
      lng: 120.9842,
      radius: -5,
      page: 1,
      tag_filter: [],
      location_filter: 'destination'
    })).rejects.toThrow();
  });
});

describe('Trip Actions - searchTags', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should search tags with partial match', async () => {
    const mockTags = [
      { tag_id: 'tag-1', tag_name: 'adventure', usage_count: 150 },
      { tag_id: 'tag-2', tag_name: 'adventure-racing', usage_count: 25 }
    ];

    vi.mocked(supabaseAdmin).from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        ilike: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({
              data: mockTags,
              error: null
            })
          })
        })
      })
    } as any);

    const result = await trip.searchTags({
      query: 'adventure',
      limit: 10
    });

    expect(result.success).toBe(true);
    expect(result.data).toEqual(mockTags);
  });

  it('should handle empty query', async () => {
    await expect(trip.searchTags({
      query: '',
      limit: 10
    })).rejects.toThrow();
  });
});
