import { z } from "astro:content";
import { supabaseAdmin, getSupabaseClient } from "@/lib/supabase";
import { type ActionInputSchema, type ActionReturnType, ActionError, defineAction } from "astro:actions";
import { rollBack } from "@/lib/rollback";
import { saveLocation, saveTripLoc } from "@/lib/locations";
import { uploadToR2 } from "@/scripts/R2/upload";
import { defineProtectedAction } from "./utils";
import type { JoinRequest, PendingInvitation, MembersSummary, CompleteMembersData } from "@/types/trip";

// Type definition for optimized search result
interface OptimizedSearchResult {
  trip_id: string;
  title: string;
  description: string;
  distance_km: number | null;
  estimated_budget: number | null;
  tags: string[];
  available_spots: number;
  max_participants: number;
  current_participants: number;
  start_date: string;
  end_date: string;
  region: string | null;
  duration_days: number | null;
  budget_per_person: number | null;
  relevance_score: number;
  primary_location_name: string | null;
  primary_location_address: string | null;
  images: string[];
}


// Initialize Supabase client (adjust based on your setup)

// get user id in astro locals



// =====================================================
// src/types/trip.ts - TypeScript Definitions
// =====================================================

export interface TripFormData {
  // Basic info
  title: string;
  description: string;
  slug: string;
  
  // Dates (dates only for trip, full datetime for others)
  start_date: string; // 'YYYY-MM-DD'
  end_date: string; // 'YYYY-MM-DD'
  joined_by: string; // Full ISO timestamp
  
  // Settings
  max_pax: number;
  gender_preference: 'any' | 'male' | 'female';
  cost_sharing: 'split_evenly' | 'organizer_shoulders_cost' | 'pay_own_expenses' | 'custom_split';
  estimated_budget?: number | null;
  tags: string[];
  
  // Locations
  region_address: string;
  region_coordinates: string; // JSON string
  
  pickup_address: string;
  pickup_coordinates: string; // JSON string
  pickup_dates: string; // Full ISO timestamp
  waiting_time: number;
  
  dropoff_address: string;
  dropoff_coordinates: string; // JSON string
  dropoff_dates: string; // Full ISO timestamp
}

export interface Trip {
  trip_id: string;
  owner_id: string;
  title: string;
  description: string;
  status: 'planning' | 'active' | 'completed' | 'cancelled';
  slug: string;
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

export interface TripDetails {
  trip_details_id: string;
  trip_id: string;
  description: string;
  start_date: string;
  end_date: string;
  join_by: string;
  join_by_time: string;
  max_pax: number;
  gender_pref: string;
  cost_sharing: string;
  estimated_budget?: number;
  region: string;
  tags: string[];
}

export interface TripLocation {
  id: string;
  scheduled_start?: string;
  scheduled_end?: string;
  actual_start?: string;
  actual_end?: string;
  waiting_time?: number;
  stop_type: 'pickup' | 'dropoff' | 'stop' | 'accommodation' | 'activity';
  notes?: string;
  is_primary: boolean;
  is_mandatory: boolean;
  order_index: number;
  location_name: string;
  latitude: number;
  longitude: number;
  location?: {
    location_id: string;
    name: string;
    lat: string;
    lng: string;
  };
  activities?: StopActivity[];
}

export interface StopActivity {
  id: string;
  activity_type: string;
  description: string;
  planned_duration_minutes: number;
  actual_duration_minutes?: number;
  order_index: number;
  notes?: string;
}

export interface TripMember {
  id: string;
  user_id: string;
  full_name: string;
  username: string;
  avatar_url?: string;
  role: 'owner' | 'admin' | 'member';
  member_status: 'pending' | 'joined' | 'left' | 'removed';
  joined_at: string;
  join_method: 'request' | 'invitation' | 'owner';
  initial_contribution?: number;
}

export interface TripFullDetails {
  trip_id: string;
  owner_id: string;
  title: string;
  description: string;
  status: string;
  slug: string;
  is_public: boolean;
  created_at: string;
  updated_at: string;
  user_role: 'owner' | 'member' | 'pending' | 'visitor';
  owner: {
    user_id: string;
    username: string;
    full_name: string;
    avatar_url?: string;
  };
  trip_details: TripDetails;
  trip_locations: TripLocation[];
  trip_members: TripMember[];
  trip_visibility: any;
  trip_social: any;
  tags: Array<{
    tag_id: string;
    tag_name: string;
    usage_count: number;
  }>;
}

// Enhanced validation with security and sanitization
const createTripSchema = z.object({
  // Basic info with enhanced validation
  title: z.string()
    .min(3, 'Title must be at least 3 characters')
    .max(100, 'Title must be less than 100 characters')
    .regex(/^[a-zA-Z0-9\s\-_!,.?]+$/, 'Title contains invalid characters')
    .transform(val => val.trim()),
  
  description: z.string()
    .min(10, 'Description must be at least 10 characters')
    .max(500, 'Description must be less than 500 characters')
    .transform(val => val.trim()),
  
  slug: z.string()
    .min(3, 'Slug must be at least 3 characters')
    .max(100, 'Slug must be less than 100 characters')
    .regex(/^[a-z0-9\-]+$/, 'Slug can only contain lowercase letters, numbers, and hyphens'),
  
  // Enhanced date validation
  start_date: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)')
    .refine(date => {
      const d = new Date(date);
      const now = new Date();
      now.setHours(0,0,0,0);
      return d >= now; // Not before today
    }, 'Trip cannot start in the past'),
  
  end_date: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
  
  joined_by: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/, 'Invalid datetime format')
    .refine(datetime => {
      const d = new Date(datetime);
      return d >= new Date(); // Not in the past
    }, 'Join deadline cannot be in the past'),
  
  // Enhanced settings validation
  max_pax: z.number()
    .int('Must be a whole number')
    .min(2, 'Minimum 2 participants required')
    .max(50, 'Maximum 50 participants allowed'),
  
  gender_preference: z.enum(['any', 'male', 'female'], {
    errorMap: (issue) => ({ message: 'Invalid gender preference' })
  }),
  
  cost_sharing: z.enum([
    'split_evenly', 
    'organizer_shoulders_cost', 
    'pay_own_expenses', 
    'custom_split'
  ], {
    errorMap: (issue) => ({ message: 'Invalid cost sharing method' })
  }),
  
  estimated_budget: z.number()
    .min(0, 'Budget cannot be negative')
    .max(9999999, 'Budget amount too large')
    .nullable()
    .optional(),
  
  tags: z.array(z.string()
    .min(2, 'Tag must be at least 2 characters')
    .max(30, 'Tag must be less than 30 characters')
    .regex(/^[a-zA-Z0-9\s\-_]+$/, 'Tag contains invalid characters')
    .transform(tag => tag.trim().toLowerCase())
  ).max(10, 'Maximum 10 tags allowed'),
  
  // Location data with coordinate validation
  region_address: z.string()
    .min(3, 'Region address is required')
    .max(200, 'Region address too long')
    .transform(val => val.trim()),
  
  region_coordinates: z.string()
    .refine(coords => {
      try {
        const parsed = JSON.parse(coords);
        return Array.isArray(parsed) && parsed.length === 2 && 
               parsed.every(coord => typeof coord === 'number' && 
               coord >= -180 && coord <= 180);
      } catch {
        return false;
      }
    }, 'Invalid region coordinates format'),
  
  pickup_address: z.string()
    .min(3, 'Pickup address is required')
    .max(200, 'Pickup address too long')
    .transform(val => val.trim()),
  
  pickup_coordinates: z.string()
    .refine(coords => {
      try {
        const parsed = JSON.parse(coords);
        return Array.isArray(parsed) && parsed.length === 2 && 
               parsed.every(coord => typeof coord === 'number' && 
               coord >= -180 && coord <= 180);
      } catch {
        return false;
      }
    }, 'Invalid pickup coordinates format'),
  
  pickup_dates: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/, 'Invalid pickup datetime format'),
  
  waiting_time: z.number()
    .int('Waiting time must be a whole number')
    .min(0, 'Waiting time cannot be negative')
    .max(60, 'Waiting time cannot exceed 60 minutes')
    .default(15),
  
  dropoff_address: z.string()
    .min(3, 'Dropoff address is required')
    .max(200, 'Dropoff address too long')
    .transform(val => val.trim()),
  
  dropoff_coordinates: z.string()
    .refine(coords => {
      try {
        const parsed = JSON.parse(coords);
        return Array.isArray(parsed) && parsed.length === 2 && 
               parsed.every(coord => typeof coord === 'number' && 
               coord >= -180 && coord <= 180);
      } catch {
        return false;
      }
    }, 'Invalid dropoff coordinates format'),
  
  dropoff_dates: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/, 'Invalid dropoff datetime format')
}).superRefine((data, ctx) => {
  // Cross-field validation
  const startDate = new Date(data.start_date);
  const endDate = new Date(data.end_date);
  const joinBy = new Date(data.joined_by);
  const pickupDate = new Date(data.pickup_dates);
  const dropoffDate = new Date(data.dropoff_dates);
  
  // End date must not be before start date (same day is allowed)
  if (endDate < startDate) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'End date cannot be before start date',
      path: ['end_date']
    });
    return false;
  }

  // Join deadline must be before trip start
  if (joinBy >= startDate) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Join deadline must be before trip start',
      path: ['joined_by']
    });
    return false;
  }

  // Pickup must be on or before trip start date (date-only comparison to avoid timezone issues)
  const pickupDateOnly = new Date(data.pickup_dates.split('T')[0]);
  if (pickupDateOnly > startDate) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Pickup date must be on or before trip start date',
      path: ['pickup_dates']
    });
    return false;
  }
  
  // Dropoff must be after pickup
  if (dropoffDate <= pickupDate) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Dropoff time must be after pickup time',
      path: ['dropoff_dates']
    });
    return false;
  }
  
  return true;
});

export const trip = {
  searchTags: defineAction({
    input: z.object({
      query: z.string().min(1),
      limit: z.number().min(1).max(20).default(10),
    }),
    handler: async (input, context) => {
      try {
        
        const { data, error } = await supabaseAdmin
          .from('trip_tags')
          .select('tag_id, tag_name, usage_count')
          .ilike('tag_name', `${input.query}%`)
          .order('usage_count', { ascending: false })
          .limit(input.limit);

        if (error) {
          return {
            success: false,
            error: { message: error.message }
          };
        }

        return {
          success: true,
          data
        };

      } catch (err) {
        return {
          success: false,
          error: { 
            message: err instanceof Error ? err.message : 'Failed to search tags' 
          }
        };
      }
    },
  }),

  getPopularTags: defineAction({
    input: z.object({
      limit: z.number().min(1).max(50).default(20),
    }).optional(),
    handler: async (input, context) => {
      try {
        
        const { data, error } = await supabaseAdmin
          .from('trip_tags')
          .select('tag_id, tag_name, usage_count')
          .order('usage_count', { ascending: false })
          .limit(input?.limit || 20);

        if (error) {
          return {
            success: false,
            error: { message: error.message }
          };
        }

        return {
          success: true,
          data
        };

      } catch (err) {
        return {
          success: false,
          error: { 
            message: err instanceof Error ? err.message : 'Failed to fetch popular tags' 
          }
        };
      }
    },
  }),

  getTripDetails: defineAction({
    input: z.object({
      tripId: z.string().uuid(),
    }),
    handler: async (input, context) => {
      try {
        const userId = context.locals.user_id || null;

        const { data, error } = await supabaseAdmin.rpc('get_trip_full_details', {
          p_trip_id: input.tripId,
          p_current_user_id: userId
        });

        if (error) {
          return {
            success: false,
            error: { message: error.message }
          };
        }

        return {
          success: true,
          data
        };

      } catch (err) {
        return {
          success: false,
          error: { 
            message: err instanceof Error ? err.message : 'Failed to fetch trip details' 
          }
        };
      }
    },
  }),

  createTrip: defineAction({
    input: createTripSchema,
    handler: async (input, context) => {
      try {
        // Get current user from request cookies (supabaseAdmin has no session)
        const userId = context.locals.user_id;

        if (!userId) {
          return {
            success: false,
            error: { message: 'Unauthorized. Please log in.' }
          };
        }

        const regionCoords = JSON.parse(input.region_coordinates);
        const pickupCoords = JSON.parse(input.pickup_coordinates);
        const dropoffCoords = JSON.parse(input.dropoff_coordinates);

        const rpcParams = {
          p_title: input.title,
          p_description: input.description,
          p_slug: input.slug,
          p_owner_id: userId,
          p_start_date: input.start_date,
          p_end_date: input.end_date,
          p_join_by: input.joined_by,
          p_max_pax: input.max_pax,
          p_gender_pref: input.gender_preference,
          p_cost_sharing: input.cost_sharing,
          p_region_name: input.region_address,
          p_region_lat: regionCoords[1]?.toString(),
          p_region_lng: regionCoords[0]?.toString(),
          p_pickup_name: input.pickup_address,
          p_pickup_lat: pickupCoords[1]?.toString(),
          p_pickup_lng: pickupCoords[0]?.toString(),
          p_pickup_datetime: input.pickup_dates,
          p_dropoff_name: input.dropoff_address,
          p_dropoff_lat: dropoffCoords[1]?.toString(),
          p_dropoff_lng: dropoffCoords[0]?.toString(),
          p_dropoff_datetime: input.dropoff_dates,
          p_waiting_time: input.waiting_time,
          p_estimated_budget: input.estimated_budget || null,
          p_tags: input.tags,
        };

        const { data, error } = await supabaseAdmin.rpc('create_trip_with_details', rpcParams);

        if (error) {
          return {
            success: false,
            error: { message: error.message || 'Failed to create trip' }
          };
        }

        // Check RPC-level success (function returns success:false on validation failures)
        const result = Array.isArray(data) ? data[0] : data;
        if (!result?.success) {
          return {
            success: false,
            error: { message: result?.message || 'Failed to create trip' }
          };
        }

        return {
          success: true,
          trip_id: result.trip_id as string,
          data: result.data
        };

      } catch (err) {
        console.error('Trip creation error:', err);
        return {
          success: false,
          error: { 
            message: err instanceof Error ? err.message : 'An unexpected error occurred' 
          }
        };
      }
    },
  }),
  
  joinTrip: defineAction({
    input: z.object({
      trip_id: z.string(),
    }),
    
    handler: defineProtectedAction(async (input, {userId}) => {
      const { data, error } = await supabaseAdmin.rpc("join_trip", { p_trip_id: input.trip_id, p_user_id: userId });
      let message = data[0].message
      if (error) {
        throw new ActionError({
          message: error.message,
          code: "INTERNAL_SERVER_ERROR"
        })
      }
      
      if (!data[0].success){
        throw new ActionError({
          message: data[0].message,
          code: "BAD_REQUEST"
        })
      }
      return data
    })
    
  }),
  
  cancelJoinRequest: defineAction({
    input: z.object({
      trip_id: z.string(),
    }),
    
    handler: defineProtectedAction(async (input, {userId}) => {
      const { data, error } = await supabaseAdmin.rpc("cancel_join_request", { p_trip_id: input.trip_id, p_user_id: userId });
      if (error) {
        throw new ActionError({
          message: error.message,
          code: "INTERNAL_SERVER_ERROR"
        })
      }
      
      if(!data[0].success){
        throw new ActionError({
          message: data[0].message,
          code: "BAD_REQUEST"
        })
      }
      return data
    })
  }),
  
  getAllUserTrips: defineAction({
    handler(context) {
      return supabaseAdmin.from("trips").select("*").eq("owner_id", context.locals.user_id || "");
    }
  }),
  
  uploadToR2: defineAction({
    accept: "json",
    
    input: z.object({
      files: z.array(
        z.object({
          file: z.string(), // base64
          name: z.string(),
          type: z.string(),
        })
      ).min(1, "At least one file is required").max(10, "Maximum 10 files allowed"),
      trip_id: z.string().uuid("Invalid trip ID"),
    }),
    
    async handler({ files, trip_id }, { locals }) {
      // Check if R2 binding exists
      if (!locals.runtime?.env?.TRIP_HERO) {
        throw new ActionError({
          message: "R2 bucket not configured",
          code: "INTERNAL_SERVER_ERROR",
        });
      }
      
      const uploadedUrls: string[] = [];
      const uploadedKeys: string[] = [];
      
      try {
        for (const f of files) {
          // Validate file type (optional - adjust allowed types as needed)
          const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
          if (!allowedTypes.includes(f.type)) {
            throw new ActionError({
              message: `Invalid file type: ${f.type}. Allowed types: ${allowedTypes.join(', ')}`,
              code: "BAD_REQUEST",
            });
          }
          
          // Proper base64 file size check (in bytes)
          const base64 = f.file;
          const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
          const sizeInBytes = (base64.length * 3) / 4 - padding;
          
          if (sizeInBytes > 5 * 1024 * 1024) {
            throw new ActionError({
              message: `File "${f.name}" is too large (max 5MB)`,
              code: "BAD_REQUEST",
            });
          }
          
          // Decode base64
          const buffer = Buffer.from(base64, "base64");
          
          // Sanitize filename to prevent path traversal
          const sanitizedName = f.name.replace(/[^a-zA-Z0-9._-]/g, '_');
          
          // Unique filename with timestamp and UUID
          const keyname = `trip/hero/${trip_id}/${Date.now()}-${crypto.randomUUID()}-${sanitizedName}`;
          
          // Upload to R2
          const url = await uploadToR2(
            buffer, 
            f.name, 
            f.type, 
            keyname, 
            locals.runtime.env.TRIP_HERO
          );
          
          if (!url) {
            throw new ActionError({
              message: `Failed to upload "${f.name}"`,
              code: "INTERNAL_SERVER_ERROR",
            });
          }
          
          uploadedUrls.push(url);
          uploadedKeys.push(keyname);
          
          // Save record in DB
          const { error } = await supabaseAdmin
          .from("trip_images")
          .insert({
            trip_id,
            image_url: keyname,
            is_cover: true,
            type: "hero",
          });
          
          if (error) {
            
            // Cleanup: delete uploaded file from R2 since DB insert failed
            try {
              await locals.runtime.env.TRIP_HERO.delete(keyname);
            } catch (deleteErr) {
              console.error(`[R2 CLEANUP ERROR] Failed to delete ${keyname}:`, deleteErr);
             }
            
            throw new ActionError({
              message: `Database error: ${error.message}`,
              code: "INTERNAL_SERVER_ERROR",
            });
          }
        }
        
        return {
          success: true,
          message: `${files.length} image(s) uploaded successfully!`,
          urls: uploadedUrls,
        };
      } catch (error: any) {
        
        // Cleanup: delete any successfully uploaded files if an error occurred
        if (uploadedKeys.length > 0) {
          for (const key of uploadedKeys) {
            try {
              await locals.runtime.env.TRIP_HERO.delete(key);
            } catch (deleteErr) {
              console.error(`[R2 CLEANUP ERROR] Failed to delete ${key}:`, deleteErr);
            }
          }
        }
        
        // Re-throw ActionError as-is, wrap other errors
        if (error instanceof ActionError) {
          throw error;
        }
        
        throw new ActionError({
          message: error?.message || "Upload failed",
          code: "INTERNAL_SERVER_ERROR",
        });
      }
    },
  }),
  
  leaveTrip: defineAction({
    input: z.object({
      trip_id: z.string().uuid(),
    }),

    async handler({ trip_id }, context) {
      const userId = context.locals.user_id;
      if (!userId) {
        throw new ActionError({ message: 'Unauthorized', code: 'UNAUTHORIZED' });
      }
      const { data, error } = await supabaseAdmin.rpc("leave_trip", { p_trip_id: trip_id, p_user_id: userId });
      if (error) {
        throw new ActionError({
          message: error.message,
          code: "INTERNAL_SERVER_ERROR",
        });
      }
      return data;
    },
  }),
  
getNearbyTrips: defineAction({
    input: z.object({
      latitude: z.number().min(-90).max(90),
      longitude: z.number().min(-180).max(180),
      radiusKm: z.number().min(0.1).max(1000).default(50),
      tags: z.array(z.string()).optional(),
      minBudget: z.number().min(0).optional(),
      maxBudget: z.number().min(0).optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      locationType: z.enum(['destination', 'pickup', 'all']).default('destination'),
      limit: z.number().min(1).max(100).default(50),
      offset: z.number().min(0).default(0),
    }),
    
    async handler(input) {
      try {
        // Validate coordinates
        if (!input.latitude || !input.longitude) {
          throw new ActionError({
            message: "Latitude and longitude are required",
            code: "BAD_REQUEST",
          });
        }

        // Convert date strings if provided
        const startDate = input.startDate ? new Date(input.startDate).toISOString().split('T')[0] : null;
        const endDate = input.endDate ? new Date(input.endDate).toISOString().split('T')[0] : null;

        // Call the optimized search function
        const { data, error } = await supabaseAdmin.rpc('search_trips_optimized', {
          p_latitude: input.latitude,
          p_longitude: input.longitude,
          p_radius_km: input.radiusKm,
          p_tags: input.tags && input.tags.length > 0 ? input.tags : null,
          p_min_budget: input.minBudget || null,
          p_max_budget: input.maxBudget || null,
          p_start_date: startDate,
          p_end_date: endDate,
          p_location_type: input.locationType,
          p_limit: input.limit,
          p_offset: input.offset,
        });

        if (error) {
          console.error('Search trips error:', error);
          throw new ActionError({
            message: `Search failed: ${error.message}`,
            code: "INTERNAL_SERVER_ERROR",
          });
        }

        // Transform results to match expected format
        const transformedTrips = (data || []).map((trip: OptimizedSearchResult) => ({
          trip_id: trip.trip_id,
          title: trip.title,
          description: trip.description,
          distance_km: trip.distance_km,
          estimated_budget: trip.estimated_budget,
          tags: Array.isArray(trip.tags) ? trip.tags : [],
          available_spots: trip.available_spots,
          max_participants: trip.max_participants,
          current_participants: trip.current_participants,
          start_date: trip.start_date,
          end_date: trip.end_date,
          region: trip.region,
          duration_days: trip.duration_days,
          budget_per_person: trip.budget_per_person,
          relevance_score: trip.relevance_score,
          primary_location_name: trip.primary_location_name,
          primary_location_address: trip.primary_location_address,
          images: Array.isArray(trip.images) ? trip.images : [],
        }));

        return {
          success: true,
          trips: transformedTrips,
          total: transformedTrips.length,
          pagination: {
            limit: input.limit,
            offset: input.offset,
            hasMore: transformedTrips.length === input.limit,
          },
        };

      } catch (err) {
        console.error('Trip search error:', err);
        
        if (err instanceof ActionError) {
          throw err;
        }
        
        throw new ActionError({
          message: err instanceof Error ? err.message : 'Unknown error occurred during search',
          code: "INTERNAL_SERVER_ERROR",
        });
      }
    },
  }),
  
  sendTripInvitations : defineAction({
    input: z.object({
      tripId: z.string().uuid(),
      invitees: z.array(z.object({
        userId: z.string().uuid().optional(),
        email: z.string().email().optional(),
        name: z.string().optional(),
      })).min(1, "At least one invitee is required"),
      message: z.string().max(500).optional(),
    }),
    handler: async (input, context) => {
      const supabase = getSupabaseClient(context.cookies);
      
      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error('You must be logged in to send invitations');
      }
      
      // Transform invitees to ensure proper format for RPC
      const formattedInvitees = input.invitees.map(invitee => ({
        user_id: invitee.userId || null,
        email: invitee.email || null,
        name: invitee.name || null,
      }));
      
      // Call RPC function
      const { data, error } = await supabase.rpc('send_trip_invitations', {
        p_trip_id: input.tripId,
        p_inviter_id: user.id,
        p_invitees: formattedInvitees,
        p_message: input.message || null,
      });
      
      if (error) {
        throw new Error(error.message || 'Failed to send invitations');
      }
      
      return {
        success: true,
        invitations: data.invitations,
        message: `Successfully sent ${data.invitations.length} invitation(s)`,
      };
    },
  }),
  
  getTripSuggestions : defineAction({
    input: z.object({
      tripId: z.string().uuid().optional(),
      limit: z.number().min(1).max(50).default(10),
    }),
    handler: async (input, context) => {
      const supabase = getSupabaseClient(context.cookies);
      
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error('You must be logged in');
      }
      
      const { data, error } = await supabase.rpc('get_trip_invitation_suggestions', {
        p_user_id: user.id,
        p_trip_id: input.tripId || null,
        p_limit: input.limit,
      });
      
      if (error) {
        throw new Error(error.message || 'Failed to get suggestions');
      }
      
      return {
        success: true,
        suggestions: data || [],
      };
    },
  }),
  
  searchUsersForInvitation : defineAction({
    input: z.object({
      query: z.string().min(1, "Search query is required"),
      tripId: z.string().uuid().optional(),
      limit: z.number().min(1).max(50).default(10),
    }),
    handler: async (input, context) => {
      const supabase = getSupabaseClient(context.cookies);
      
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error('You must be logged in');
      }
      
      const { data, error } = await supabase.rpc('search_users_for_invitation', {
        p_search_query: input.query,
        p_current_user_id: user.id,
        p_trip_id: input.tripId || null,
        p_limit: input.limit,
      });
      console.log(data);
      console.log(error);
      if (error) {
        throw new Error(error.message || 'Failed to search users');
      }
      
      return {
        success: true,
        users: data || [],
      };
    },
  }),
  
  acceptTripInvitation : defineAction({
    input: z.object({
      invitationId: z.string().uuid(),
    }),
    handler: async (input, context) => {
      const supabase = getSupabaseClient(context.cookies);
      
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error('You must be logged in to accept invitations');
      }
      
      const { data, error } = await supabase.rpc('accept_trip_invitation', {
        p_invitation_id: input.invitationId,
        p_user_id: user.id,
      });
      
      if (error || !data?.success) {
        throw new Error(data?.message || error?.message || 'Failed to accept invitation');
      }
      
      return {
        success: true,
        tripId: data.trip_id,
        memberId: data.member_id,
        message: data.message || 'Successfully joined the trip!',
      };
    },
  }),
  
  declineTripInvitation : defineAction({
    input: z.object({
      invitationId: z.string().uuid(),
    }),
    handler: async (input, context) => {
      const supabase = getSupabaseClient(context.cookies);
      
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error('You must be logged in');
      }
      
      const { data, error } = await supabase.rpc('decline_trip_invitation', {
        p_invitation_id: input.invitationId,
        p_user_id: user.id,
      });
      
      if (error || !data?.success) {
        throw new Error(data?.message || error?.message || 'Failed to decline invitation');
      }
      
      return {
        success: true,
        message: 'Invitation declined',
      };
    },
  }),
  
  cancelTripInvitation : defineAction({
    input: z.object({
      invitationId: z.string().uuid(),
    }),
    handler: async (input, context) => {
      const supabase = getSupabaseClient(context.cookies);
      
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error('You must be logged in');
      }
      
      const { data, error } = await supabase.rpc('cancel_trip_invitation', {
        p_invitation_id: input.invitationId,
        p_user_id: user.id,
      });
      
      if (error || !data?.success) {
        throw new Error(data?.message || error?.message || 'Failed to cancel invitation');
      }
      
      return {
        success: true,
        message: 'Invitation cancelled',
      };
    },
  }),
  
  getUserPendingInvitations : defineAction({
    input: z.object({}),
    handler: async (input, context) => {
      const supabase = getSupabaseClient(context.cookies);
      
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error('You must be logged in');
      }
      
      const { data, error } = await supabase.rpc('get_user_pending_invitations', {
        p_user_id: user.id,
      });
      
      if (error) {
        throw new Error(error.message || 'Failed to get pending invitations');
      }
      
      return {
        success: true,
        invitations: data || [],
      };
    },
  }),
  
  getTripInvitations : defineAction({
    input: z.object({
      tripId: z.string().uuid(),
    }),
    handler: async (input, context) => {
      const supabase = getSupabaseClient(context.cookies);
      
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error('You must be logged in');
      }
      
      const { data, error } = await supabase.rpc('get_trip_invitations', {
        p_trip_id: input.tripId,
        p_user_id: user.id,
      });
      
      if (error) {
        throw new Error(error.message || 'Failed to get trip invitations');
      }
      
      return {
        success: true,
        invitations: data || [],
      };
    },
  }),
  
  resendTripInvitation : defineAction({
    input: z.object({
      tripId: z.string().uuid(),
      inviteeId: z.string().uuid(),
      message: z.string().max(500).optional(),
    }),
    handler: async (input, context) => {
      const supabase = getSupabaseClient(context.cookies);
      
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error('You must be logged in');
      }
      
      // Use send_trip_invitations with single user (will update existing)
      const { data, error } = await supabase.rpc('send_trip_invitations', {
        p_trip_id: input.tripId,
        p_inviter_id: user.id,
        p_invitees: [{
          user_id: input.inviteeId,
        }],
        p_message: input.message || null,
      });
      
      if (error) {
        throw new Error(error.message || 'Failed to resend invitation');
      }
      
      return {
        success: true,
        message: 'Invitation resent successfully',
      };
    },
  }),
  
  getTripMembers : defineAction({
    input: z.object({
      tripId: z.string().uuid(),
    }),
    handler: async (input, context) => {
      const supabase = getSupabaseClient(context.cookies);
      
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error('You must be logged in');
      }
      
      const { data, error } = await supabase.rpc('get_trip_members', {
        p_trip_id: input.tripId,
        p_user_id: user.id,
      });
      
      if (error) {
        throw new Error(error.message || 'Failed to get trip members');
      }
      
      return {
        success: true,
        members: data as TripMember[],
      };
    },
  }),
  
  getTripJoinRequests : defineAction({
    input: z.object({
      tripId: z.string().uuid(),
    }),
    handler: async (input, context) => {
      const supabase = getSupabaseClient(context.cookies);
      
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error('You must be logged in');
      }
      
      const { data, error } = await supabase.rpc('get_trip_join_requests', {
        p_trip_id: input.tripId,
        p_user_id: user.id,
      });
      
      if (error) {
        throw new Error(error.message || 'Failed to get join requests');
      }
      
      return {
        success: true,
        requests: data as JoinRequest[],
      };
    },
  }),
  
  getTripPendingInvitations : defineAction({
    input: z.object({
      tripId: z.string().uuid(),
    }),
    handler: async (input, context) => {
      const supabase = getSupabaseClient(context.cookies);
      
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error('You must be logged in');
      }
      
      const { data, error } = await supabase.rpc('get_trip_pending_invitations', {
        p_trip_id: input.tripId,
        p_user_id: user.id,
      });
      
      if (error) {
        throw new Error(error.message || 'Failed to get pending invitations');
      }
      
      return {
        success: true,
        invitations: data as PendingInvitation[],
      };
    },
  }),
  
  getTripMembersSummary : defineAction({
    input: z.object({
      tripId: z.string().uuid(),
    }),
    handler: async (input, context) => {
      const supabase = getSupabaseClient(context.cookies);
      
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error('You must be logged in');
      }
      
      const { data, error } = await supabase.rpc('get_trip_members_summary', {
        p_trip_id: input.tripId,
        p_user_id: user.id,
      });
      
      if (error) {
        throw new Error(error.message || 'Failed to get members summary');
      }
      
      return {
        success: true,
        summary: data?.[0] as MembersSummary,
      };
    },
  }),
  
  getTripMembersComplete : defineAction({
    input: z.object({
      tripId: z.string().uuid(),
    }),
    handler: async (input, context) => {
      const supabase = getSupabaseClient(context.cookies);

      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error('You must be logged in');
      }

      const { data, error } = await supabase.rpc('get_trip_members_complete', {
        p_trip_id: input.tripId,
        p_user_id: user.id,
      });

      if (error) {
        throw new Error(error.message || 'Failed to get trip data');
      }
      
      return {
        success: true,
        data: data as CompleteMembersData,
      };
    },
  }),
  
  approveJoinRequest : defineAction({
    input: z.object({
      memberId: z.string().uuid(),
      tripId: z.string().uuid(),
    }),
    handler: async (input, context) => {
      const supabase = getSupabaseClient(context.cookies);
      
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error('You must be logged in');
      }

      const { data, error } = await supabase.rpc('approve_join_request', {
        p_member_id: input.memberId,
        p_trip_id: input.tripId,
        p_approver_id: user.id,
      });
      
      if (error || !data?.success) {
        throw new Error(data?.message || error?.message || 'Failed to approve request');
      }
      
      return {
        success: true,
        message: data.message,
        userId: data.user_id,
      };
    },
  }),
  
  rejectJoinRequest : defineAction({
    input: z.object({
      memberId: z.string().uuid(),
      tripId: z.string().uuid(),
    }),
    handler: async (input, context) => {
      const supabase = getSupabaseClient(context.cookies);
      
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error('You must be logged in');
      }
      
      const { data, error } = await supabase.rpc('reject_join_request', {
        p_member_id: input.memberId,
        p_trip_id: input.tripId,
        p_rejector_id: user.id,
      });
      
      if (error || !data?.success) {
        throw new Error(data?.message || error?.message || 'Failed to reject request');
      }
      
      return {
        success: true,
        message: data.message,
      };
    },
  }),
  
  removeTripMember : defineAction({
    input: z.object({
      memberId: z.string().uuid(),
      tripId: z.string().uuid(),
    }),
    handler: async (input, context) => {
      const supabase = getSupabaseClient(context.cookies);
      
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error('You must be logged in');
      }
      
      const { data, error } = await supabase.rpc('remove_trip_member', {
        p_member_id: input.memberId,
        p_trip_id: input.tripId,
        p_remover_id: user.id,
      });
      
      if (error || !data?.success) {
        throw new Error(data?.message || error?.message || 'Failed to remove member');
      }
      
      return {
        success: true,
        message: data.message,
      };
    },
  }),

    getUserOwnedTrips: defineAction({
    input: z.object({
      userId: z.string().uuid(),
      search: z.string().optional(),
      status: z.string().optional(),
      limit: z.number().default(12),
      offset: z.number().default(0),
    }),
    handler: async ({ userId, search, status, limit, offset }) => {
      const { data, error } = await supabaseAdmin.rpc('get_user_owned_trips', {
        p_user_id: userId,
        p_search: search || null,
        p_status: status || null,
        p_limit: limit,
        p_offset: offset,
      });

      if (error) throw error;

      return {
        trips: data || [],
        totalCount: data?.[0]?.total_count || 0,
      };
    },
  }),

  // Get trips user is a member of
  getUserMemberTrips: defineAction({
    input: z.object({
      userId: z.string().uuid(),
      search: z.string().optional(),
      memberStatus: z.string().optional(),
      limit: z.number().default(12),
      offset: z.number().default(0),
    }),
    handler: async ({ userId, search, memberStatus, limit, offset }) => {
      const { data, error } = await supabaseAdmin.rpc('get_user_member_trips', {
        p_user_id: userId,
        p_search: search || null,
        p_member_status: memberStatus || null,
        p_limit: limit,
        p_offset: offset,
      });

      if (error) throw error;

      return {
        trips: data || [],
        totalCount: data?.[0]?.total_count || 0,
      };
    },
  }),

  // Get recent/discover trips
  getRecentTrips: defineAction({
    input: z.object({
      userId: z.string().uuid(),
      search: z.string().optional(),
      tags: z.array(z.string()).optional(),
      region: z.string().optional(),
      limit: z.number().default(12),
      offset: z.number().default(0),
    }),
    handler: async ({ userId, search, tags, region, limit, offset }) => {
      const { data, error } = await supabaseAdmin.rpc('get_recent_trips', {
        p_user_id: userId,
        p_search: search || null,
        p_tags: tags || null,
        p_region: region || null,
        p_limit: limit,
        p_offset: offset,
      });

      if (error) throw error;

      return {
        trips: data || [],
        totalCount: data?.[0]?.total_count || 0,
      };
    },
  }),

  // Get suggested trips
  getSuggestedTrips: defineAction({
    input: z.object({
      userId: z.string().uuid(),
      limit: z.number().default(6),
    }),
    handler: async ({ userId, limit }) => {
      const { data, error } = await supabaseAdmin.rpc('get_suggested_trips', {
        p_user_id: userId,
        p_limit: limit,
      });

      if (error) throw error;

      return {
        trips: data || [],
      };
    },
  }),

  updateTripVisibility: defineAction({
    accept: 'json',
    input: z.object({
      trip_id: z.string().uuid(),
      visibility: z.enum(['private', 'public', 'friends']),
    }),
    handler: async ({ trip_id, visibility }, context) => {
      const user = context.locals.user_id;
      if (!user) {
        throw new ActionError({ message: 'Unauthorized', code: 'UNAUTHORIZED' });
      }

      const { data: ownerCheck } = await supabaseAdmin
        .from('trips')
        .select('owner_id')
        .eq('trip_id', trip_id)
        .single();

      if (!ownerCheck || ownerCheck.owner_id !== user) {
        throw new ActionError({ message: 'Only the trip owner can change visibility', code: 'FORBIDDEN' });
      }

      const { error } = await supabaseAdmin
        .from('trip_visibility')
        .update({ visibility })
        .eq('trip_id', trip_id);

      if (error) {
        throw new ActionError({ message: error.message, code: 'INTERNAL_SERVER_ERROR' });
      }

      return { success: true, visibility };
    },
  }),

  updateTripStatus: defineAction({
    accept: 'json',
    input: z.object({
      trip_id: z.string().uuid(),
      status: z.enum(['draft', 'active', 'completed', 'archived', 'cancelled'])
    }),
    handler: async ({ trip_id, status }, context) => {
      const user = context.locals.user_id;

      if (!user) {
        throw new Error('Unauthorized');
      }

      // Call RPC function to update status
      const { data, error } = await supabaseAdmin.rpc('update_trip_status', {
        p_trip_id: trip_id,
        p_user_id: user,
        p_new_status: status
      });

      if (error) {
        throw new Error(error.message);
      }

      return { success: true, data };
    }
  }),

  updateTripDestination: defineAction({
    accept: 'json',
    input: z.object({
      trip_id: z.string().uuid(),
      region_address: z.string(),
      region_coordinates: z.string()
    }),
    handler: async ({ trip_id, region_address, region_coordinates }, context) => {
      const user = context.locals.user_id;

      if (!user) {
        throw new Error('Unauthorized');
      }

      const { data, error } = await supabaseAdmin.rpc('update_trip_destination', {
        p_trip_id: trip_id,
        p_user_id: user,
        p_region_address: region_address,
        p_coordinates: region_coordinates
      });

      if (error) {
        throw new Error(error.message);
      }

      return { success: true, data };
    }
  }),

  updateTripDates: defineAction({
    accept: 'json',
    input: z.object({
      trip_id: z.string().uuid(),
      start_date: z.string(),
      end_date: z.string(),
      joined_by: z.string()
    }),
    handler: async ({ trip_id, start_date, end_date, joined_by }, context) => {
      const user = context.locals.user_id;

      if (!user) {
        throw new Error('Unauthorized');
      }

      const { data, error } = await supabaseAdmin.rpc('update_trip_dates', {
        p_trip_id: trip_id,
        p_user_id: user,
        p_start_date: start_date,
        p_end_date: end_date,
        p_joined_by: joined_by
      });

      if (error) {
        throw new Error(error.message);
      }

      return { success: true, data };
    }
  }),

  updateTripPreferences: defineAction({
    accept: 'json',
    input: z.object({
      trip_id: z.string().uuid(),
      gender_pref: z.string(),
      max_pax: z.number().int().min(2).max(50)
    }),
    handler: async ({ trip_id, gender_pref, max_pax }, context) => {
      const user = context.locals.user_id;

      if (!user) {
        throw new Error('Unauthorized');
      }

      const { data, error } = await supabaseAdmin.rpc('update_trip_preferences', {
        p_trip_id: trip_id,
        p_user_id: user,
        p_gender_pref: gender_pref,
        p_max_pax: max_pax
      });

      if (error) {
        throw new Error(error.message);
      }

      return { success: true, data };
    }
  }),

  updateTripBudget: defineAction({
    accept: 'json',
    input: z.object({
      trip_id: z.string().uuid(),
      cost_sharing: z.string(),
      estimated_budget: z.number().nullable()
    }),
    handler: async ({ trip_id, cost_sharing, estimated_budget }, context) => {
      const user = context.locals.user_id;

      if (!user) {
        throw new Error('Unauthorized');
      }

      const { data, error } = await supabaseAdmin.rpc('update_trip_budget', {
        p_trip_id: trip_id,
        p_user_id: user,
        p_cost_sharing: cost_sharing,
        p_estimated_budget: estimated_budget
      });

      if (error) {
        throw new Error(error.message);
      }

      return { success: true, data };
    }
  }),

  updateTripDescription: defineAction({
    accept: 'json',
    input: z.object({
      trip_id: z.string().uuid(),
      title: z.string().max(100),
      description: z.string().max(500),
      tags: z.array(z.string())
    }),
    handler: async ({ trip_id, title, description, tags }, context) => {
      const user = context.locals.user_id;

      if (!user) {
        throw new Error('Unauthorized');
      }

      const { data, error } = await supabaseAdmin.rpc('update_trip_description', {
        p_trip_id: trip_id,
        p_user_id: user,
        p_title: title,
        p_description: description,
        p_tags: tags
      });

      if (error) {
        throw new Error(error.message);
      }

      return { success: true, data };
    }
  }),

  createStop: defineAction({
    input: z.object({
      trip_id: z.string().uuid(),
      name: z.string().optional(),
      location_name: z.string().optional(),
      latitude: z.number().optional(),
      longitude: z.number().optional(),
      scheduled_start: z.string(),
      scheduled_end: z.string(),
      waiting_time: z.number().optional(),
      stop_type: z.string().optional(),
      notes: z.string().optional(),
      is_primary: z.boolean().optional(),
      is_mandatory: z.boolean().optional(),
      order_index: z.number().optional(),
      activities: z.array(z.object({
        activity_type: z.string(),
        description: z.string(),
        planned_duration_minutes: z.number(),
        order_index: z.number().optional(),
        notes: z.string().optional(),
      })).optional(),
    }),
    handler: async (input, context) => {
      const accessToken = context.cookies.get('sb-access-token')?.value;
      const supabase = getSupabaseClient(accessToken);

      // Insert the trip_location
      const { data: stop, error: stopError } = await supabase
        .from('trip_location')
        .insert({
          trip_id: input.trip_id,
          name: input.name,
          location_name: input.location_name,
          latitude: input.latitude,
          longitude: input.longitude,
          scheduled_start: input.scheduled_start,
          scheduled_end: input.scheduled_end,
          waiting_time: input.waiting_time,
          stop_type: input.stop_type || 'activity',
          notes: input.notes,
          is_primary: input.is_primary || false,
          is_mandatory: input.is_mandatory !== undefined ? input.is_mandatory : true,
          order_index: input.order_index || 0,
        })
        .select()
        .single();

      if (stopError) throw new Error(`Failed to create stop: ${stopError.message}`);

      // If activities provided, create them
      if (input.activities && input.activities.length > 0 && stop) {
        const activitiesData = input.activities.map(a => ({
          stop_id: stop.id,
          activity_type: a.activity_type,
          description: a.description,
          planned_duration_minutes: a.planned_duration_minutes,
          order_index: a.order_index || 0,
          notes: a.notes,
        }));

        const { error: activitiesError } = await supabase
          .from('stop_activities')
          .insert(activitiesData);

        if (activitiesError) {
          console.error('Failed to create activities:', activitiesError);
        }
      }

      return { stop };
    },
  }),

  // Update an existing trip location
  updateStop: defineAction({
    input: z.object({
      stop_id: z.string().uuid(),
      name: z.string().optional(),
      location_name: z.string().optional(),
      latitude: z.number().optional(),
      longitude: z.number().optional(),
      scheduled_start: z.string().optional(),
      scheduled_end: z.string().optional(),
      actual_start: z.string().optional(),
      actual_end: z.string().optional(),
      waiting_time: z.number().optional(),
      stop_type: z.string().optional(),
      notes: z.string().optional(),
      is_primary: z.boolean().optional(),
      is_mandatory: z.boolean().optional(),
      order_index: z.number().optional(),
    }),
    handler: async (input, context) => {
      const accessToken = context.cookies.get('sb-access-token')?.value;
      const supabase = getSupabaseClient(accessToken);

      const { stop_id, ...updateData } = input;
      
      // Remove undefined values
      const cleanData = Object.fromEntries(
        Object.entries(updateData).filter(([_, v]) => v !== undefined)
      );

      const { data, error } = await supabase
        .from('trip_location')
        .update(cleanData)
        .eq('id', stop_id)
        .select()
        .single();

      if (error) throw new Error(`Failed to update stop: ${error.message}`);
      return { stop: data };
    },
  }),

  // Delete a trip location
  deleteStop: defineAction({
    input: z.object({
      stopId: z.string().uuid(),
    }),
    handler: async ({ stopId }, context) => {
      const accessToken = context.cookies.get('sb-access-token')?.value;
      const supabase = getSupabaseClient(accessToken);

      // Activities will cascade delete due to FK constraint
      const { error } = await supabase
        .from('trip_location')
        .delete()
        .eq('id', stopId);

      if (error) throw new Error(`Failed to delete stop: ${error.message}`);
      return { success: true };
    },
  }),

  // Create a new activity for a stop
  createActivity: defineAction({
    input: z.object({
      stop_id: z.string().uuid(),
      activity_type: z.string(),
      description: z.string(),
      planned_duration_minutes: z.number(),
      actual_duration_minutes: z.number().optional(),
      order_index: z.number().optional(),
      notes: z.string().optional(),
    }),
    handler: async (input, context) => {
      const accessToken = context.cookies.get('sb-access-token')?.value;
      const supabase = getSupabaseClient(accessToken);

      const { data, error } = await supabase
        .from('stop_activities')
        .insert({
          stop_id: input.stop_id,
          activity_type: input.activity_type,
          description: input.description,
          planned_duration_minutes: input.planned_duration_minutes,
          actual_duration_minutes: input.actual_duration_minutes,
          order_index: input.order_index || 0,
          notes: input.notes,
        })
        .select()
        .single();

      if (error) throw new Error(`Failed to create activity: ${error.message}`);
      return { activity: data };
    },
  }),

  // Update an existing activity
  updateActivity: defineAction({
    input: z.object({
      activity_id: z.string().uuid(),
      activity_type: z.string().optional(),
      description: z.string().optional(),
      planned_duration_minutes: z.number().optional(),
      actual_duration_minutes: z.number().optional(),
      order_index: z.number().optional(),
      notes: z.string().optional(),
    }),
    handler: async (input, context) => {
      const accessToken = context.cookies.get('sb-access-token')?.value;
      const supabase = getSupabaseClient(accessToken);

      const { activity_id, ...updateData } = input;
      
      // Remove undefined values
      const cleanData = Object.fromEntries(
        Object.entries(updateData).filter(([_, v]) => v !== undefined)
      );

      const { data, error } = await supabase
        .from('stop_activities')
        .update(cleanData)
        .eq('id', activity_id)
        .select()
        .single();

      if (error) throw new Error(`Failed to update activity: ${error.message}`);
      return { activity: data };
    },
  }),

  // Delete an activity
  deleteActivity: defineAction({
    input: z.object({
      activityId: z.string().uuid(),
    }),
    handler: async ({ activityId }, context) => {
      const accessToken = context.cookies.get('sb-access-token')?.value;
      const supabase = getSupabaseClient(accessToken);

      const { error } = await supabase
        .from('stop_activities')
        .delete()
        .eq('id', activityId);

      if (error) throw new Error(`Failed to delete activity: ${error.message}`);
      return { success: true };
    },
  }),

  // Get trip itinerary with all stops and activities
  getItinerary: defineAction({
    input: z.object({
      trip_id: z.string().uuid(),
    }),
    handler: async ({ trip_id }, context) => {
      const accessToken = context.cookies.get('sb-access-token')?.value;
      const supabase = getSupabaseClient(accessToken);

      // Fetch trip locations with activities
      const { data: locations, error: locationsError } = await supabase
        .from('trip_location')
        .select(`
          *,
          location:locations(*),
          activities:stop_activities(*)
        `)
        .eq('trip_id', trip_id)
        .order('order_index', { ascending: true })
        .order('scheduled_start', { ascending: true });

      if (locationsError) throw new Error(`Failed to get itinerary: ${locationsError.message}`);

      // Sort activities within each stop
      const sorted = locations?.map(loc => ({
        ...loc,
        activities: loc.activities?.sort((a: any, b: any) => a.order_index - b.order_index) || []
      }));

      return { locations: sorted || [] };
    },
  }),

  // Reorder stops
  reorderStops: defineAction({
    input: z.object({
      updates: z.array(z.object({
        stop_id: z.string().uuid(),
        order_index: z.number(),
      })),
    }),
    handler: async ({ updates }, context) => {
      const accessToken = context.cookies.get('sb-access-token')?.value;
      const supabase = getSupabaseClient(accessToken);

      // Update each stop's order_index
      const promises = updates.map(({ stop_id, order_index }) =>
        supabase
          .from('trip_location')
          .update({ order_index })
          .eq('id', stop_id)
      );

      const results = await Promise.all(promises);
      const errors = results.filter(r => r.error);

      if (errors.length > 0) {
        throw new Error('Failed to reorder some stops');
      }

      return { success: true };
    },
  }),
}


type tripDetailsSchema = ActionInputSchema<typeof trip.getTripDetails>;

// export type TripDetails = z.output<tripDetailsSchema>;
export type TripDetailsRES = ActionReturnType<typeof trip.getTripDetails>;