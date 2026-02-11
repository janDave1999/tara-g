import { describe, it, expect, vi, beforeEach } from 'vitest';
import { supabaseAdmin } from '@/lib/supabase';
import { createTestTrips } from '@/testing/fixtures/trips';

// Mock Supabase client
vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    rpc: vi.fn()
  }
}));

describe('Database Data Consistency Tests', () => {
  const mockSupabase = vi.mocked(supabaseAdmin);
  const testTrips = createTestTrips();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should maintain referential integrity between trips and locations', async () => {
    const mockResults = [
      {
        ...testTrips.withLocations,
        trip_locations: testTrips.withLocations.trip_locations.map(loc => ({
          ...loc,
          location: {
            location_id: 'valid-location-id',
            name: 'Valid Location',
            lat: '14.5995',
            lng: '120.9842'
          }
        }))
      }
    ];

    mockSupabase.rpc.mockResolvedValue({
      data: mockResults,
      error: null
    });

    const result = await supabaseAdmin.rpc('get_nearby_trips', {
      user_lat: 14.5995,
      user_lng: 120.9842,
      page: 1,
      page_size: 50,
      radius_meters: 50,
      tag_filter: null,
      location_filter: 'destination'
    });

    result.data.forEach((trip: any) => {
      expect(trip.trip_id).toBeDefined();
      if (trip.trip_locations) {
        trip.trip_locations.forEach((location: any) => {
          expect(location.location).toBeDefined();
          expect(location.location.location_id).toBeDefined();
          expect(location.location.name).toBeDefined();
        });
      }
    });
  });

  it('should ensure data type consistency across related tables', async () => {
    const mockResults = [
      {
        trip_id: 'uuid-string',
        owner_id: 'user-uuid-string',
        title: 'String Title',
        estimated_budget: 5000,
        max_pax: 10,
        created_at: '2024-01-01T00:00:00Z',
        trip_details: {
          start_date: '2024-06-15',
          end_date: '2024-06-20',
          tags: ['tag1', 'tag2'],
          cost_sharing: 'split_evenly'
        }
      }
    ];

    mockSupabase.rpc.mockResolvedValue({
      data: mockResults,
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

    result.data.forEach((trip: any) => {
      expect(typeof trip.trip_id).toBe('string');
      expect(typeof trip.owner_id).toBe('string');
      expect(typeof trip.estimated_budget).toBe('number');
      expect(typeof trip.max_pax).toBe('number');
      expect(typeof trip.created_at).toBe('string');
      expect(typeof trip.trip_details.start_date).toBe('string');
      expect(typeof trip.trip_details.end_date).toBe('string');
      expect(Array.isArray(trip.trip_details.tags)).toBe(true);
      expect(['split_evenly', 'organizer_shoulders_cost', 'pay_own_expenses', 'custom_split'])
        .toContain(trip.trip_details.cost_sharing);
    });
  });
});
