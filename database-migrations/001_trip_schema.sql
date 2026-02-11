-- =====================================================
-- TRIP SEARCH DATABASE SCHEMA (CORRECTED)
-- =====================================================
-- Core tables and indexes for trip search functionality
-- =====================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- =====================================================
-- ENUM TYPES
-- =====================================================

CREATE TYPE trip_status AS ENUM ('draft', 'active', 'completed', 'archived', 'cancelled');
CREATE TYPE visibility_type AS ENUM ('private', 'public', 'friends');
CREATE TYPE location_type_enum AS ENUM ('destination', 'activity', 'meal_break', 'rest_stop', 'accommodation', 'checkpoint', 'pickup', 'dropoff');
CREATE TYPE user_role AS ENUM ('owner', 'admin', 'member');
CREATE TYPE member_status AS ENUM ('joined', 'pending', 'left', 'removed', 'invited');

-- =====================================================
-- CORE TABLES
-- =====================================================

-- Trips table
CREATE TABLE trips (
    trip_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    status trip_status NOT NULL DEFAULT 'active',
    is_public BOOLEAN DEFAULT false,
    slug VARCHAR(100) UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Full-text search
    search_vector tsvector GENERATED ALWAYS AS (
        setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(description, '')), 'B')
    ) STORED,
    
    -- Performance tracking
    popularity_score DECIMAL(5,3) DEFAULT 0.0,
    last_accessed TIMESTAMPTZ DEFAULT NOW(),
    view_count INTEGER DEFAULT 0,
    join_count INTEGER DEFAULT 0
);

-- Trip details
CREATE TABLE trip_details (
    trip_id UUID PRIMARY KEY REFERENCES trips(trip_id) ON DELETE CASCADE,
    description TEXT,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    cover_image TEXT,
    region VARCHAR(200),
    max_pax SMALLINT CHECK (max_pax > 0),
    gender_pref VARCHAR(20) DEFAULT 'any',
    cost_sharing VARCHAR(30) DEFAULT 'split_evenly',
    estimated_budget INTEGER CHECK (estimated_budget >= 0),
    join_by TIMESTAMPTZ NOT NULL,
    join_by_time TIME WITHOUT TIME ZONE DEFAULT '23:59:59',
    
    tags TEXT[] DEFAULT '{}',
    
    -- Computed fields
    duration_days INTEGER GENERATED ALWAYS AS ((end_date - start_date) + 1) STORED,
    budget_per_person DECIMAL(10,2) GENERATED ALWAYS AS (
        CASE WHEN max_pax > 0 THEN estimated_budget::DECIMAL / max_pax ELSE NULL END
    ) STORED,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Locations table
CREATE TABLE locations (
    location_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,
    address TEXT,
    city VARCHAR(100),
    country VARCHAR(100),
    latitude DECIMAL(10,8) NOT NULL,
    longitude DECIMAL(11,8) NOT NULL,
    geometry GEOMETRY(POINT, 4326),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trip-location junction
CREATE TABLE trip_location (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id UUID NOT NULL REFERENCES trips(trip_id) ON DELETE CASCADE,
    location_id UUID NOT NULL REFERENCES locations(location_id) ON DELETE CASCADE,
    location_type location_type_enum NOT NULL DEFAULT 'destination',
    is_primary BOOLEAN DEFAULT FALSE,
    is_mandatory BOOLEAN DEFAULT TRUE,
    order_index INTEGER DEFAULT 0,
    
    scheduled_start TIMESTAMPTZ,
    scheduled_end TIMESTAMPTZ,
    actual_start TIMESTAMPTZ,
    actual_end TIMESTAMPTZ,
    waiting_time SMALLINT DEFAULT 0,
    notes TEXT,
    
    distance_km DECIMAL(8,3),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(trip_id, location_id, location_type)
);

-- Trip visibility
CREATE TABLE trip_visibility (
    trip_id UUID PRIMARY KEY REFERENCES trips(trip_id) ON DELETE CASCADE,
    visibility visibility_type NOT NULL DEFAULT 'private',
    max_participants SMALLINT CHECK (max_participants > 0),
    current_participants SMALLINT DEFAULT 0,
    is_reusable BOOLEAN DEFAULT FALSE,
    share_slug VARCHAR(100) UNIQUE,
    
    -- Computed availability
    available_spots SMALLINT GENERATED ALWAYS AS (
        GREATEST(0, max_participants - current_participants)
    ) STORED,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trip images
CREATE TABLE trip_images (
    image_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id UUID NOT NULL REFERENCES trips(trip_id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    image_hash VARCHAR(64),
    alt_text VARCHAR(200),
    is_cover BOOLEAN DEFAULT FALSE,
    type VARCHAR(20) DEFAULT 'hero',
    display_order SMALLINT DEFAULT 0,
    file_size BIGINT,
    dimensions VARCHAR(20),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trip members
CREATE TABLE trip_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id UUID NOT NULL REFERENCES trips(trip_id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role user_role NOT NULL DEFAULT 'member',
    member_status member_status NOT NULL DEFAULT 'pending',
    join_method VARCHAR(20) DEFAULT 'request' CHECK (join_method = ANY (ARRAY['request', 'invitation', 'owner'])),
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    initial_contribution DECIMAL(10,2),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    invitation_id UUID,
    
    UNIQUE(trip_id, user_id)
);

-- Trip tags
CREATE TABLE trip_tags (
    tag_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tag_name TEXT NOT NULL UNIQUE,
    usage_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE trip_tag_relations (
    trip_id UUID NOT NULL REFERENCES trips(trip_id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES trip_tags(tag_id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (trip_id, tag_id)
);

-- Trip invitations
CREATE TABLE trip_invitations (
    invitation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id UUID NOT NULL REFERENCES trips(trip_id) ON DELETE CASCADE,
    inviter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    invitee_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    invitee_email VARCHAR(255),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status = ANY (ARRAY['pending', 'accepted', 'declined', 'expired', 'cancelled'])),
    message TEXT,
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),
    responded_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- INDEXES
-- =====================================================

-- Spatial indexes
CREATE INDEX idx_locations_geometry_gist ON locations USING GIST (geometry);

-- Search indexes
CREATE INDEX idx_trips_search_vector ON trips USING GIN (search_vector);
CREATE INDEX idx_trip_details_tags ON trip_details USING GIN (tags);

-- Core performance indexes
CREATE INDEX idx_trips_status_created ON trips (status, created_at DESC);
CREATE INDEX idx_trips_popularity ON trips (popularity_score DESC, last_accessed DESC);
CREATE INDEX idx_trips_active ON trips (created_at DESC) WHERE status = 'active';

-- Date range indexes
CREATE INDEX idx_trip_details_dates ON trip_details (start_date, end_date);
CREATE INDEX idx_trip_details_join_by ON trip_details (join_by);
CREATE INDEX idx_trip_details_budget ON trip_details (estimated_budget);
CREATE INDEX idx_trip_details_budget_per_person ON trip_details (budget_per_person);

-- Location indexes
CREATE INDEX idx_trip_locations_composite ON trip_location (location_type, is_primary, trip_id);
CREATE INDEX idx_trip_locations_distance ON trip_location (distance_km) WHERE distance_km IS NOT NULL;
CREATE INDEX idx_trip_locations_time ON trip_location (scheduled_start, scheduled_end);

-- Visibility indexes
CREATE INDEX idx_trip_visibility_public ON trip_visibility (visibility, current_participants, max_participants);
CREATE INDEX idx_trip_visibility_available ON trip_visibility (available_spots DESC) WHERE available_spots > 0;

-- Images indexes
CREATE INDEX idx_trip_images_trip_cover ON trip_images (trip_id, is_cover, display_order);
CREATE INDEX idx_trip_images_hash ON trip_images (image_hash) WHERE image_hash IS NOT NULL;

-- Tag indexes
CREATE INDEX idx_trip_tags_usage ON trip_tags (usage_count DESC);
CREATE INDEX idx_trip_tag_relations_trip ON trip_tag_relations (trip_id);
CREATE INDEX idx_trip_tag_relations_tag ON trip_tag_relations (tag_id);

-- Member indexes
CREATE INDEX idx_trip_members_trip ON trip_members (trip_id, member_status);
CREATE INDEX idx_trip_members_user ON trip_members (user_id, member_status);

-- Invitation indexes
CREATE INDEX idx_trip_invitations_trip ON trip_invitations (trip_id, status);
CREATE INDEX idx_trip_invitations_invitee ON trip_invitations (invitee_id, status) WHERE invitee_id IS NOT NULL;
CREATE INDEX idx_trip_invitations_email ON trip_invitations (invitee_email, status) WHERE invitee_email IS NOT NULL;

-- Foreign key indexes
CREATE INDEX idx_trip_details_trip_id_fk ON trip_details (trip_id);
CREATE INDEX idx_trip_location_trip_id_fk ON trip_location (trip_id);
CREATE INDEX idx_trip_location_location_id_fk ON trip_location (location_id);
CREATE INDEX idx_trip_visibility_trip_id_fk ON trip_visibility (trip_id);
CREATE INDEX idx_trip_images_trip_id_fk ON trip_images (trip_id);
CREATE INDEX idx_trip_members_trip_id_fk ON trip_members (trip_id);
CREATE INDEX idx_trip_members_user_id_fk ON trip_members (user_id);
CREATE INDEX idx_trip_tag_relations_trip_id_fk ON trip_tag_relations (trip_id);
CREATE INDEX idx_trip_tag_relations_tag_id_fk ON trip_tag_relations (tag_id);
CREATE INDEX idx_trip_invitations_trip_id_fk ON trip_invitations (trip_id);
CREATE INDEX idx_trip_invitations_inviter_id_fk ON trip_invitations (inviter_id);
CREATE INDEX idx_trip_invitations_invitee_id_fk ON trip_invitations (invitee_id);

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Update geometry when lat/lng changes
CREATE OR REPLACE FUNCTION update_location_geometry()
RETURNS TRIGGER AS $$
BEGIN
    NEW.geometry := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_location_geometry
    BEFORE INSERT OR UPDATE ON locations
    FOR EACH ROW
    EXECUTE FUNCTION update_location_geometry();

-- Update trip statistics
CREATE OR REPLACE FUNCTION update_trip_stats()
RETURNS TRIGGER AS $$
BEGIN
    -- Update stats directly on the NEW row
    NEW.view_count := NEW.view_count + 1;
    NEW.popularity_score := GREATEST(0.1, NEW.popularity_score + 0.01);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_trip_stats
    BEFORE UPDATE ON trips
    FOR EACH ROW
    WHEN (OLD.last_accessed IS DISTINCT FROM NEW.last_accessed)
    EXECUTE FUNCTION update_trip_stats();

-- Update available spots
CREATE OR REPLACE FUNCTION update_available_spots()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE trip_visibility tv
    SET current_participants = (
        SELECT COUNT(*) 
        FROM trip_members tm 
        WHERE tm.trip_id = tv.trip_id 
        AND tm.member_status = 'joined'
    )
    WHERE tv.trip_id = COALESCE(NEW.trip_id, OLD.trip_id);
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_available_spots
    AFTER INSERT OR UPDATE OR DELETE ON trip_members
    FOR EACH ROW
    EXECUTE FUNCTION update_available_spots();

-- =====================================================
-- VERIFICATION
-- =====================================================

SELECT 'Migration completed successfully' as status, COUNT(*) as table_count, NOW() as completed_at
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('trips', 'trip_details', 'locations', 'trip_location', 'trip_visibility', 'trip_images');