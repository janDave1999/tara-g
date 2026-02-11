-- =====================================================
-- PHASE 1: ENHANCED SOCIAL FEATURES (CLEANED)
-- =====================================================
-- This migration adds comprehensive social networking capabilities:
-- 1. Communication system (messaging, notifications)
-- 2. Reviews and reputation system
-- 3. Advanced user features (profiles, verification)
-- 4. User content management (posts, photos, updates)
-- =====================================================

-- =====================================================
-- 1. COMMUNICATION SYSTEM
-- =====================================================

-- User notifications system
CREATE TABLE IF NOT EXISTS notifications (
    notification_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL 
        CHECK (type IN (
            'trip_invite', 'friend_request', 'friend_accepted', 'trip_update',
            'trip_reminder', 'payment_due', 'trip_comment', 'trip_like',
            'trip_nearby', 'new_follower', 'system_announcement'
        )),
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    data JSONB DEFAULT '{}',
    is_read BOOLEAN DEFAULT FALSE,
    is_email_sent BOOLEAN DEFAULT FALSE,
    is_push_sent BOOLEAN DEFAULT FALSE,
    priority VARCHAR(20) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    action_url TEXT,
    action_required BOOLEAN DEFAULT FALSE,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    read_at TIMESTAMPTZ,
    
    -- Constraints
    CONSTRAINT chk_notification_priority_logic CHECK (
        (priority = 'urgent' AND action_required = TRUE) OR
        priority IN ('low', 'normal', 'high')
    ),
    CONSTRAINT chk_notification_expires_future CHECK (
        expires_at IS NULL OR expires_at > created_at
    )
);

-- Direct messaging between users
CREATE TABLE IF NOT EXISTS messages (
    message_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    receiver_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    trip_id UUID REFERENCES trips(trip_id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    message_type VARCHAR(20) DEFAULT 'text' 
        CHECK (message_type IN ('text', 'image', 'file', 'location', 'trip_share', 'voice')),
    metadata JSONB DEFAULT '{}',
    is_read BOOLEAN DEFAULT FALSE,
    is_edited BOOLEAN DEFAULT FALSE,
    is_deleted BOOLEAN DEFAULT FALSE,
    reply_to UUID REFERENCES messages(message_id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    read_at TIMESTAMPTZ,
    edited_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ,
    
    -- Constraints
    CONSTRAINT chk_message_sender_receiver CHECK (sender_id != receiver_id),
    CONSTRAINT chk_message_content_length CHECK (
        message_type = 'text' AND LENGTH(TRIM(content)) > 0 OR
        message_type != 'text'
    )
);

-- Message attachments
CREATE TABLE IF NOT EXISTS message_attachments (
    attachment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL REFERENCES messages(message_id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255),
    file_size BIGINT CHECK (file_size > 0),
    mime_type VARCHAR(100),
    file_url TEXT NOT NULL,
    thumbnail_url TEXT,
    is_image BOOLEAN DEFAULT FALSE,
    is_video BOOLEAN DEFAULT FALSE,
    download_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT chk_attachment_mime_type CHECK (
        (is_image = TRUE AND mime_type LIKE 'image/%') OR
        (is_video = TRUE AND mime_type LIKE 'video/%') OR
        (is_image = FALSE AND is_video = FALSE)
    )
);

-- =====================================================
-- 2. REVIEWS & REPUTATION SYSTEM
-- =====================================================

-- User reviews and ratings
CREATE TABLE IF NOT EXISTS reviews (
    review_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reviewer_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    reviewee_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    trip_id UUID REFERENCES trips(trip_id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    title VARCHAR(200),
    content TEXT CHECK (content IS NULL OR LENGTH(TRIM(content)) >= 10),
    aspects JSONB DEFAULT '{}',
    is_visible BOOLEAN DEFAULT TRUE,
    is_verified BOOLEAN DEFAULT FALSE,
    helpful_count INTEGER DEFAULT 0 CHECK (helpful_count >= 0),
    reported_count INTEGER DEFAULT 0 CHECK (reported_count >= 0),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    UNIQUE(reviewer_id, reviewee_id, trip_id),
    CONSTRAINT chk_reviews_different_users CHECK (reviewer_id != reviewee_id)
);

-- Review responses and moderation
CREATE TABLE IF NOT EXISTS review_responses (
    response_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    review_id UUID NOT NULL REFERENCES reviews(review_id) ON DELETE CASCADE,
    responder_id UUID REFERENCES users(user_id),
    response_type VARCHAR(20) NOT NULL 
        CHECK (response_type IN ('rebuttal', 'clarification', 'moderation', 'edit_history')),
    content TEXT NOT NULL CHECK (LENGTH(TRIM(content)) >= 10),
    is_visible BOOLEAN DEFAULT TRUE,
    is_admin_response BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    UNIQUE(review_id, response_type),
    CONSTRAINT chk_response_type_moderator CHECK (
        response_type != 'moderation' OR is_admin_response = TRUE
    )
);

-- User reputation tracking (FIXED: typo in column name)
CREATE TABLE IF NOT EXISTS user_reputation (
    reputation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(user_id) ON DELETE CASCADE,
    overall_rating DECIMAL(3,2) DEFAULT 0.00 CHECK (overall_rating >= 0 AND overall_rating <= 5),
    review_count INTEGER DEFAULT 0 CHECK (review_count >= 0),
    trip_completion_rate DECIMAL(5,2) DEFAULT 0.00 CHECK (trip_completion_rate >= 0 AND trip_completion_rate <= 100),
    payment_reliability DECIMAL(5,2) DEFAULT 0.00 CHECK (payment_reliability >= 0 AND payment_reliability <= 100),
    response_rate DECIMAL(5,2) DEFAULT 0.00 CHECK (response_rate >= 0 AND response_rate <= 100),
    verification_status VARCHAR(20) DEFAULT 'none' 
        CHECK (verification_status IN ('none', 'email', 'phone', 'id_card', 'passport', 'enhanced')),
    trust_score DECIMAL(5,2) DEFAULT 0.00 CHECK (trust_score >= 0 AND trust_score <= 100),
    is_top_rated BOOLEAN DEFAULT FALSE,
    is_verified_traveler BOOLEAN DEFAULT FALSE,
    is_super_host BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 3. ADVANCED USER FEATURES
-- =====================================================

-- User verification system
CREATE TABLE IF NOT EXISTS user_verifications (
    verification_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    verification_type VARCHAR(30) NOT NULL 
        CHECK (verification_type IN ('email', 'phone', 'id_card', 'passport', 'address', 'social_media')),
    verification_data JSONB NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' 
        CHECK (status IN ('pending', 'submitted', 'processing', 'approved', 'rejected', 'expired')),
    submitted_at TIMESTAMPTZ,
    reviewed_by UUID REFERENCES users(user_id),
    reviewed_at TIMESTAMPTZ,
    rejection_reason TEXT,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    UNIQUE(user_id, verification_type),
    CONSTRAINT chk_verification_review_logic CHECK (
        (status IN ('approved', 'rejected') AND reviewed_at IS NOT NULL) OR
        status IN ('pending', 'submitted', 'processing', 'expired')
    )
);

-- User profiles and bio sections
CREATE TABLE IF NOT EXISTS user_profiles (
    profile_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(user_id) ON DELETE CASCADE,
    tagline VARCHAR(200),
    about_me TEXT,
    travel_experience VARCHAR(50) CHECK (travel_experience IN ('beginner', 'intermediate', 'advanced', 'expert')),
    favorite_destinations TEXT[] DEFAULT '{}',
    travel_highlights TEXT[] DEFAULT '{}',
    languages_spoken TEXT[] DEFAULT '{}',
    hobbies_interests TEXT[] DEFAULT '{}',
    social_links JSONB DEFAULT '{}',
    favorite_quote TEXT,
    website_url TEXT,
    linkedin_url TEXT,
    instagram_handle VARCHAR(100),
    twitter_handle VARCHAR(100),
    facebook_url TEXT,
    youtube_url TEXT,
    profile_views INTEGER DEFAULT 0 CHECK (profile_views >= 0),
    profile_visits INTEGER DEFAULT 0 CHECK (profile_visits >= 0),
    last_profile_visit TIMESTAMPTZ,
    is_profile_public BOOLEAN DEFAULT TRUE,
    show_travel_experience BOOLEAN DEFAULT TRUE,
    show_contact_info BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- URL format validation
    CONSTRAINT chk_website_url CHECK (
        website_url IS NULL OR 
        website_url ~ '^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&=]*)$'
    ),
    CONSTRAINT chk_linkedin_url CHECK (
        linkedin_url IS NULL OR 
        linkedin_url ~ '^https?:\/\/(www\.)?linkedin\.com\/.*$'
    )
);

-- User achievements and badges
CREATE TABLE IF NOT EXISTS user_achievements (
    achievement_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    achievement_type VARCHAR(50) NOT NULL 
        CHECK (achievement_type IN (
            'first_trip', 'ten_trips', 'hundred_trips', 'five_star_host',
            'early_adopter', 'verified_traveler', 'super_host',
            'community_helper', 'perfect_reviews', 'explorer'
        )),
    achievement_data JSONB DEFAULT '{}',
    earned_at TIMESTAMPTZ DEFAULT NOW(),
    is_displayed BOOLEAN DEFAULT TRUE,
    badge_url TEXT,
    badge_color VARCHAR(10) DEFAULT '#gold',
    
    -- Constraints
    UNIQUE(user_id, achievement_type)
);

-- User statistics and analytics
CREATE TABLE IF NOT EXISTS user_statistics (
    stats_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(user_id) ON DELETE CASCADE,
    total_trips_created INTEGER DEFAULT 0 CHECK (total_trips_created >= 0),
    total_trips_joined INTEGER DEFAULT 0 CHECK (total_trips_joined >= 0),
    total_trips_completed INTEGER DEFAULT 0 CHECK (total_trips_completed >= 0),
    total_miles_traveled DECIMAL(10,2) DEFAULT 0.00 CHECK (total_miles_traveled >= 0),
    total_countries_visited INTEGER DEFAULT 0 CHECK (total_countries_visited >= 0),
    total_spent DECIMAL(12,2) DEFAULT 0.00 CHECK (total_spent >= 0),
    total_earned DECIMAL(12,2) DEFAULT 0.00 CHECK (total_earned >= 0),
    average_trip_length DECIMAL(5,2) DEFAULT 0.00 CHECK (average_trip_length >= 0),
    favorite_trip_type VARCHAR(50),
    last_trip_date TIMESTAMPTZ,
    longest_trip_duration_days INTEGER DEFAULT 0 CHECK (longest_trip_duration_days >= 0),
    total_friends INTEGER DEFAULT 0 CHECK (total_friends >= 0),
    total_reviews_given INTEGER DEFAULT 0 CHECK (total_reviews_given >= 0),
    total_reviews_received INTEGER DEFAULT 0 CHECK (total_reviews_received >= 0),
    average_rating_given DECIMAL(3,2) DEFAULT 0.00 CHECK (average_rating_given >= 0 AND average_rating_given <= 5),
    average_rating_received DECIMAL(3,2) DEFAULT 0.00 CHECK (average_rating_received >= 0 AND average_rating_received <= 5),
    response_rate_percentage DECIMAL(5,2) DEFAULT 0.00 CHECK (response_rate_percentage >= 0 AND response_rate_percentage <= 100),
    account_age_days INTEGER DEFAULT 0 CHECK (account_age_days >= 0),
    login_streak INTEGER DEFAULT 0 CHECK (login_streak >= 0),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 4. USER CONTENT MANAGEMENT
-- =====================================================

-- User posts and updates
CREATE TABLE IF NOT EXISTS user_posts (
    post_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    trip_id UUID REFERENCES trips(trip_id),
    post_type VARCHAR(20) DEFAULT 'status_update' 
        CHECK (post_type IN ('status_update', 'trip_planning', 'trip_completed', 'photo', 'question', 'tip')),
    title VARCHAR(200),
    content TEXT NOT NULL CHECK (LENGTH(TRIM(content)) >= 1),
    hashtags TEXT[] DEFAULT '{}',
    mentions UUID[] DEFAULT '{}',
    is_public BOOLEAN DEFAULT TRUE,
    allow_comments BOOLEAN DEFAULT TRUE,
    allow_shares BOOLEAN DEFAULT TRUE,
    location_name VARCHAR(200),
    latitude DECIMAL(10,8),
    longitude DECIMAL(11,8),
    like_count INTEGER DEFAULT 0 CHECK (like_count >= 0),
    comment_count INTEGER DEFAULT 0 CHECK (comment_count >= 0),
    share_count INTEGER DEFAULT 0 CHECK (share_count >= 0),
    view_count INTEGER DEFAULT 0 CHECK (view_count >= 0),
    is_pinned BOOLEAN DEFAULT FALSE,
    is_featured BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT chk_post_coordinates CHECK (
        (latitude IS NULL AND longitude IS NULL) OR
        (latitude IS NOT NULL AND longitude IS NOT NULL AND 
         latitude >= -90 AND latitude <= 90 AND 
         longitude >= -180 AND longitude <= 180)
    )
);

-- Post interactions
CREATE TABLE IF NOT EXISTS post_interactions (
    interaction_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES user_posts(post_id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    interaction_type VARCHAR(20) NOT NULL 
        CHECK (interaction_type IN ('like', 'love', 'laugh', 'wow', 'sad', 'angry', 'share', 'save', 'bookmark')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    UNIQUE(post_id, user_id, interaction_type)
);

-- Post comments
CREATE TABLE IF NOT EXISTS post_comments (
    comment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES user_posts(post_id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    parent_comment_id UUID REFERENCES post_comments(comment_id),
    content TEXT NOT NULL CHECK (LENGTH(TRIM(content)) >= 1),
    like_count INTEGER DEFAULT 0 CHECK (like_count >= 0),
    is_edited BOOLEAN DEFAULT FALSE,
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User photo albums
CREATE TABLE IF NOT EXISTS user_photo_albums (
    album_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    album_name VARCHAR(200) NOT NULL,
    description TEXT,
    album_type VARCHAR(20) DEFAULT 'general' 
        CHECK (album_type IN ('general', 'trips', 'profile', 'screenshots', 'memories')),
    is_public BOOLEAN DEFAULT TRUE,
    cover_photo_url TEXT,
    photo_count INTEGER DEFAULT 0 CHECK (photo_count >= 0),
    total_size BIGINT DEFAULT 0 CHECK (total_size >= 0),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Individual photos
CREATE TABLE IF NOT EXISTS user_photos (
    photo_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    album_id UUID REFERENCES user_photo_albums(album_id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255),
    file_size BIGINT CHECK (file_size > 0),
    mime_type VARCHAR(100),
    photo_url TEXT NOT NULL,
    thumbnail_url TEXT,
    medium_url TEXT,
    large_url TEXT,
    description TEXT,
    caption TEXT,
    location_name VARCHAR(200),
    latitude DECIMAL(10,8),
    longitude DECIMAL(11,8),
    camera_make VARCHAR(50),
    camera_model VARCHAR(100),
    exif_data JSONB,
    is_public BOOLEAN DEFAULT TRUE,
    is_featured BOOLEAN DEFAULT FALSE,
    view_count INTEGER DEFAULT 0 CHECK (view_count >= 0),
    like_count INTEGER DEFAULT 0 CHECK (like_count >= 0),
    comment_count INTEGER DEFAULT 0 CHECK (comment_count >= 0),
    tags TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT chk_photo_coordinates CHECK (
        (latitude IS NULL AND longitude IS NULL) OR
        (latitude IS NOT NULL AND longitude IS NOT NULL AND 
         latitude >= -90 AND latitude <= 90 AND 
         longitude >= -180 AND longitude <= 180)
    )
);

-- =====================================================
-- 5. ESSENTIAL INDEXES FOR SOCIAL FEATURES
-- =====================================================

-- Communication indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, is_read, priority, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_expires ON notifications(expires_at) WHERE expires_at IS NOT NULL;

-- Fixed: conversation index with proper table name
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(LEAST(sender_id, receiver_id), GREATEST(sender_id, receiver_id), created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_receiver ON messages(receiver_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_trip ON messages(trip_id, created_at DESC) WHERE trip_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_messages_unread ON messages(receiver_id, is_read, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_message_attachments_message ON message_attachments(message_id);
CREATE INDEX IF NOT EXISTS idx_message_attachments_type ON message_attachments(is_image, is_video);

-- Review and reputation indexes
CREATE INDEX IF NOT EXISTS idx_reviews_reviewer ON reviews(reviewer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewee ON reviews(reviewee_id, rating DESC);
CREATE INDEX IF NOT EXISTS idx_reviews_trip ON reviews(trip_id, rating DESC) WHERE trip_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_reviews_rating ON reviews(rating DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reviews_visible ON reviews(is_visible, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_review_responses_review ON review_responses(review_id, response_type);
CREATE INDEX IF NOT EXISTS idx_review_responses_admin ON review_responses(is_admin_response);

CREATE INDEX IF NOT EXISTS idx_user_reputation_user ON user_reputation(user_id);
CREATE INDEX IF NOT EXISTS idx_user_reputation_rating ON user_reputation(overall_rating DESC, review_count DESC);
CREATE INDEX IF NOT EXISTS idx_user_reputation_trust ON user_reputation(trust_score DESC, verification_status);

-- User profile and verification indexes
CREATE INDEX IF NOT EXISTS idx_user_verifications_user ON user_verifications(user_id);
CREATE INDEX IF NOT EXISTS idx_user_verifications_status ON user_verifications(status, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_verifications_type ON user_verifications(verification_type);

CREATE INDEX IF NOT EXISTS idx_user_profiles_user ON user_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_public ON user_profiles(is_profile_public, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_profiles_views ON user_profiles(profile_visits DESC);

CREATE INDEX IF NOT EXISTS idx_user_achievements_user ON user_achievements(user_id, earned_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_achievements_displayed ON user_achievements(is_displayed, earned_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_statistics_user ON user_statistics(user_id);
CREATE INDEX IF NOT EXISTS idx_user_statistics_trips ON user_statistics(total_trips_completed DESC);
CREATE INDEX IF NOT EXISTS idx_user_statistics_rating ON user_statistics(average_rating_received DESC);

-- User content indexes
CREATE INDEX IF NOT EXISTS idx_user_posts_user ON user_posts(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_posts_public ON user_posts(is_public, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_posts_trip ON user_posts(trip_id, created_at DESC) WHERE trip_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_user_posts_type ON user_posts(post_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_posts_featured ON user_posts(is_featured, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_posts_likes ON user_posts(like_count DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_post_interactions_post ON post_interactions(post_id, interaction_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_post_interactions_user ON post_interactions(user_id, interaction_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_post_comments_post ON post_comments(post_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_post_comments_user ON post_comments(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_post_comments_thread ON post_comments(parent_comment_id, created_at ASC) WHERE parent_comment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_user_photo_albums_user ON user_photo_albums(user_id, album_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_photo_albums_public ON user_photo_albums(is_public, photo_count DESC);

CREATE INDEX IF NOT EXISTS idx_user_photos_album ON user_photos(album_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_photos_user ON user_photos(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_photos_public ON user_photos(is_public, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_photos_featured ON user_photos(is_featured, like_count DESC);
CREATE INDEX IF NOT EXISTS idx_user_photos_tags ON user_photos USING GIN(tags);

-- =====================================================
-- 6. TRIGGERS FOR AUTOMATIC UPDATES
-- =====================================================

-- Function to update user statistics
CREATE OR REPLACE FUNCTION update_user_statistics()
RETURNS TRIGGER AS $$
BEGIN
    -- Update review counts
    IF TG_TABLE_NAME = 'reviews' THEN
        IF TG_OP = 'INSERT' THEN
            UPDATE user_statistics SET
                total_reviews_received = total_reviews_received + 1,
                updated_at = NOW()
            WHERE user_id = NEW.reviewee_id;
        ELSIF TG_OP = 'DELETE' THEN
            UPDATE user_statistics SET
                total_reviews_received = GREATEST(total_reviews_received - 1, 0),
                updated_at = NOW()
            WHERE user_id = OLD.reviewee_id;
        END IF;
    END IF;
    
    -- Update photo counts
    IF TG_TABLE_NAME = 'user_photos' THEN
        UPDATE user_photo_albums SET
            photo_count = (
                SELECT COUNT(*) FROM user_photos 
                WHERE album_id = COALESCE(NEW.album_id, OLD.album_id)
            ),
            updated_at = NOW()
        WHERE album_id = COALESCE(NEW.album_id, OLD.album_id);
    END IF;
    
    -- Update post interaction counts
    IF TG_TABLE_NAME = 'post_interactions' THEN
        IF TG_OP = 'INSERT' THEN
            UPDATE user_posts SET
                like_count = CASE WHEN NEW.interaction_type IN ('like', 'love', 'laugh', 'wow', 'sad', 'angry') THEN like_count + 1 ELSE like_count END,
                share_count = CASE WHEN NEW.interaction_type = 'share' THEN share_count + 1 ELSE share_count END,
                updated_at = NOW()
            WHERE post_id = NEW.post_id;
        ELSIF TG_OP = 'DELETE' THEN
            UPDATE user_posts SET
                like_count = CASE WHEN OLD.interaction_type IN ('like', 'love', 'laugh', 'wow', 'sad', 'angry') THEN GREATEST(like_count - 1, 0) ELSE like_count END,
                share_count = CASE WHEN OLD.interaction_type = 'share' THEN GREATEST(share_count - 1, 0) ELSE share_count END,
                updated_at = NOW()
            WHERE post_id = OLD.post_id;
        END IF;
    END IF;
    
    -- Update comment counts
    IF TG_TABLE_NAME = 'post_comments' THEN
        UPDATE user_posts SET
            comment_count = (
                SELECT COUNT(*) FROM post_comments pc 
                WHERE pc.post_id = COALESCE(NEW.post_id, OLD.post_id) 
                AND pc.is_deleted = FALSE
            ),
            updated_at = NOW()
        WHERE post_id = COALESCE(NEW.post_id, OLD.post_id);
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
CREATE TRIGGER trigger_update_user_stats_reviews
    AFTER INSERT OR DELETE ON reviews
    FOR EACH ROW
    EXECUTE FUNCTION update_user_statistics();

CREATE TRIGGER trigger_update_user_stats_photos
    AFTER INSERT OR DELETE ON user_photos
    FOR EACH ROW
    EXECUTE FUNCTION update_user_statistics();

CREATE TRIGGER trigger_update_user_stats_interactions
    AFTER INSERT OR DELETE ON post_interactions
    FOR EACH ROW
    EXECUTE FUNCTION update_user_statistics();

CREATE TRIGGER trigger_update_user_stats_comments
    AFTER INSERT OR UPDATE OR DELETE ON post_comments
    FOR EACH ROW
    EXECUTE FUNCTION update_user_statistics();

-- Function to update reputation when reviews are created/updated
CREATE OR REPLACE FUNCTION update_user_reputation()
RETURNS TRIGGER AS $$
DECLARE
    v_avg_rating DECIMAL(3,2);
    v_review_count INTEGER;
BEGIN
    -- Calculate new average rating for reviewee
    SELECT AVG(rating), COUNT(*) INTO v_avg_rating, v_review_count
    FROM reviews
    WHERE reviewee_id = COALESCE(NEW.reviewee_id, OLD.reviewee_id)
    AND is_visible = TRUE;
    
    -- Update reputation
    UPDATE user_reputation SET
        overall_rating = COALESCE(v_avg_rating, 0),
        review_count = COALESCE(v_review_count, 0),
        updated_at = NOW()
    WHERE user_id = COALESCE(NEW.reviewee_id, OLD.reviewee_id);
    
    -- Create reputation record if it doesn't exist
    IF NOT FOUND THEN
        INSERT INTO user_reputation (user_id, overall_rating, review_count)
        VALUES (COALESCE(NEW.reviewee_id, OLD.reviewee_id), COALESCE(v_avg_rating, 0), COALESCE(v_review_count, 0))
        ON CONFLICT (user_id) DO NOTHING;
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_reputation
    AFTER INSERT OR UPDATE OR DELETE ON reviews
    FOR EACH ROW
    EXECUTE FUNCTION update_user_reputation();

-- =====================================================
-- 7. FUNCTIONS FOR SOCIAL OPERATIONS
-- =====================================================

-- Function to get user's social feed
CREATE OR REPLACE FUNCTION get_user_social_feed(
    p_user_id UUID, 
    p_limit INTEGER DEFAULT 20, 
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE(
    post_id UUID,
    user_id UUID,
    username VARCHAR,
    avatar_url TEXT,
    post_type VARCHAR,
    title VARCHAR,
    content TEXT,
    hashtags TEXT[],
    like_count INTEGER,
    comment_count INTEGER,
    share_count INTEGER,
    created_at TIMESTAMPTZ,
    user_interaction_type VARCHAR
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        up.post_id,
        up.user_id,
        u.username,
        u.avatar_url,
        up.post_type,
        up.title,
        up.content,
        up.hashtags,
        up.like_count,
        up.comment_count,
        up.share_count,
        up.created_at,
        pi.interaction_type::VARCHAR as user_interaction_type
    FROM user_posts up
    INNER JOIN users u ON up.user_id = u.user_id
    LEFT JOIN post_interactions pi ON up.post_id = pi.post_id AND pi.user_id = p_user_id
    WHERE up.is_public = TRUE
    AND (
        up.user_id = p_user_id
        OR up.user_id IN (
            SELECT friend_id FROM friends WHERE user_id = p_user_id
            UNION
            SELECT user_id FROM friends WHERE friend_id = p_user_id
        )
    )
    ORDER BY up.created_at DESC
    LIMIT p_limit OFFSET p_offset;
END;
$$;

-- Function to check if user can view/interact with content
CREATE OR REPLACE FUNCTION check_content_access(
    p_user_id UUID, 
    p_content_type VARCHAR, 
    p_content_id UUID
)
RETURNS TABLE(
    can_view BOOLEAN,
    can_interact BOOLEAN,
    access_reason VARCHAR
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_is_blocked BOOLEAN;
    v_is_friends BOOLEAN;
    v_content_owner_id UUID;
    v_content_visibility BOOLEAN;
BEGIN
    -- Get content owner and visibility based on content type
    CASE p_content_type
        WHEN 'post' THEN
            SELECT user_id, is_public INTO v_content_owner_id, v_content_visibility
            FROM user_posts WHERE post_id = p_content_id;
        WHEN 'album' THEN
            SELECT user_id, is_public INTO v_content_owner_id, v_content_visibility
            FROM user_photo_albums WHERE album_id = p_content_id;
        ELSE
            v_content_owner_id := NULL;
            v_content_visibility := FALSE;
    END CASE;
    
    -- Check if user is blocked by content owner
    SELECT EXISTS(
        SELECT 1 FROM blocks b 
        WHERE b.blocker_id = v_content_owner_id AND b.blocked_id = p_user_id
    ) INTO v_is_blocked;
    
    -- Check friendship
    SELECT EXISTS(
        SELECT 1 FROM friends f 
        WHERE (f.user_id = p_user_id AND f.friend_id = v_content_owner_id)
           OR (f.user_id = v_content_owner_id AND f.friend_id = p_user_id)
    ) INTO v_is_friends;
    
    -- Determine access
    IF v_is_blocked THEN
        RETURN QUERY SELECT FALSE, FALSE, 'Content blocked'::VARCHAR;
    ELSIF v_content_owner_id = p_user_id THEN
        RETURN QUERY SELECT TRUE, TRUE, 'Content owner'::VARCHAR;
    ELSIF v_content_visibility THEN
        RETURN QUERY SELECT TRUE, TRUE, 'Public content'::VARCHAR;
    ELSIF v_is_friends THEN
        RETURN QUERY SELECT TRUE, TRUE, 'Friends content'::VARCHAR;
    ELSE
        RETURN QUERY SELECT FALSE, FALSE, 'Private content'::VARCHAR;
    END IF;
END;
$$;

-- =====================================================
-- 8. GRANT PERMISSIONS
-- =====================================================

-- Communication permissions
GRANT SELECT, INSERT, UPDATE ON notifications TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON messages TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON message_attachments TO authenticated;

-- Review and reputation permissions
GRANT SELECT, INSERT, UPDATE ON reviews TO authenticated;
GRANT SELECT, INSERT, UPDATE ON review_responses TO authenticated;
GRANT SELECT, UPDATE ON user_reputation TO authenticated;
GRANT SELECT, INSERT ON user_verifications TO authenticated;

-- Social content permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON user_posts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON post_interactions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON post_comments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON user_photo_albums TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON user_photos TO authenticated;

-- Profile and achievements permissions
GRANT SELECT, INSERT, UPDATE ON user_profiles TO authenticated;
GRANT SELECT, INSERT ON user_achievements TO authenticated;
GRANT SELECT ON user_statistics TO authenticated;

-- Function permissions
GRANT EXECUTE ON FUNCTION get_user_social_feed TO authenticated;
GRANT EXECUTE ON FUNCTION check_content_access TO authenticated;

-- =====================================================
-- 9. VERIFICATION TESTS
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
        'notifications', 'messages', 'message_attachments', 'reviews', 'review_responses',
        'user_reputation', 'user_verifications', 'user_profiles', 'user_achievements',
        'user_statistics', 'user_posts', 'post_interactions', 'post_comments',
        'user_photo_albums', 'user_photos'
    );
    
    -- Verify indexes created
    SELECT COUNT(*) INTO v_index_count
    FROM pg_indexes 
    WHERE schemaname = 'public' 
    AND indexname LIKE 'idx_%';
    
    -- Verify functions created
    SELECT COUNT(*) INTO v_function_count
    FROM pg_proc 
    WHERE proname IN ('get_user_social_feed', 'check_content_access');
    
    -- Verify triggers created
    SELECT COUNT(*) INTO v_trigger_count
    FROM pg_trigger 
    WHERE tgname LIKE 'trigger_%';
    
    -- Report results
    RAISE NOTICE '=== ENHANCED SOCIAL FEATURES VERIFICATION ===';
    RAISE NOTICE 'Tables Created: %/15', v_table_count;
    RAISE NOTICE 'Indexes Created: %', v_index_count;
    RAISE NOTICE 'Functions Created: %/2', v_function_count;
    RAISE NOTICE 'Triggers Created: %', v_trigger_count;
    
    IF v_table_count >= 12 AND v_function_count = 2 AND v_trigger_count >= 4 THEN
        RAISE NOTICE 'ENHANCED SOCIAL FEATURES COMPLETED SUCCESSFULLY!';
        RAISE NOTICE 'Communication system is fully operational';
        RAISE NOTICE 'Reviews and reputation system active';
        RAISE NOTICE 'User profiles and verification ready';
        RAISE NOTICE 'Social content management enabled';
        RAISE NOTICE 'Analytics and statistics tracking live';
    ELSE
        RAISE WARNING 'Some enhanced features may need attention. Check previous messages.';
    END IF;
END $$;

SELECT '=== PHASE 1 MIGRATION COMPLETE ===' as status,
       'Enhanced social features ready' as message,
       NOW() as completed_at;