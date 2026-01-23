// ============================================================================
// FILE: src/actions/index.ts
// Astro Actions using Supabase RPC functions
// ============================================================================
import { defineAction, ActionError } from 'astro:actions';
import { z } from 'astro:schema';
import { supabase } from '@/lib/supabase';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function handleRpcError(error: any, defaultMessage: string) {
  const message = error?.message || defaultMessage;
  
  // Map Postgres exceptions to appropriate error codes
  if (message.includes('Unauthorized')) {
    throw new ActionError({
      code: 'UNAUTHORIZED',
      message: 'You must be logged in to perform this action'
    });
  }
  
  if (message.includes('already taken') || message.includes('exists')) {
    throw new ActionError({
      code: 'BAD_REQUEST',
      message
    });
  }
  
  if (message.includes('at least')) {
    throw new ActionError({
      code: 'BAD_REQUEST',
      message
    });
  }

  throw new ActionError({
    code: 'INTERNAL_SERVER_ERROR',
    message
  });
}

// ============================================================================
// ONBOARDING ACTIONS
// ============================================================================

export const onboarding = {
  // ============================================================================
  // Get onboarding status
  // ============================================================================
  getOnboardingStatus: defineAction({
    handler: async (_, context) => {
      const userId = context.locals.user_id;
      if (!userId) {
        throw new ActionError({
          code: 'UNAUTHORIZED',
          message: 'You must be logged in'
        });
      }

      try {
        const { data, error } = await supabase.rpc('get_onboarding_status', {
          p_user_id: userId
        });

        if (error) throw error;
        return data;
      } catch (error) {
        handleRpcError(error, 'Failed to fetch onboarding status');
      }
    }
  }),

  // ============================================================================
  // Update profile (Step 1) - Uses single RPC call
  // ============================================================================
  updateProfile: defineAction({
    input: z.object({
      username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/).optional(),
      first_name: z.string().min(1).max(50).optional(),
      last_name: z.string().min(1).max(50).optional(),
      bio: z.string().max(500).optional(),
      avatar_url: z.string().url().optional(),
      dob: z.string().optional(),
      nationality: z.string().max(100).optional(),
      location_city: z.string().max(100).optional(),
      location_country: z.string().max(100).optional(),
      gender: z.enum(['male', 'female', 'non-binary', 'other', '']).optional(),
      phone_number: z.string().max(20).optional(),
    }),
    handler: async (input, context) => {
      const userId = context.locals.user_id;
      if (!userId) {
        throw new ActionError({
          code: 'UNAUTHORIZED',
          message: 'You must be logged in'
        });
      }

      try {
        const { data, error } = await supabase.rpc('update_user_profile', {
          p_user_id: userId,
          p_username: input.username || null,
          p_first_name: input.first_name || null,
          p_last_name: input.last_name || null,
          p_bio: input.bio || null,
          p_avatar_url: input.avatar_url || null,
          p_dob: input.dob || null,
          p_nationality: input.nationality || null,
          p_location_city: input.location_city || null,
          p_location_country: input.location_country || null,
          p_gender: input.gender || null,
          p_phone_number: input.phone_number || null,
        });

        if (error) throw error;
        return data;
      } catch (error) {
        handleRpcError(error, 'Failed to update profile');
      }
    }
  }),

  // ============================================================================
  // Set user interests (Step 2) - Single RPC call
  // ============================================================================
  setInterests: defineAction({
    input: z.object({
      interests: z.array(z.string()).min(3, 'Please select at least 3 interests').max(10)
    }),
    handler: async (input, context) => {
      const userId = context.locals.user_id;
      if (!userId) {
        throw new ActionError({
          code: 'UNAUTHORIZED',
          message: 'You must be logged in'
        });
      }

      try {
        const { data, error } = await supabase.rpc('set_user_interests', {
          p_user_id: userId,
          p_interests: input.interests
        });

        if (error) throw error;
        return data;
      } catch (error) {
        handleRpcError(error, 'Failed to save interests');
      }
    }
  }),

  // ============================================================================
  // Set travel preferences (Step 3) - Single RPC call
  // ============================================================================
  setTravelPreferences: defineAction({
    input: z.object({
      budget_range: z.enum(['budget', 'moderate', 'luxury']).optional(),
      travel_style: z.array(z.string()).optional(),
      pace_preference: z.enum(['relaxed', 'moderate', 'packed']).optional(),
      accommodation_type: z.array(z.string()).optional(),
      preferred_group_size: z.number().int().min(1).max(50).optional(),
      max_group_size: z.number().int().min(1).max(100).optional(),
      willing_to_split_costs: z.boolean().optional(),
      languages_spoken: z.array(z.string()).optional(),
      dietary_restrictions: z.array(z.string()).optional(),
      accessibility_needs: z.array(z.string()).optional(),
    }),
    handler: async (input, context) => {
      const userId = context.locals.user_id;
      if (!userId) {
        throw new ActionError({
          code: 'UNAUTHORIZED',
          message: 'You must be logged in'
        });
      }

      try {
        const { data, error } = await supabase.rpc('set_travel_preferences', {
          p_user_id: userId,
          p_budget_range: input.budget_range || null,
          p_travel_style: input.travel_style || null,
          p_pace_preference: input.pace_preference || null,
          p_accommodation_type: input.accommodation_type || null,
          p_preferred_group_size: input.preferred_group_size || null,
          p_max_group_size: input.max_group_size || null,
          p_willing_to_split_costs: input.willing_to_split_costs ?? null,
          p_languages_spoken: input.languages_spoken || null,
          p_dietary_restrictions: input.dietary_restrictions || null,
          p_accessibility_needs: input.accessibility_needs || null,
        });

        if (error) throw error;
        return data;
      } catch (error) {
        handleRpcError(error, 'Failed to save preferences');
      }
    }
  }),

  // ============================================================================
  // Skip onboarding step
  // ============================================================================
  skipOnboardingStep: defineAction({
    input: z.object({
      step: z.enum(['profile', 'interests', 'preferences', 'verification'])
    }),
    handler: async (input, context) => {
      const userId = context.locals.user_id;
      if (!userId) {
        throw new ActionError({
          code: 'UNAUTHORIZED',
          message: 'You must be logged in'
        });
      }

      try {
        const { data, error } = await supabase.rpc('skip_onboarding_step', {
          p_user_id: userId,
          p_step_name: input.step
        });

        if (error) throw error;
        return data;
      } catch (error) {
        handleRpcError(error, 'Failed to skip step');
      }
    }
  }),

  // ============================================================================
  // Check username availability
  // ============================================================================
  checkUsername: defineAction({
    input: z.object({
      username: z.string().min(3).max(30)
    }),
    handler: async (input, context) => {
      const userId = context.locals.user_id;
      
      try {
        const { data, error } = await supabase.rpc('check_username_availability', {
          p_username: input.username,
          p_exclude_user_id: userId || null
        });

        if (error) throw error;
        return data;
      } catch (error) {
        handleRpcError(error, 'Failed to check username');
      }
    }
  }),

  // ============================================================================
  // Upload avatar
  // ============================================================================
  uploadAvatar: defineAction({
    input: z.instanceof(FormData),
    handler: async (formData, context) => {
      const userId = context.locals.user_id;
      if (!userId) {
        throw new ActionError({
          code: 'UNAUTHORIZED',
          message: 'You must be logged in'
        });
      }

      try {
        const file = formData.get('file') as File;

        if (!file) {
          throw new ActionError({
            code: 'BAD_REQUEST',
            message: 'No file provided'
          });
        }

        // Validate file type
        if (!file.type.startsWith('image/')) {
          throw new ActionError({
            code: 'BAD_REQUEST',
            message: 'File must be an image'
          });
        }

        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
          throw new ActionError({
            code: 'BAD_REQUEST',
            message: 'File size must be less than 5MB'
          });
        }

        const fileExt = file.name.split('.').pop();
        const fileName = `${userId}-${Date.now()}.${fileExt}`;
        const filePath = `avatars/${fileName}`;

        // Upload to Supabase Storage
        const { error: uploadError } = await supabase.storage
          .from('user-content')
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false
          });

        if (uploadError) throw uploadError;

        // Get public URL
        const { data: urlData } = supabase.storage
          .from('user-content')
          .getPublicUrl(filePath);

        return { 
          success: true, 
          url: urlData.publicUrl,
          message: 'Avatar uploaded successfully'
        };
      } catch (error) {
        if (error instanceof ActionError) throw error;
        
        console.error('Avatar upload error:', error);
        throw new ActionError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to upload avatar'
        });
      }
    }
  }),

  // ============================================================================
  // Complete entire onboarding
  // ============================================================================
  completeOnboarding: defineAction({
    handler: async (_, context) => {
      const userId = context.locals.user_id;
      if (!userId) {
        throw new ActionError({
          code: 'UNAUTHORIZED',
          message: 'You must be logged in'
        });
      }

      try {
        const { data, error } = await supabase.rpc('complete_user_onboarding', {
          p_user_id: userId
        });

        if (error) throw error;
        return data;
      } catch (error) {
        handleRpcError(error, 'Failed to complete onboarding');
      }
    }
  }),

  // ============================================================================
  // Get user profile data (for forms)
  // ============================================================================
  getUserProfileData: defineAction({
    handler: async (_, context) => {
      const userId = context.locals.user_id;
      if (!userId) {
        throw new ActionError({
          code: 'UNAUTHORIZED',
          message: 'You must be logged in'
        });
      }

      try {
        const { data, error } = await supabase.rpc('get_user_profile_data', {
          p_user_id: userId
        });

        if (error) throw error;
        return data;
      } catch (error) {
        handleRpcError(error, 'Failed to get profile data');
      }
    }
  }),

  // ============================================================================
  // Get user stats (for dashboard)
  // ============================================================================
  getUserStats: defineAction({
    handler: async (_, context) => {
      const userId = context.locals.user_id;
      if (!userId) {
        throw new ActionError({
          code: 'UNAUTHORIZED',
          message: 'You must be logged in'
        });
      }

      try {
        const { data, error } = await supabase.rpc('get_user_stats', {
          p_user_id: userId
        });

        if (error) throw error;
        return data;
      } catch (error) {
        handleRpcError(error, 'Failed to get user stats');
      }
    }
  }),
};

// ============================================================================
// TYPE EXPORTS for client-side usage
// ============================================================================
export type OnboardingActions = typeof onboarding;