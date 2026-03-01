-- Migration: 046_trip_share_links.sql
-- Add support for share links with limited usage

-- Drop existing functions if they exist
DROP FUNCTION IF EXISTS public.create_trip_share_link(UUID, UUID, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS public.validate_and_use_share_link(VARCHAR, UUID);
DROP FUNCTION IF EXISTS public.get_trip_share_links(UUID, UUID);
DROP FUNCTION IF EXISTS public.validate_share_link_invitation(UUID, UUID);

-- Add new columns to trip_invitations for share link functionality
ALTER TABLE trip_invitations 
ADD COLUMN IF NOT EXISTS invitation_type VARCHAR(20) DEFAULT 'invitation' 
CHECK (invitation_type = ANY (ARRAY['invitation', 'share_link']));

ALTER TABLE trip_invitations 
ADD COLUMN IF NOT EXISTS max_uses INTEGER DEFAULT 5;

ALTER TABLE trip_invitations 
ADD COLUMN IF NOT EXISTS current_uses INTEGER DEFAULT 0;

ALTER TABLE trip_invitations 
ADD COLUMN IF NOT EXISTS share_code VARCHAR(50) UNIQUE;

-- Create index for share_code lookups
CREATE INDEX IF NOT EXISTS idx_trip_invitations_share_code ON trip_invitations (share_code) WHERE share_code IS NOT NULL;

-- Function to create a share link invitation
CREATE OR REPLACE FUNCTION public.create_trip_share_link(
  p_trip_id UUID,
  p_creator_id UUID,
  p_max_uses INTEGER DEFAULT 5,
  p_expires_in_days INTEGER DEFAULT 30
)
RETURNS TABLE(
  invitation_id UUID,
  share_code VARCHAR(50),
  share_url TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_invitation_id UUID;
  v_share_code VARCHAR(50);
  v_site_url TEXT;
BEGIN
  -- Generate unique share code
  LOOP
    v_share_code := encode(gen_random_bytes(4), 'hex');
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM trip_invitations WHERE trip_invitations.share_code = v_share_code
    );
  END LOOP;

  -- Get site URL from environment or use default
  v_site_url := COALESCE(
    current_setting('app.site_url', true),
    'https://tara-g.com'
  );

  -- Create the invitation record
  INSERT INTO trip_invitations (
    trip_id,
    inviter_id,
    invitation_type,
    status,
    max_uses,
    current_uses,
    share_code,
    expires_at,
    message
  )
  VALUES (
    p_trip_id,
    p_creator_id,
    'share_link',
    'pending',
    p_max_uses,
    0,
    v_share_code,
    NOW() + (p_expires_in_days || ' days')::INTERVAL,
    'Share link invitation'
  )
  RETURNING trip_invitations.invitation_id INTO v_invitation_id;

  RETURN QUERY SELECT 
    v_invitation_id,
    v_share_code,
    v_site_url || '/trips/' || p_trip_id::text || '?invite=' || v_share_code;
END;
$$;

-- Function to validate and consume a share link
CREATE OR REPLACE FUNCTION public.validate_and_use_share_link(
  p_share_code VARCHAR(50),
  p_user_id UUID
)
RETURNS TABLE(
  valid BOOLEAN,
  trip_id UUID,
  invitation_id UUID,
  inviter_id UUID,
  error_message TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_invitation RECORD;
BEGIN
  -- Find the share link
  SELECT * INTO v_invitation
  FROM trip_invitations
  WHERE trip_invitations.share_code = p_share_code
    AND trip_invitations.invitation_type = 'share_link'
    AND trip_invitations.status = 'pending';

  IF v_invitation IS NULL THEN
    RETURN QUERY SELECT false, NULL::UUID, NULL::UUID, NULL::UUID, 'Invalid or expired share link'::TEXT;
    RETURN;
  END IF;

  -- Check if expired
  IF v_invitation.expires_at < NOW() THEN
    RETURN QUERY SELECT false, NULL::UUID, NULL::UUID, NULL::UUID, 'Share link has expired'::TEXT;
    RETURN;
  END IF;

  -- Check max uses
  IF v_invitation.max_uses IS NOT NULL AND v_invitation.current_uses >= v_invitation.max_uses THEN
    RETURN QUERY SELECT false, NULL::UUID, NULL::UUID, NULL::UUID, 'Share link has reached maximum uses'::TEXT;
    RETURN;
  END IF;

  -- Check if user is already a member
  IF EXISTS (
    SELECT 1 FROM trip_members
    WHERE trip_members.trip_id = v_invitation.trip_id
      AND trip_members.user_id = p_user_id
      AND trip_members.member_status = 'joined'
  ) THEN
    RETURN QUERY SELECT false, NULL::UUID, NULL::UUID, NULL::UUID, 'You are already a member of this trip'::TEXT;
    RETURN;
  END IF;

  -- Increment use count
  UPDATE trip_invitations
  SET current_uses = trip_invitations.current_uses + 1
  WHERE trip_invitations.invitation_id = v_invitation.invitation_id;

  RETURN QUERY SELECT
    true,
    v_invitation.trip_id::UUID,
    v_invitation.invitation_id::UUID,
    v_invitation.inviter_id::UUID,
    NULL::TEXT;
END;
$$;

-- Function to get share link stats
CREATE OR REPLACE FUNCTION public.get_trip_share_links(
  p_trip_id UUID,
  p_user_id UUID
)
RETURNS TABLE(
  invitation_id UUID,
  share_code VARCHAR(50),
  max_uses INTEGER,
  current_uses INTEGER,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verify user is trip owner
  IF NOT EXISTS (
    SELECT 1 FROM trips 
    WHERE trip_id = p_trip_id AND owner_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY SELECT 
    ti.invitation_id,
    ti.share_code,
    ti.max_uses,
    ti.current_uses,
    ti.expires_at,
    ti.created_at
  FROM trip_invitations ti
  WHERE ti.trip_id = p_trip_id
    AND ti.invitation_type = 'share_link'
  ORDER BY ti.created_at DESC;
END;
$$;

-- Function to validate and consume a share link by invitation_id
CREATE OR REPLACE FUNCTION public.validate_share_link_invitation(
  p_invitation_id UUID,
  p_user_id UUID
)
RETURNS TABLE(
  valid BOOLEAN,
  trip_id UUID,
  invitation_id UUID,
  inviter_id UUID,
  error_message TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_invitation RECORD;
BEGIN
  -- Find the share link invitation
  SELECT * INTO v_invitation
  FROM trip_invitations
  WHERE trip_invitations.invitation_id = p_invitation_id
    AND trip_invitations.invitation_type = 'share_link'
    AND trip_invitations.status = 'pending';

  IF v_invitation IS NULL THEN
    RETURN QUERY SELECT false, NULL::UUID, NULL::UUID, NULL::UUID, 'Invalid invitation'::TEXT;
    RETURN;
  END IF;

  -- Check if expired
  IF v_invitation.expires_at < NOW() THEN
    RETURN QUERY SELECT false, NULL::UUID, NULL::UUID, NULL::UUID, 'Invitation has expired'::TEXT;
    RETURN;
  END IF;

  -- Check max uses
  IF v_invitation.max_uses IS NOT NULL AND v_invitation.current_uses >= v_invitation.max_uses THEN
    RETURN QUERY SELECT false, NULL::UUID, NULL::UUID, NULL::UUID, 'Invitation has reached maximum uses'::TEXT;
    RETURN;
  END IF;

  -- Check if user is already a member
  IF EXISTS (
    SELECT 1 FROM trip_members
    WHERE trip_members.trip_id = v_invitation.trip_id
      AND trip_members.user_id = p_user_id
      AND trip_members.member_status = 'joined'
  ) THEN
    RETURN QUERY SELECT false, NULL::UUID, NULL::UUID, NULL::UUID, 'You are already a member of this trip'::TEXT;
    RETURN;
  END IF;

  -- Check if user already has a pending request
  IF EXISTS (
    SELECT 1 FROM trip_members
    WHERE trip_members.trip_id = v_invitation.trip_id
      AND trip_members.user_id = p_user_id
      AND trip_members.member_status = 'pending'
  ) THEN
    RETURN QUERY SELECT false, NULL::UUID, NULL::UUID, NULL::UUID, 'You already have a pending request to join this trip'::TEXT;
    RETURN;
  END IF;

  -- Increment use count
  UPDATE trip_invitations
  SET current_uses = trip_invitations.current_uses + 1
  WHERE trip_invitations.invitation_id = v_invitation.invitation_id;

  RETURN QUERY SELECT
    true,
    v_invitation.trip_id::UUID,
    v_invitation.invitation_id::UUID,
    v_invitation.inviter_id::UUID,
    NULL::TEXT;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.validate_share_link_invitation TO authenticated;
