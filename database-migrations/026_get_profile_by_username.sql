-- Migration 026: Get Profile By Username RPC
-- Fetch public profile data by username for public profile viewing

DROP FUNCTION IF EXISTS public.get_profile_by_username(TEXT);

CREATE OR REPLACE FUNCTION public.get_profile_by_username(
  p_username TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSONB;
  v_user_record RECORD;
  v_info_record RECORD;
  v_prefs_record RECORD;
  v_interests JSONB;
  v_stats JSONB;
BEGIN
  -- Fetch user by username
  SELECT u.*
  INTO v_user_record
  FROM public.users u
  WHERE u.username = p_username;

  IF v_user_record IS NULL THEN
    RETURN jsonb_build_object(
      'error', 'User not found',
      'found', false
    );
  END IF;

  -- Fetch user information
  SELECT ui.*
  INTO v_info_record
  FROM public.user_information ui
  WHERE ui.user_id = v_user_record.id;

  -- Fetch travel preferences
  SELECT utp.*
  INTO v_prefs_record
  FROM public.user_travel_preferences utp
  WHERE utp.user_id = v_user_record.id;

  -- Fetch interests
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', i.id,
      'category', i.category,
      'icon', i.icon
    )
  ) INTO v_interests
  FROM public.user_interests ui2
  JOIN public.interests i ON ui2.interest_id = i.id
  WHERE ui2.user_id = v_user_record.id;

  -- Build result
  result := jsonb_build_object(
    'found', true,
    'profile', jsonb_build_object(
      'id', v_user_record.id,
      'username', v_user_record.username,
      'full_name', v_user_record.full_name,
      'avatar_url', v_user_record.avatar_url,
      'cover_image_url', v_user_record.cover_image_url,
      'bio', v_user_record.bio,
      'is_verified', v_user_record.is_verified,
      'created_at', v_user_record.created_at,
      'privacy_mode', v_user_record.privacy_mode
    ),
    'information', CASE WHEN v_info_record IS NOT NULL THEN
      jsonb_build_object(
        'location_city', v_info_record.location_city,
        'location_country', v_info_record.location_country,
        'profile_completion_percentage', v_info_record.profile_completion_percentage,
        'date_of_birth', v_info_record.date_of_birth,
        'gender', v_info_record.gender
      )
    ELSE jsonb_build_object() END,
    'preferences', CASE WHEN v_prefs_record IS NOT NULL THEN
      jsonb_build_object(
        'budget_range', v_prefs_record.budget_range,
        'travel_style', COALESCE(v_prefs_record.travel_style, '[]'::jsonb),
        'pace_preference', v_prefs_record.pace_preference,
        'languages_spoken', COALESCE(v_prefs_record.languages_spoken, '[]'::jsonb),
        'accommodation_type', v_prefs_record.accommodation_type,
        'preferred_activities', COALESCE(v_prefs_record.preferred_activities, '[]'::jsonb)
      )
    ELSE jsonb_build_object() END,
    'interests', COALESCE(v_interests, '[]'::jsonb)
  );

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_profile_by_username(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_profile_by_username(TEXT) TO anon;
