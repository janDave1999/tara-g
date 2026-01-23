import { z } from "astro:content";
import { supabaseAdmin, getSupabaseClient } from "@/lib/supabase";
import { type ActionInputSchema, type ActionReturnType, ActionError, defineAction } from "astro:actions";
import { rollBack } from "@/lib/rollback";
import { saveLocation, saveTripLoc } from "@/lib/locations";
import { uploadToR2 } from "@/scripts/R2/upload";
import { defineProtectedAction } from "./utils";
import type { TripMember, JoinRequest, PendingInvitation, MembersSummary, CompleteMembersData } from "@/types/trip";


// Initialize Supabase client (adjust based on your setup)

// get user id in astro locals


export const trip = {
  createTrip: defineAction({
    input: z.object({
      slug: z.string(),
      title: z.string(),
      region_address: z.string(),
      region_coordinates: z.string(),
      description: z.string(),
      start_date: z.string(),
      end_date: z.string(),
      cost_sharing: z.string(),
      pickup_address: z.string(),
      pickup_coordinates: z.string(),
      max_pax: z.number(),
      pickup_dates: z.string(),
      waiting_time: z.number(),
      gender_preference: z.string(),
      tags: z.array(z.string()),
      joined_by: z.string()
    }),
    
    async handler(input, context) {
      console.log("Trip Created:", input);
      const user_id = context.locals.user_id || "";
      
      // insert into trips table
      const { data, error } = await supabaseAdmin
      .from("trips")
      .insert({
        title: input.title,
        slug: input.slug,
        owner_id: user_id,
        description: input.description,
        status: "draft",
        is_public: false
      })
      .select("trip_id, slug")
      .single();
      
      if (error) {
        console.log("[error]Checkpoint 1:", error);
        throw new ActionError({
          message: error.message,
          code: "INTERNAL_SERVER_ERROR"
        });
      }
      
      console.log("Checkpoint 1:", data);
      
      let trip_id = data?.trip_id || "";
      let slug = data?.slug || "";
      
      
      const { error: tripError } = await supabaseAdmin
      .from("trip_details")
      .insert({
        trip_id: trip_id,
        start_date: input.start_date,
        end_date: input.end_date,
        cost_sharing: input.cost_sharing,
        region: input.region_address,
        gender_pref: input.gender_preference,
        max_pax: input.max_pax,
        tags: input.tags,
        join_by: input.joined_by
      })
      .single();
      
      if (tripError) {
        await rollBack("trips", trip_id);
        throw new ActionError({
          message: tripError.message,
          code: "INTERNAL_SERVER_ERROR"
        })
      }
      
      const { error: tripVisibilityError } = await supabaseAdmin
      .from("trip_visibility")
      .insert({
        trip_id: trip_id,
        max_participants: input.max_pax,
        
      })
      
      if (tripVisibilityError) {
        await rollBack("trips", trip_id);
        throw new ActionError({
          message: tripVisibilityError.message,
          code: "INTERNAL_SERVER_ERROR"
        })
      }
      
      const { data: region, error: locationError } = await saveLocation(input.region_address, input.region_coordinates);
      if (locationError) {
        await rollBack("trips", trip_id);
        throw new ActionError({
          message: locationError,
          code: "INTERNAL_SERVER_ERROR"
        })
      }
      const { data: pickup, error: pickupError } = await saveLocation(input.pickup_address, input.pickup_coordinates);
      if (pickupError) {
        await rollBack("trips", trip_id);
        throw new ActionError({
          message: pickupError,
          code: "INTERNAL_SERVER_ERROR"
        })
      }
      // const { data: dropoff, error: dropoffError } = await saveLocation(input.dropoff_address, input.dropoff_coordinates);
      // if (dropoffError) {
      //     await rollBack("trips", trip_id);
      //     throw new ActionError({
      //         message: dropoffError,
      //         code: "INTERNAL_SERVER_ERROR"
      //     })
      // }
      const { error: tripLocError } = await saveTripLoc(trip_id, region, "destination", input.start_date, input.end_date, 0);
      if (tripLocError) {
        await rollBack("trips", trip_id);
        console.log("[error]Checkpoint 2:", tripLocError);
        throw new ActionError({
          message: tripLocError,
          code: "INTERNAL_SERVER_ERROR"
        })
      }
      const { error: tripPickupError } = await saveTripLoc(trip_id, pickup, "pickup", input.pickup_dates, input.pickup_dates, input.waiting_time || 0);
      if (tripPickupError) {
        await rollBack("trips", trip_id);
        console.log("[error]Checkpoint 3:", tripPickupError);
        throw new ActionError({
          message: tripPickupError,
          code: "INTERNAL_SERVER_ERROR"
        })
      }
      let reponse = JSON.stringify({
        success: true,
        message: "Trip created successfully!",
        data: {
          trip_id: trip_id,
          slug: slug,
        },
      })
      
      return reponse;
    }
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
  
  getTripDetails: defineAction({
    input: z.object({
      slug: z.string(),
      user_id: z.string().optional()
    }),
    
    async handler(input) {
      let slug = input.slug
      
      const { data, error } = await supabaseAdmin.rpc("get_trip_details", { trip_slug:slug, current_user_id: input.user_id ?? null });
      if (error) {
        throw new ActionError({
          message: error.message,
          code: "INTERNAL_SERVER_ERROR"
        })
      }
      return data
    }
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
        p_approver_id: "d0d3fb74-8da5-4cbc-b2b8-dbd17bf60e1d"
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
}

type tripDetailsSchema = ActionInputSchema<typeof trip.getTripDetails>;

export type TripDetails = z.output<tripDetailsSchema>;
export type TripDetailsRES = ActionReturnType<typeof trip.getTripDetails>;