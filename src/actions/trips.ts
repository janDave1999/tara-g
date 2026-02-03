import { z } from "astro:content";
import { supabaseAdmin, getSupabaseClient } from "@/lib/supabase";
import { type ActionInputSchema, type ActionReturnType, ActionError, defineAction } from "astro:actions";
import { rollBack } from "@/lib/rollback";
import { saveLocation, saveTripLoc } from "@/lib/locations";
import { uploadToR2 } from "@/scripts/R2/upload";
import { defineProtectedAction } from "./utils";
import type { JoinRequest, PendingInvitation, MembersSummary, CompleteMembersData } from "@/types/trip";


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

const createTripSchema = z.object({
  // Basic info
  title: z.string().min(3, 'Title must be at least 3 characters').max(100),
  description: z.string().min(10, 'Description must be at least 10 characters').max(500),
  slug: z.string().min(3),
  
  // Dates (dates only for trip duration)
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),
  joined_by: z.string(), // Full ISO timestamp
  
  // Settings
  max_pax: z.number().min(2).max(50),
  gender_preference: z.enum(['any', 'male', 'female']),
  cost_sharing: z.enum(['split_evenly', 'organizer_shoulders_cost', 'pay_own_expenses', 'custom_split']),
  estimated_budget: z.number().nullable().optional(),
  tags: z.array(z.string().min(2).max(30)).max(10),
  
  // Location data
  region_address: z.string(),
  region_coordinates: z.string(),
  
  pickup_address: z.string(),
  pickup_coordinates: z.string(),
  pickup_dates: z.string(), // Full ISO timestamp
  waiting_time: z.number().min(0).max(60).default(15),
  
  dropoff_address: z.string(),
  dropoff_coordinates: z.string(),
  dropoff_dates: z.string(), // Full ISO timestamp
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
        // Get current user (optional)
        const { data: { user } } = await supabaseAdmin.auth.getUser();
        
        const { data, error } = await supabaseAdmin.rpc('get_trip_full_details', {
          p_trip_id: input.tripId,
          p_current_user_id: user?.id || null
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
        console.log('Creating trip...', input);
        // Get current user
        const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser();
        
        if (authError || !user) {
          return {
            success: false,
            error: { message: 'Unauthorized. Please log in.' }
          };
        }
        const regionCoords = JSON.parse(input.region_coordinates);
        const pickupCoords = JSON.parse(input.pickup_coordinates);
        const dropoffCoords = JSON.parse(input.dropoff_coordinates);
        // Call RPC function
       // Call RPC function
// Call RPC function
        const { data, error } = await supabaseAdmin.rpc('create_trip_with_details', {
          // Basic info (in order)
          p_title: input.title,
          p_description: input.description,
          p_slug: input.slug,
          p_owner_id: user.id,
          
          // Trip dates
          p_start_date: input.start_date,
          p_end_date: input.end_date,
          p_join_by: input.joined_by,
          
          // Trip settings
          p_max_pax: input.max_pax,
          p_gender_pref: input.gender_preference,
          p_cost_sharing: input.cost_sharing,
          
          // Region/destination
          p_region_name: input.region_address,
          p_region_lat: (regionCoords[0] || regionCoords[1])?.toString(),
          p_region_lng: (regionCoords[0] || regionCoords[1])?.toString(),
          
          // Pickup
          p_pickup_name: input.pickup_address,
          p_pickup_lat: (pickupCoords[0] || pickupCoords[1])?.toString(),
          p_pickup_lng: (pickupCoords[0] || pickupCoords[1])?.toString(),
          p_pickup_datetime: input.pickup_dates,
          
          // Dropoff
          p_dropoff_name: input.dropoff_address,
          p_dropoff_lat: (dropoffCoords[0] || dropoffCoords[1])?.toString(),
          p_dropoff_lng: (dropoffCoords[0] || dropoffCoords[1])?.toString(),
          p_dropoff_datetime: input.dropoff_dates,
          
          // Parameters with defaults (MUST BE LAST)
          p_waiting_time: input.waiting_time,
          p_estimated_budget: input.estimated_budget || null,
          p_tags: input.tags,
        });

        if (error) {
          console.error('Supabase RPC error:', error);
          return {
            success: false,
            error: { message: error.message || 'Failed to create trip' }
          };
        }

        return {
          success: true,
          data: data
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
      console.log(message);
      if (error) {
        console.log(error);
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
      console.log("locals:", locals.runtime);
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
            key_name: keyname,
            type: "hero",
          });
          
          if (error) {
            console.error("[DB ERROR]", error);
            
            // Cleanup: delete uploaded file from R2 since DB insert failed
            try {
              await locals.runtime.env.TRIP_HERO.delete(keyname);
            } catch (deleteErr) {
              console.error("[R2 DELETE ERROR]", deleteErr);
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
        console.error("[UPLOAD ERROR]", error);
        
        // Cleanup: delete any successfully uploaded files if an error occurred
        if (uploadedKeys.length > 0) {
          console.log(`Cleaning up ${uploadedKeys.length} uploaded file(s)...`);
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
    
    async handler({ trip_id }) {
      const { data, error } = await supabaseAdmin.rpc("leave_trip", { p_trip_id: trip_id });
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
      lat: z.number(),
      lng: z.number(),
      radius: z.number(),
      page: z.number().default(1),
      tag_filter: z.array(z.string()).default([]),
      location_filter: z.string().default("destination"),
    }),
    
    async handler(input) {
      const allTrips: any[] = [];
      let tag: string[] | null = null;
      if (input.tag_filter.length > 0) {
        tag = input.tag_filter;
      } else {
        tag = null;
      }
      let page = input.page;
      const pageSize = 50;
      let lastBatchLength = -1;
      
      while (true) {
        const { data, error } = await supabaseAdmin.rpc("get_nearby_trips", {
          user_lng: input.lng,
          user_lat: input.lat,
          page: page,
          page_size: pageSize,
          radius_meters: input.radius,
          tag_filter: tag,
          location_filter: input.location_filter,
        });
        
        if (error) {
          console.error(error);
          throw new ActionError({
            message: error.message,
            code: "INTERNAL_SERVER_ERROR",
          });
        }
        
        // Ensure it's an array
        const batch = Array.isArray(data) ? data : [];
        // Stop if no data or same length as previous batch (safety check)
        if (batch.length === 0 || batch.length === lastBatchLength) break;
        
        allTrips.push(...batch);
        
        // Stop if less than pageSize (last page)
        if (batch.length < pageSize) break;
        
        lastBatchLength = batch.length;
        page++;
      }
      console.log("allTrips", allTrips);
      
      return allTrips;
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
      console.log("input", input);
      const supabase = getSupabaseClient(context.cookies);
      
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        console.log(userError);
        throw new Error('You must be logged in');
      }
      
      const { data, error } = await supabase.rpc('get_trip_members_complete', {
        p_trip_id: input.tripId,
        p_user_id: user.id,
      });
      
      if (error) {
        console.log(error);
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

      const userId = user.id
      console.log("user", userId);
      const { data, error } = await supabase.rpc('approve_join_request', {
        p_member_id: input.memberId,
        p_trip_id: input.tripId,
        p_approver_id: userId
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
  })
}


type tripDetailsSchema = ActionInputSchema<typeof trip.getTripDetails>;

// export type TripDetails = z.output<tripDetailsSchema>;
export type TripDetailsRES = ActionReturnType<typeof trip.getTripDetails>;