import { vi } from 'vitest';

// Global test setup
export const setupTestEnvironment = () => {
  // Mock console methods to reduce noise in tests
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});

  // Set up timezone for consistent date testing
  process.env.TZ = 'UTC';

  // Mock performance.now() for consistent timing tests
  let mockTime = 0;
  vi.spyOn(performance, 'now').mockImplementation(() => {
    mockTime += Math.random() * 50; // Simulate varying response times
    return mockTime;
  });

  return () => {
    vi.restoreAllMocks();
  };
};

// Test data cleanup utilities
export const cleanupTestData = async () => {
  // Clean up any test data in database
  // Reset mocks
  vi.clearAllMocks();
};

// Performance measurement utilities
export const measureResponseTime = async <T>(
  fn: () => Promise<T>
): Promise<{ result: T; duration: number }> => {
  const start = performance.now();
  const result = await fn();
  const end = performance.now();
  return { result, duration: end - start };
};

export const assertPerformance = (duration: number, maxMs: number, operation: string) => {
  if (duration > maxMs) {
    throw new Error(`Performance test failed: ${operation} took ${duration}ms (max: ${maxMs}ms)`);
  }
};

// Database helpers
export const createMockSupabaseResponse = (data: any, error: any = null) => ({
  data,
  error
});

export const createMockTrip = (overrides: any = {}) => ({
  trip_id: 'test-trip-id',
  owner_id: 'test-user-id',
  title: 'Test Trip',
  description: 'Test description',
  status: 'active',
  user_role: 'owner',
  trip_details: {
    description: 'Test trip details',
    start_date: '2024-06-15',
    end_date: '2024-06-20',
    region: 'Manila, Philippines',
    max_pax: 10,
    gender_pref: 'any',
    cost_sharing: 'split_evenly',
    estimated_budget: 5000,
    join_by: '2024-06-10T23:59:59Z',
    join_by_time: '23:59:59',
    tags: ['adventure', 'beach', 'travel'],
    ...overrides.trip_details
  },
  trip_locations: [],
  trip_members: [],
  trip_visibility: {
    visibility: 'public',
    max_participants: 10,
    current_participants: 2,
    is_reusable: false,
    share_slug: 'test-trip-slug'
  },
  trip_pools: [],
  trip_pool_members: [],
  trip_expenses: [],
  trip_images: [],
  ...overrides
});

// Common test constants
export const TEST_CONSTANTS = {
  MANILA_COORDINATES: { lat: 14.5995, lng: 120.9842 },
  CEBU_COORDINATES: { lat: 10.3157, lng: 123.8854 },
  DAVAO_COORDINATES: { lat: 7.0731, lng: 125.6128 },
  
  PERFORMANCE_TARGETS: {
    SIMPLE_SEARCH: 100,    // ms
    COMPLEX_SEARCH: 300,   // ms
    LARGE_DATASET: 500,    // ms
    CONCURRENT_SEARCH: 1000, // ms average
    
    // Response size limits
    MAX_RESULTS_PER_PAGE: 50,
    MAX_CONCURRENT_REQUESTS: 50
  },
  
  BUDGET_RANGES: {
    BUDGET: [0, 3000],
    MID_RANGE: [3000, 8000],
    LUXURY: [8000, null]
  },
  
  COMMON_TAGS: [
    'adventure', 'beach', 'mountain', 'city', 
    'cultural', 'food', 'budget', 'luxury',
    'family', 'solo', 'backpacking', 'resort'
  ]
};

// Error simulation utilities
export const simulateDatabaseError = (message: string) => ({
  data: null,
  error: new Error(message)
});

export const simulateNetworkError = () => {
  const error = new Error('Network error');
  error.name = 'NetworkError';
  return error;
};

// Test assertion helpers
export const expectValidTripStructure = (trip: any) => {
  expect(trip).toHaveProperty('trip_id');
  expect(trip).toHaveProperty('title');
  expect(trip).toHaveProperty('status');
  expect(trip).toHaveProperty('trip_details');
  expect(trip.trip_details).toHaveProperty('tags');
  expect(trip.trip_details).toHaveProperty('estimated_budget');
  expect(trip.trip_details).toHaveProperty('start_date');
  expect(trip.trip_details).toHaveProperty('end_date');
};

export const expectValidSearchResults = (results: any[]) => {
  expect(Array.isArray(results)).toBe(true);
  results.forEach(trip => {
    expectValidTripStructure(trip);
  });
};

export const expectResultsSortedByDistance = (results: any[]) => {
  if (results.length < 2) return;
  
  for (let i = 1; i < results.length; i++) {
    if (results[i].distance_km && results[i - 1].distance_km) {
      expect(results[i].distance_km).toBeGreaterThanOrEqual(results[i - 1].distance_km);
    }
  }
};
