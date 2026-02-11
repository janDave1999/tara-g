import type { Trip, TripDetails, TripLocation } from '@/types/trip';

export interface TestTripData {
  basic: Trip;
  withLocations: Trip;
  complexFiltering: Trip;
  edgeCases: Trip;
}

// Generate test trips with various scenarios
export const createTestTrips = (): TestTripData => {
  const baseTrip = {
    trip_id: 'test-trip-id',
    owner_id: 'test-user-id',
    title: 'Test Trip',
    description: 'Test description',
    status: 'active' as const,
    user_role: 'owner' as const,
    trip_details: {
      description: 'Test trip details',
      start_date: '2024-06-15',
      end_date: '2024-06-20',
      cover_image: 'https://example.com/image.jpg',
      region: 'Manila, Philippines',
      max_pax: 10,
      gender_pref: 'any',
      cost_sharing: 'split_evenly',
      estimated_budget: 5000,
      join_by: '2024-06-10T23:59:59Z',
      join_by_time: '23:59:59',
      tags: ['adventure', 'beach', 'travel']
    } as TripDetails,
    trip_locations: [] as TripLocation[],
    trip_members: [],
    trip_visibility: {
      visibility: 'public' as const,
      max_participants: 10,
      current_participants: 2,
      is_reusable: false,
      share_slug: 'test-trip-slug'
    },
    trip_pools: [],
    trip_pool_members: [],
    trip_expenses: [],
    trip_images: []
  };

  return {
    basic: { ...baseTrip },
    withLocations: {
      ...baseTrip,
      trip_locations: [
        {
          id: 'loc-1',
          start_time: '2024-06-15T09:00:00Z',
          end_time: '2024-06-15T10:00:00Z',
          waiting_time: 15,
          type: 'pickup',
          notes: 'Pickup location',
          is_primary: true,
          location: {
            location_id: 'loc-1',
            name: 'Manila Airport',
            lat: '14.5085',
            lng: '121.0196'
          },
          activities: [
            {
              id: 'act-1',
              activity_type: 'travel',
              description: 'Airport pickup',
              planned_duration_minutes: 60
            }
          ]
        }
      ]
    },
    complexFiltering: {
      ...baseTrip,
      title: 'Budget Adventure Trip',
      trip_details: {
        ...baseTrip.trip_details,
        estimated_budget: 2000,
        tags: ['budget', 'backpacking', 'adventure'],
        region: 'Palawan, Philippines'
      },
      trip_locations: [
        {
          id: 'loc-2',
          start_time: '2024-06-15T14:00:00Z',
          end_time: '2024-06-15T16:00:00Z',
          waiting_time: 0,
          type: 'activity',
          notes: 'Beach activity',
          is_primary: false,
          location: {
            location_id: 'loc-2',
            name: 'El Nido Beach',
            lat: '11.2094',
            lng: '119.3837'
          },
          activities: []
        }
      ]
    },
    edgeCases: {
      ...baseTrip,
      status: 'draft',
      trip_details: {
        ...baseTrip.trip_details,
        estimated_budget: 0,
        tags: [],
        start_date: '2024-01-01',
        end_date: '2024-12-31'
      },
      trip_visibility: {
        ...baseTrip.trip_visibility,
        visibility: 'private' as const
      }
    }
  };
};

// Generate large dataset for performance testing
export const generateLargeTripDataset = (count: number = 1000) => {
  const trips = [];
  const regions = ['Manila', 'Cebu', 'Davao', 'Palawan', 'Bohol', 'Ilocos', 'Bicol'];
  const tags = ['adventure', 'beach', 'mountain', 'city', 'cultural', 'food', 'budget', 'luxury'];
  const statuses = ['active', 'planning', 'completed', 'cancelled'];

  for (let i = 0; i < count; i++) {
    const lat = 11.0 + Math.random() * 10; // Philippines lat range
    const lng = 120.0 + Math.random() * 10; // Philippines lng range
    
    trips.push({
      trip_id: \`perf-trip-\${i}\`,
      owner_id: \`user-\${i % 100}\`,
      title: \`Performance Test Trip \${i}\`,
      description: \`Description for performance test trip \${i}\`,
      status: statuses[i % statuses.length] as any,
      user_role: 'visitor' as const,
      trip_details: {
        description: \`Details for trip \${i}\`,
        start_date: \`2024-\${String((i % 12) + 1).padStart(2, '0')}-15\`,
        end_date: \`2024-\${String((i % 12) + 1).padStart(2, '0')}-20\`,
        cover_image: \`https://example.com/image\${i}.jpg\`,
        region: \`\${regions[i % regions.length]}, Philippines\`,
        max_pax: 5 + (i % 15),
        gender_pref: ['any', 'male', 'female'][i % 3],
        cost_sharing: ['split_evenly', 'organizer_shoulders_cost', 'pay_own_expenses'][i % 3],
        estimated_budget: 1000 + (i % 10000),
        join_by: '2024-06-10T23:59:59Z',
        join_by_time: '23:59:59',
        tags: [tags[i % tags.length], tags[(i + 1) % tags.length]]
      } as TripDetails,
      trip_locations: [
        {
          id: \`loc-\${i}\`,
          start_time: '2024-06-15T09:00:00Z',
          end_time: '2024-06-15T10:00:00Z',
          waiting_time: 15,
          type: 'pickup',
          notes: 'Location notes',
          is_primary: true,
          location: {
            location_id: \`loc-\${i}\`,
            name: \`Location \${i}\`,
            lat: lat.toString(),
            lng: lng.toString()
          },
          activities: []
        }
      ],
      trip_members: [],
      trip_visibility: {
        visibility: 'public' as const,
        max_participants: 10,
        current_participants: i % 10,
        is_reusable: false,
        share_slug: \`trip-\${i}\`
      },
      trip_pools: [],
      trip_pool_members: [],
      trip_expenses: [],
      trip_images: []
    });
  }

  return trips;
};

// Edge case test data
export const edgeCaseTrips = {
  noBudget: {
    ...createTestTrips().basic,
    trip_id: 'no-budget-trip',
    title: 'No Budget Trip',
    trip_details: {
      ...createTestTrips().basic.trip_details,
      estimated_budget: 0
    }
  },
  highBudget: {
    ...createTestTrips().basic,
    trip_id: 'high-budget-trip',
    title: 'Luxury Trip',
    trip_details: {
      ...createTestTrips().basic.trip_details,
      estimated_budget: 50000
    }
  },
  noTags: {
    ...createTestTrips().basic,
    trip_id: 'no-tags-trip',
    title: 'No Tags Trip',
    trip_details: {
      ...createTestTrips().basic.trip_details,
      tags: []
    }
  },
  manyTags: {
    ...createTestTrips().basic,
    trip_id: 'many-tags-trip',
    title: 'Many Tags Trip',
    trip_details: {
      ...createTestTrips().basic.trip_details,
      tags: ['adventure', 'beach', 'mountain', 'city', 'cultural', 'food', 'budget', 'luxury', 'family', 'solo']
    }
  },
  veryLongDuration: {
    ...createTestTrips().basic,
    trip_id: 'long-duration-trip',
    title: 'Year Long Trip',
    trip_details: {
      ...createTestTrips().basic.trip_details,
      start_date: '2024-01-01',
      end_date: '2024-12-31'
    }
  },
  veryShortDuration: {
    ...createTestTrips().basic,
    trip_id: 'short-duration-trip',
    title: 'Day Trip',
    trip_details: {
      ...createTestTrips().basic.trip_details,
      start_date: '2024-06-15',
      end_date: '2024-06-15'
    }
  }
};
