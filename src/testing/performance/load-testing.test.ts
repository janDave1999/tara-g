import { describe, it, expect, vi, beforeEach } from 'vitest';
import { trip } from '@/actions/trips';
import { supabaseAdmin } from '@/lib/supabase';
import { generateLargeTripDataset } from '@/testing/fixtures/trips';

// Mock Supabase client
vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    rpc: vi.fn()
  }
}));

// Performance measurement utility
const measureResponseTime = async (fn: Function): Promise<{ result: any; duration: number }> => {
  const start = performance.now();
  const result = await fn();
  const end = performance.now();
  return { result, duration: end - start };
};

describe('Load Testing - Trip Search', () => {
  const largeDataset = generateLargeTripDataset(1000);
  const mockSupabase = vi.mocked(supabaseAdmin);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should handle simple search within performance target', async () => {
    mockSupabase.rpc.mockResolvedValue({
      data: largeDataset.slice(0, 50),
      error: null
    });

    const { duration, result } = await measureResponseTime(() => 
      trip.getNearbyTrips({
        lat: 14.5995,
        lng: 120.9842,
        radius: 50,
        page: 1,
        tag_filter: [],
        location_filter: 'destination'
      })
    );

    expect(duration).toBeLessThan(100); // < 100ms for simple search
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  it('should handle complex search within performance target', async () => {
    mockSupabase.rpc.mockResolvedValue({
      data: largeDataset.slice(0, 30),
      error: null
    });

    const { duration, result } = await measureResponseTime(() => 
      trip.getNearbyTrips({
        lat: 14.5995,
        lng: 120.9842,
        radius: 25,
        page: 1,
        tag_filter: ['adventure', 'beach', 'budget'],
        location_filter: 'pickup'
      })
    );

    expect(duration).toBeLessThan(300); // < 300ms for complex search
    expect(Array.isArray(result)).toBe(true);
  });

  it('should handle concurrent searches efficiently', async () => {
    mockSupabase.rpc.mockResolvedValue({
      data: largeDataset.slice(0, 20),
      error: null
    });

    const concurrentRequests = 50;
    const searchPromises = Array.from({ length: concurrentRequests }, (_, i) => 
      trip.getNearbyTrips({
        lat: 14.5995 + (i * 0.01),
        lng: 120.9842 + (i * 0.01),
        radius: 25,
        page: 1,
        tag_filter: [],
        location_filter: 'destination'
      })
    );

    const start = performance.now();
    const results = await Promise.all(searchPromises);
    const end = performance.now();

    const averageDuration = (end - start) / concurrentRequests;

    expect(averageDuration).toBeLessThan(1000); // < 1s average for concurrent
    expect(results.length).toBe(concurrentRequests);
    results.forEach(result => {
      expect(Array.isArray(result)).toBe(true);
    });
  });

  it('should maintain performance with multiple filters', async () => {
    mockSupabase.rpc.mockResolvedValue({
      data: largeDataset.slice(0, 25),
      error: null
    });

    const searchParams = {
      lat: 14.5995,
      lng: 120.9842,
      radius: 30,
      page: 1,
      tag_filter: ['adventure', 'beach', 'mountain', 'budget'],
      location_filter: 'destination'
    };

    const durations = [];
    for (let i = 0; i < 10; i++) {
      const { duration } = await measureResponseTime(() => 
        trip.getNearbyTrips(searchParams)
      );
      durations.push(duration);
    }

    const averageDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
    const maxDuration = Math.max(...durations);

    expect(averageDuration).toBeLessThan(300); // Consistent average performance
    expect(maxDuration).toBeLessThan(500); // No major spikes
  });
});
