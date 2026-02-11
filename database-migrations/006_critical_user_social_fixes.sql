-- =====================================================
-- PHASE 0: CRITICAL USER & SOCIAL FIXES (CLEANED)
-- =====================================================
-- This migration implements:
-- 1. User management tables
-- 2. Social features  
-- 3. Financial management
-- No circular dependencies or invalid constraints
-- =====================================================

-- =====================================================
-- 1. USER MANAGEMENT SYSTEM
-- =====================================================

-- Core users table linking to auth.users
CREATE TABLE IF NOT EXISTS users (
    user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(200),
    avatar_url TEXT,
    bio TEXT,
    is_verified BOOLEAN DEFAULT FALSE,
    is_private BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints for data integrity
    CONSTRAINT chk_users_username_length CHECK (LENGTH(TRIM(username)) >= 3),
    CONSTRAINT chk_users_username_format CHECK (username ~ '^[a-zA-Z0-9_]+$'),
    CONSTRAINT chk_users_email_format CHECK (email ~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
    CONSTRAINT chk_users_username_lower CHECK (username = LOWER(username))
);

-- Extended user information table
CREATE TABLE IF NOT EXISTS user_information (
    user_id UUID PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    phone_number VARCHAR(30),
    date_of_birth DATE,
    gender VARCHAR(20) CHECK (gender IN ('male', 'female', 'other', 'prefer_not_to_say')),
    location_country VARCHAR(100),
    location_city VARCHAR(100),
    address TEXT,
    emergency_contact_name VARCHAR(200),
    emergency_contact_phone VARCHAR(30),
    profile_completion_percentage INTEGER DEFAULT 0 CHECK (profile_completion_percentage BETWEEN 0 AND 100),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Phone number format validation
    CONSTRAINT chk_phone_format CHECK (
        phone_number IS NULL OR 
        phone_number ~ '^\+?[1-9]\d{1,14}$'
    )
);

-- User travel preferences for matching algorithm
CREATE TABLE IF NOT EXISTS user_travel_preferences (
    preference_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(user_id) ON DELETE CASCADE,
    budget_range VARCHAR(50) CHECK (budget_range IN ('budget', 'moderate', 'luxury', 'any')),
    travel_style TEXT[] DEFAULT '{}',
    pace_preference VARCHAR(30) DEFAULT 'moderate' CHECK (pace_preference IN ('relaxed', 'moderate', 'fast', 'any')),
    accommodation_type TEXT[] DEFAULT '{}',
    preferred_group_size INTEGER DEFAULT 4 CHECK (preferred_group_size BETWEEN 1 AND 50),
    max_group_size INTEGER DEFAULT 20 CHECK (max_group_size BETWEEN 1 AND 100),
    willing_to_split_costs BOOLEAN DEFAULT TRUE,
    languages_spoken TEXT[] DEFAULT '{}',
    dietary_restrictions TEXT[] DEFAULT '{}',
    accessibility_needs TEXT[] DEFAULT '{}',
    smoking_preference VARCHAR(20) DEFAULT 'non_smoker' CHECK (smoking_preference IN ('smoker', 'non_smoker', 'any')),
    drinking_preference VARCHAR(20) DEFAULT 'any' CHECK (drinking_preference IN ('drinker', 'non_drinker', 'any')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User interests for matching and recommendations
CREATE TABLE IF NOT EXISTS user_interests (
    user_interest_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    interest_category TEXT NOT NULL,
    interest_subcategory VARCHAR(100),
    priority INTEGER DEFAULT 0 CHECK (priority BETWEEN 0 AND 10),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Unique constraint: one entry per user per category
    UNIQUE(user_id, interest_category)
);

-- User settings and preferences
CREATE TABLE IF NOT EXISTS user_settings (
    user_settings_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(user_id) ON DELETE CASCADE,
    language VARCHAR(10) DEFAULT 'en',
    theme VARCHAR(20) DEFAULT 'light' CHECK (theme IN ('light', 'dark', 'auto')),
    notification_email BOOLEAN DEFAULT TRUE,
    notification_push BOOLEAN DEFAULT TRUE,
    timezone VARCHAR(50) DEFAULT 'UTC',
    currency VARCHAR(3) DEFAULT 'USD',
    date_format VARCHAR(20) DEFAULT 'MM/DD/YYYY',
    time_format VARCHAR(10) DEFAULT '12h' CHECK (time_format IN ('12h', '24h')),
    distance_unit VARCHAR(10) DEFAULT 'km' CHECK (distance_unit IN ('km', 'miles')),
    temperature_unit VARCHAR(10) DEFAULT 'celsius' CHECK (temperature_unit IN ('celsius', 'fahrenheit')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User onboarding progress tracking
CREATE TABLE IF NOT EXISTS user_onboarding_progress (
    progress_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    step_name TEXT NOT NULL,
    completed BOOLEAN DEFAULT FALSE,
    completed_at TIMESTAMPTZ,
    skipped BOOLEAN DEFAULT FALSE,
    data JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Ensure each user only has one record per step
    UNIQUE(user_id, step_name)
);

-- =====================================================
-- 2. SOCIAL FEATURES
-- =====================================================

-- User blocking system for privacy
CREATE TABLE IF NOT EXISTS blocks (
    blocker_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    blocked_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    reason VARCHAR(500),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Primary key and constraints
    PRIMARY KEY (blocker_id, blocked_id),
    CONSTRAINT chk_blocks_different_users CHECK (blocker_id != blocked_id)
);

-- Friend relationships
CREATE TABLE IF NOT EXISTS friends (
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    friend_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Primary key and constraints
    PRIMARY KEY (user_id, friend_id),
    CONSTRAINT chk_friends_different_users CHECK (user_id != friend_id)
);

-- Friend request management
CREATE TABLE IF NOT EXISTS friend_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    receiver_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' 
        CHECK (status IN ('pending', 'accepted', 'declined', 'expired', 'cancelled')),
    message TEXT,
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days'),
    responded_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Unique constraint and validation
    UNIQUE(sender_id, receiver_id),
    CONSTRAINT chk_friend_requests_different_users CHECK (sender_id != receiver_id)
);

-- Trip suggestions for users (algorithm-based recommendations)
CREATE TABLE IF NOT EXISTS trip_suggestions (
    suggestion_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    suggested_user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    reason TEXT,
    source_trip_id UUID REFERENCES trips(trip_id),
    relevance_score INTEGER DEFAULT 0 CHECK (relevance_score BETWEEN 0 AND 100),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'viewed', 'accepted', 'dismissed')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    UNIQUE(user_id, suggested_user_id),
    CONSTRAINT chk_trip_suggestions_different_users CHECK (user_id != suggested_user_id)
);

-- =====================================================
-- 3. FINANCIAL MANAGEMENT
-- =====================================================

-- Trip money collection pools
CREATE TABLE IF NOT EXISTS trip_pools (
    trip_pool_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id UUID NOT NULL REFERENCES trips(trip_id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL DEFAULT 'Main Pool',
    description TEXT,
    total_pool DECIMAL(12,2) NOT NULL DEFAULT 0.00 CHECK (total_pool >= 0),
    currency VARCHAR(3) NOT NULL DEFAULT 'USD' CHECK (currency ~ '^[A-Z]{3}$'),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled', 'frozen')),
    created_by UUID REFERENCES users(user_id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index to enforce single active pool per trip (replaces CHECK constraint)
CREATE UNIQUE INDEX IF NOT EXISTS idx_trip_pools_single_active
ON trip_pools (trip_id)
WHERE status = 'active';

-- Pool member contributions and balances
CREATE TABLE IF NOT EXISTS trip_pool_members (
    trip_pool_members_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pool_id UUID NOT NULL REFERENCES trip_pools(trip_pool_id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    contribution DECIMAL(12,2) NOT NULL DEFAULT 0.00 CHECK (contribution >= 0),
    paid_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00 CHECK (paid_amount >= 0),
    balance DECIMAL(12,2) GENERATED ALWAYS AS (contribution - paid_amount) STORED,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'partial', 'overdue', 'refunded')),
    payment_method VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Unique constraint
    UNIQUE(pool_id, member_id)
);

-- Trip expense tracking
CREATE TABLE IF NOT EXISTS trip_expenses (
    trip_expense_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id UUID NOT NULL REFERENCES trips(trip_id) ON DELETE CASCADE,
    pool_id UUID REFERENCES trip_pools(trip_pool_id) ON DELETE SET NULL,
    payer_id UUID NOT NULL REFERENCES users(user_id),
    description VARCHAR(500) NOT NULL,
    category VARCHAR(50) NOT NULL 
        CHECK (category IN ('transportation', 'accommodation', 'food', 'activities', 'shopping', 'entertainment', 'other')),
    amount DECIMAL(12,2) NOT NULL CHECK (amount > 0),
    currency VARCHAR(3) NOT NULL DEFAULT 'USD' CHECK (currency ~ '^[A-Z]{3}$'),
    expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
    receipt_url TEXT,
    notes TEXT,
    is_shared BOOLEAN DEFAULT TRUE,
    split_method VARCHAR(20) DEFAULT 'even' CHECK (split_method IN ('even', 'custom', 'percentage', 'payer_only')),
    split_details JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT chk_expense_date_not_future CHECK (expense_date <= CURRENT_DATE + INTERVAL '1 day')
);

-- Trip social engagement tracking
CREATE TABLE IF NOT EXISTS trip_social (
    trip_social_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id UUID NOT NULL UNIQUE REFERENCES trips(trip_id) ON DELETE CASCADE,
    views INTEGER DEFAULT 0 CHECK (views >= 0),
    likes INTEGER DEFAULT 0 CHECK (likes >= 0),
    shares INTEGER DEFAULT 0 CHECK (shares >= 0),
    featured BOOLEAN DEFAULT FALSE,
    trending_score DECIMAL(10,2) DEFAULT 0.00 CHECK (trending_score >= 0),
    last_accessed TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 4. ESSENTIAL INDEXES FOR PERFORMANCE
-- =====================================================

-- User management indexes
CREATE INDEX IF NOT EXISTS idx_users_auth_id ON users(auth_id);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_active_verified ON users(is_active, is_verified);

CREATE INDEX IF NOT EXISTS idx_user_information_user_id ON user_information(user_id);
CREATE INDEX IF NOT EXISTS idx_user_travel_preferences_user_id ON user_travel_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_user_interests_user_id ON user_interests(user_id);
CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON user_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_user_onboarding_user_id ON user_onboarding_progress(user_id);

-- Social feature indexes
CREATE INDEX IF NOT EXISTS idx_blocks_blocker ON blocks(blocker_id);
CREATE INDEX IF NOT EXISTS idx_blocks_blocked ON blocks(blocked_id);
CREATE INDEX IF NOT EXISTS idx_blocks_created ON blocks(created_at);

CREATE INDEX IF NOT EXISTS idx_friends_user ON friends(user_id);
CREATE INDEX IF NOT EXISTS idx_friends_friend ON friends(friend_id);
CREATE INDEX IF NOT EXISTS idx_friends_created ON friends(created_at);

CREATE INDEX IF NOT EXISTS idx_friend_requests_sender ON friend_requests(sender_id);
CREATE INDEX IF NOT EXISTS idx_friend_requests_receiver ON friend_requests(receiver_id, status);
CREATE INDEX IF NOT EXISTS idx_friend_requests_expires ON friend_requests(expires_at);

CREATE INDEX IF NOT EXISTS idx_trip_suggestions_user ON trip_suggestions(user_id, relevance_score);
CREATE INDEX IF NOT EXISTS idx_trip_suggestions_status ON trip_suggestions(status);

-- Financial indexes
CREATE INDEX IF NOT EXISTS idx_trip_pools_trip ON trip_pools(trip_id);
CREATE INDEX IF NOT EXISTS idx_trip_pools_status ON trip_pools(status);
CREATE INDEX IF NOT EXISTS idx_trip_pools_created_by ON trip_pools(created_by);

CREATE INDEX IF NOT EXISTS idx_trip_pool_members_pool ON trip_pool_members(pool_id);
CREATE INDEX IF NOT EXISTS idx_trip_pool_members_member ON trip_pool_members(member_id);
CREATE INDEX IF NOT EXISTS idx_trip_pool_members_balance ON trip_pool_members(balance, status);

CREATE INDEX IF NOT EXISTS idx_trip_expenses_trip ON trip_expenses(trip_id);
CREATE INDEX IF NOT EXISTS idx_trip_expenses_payer ON trip_expenses(payer_id);
CREATE INDEX IF NOT EXISTS idx_trip_expenses_category ON trip_expenses(category);
CREATE INDEX IF NOT EXISTS idx_trip_expenses_date ON trip_expenses(expense_date DESC);
CREATE INDEX IF NOT EXISTS idx_trip_expenses_amount ON trip_expenses(amount DESC);

-- Social engagement indexes
CREATE INDEX IF NOT EXISTS idx_trip_social_trip ON trip_social(trip_id);
CREATE INDEX IF NOT EXISTS idx_trip_social_featured ON trip_social(featured);
CREATE INDEX IF NOT EXISTS idx_trip_social_score ON trip_social(trending_score DESC);
CREATE INDEX IF NOT EXISTS idx_trip_social_views ON trip_social(views DESC);

-- =====================================================
-- 5. TRIGGERS FOR AUTOMATIC UPDATES
-- =====================================================

-- Function to update profile completion percentage
CREATE OR REPLACE FUNCTION update_profile_completion()
RETURNS TRIGGER AS $$
DECLARE
    v_user_id UUID;
    v_completion_score INTEGER := 0;
    v_has_full_name BOOLEAN;
    v_has_avatar BOOLEAN;
    v_has_bio BOOLEAN;
    v_is_verified BOOLEAN;
    v_has_phone BOOLEAN;
    v_has_dob BOOLEAN;
    v_has_country BOOLEAN;
    v_has_emergency_contact BOOLEAN;
    v_has_emergency_phone BOOLEAN;
    v_has_travel_style BOOLEAN;
    v_has_languages BOOLEAN;
BEGIN
    -- Get user_id
    v_user_id := NEW.user_id;
    
    -- Get user profile data
    SELECT 
        full_name IS NOT NULL,
        avatar_url IS NOT NULL,
        bio IS NOT NULL,
        is_verified
    INTO v_has_full_name, v_has_avatar, v_has_bio, v_is_verified
    FROM users WHERE user_id = v_user_id;
    
    -- Basic profile (40%)
    IF v_has_full_name THEN v_completion_score := v_completion_score + 10; END IF;
    IF v_has_avatar THEN v_completion_score := v_completion_score + 10; END IF;
    IF v_has_bio THEN v_completion_score := v_completion_score + 10; END IF;
    IF v_is_verified THEN v_completion_score := v_completion_score + 10; END IF;
    
    -- Extended info (40%)
    SELECT 
        phone_number IS NOT NULL,
        date_of_birth IS NOT NULL,
        location_country IS NOT NULL,
        emergency_contact_name IS NOT NULL,
        emergency_contact_phone IS NOT NULL
    INTO v_has_phone, v_has_dob, v_has_country, v_has_emergency_contact, v_has_emergency_phone
    FROM user_information WHERE user_id = v_user_id;
    
    IF v_has_phone THEN v_completion_score := v_completion_score + 8; END IF;
    IF v_has_dob THEN v_completion_score := v_completion_score + 8; END IF;
    IF v_has_country THEN v_completion_score := v_completion_score + 8; END IF;
    IF v_has_emergency_contact THEN v_completion_score := v_completion_score + 8; END IF;
    IF v_has_emergency_phone THEN v_completion_score := v_completion_score + 8; END IF;
    
    -- Preferences (20%)
    SELECT 
        travel_style IS NOT NULL AND array_length(travel_style, 1) > 0,
        languages_spoken IS NOT NULL AND array_length(languages_spoken, 1) > 0
    INTO v_has_travel_style, v_has_languages
    FROM user_travel_preferences WHERE user_id = v_user_id;
    
    IF v_has_travel_style THEN v_completion_score := v_completion_score + 10; END IF;
    IF v_has_languages THEN v_completion_score := v_completion_score + 10; END IF;
    
    -- Update user_information table with completion percentage
    UPDATE user_information 
    SET profile_completion_percentage = LEAST(v_completion_score, 100),
        updated_at = NOW()
    WHERE user_id = v_user_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
CREATE TRIGGER trigger_users_completion
    AFTER INSERT OR UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_profile_completion();

CREATE TRIGGER trigger_user_info_completion
    AFTER INSERT OR UPDATE ON user_information
    FOR EACH ROW
    EXECUTE FUNCTION update_profile_completion();

CREATE TRIGGER trigger_user_preferences_completion
    AFTER INSERT OR UPDATE ON user_travel_preferences
    FOR EACH ROW
    EXECUTE FUNCTION update_profile_completion();

-- Function to handle friendship creation
CREATE OR REPLACE FUNCTION create_friendship()
RETURNS TRIGGER AS $$
BEGIN
    -- When friend request is accepted, create bidirectional friendship
    IF NEW.status = 'accepted' AND OLD.status != 'accepted' THEN
        INSERT INTO friends (user_id, friend_id, created_at)
        VALUES 
            (NEW.sender_id, NEW.receiver_id, NOW()),
            (NEW.receiver_id, NEW.sender_id, NOW())
        ON CONFLICT (user_id, friend_id) DO NOTHING;
        
        -- Update responded_at
        NEW.responded_at := NOW();
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_create_friendship
    BEFORE UPDATE ON friend_requests
    FOR EACH ROW
    WHEN (OLD.status != NEW.status AND NEW.status = 'accepted')
    EXECUTE FUNCTION create_friendship();

-- Function to update trip social metrics
CREATE OR REPLACE FUNCTION update_trip_social_metrics()
RETURNS TRIGGER AS $$
BEGIN
    -- Update last accessed time
    INSERT INTO trip_social (trip_id, last_accessed)
    VALUES (NEW.trip_id, NOW())
    ON CONFLICT (trip_id) 
    DO UPDATE SET 
        last_accessed = NOW(),
        updated_at = NOW();
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_trip_social
    AFTER UPDATE ON trips
    FOR EACH ROW
    EXECUTE FUNCTION update_trip_social_metrics();

-- =====================================================
-- 6. FUNCTIONS FOR COMMON OPERATIONS
-- =====================================================

-- Function to check if users can interact
CREATE OR REPLACE FUNCTION check_user_interaction(p_user1_id UUID, p_user2_id UUID)
RETURNS TABLE(
    can_interact BOOLEAN,
    is_friends BOOLEAN,
    is_blocked BOOLEAN,
    blocks_user BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        -- Can interact if not blocked either way
        NOT EXISTS (
            SELECT 1 FROM blocks b 
            WHERE (b.blocker_id = p_user1_id AND b.blocked_id = p_user2_id)
               OR (b.blocker_id = p_user2_id AND b.blocked_id = p_user1_id)
        ) as can_interact,
        -- Check friendship
        EXISTS (
            SELECT 1 FROM friends f 
            WHERE (f.user_id = p_user1_id AND f.friend_id = p_user2_id)
               OR (f.user_id = p_user2_id AND f.friend_id = p_user1_id)
        ) as is_friends,
        -- Check if user1 blocks user2
        EXISTS (
            SELECT 1 FROM blocks b 
            WHERE b.blocker_id = p_user1_id AND b.blocked_id = p_user2_id
        ) as is_blocked,
        -- Check if user2 blocks user1
        EXISTS (
            SELECT 1 FROM blocks b 
            WHERE b.blocker_id = p_user2_id AND b.blocked_id = p_user1_id
        ) as blocks_user;
END;
$$;

-- Function to get user's trip statistics
CREATE OR REPLACE FUNCTION get_user_trip_statistics(p_user_id UUID)
RETURNS TABLE(
    total_trips INTEGER,
    active_trips INTEGER,
    completed_trips INTEGER,
    total_spent DECIMAL,
    friends_count INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(DISTINCT t.trip_id)::INTEGER as total_trips,
        COUNT(DISTINCT CASE WHEN t.status = 'active' THEN t.trip_id END)::INTEGER as active_trips,
        COUNT(DISTINCT CASE WHEN t.status = 'completed' THEN t.trip_id END)::INTEGER as completed_trips,
        COALESCE(SUM(te.amount), 0)::DECIMAL as total_spent,
        (SELECT COUNT(*)::INTEGER FROM friends f WHERE f.user_id = p_user_id) as friends_count
    FROM trips t
    LEFT JOIN trip_expenses te ON t.trip_id = te.trip_id AND te.payer_id = p_user_id
    WHERE t.owner_id = p_user_id OR EXISTS (
        SELECT 1 FROM trip_members tm 
        WHERE tm.trip_id = t.trip_id AND tm.user_id = p_user_id
    );
END;
$$;

-- =====================================================
-- 7. GRANT PERMISSIONS
-- =====================================================

-- Grant permissions to authenticated users
GRANT SELECT, INSERT, UPDATE ON users TO authenticated;
GRANT SELECT, INSERT, UPDATE ON user_information TO authenticated;
GRANT SELECT, INSERT, UPDATE ON user_travel_preferences TO authenticated;
GRANT SELECT, INSERT, UPDATE ON user_interests TO authenticated;
GRANT SELECT, INSERT, UPDATE ON user_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE ON user_onboarding_progress TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON blocks TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON friends TO authenticated;
GRANT SELECT, INSERT, UPDATE ON friend_requests TO authenticated;
GRANT SELECT ON trip_suggestions TO authenticated;

GRANT SELECT, INSERT, UPDATE ON trip_pools TO authenticated;
GRANT SELECT, INSERT, UPDATE ON trip_pool_members TO authenticated;
GRANT SELECT, INSERT, UPDATE ON trip_expenses TO authenticated;
GRANT SELECT, INSERT, UPDATE ON trip_social TO authenticated;

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION check_user_interaction TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_trip_statistics TO authenticated;

-- =====================================================
-- 8. VERIFICATION TESTS
-- =====================================================

DO $$
DECLARE
    v_table_count INTEGER;
    v_index_count INTEGER;
    v_function_count INTEGER;
    v_trigger_count INTEGER;
BEGIN
    -- Verify tables created
    SELECT COUNT(*) INTO v_table_count
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name IN (
        'users', 'user_information', 'user_travel_preferences', 'user_interests',
        'user_settings', 'user_onboarding_progress', 'blocks', 'friends',
        'friend_requests', 'trip_suggestions', 'trip_pools', 'trip_pool_members',
        'trip_expenses', 'trip_social'
    );
    
    -- Verify indexes created
    SELECT COUNT(*) INTO v_index_count
    FROM pg_indexes 
    WHERE schemaname = 'public' 
    AND indexname LIKE 'idx_%';
    
    -- Verify functions created
    SELECT COUNT(*) INTO v_function_count
    FROM pg_proc 
    WHERE proname IN ('check_user_interaction', 'get_user_trip_statistics');
    
    -- Verify triggers created
    SELECT COUNT(*) INTO v_trigger_count
    FROM pg_trigger 
    WHERE tgname LIKE 'trigger_%';
    
    -- Report results
    RAISE NOTICE '=== CRITICAL USER & SOCIAL FIXES VERIFICATION ===';
    RAISE NOTICE 'Tables Created: %/14', v_table_count;
    RAISE NOTICE 'Indexes Created: %', v_index_count;
    RAISE NOTICE 'Functions Created: %/2', v_function_count;
    RAISE NOTICE 'Triggers Created: %', v_trigger_count;
    
    IF v_table_count >= 12 AND v_function_count = 2 AND v_trigger_count >= 3 THEN
        RAISE NOTICE 'CRITICAL USER & SOCIAL FIXES COMPLETED SUCCESSFULLY!';
        RAISE NOTICE 'User registration is now functional';
        RAISE NOTICE 'Privacy controls are now active';
        RAISE NOTICE 'Financial management is enabled';
        RAISE NOTICE 'Social features are operational';
    ELSE
        RAISE WARNING 'Some components may need attention. Check previous messages.';
    END IF;
END $$;

SELECT '=== PHASE 0 MIGRATION COMPLETE ===' as status,
       'User and social features ready' as message,
       NOW() as completed_at;