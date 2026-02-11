import { vi } from 'vitest';

// Mock Supabase client for all tests
export const createMockSupabaseClient = () => {
  const mockClient = {
    // RPC function mocking
    rpc: vi.fn(),
    
    // Query builder mocking
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => ({
            limit: vi.fn(() => ({
              data: [],
              error: null
            }))
          }))
        })),
        ilike: vi.fn(() => ({
          order: vi.fn(() => ({
            limit: vi.fn(() => ({
              data: [],
              error: null
            }))
          }))
        })),
        in: vi.fn(() => ({
          order: vi.fn(() => ({
            limit: vi.fn(() => ({
              data: [],
              error: null
            }))
          }))
        }))
      })),
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() => ({
            data: null,
            error: null
          }))
        }))
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() => ({
              data: null,
              error: null
            }))
          }))
        }))
      })),
      delete: vi.fn(() => ({
        eq: vi.fn(() => ({
          data: null,
          error: null
        }))
      }))
    })),
    
    // Auth mocking
    auth: {
      getUser: vi.fn(() => ({
        data: { user: { id: 'test-user-id' } },
        error: null
      })),
      signIn: vi.fn(),
      signOut: vi.fn()
    }
  };
  
  return mockClient;
};

// Default mock responses
export const mockTripSearchResponse = (trips: any[] = []) => ({
  data: trips,
  error: null
});

export const mockErrorResponse = (message: string) => ({
  data: null,
  error: new Error(message)
});

export const mockAuthUser = (overrides: any = {}) => ({
  id: 'test-user-id',
  email: 'test@example.com',
  full_name: 'Test User',
  ...overrides
});

// Common mock setups
export const setupTripSearchMocks = () => {
  const mockClient = createMockSupabaseClient();
  
  // Setup default successful response for search_trips
  mockClient.rpc.mockResolvedValue(mockTripSearchResponse());
  
  return mockClient;
};

export const setupAuthMocks = (user: any = mockAuthUser()) => {
  const mockClient = createMockSupabaseClient();
  
  mockClient.auth.getUser.mockResolvedValue({
    data: { user },
    error: null
  });
  
  return mockClient;
};

export const setupErrorMocks = (errorMessage: string) => {
  const mockClient = createMockSupabaseClient();
  
  mockClient.rpc.mockResolvedValue(mockErrorResponse(errorMessage));
  
  return mockClient;
};

// Mock transaction helpers
export const mockTransaction = () => ({
  begin: vi.fn(),
  commit: vi.fn(),
  rollback: vi.fn()
});

// Mock performance monitoring
export const mockPerformanceMetrics = () => ({
  queryTime: 45,
  dbConnections: 5,
  memoryUsage: 1024 * 1024 * 50, // 50MB
  cacheHitRate: 0.85
});

// Type helpers for better TypeScript support
export interface MockSupabaseClient {
  rpc: ReturnType<typeof vi.fn>;
  from: ReturnType<typeof vi.fn>;
  auth: {
    getUser: ReturnType<typeof vi.fn>;
    signIn: ReturnType<typeof vi.fn>;
    signOut: ReturnType<typeof vi.fn>;
  };
}

// Helper to create realistic test data
export const createMockTripData = (overrides: any = {}) => ({
  trip_id: 'mock-trip-id',
  owner_id: 'mock-user-id',
  title: 'Mock Trip',
  description: 'A mock trip for testing',
  status: 'active',
  user_role: 'visitor',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  trip_details: {
    description: 'Mock trip details',
    start_date: '2024-06-15',
    end_date: '2024-06-20',
    region: 'Mock Region',
    max_pax: 10,
    gender_pref: 'any',
    cost_sharing: 'split_evenly',
    estimated_budget: 5000,
    join_by: '2024-06-10T23:59:59Z',
    join_by_time: '23:59:59',
    tags: ['mock', 'test'],
    ...overrides.trip_details
  },
  trip_locations: [],
  trip_members: [],
  trip_visibility: {
    visibility: 'public',
    max_participants: 10,
    current_participants: 2,
    is_reusable: false,
    share_slug: 'mock-trip'
  },
  trip_pools: [],
  trip_pool_members: [],
  trip_expenses: [],
  trip_images: [],
  ...overrides
});

// Helper to create search result with distance
export const createMockSearchResult = (distance: number, overrides: any = {}) => ({
  ...createMockTripData(overrides),
  distance_km: distance,
  score: Math.max(0, 1 - distance / 100) // Simple scoring based on distance
});

// Helper to create paginated results
export const createMockPaginatedResults = (
  totalItems: number,
  page: number,
  pageSize: number
) => {
  const start = (page - 1) * pageSize;
  const end = start + pageSize;
  const items = Array.from({ length: Math.min(pageSize, totalItems - start) }, (_, i) => 
    createMockSearchResult(start + i + 1, {
      trip_id: `trip-${start + i + 1}`,
      title: `Trip ${start + i + 1}`
    })
  );
  
  return {
    data: items,
    pagination: {
      page,
      pageSize,
      totalItems,
      totalPages: Math.ceil(totalItems / pageSize),
      hasNext: end < totalItems,
      hasPrev: page > 1
    }
  };
};
