-- =====================================================
-- DB TRIGGER ACCEPTANCE TESTS — Feed Notifications
-- =====================================================
-- Run this script in the Supabase SQL editor AFTER
-- migration 065_feed_notifications.sql has been applied.
--
-- Each test is wrapped in a transaction that is ROLLED BACK,
-- so no permanent data is created.
--
-- Results are returned via RAISE NOTICE messages.
-- A passing test prints: ✅ PASS — <test name>
-- A failing test prints: ❌ FAIL — <test name>: <detail>
-- =====================================================

DO $$
DECLARE
  -- ── Shared test fixtures ────────────────────────────────────────────────
  v_auth_a   UUID := gen_random_uuid();
  v_auth_b   UUID := gen_random_uuid();
  v_user_a   UUID := gen_random_uuid();  -- internal user_id of User A (actor)
  v_user_b   UUID := gen_random_uuid();  -- internal user_id of User B (recipient)
  v_post_id  UUID := gen_random_uuid();
  v_c1_id    UUID := gen_random_uuid();  -- top-level comment by A
  v_c2_id    UUID := gen_random_uuid();  -- reply by A to B's comment
  v_b_com_id UUID := gen_random_uuid();  -- comment by B (to test reply notification)

  v_count    INT;
  v_type     TEXT;
  v_is_read  BOOLEAN;
BEGIN

  -- ── Seed test users ──────────────────────────────────────────────────────
  INSERT INTO users (user_id, auth_id, username, full_name, email, avatar_url)
  VALUES
    (v_user_a, v_auth_a, 'test_user_a', 'User Alpha', 'a@test.local', NULL),
    (v_user_b, v_auth_b, 'test_user_b', 'User Beta',  'b@test.local', NULL);

  -- ── Seed test post (owned by B) ──────────────────────────────────────────
  INSERT INTO user_posts (post_id, user_id, content, is_published)
  VALUES (v_post_id, v_user_b, 'A great test post about Batanes.', TRUE);


  -- ════════════════════════════════════════════════════════════════════════
  -- US-01 AC1 — A likes B's post → B gets post_like notification
  -- ════════════════════════════════════════════════════════════════════════
  INSERT INTO post_interactions (post_id, user_id, interaction_type)
  VALUES (v_post_id, v_user_a, 'like');

  SELECT COUNT(*) INTO v_count
  FROM notifications
  WHERE user_id = v_user_b
    AND type    = 'post_like'
    AND data ->> 'username' = 'test_user_a';

  IF v_count = 1 THEN
    RAISE NOTICE '✅ PASS — US-01 AC1: A likes B post → B gets post_like notification';
  ELSE
    RAISE NOTICE '❌ FAIL — US-01 AC1: expected 1 notification, got %', v_count;
  END IF;


  -- ════════════════════════════════════════════════════════════════════════
  -- US-01 AC4 — A likes own post → no notification
  -- ════════════════════════════════════════════════════════════════════════
  DECLARE
    v_self_post_id UUID := gen_random_uuid();
  BEGIN
    INSERT INTO user_posts (post_id, user_id, content, is_published)
    VALUES (v_self_post_id, v_user_a, 'My own post.', TRUE);

    INSERT INTO post_interactions (post_id, user_id, interaction_type)
    VALUES (v_self_post_id, v_user_a, 'like');

    SELECT COUNT(*) INTO v_count
    FROM notifications
    WHERE user_id = v_user_a
      AND type    = 'post_like';

    IF v_count = 0 THEN
      RAISE NOTICE '✅ PASS — US-01 AC4: A likes own post → no notification';
    ELSE
      RAISE NOTICE '❌ FAIL — US-01 AC4: expected 0 notifications, got %', v_count;
    END IF;
  END;


  -- ════════════════════════════════════════════════════════════════════════
  -- US-01 AC3 — Dedup: A likes → unlike → re-likes → still only 1 notification
  -- ════════════════════════════════════════════════════════════════════════

  -- Unlike (toggle_post_like deletes the row)
  DELETE FROM post_interactions
  WHERE post_id = v_post_id AND user_id = v_user_a AND interaction_type = 'like';

  -- Re-like (insert again)
  INSERT INTO post_interactions (post_id, user_id, interaction_type)
  VALUES (v_post_id, v_user_a, 'like');

  SELECT COUNT(*) INTO v_count
  FROM notifications
  WHERE user_id          = v_user_b
    AND type             = 'post_like'
    AND is_read          = FALSE
    AND data ->> 'username' = 'test_user_a';

  IF v_count = 1 THEN
    RAISE NOTICE '✅ PASS — US-01 AC3: like → unlike → re-like → exactly 1 notification (dedup)';
  ELSE
    RAISE NOTICE '❌ FAIL — US-01 AC3: expected 1 notification after dedup, got %', v_count;
  END IF;


  -- ════════════════════════════════════════════════════════════════════════
  -- US-01 AC3b — After B reads the notification, a NEW like creates a new one
  -- ════════════════════════════════════════════════════════════════════════

  -- Mark existing notification as read
  UPDATE notifications
  SET is_read = TRUE, read_at = NOW()
  WHERE user_id = v_user_b AND type = 'post_like';

  -- Unlike and re-like
  DELETE FROM post_interactions
  WHERE post_id = v_post_id AND user_id = v_user_a AND interaction_type = 'like';
  INSERT INTO post_interactions (post_id, user_id, interaction_type)
  VALUES (v_post_id, v_user_a, 'like');

  SELECT COUNT(*) INTO v_count
  FROM notifications
  WHERE user_id = v_user_b AND type = 'post_like';

  IF v_count = 2 THEN
    RAISE NOTICE '✅ PASS — US-01 AC3b: after notification read, re-like creates a new notification';
  ELSE
    RAISE NOTICE '❌ FAIL — US-01 AC3b: expected 2 total notifications, got %', v_count;
  END IF;


  -- ════════════════════════════════════════════════════════════════════════
  -- US-02 AC1 — A comments on B's post → B gets post_comment notification
  -- ════════════════════════════════════════════════════════════════════════
  INSERT INTO post_comments (comment_id, post_id, user_id, content, parent_comment_id)
  VALUES (v_c1_id, v_post_id, v_user_a, 'Great post!', NULL);

  SELECT COUNT(*) INTO v_count
  FROM notifications
  WHERE user_id          = v_user_b
    AND type             = 'post_comment'
    AND data ->> 'comment_id' = v_c1_id::TEXT;

  IF v_count = 1 THEN
    RAISE NOTICE '✅ PASS — US-02 AC1: A comments on B post → B gets post_comment notification';
  ELSE
    RAISE NOTICE '❌ FAIL — US-02 AC1: expected 1 notification, got %', v_count;
  END IF;


  -- ════════════════════════════════════════════════════════════════════════
  -- US-02 AC4 — A comments on own post → no notification
  -- ════════════════════════════════════════════════════════════════════════
  DECLARE
    v_self_post_id2 UUID := gen_random_uuid();
    v_self_com_id   UUID := gen_random_uuid();
  BEGIN
    INSERT INTO user_posts (post_id, user_id, content, is_published)
    VALUES (v_self_post_id2, v_user_a, 'Another post by A.', TRUE);

    INSERT INTO post_comments (comment_id, post_id, user_id, content, parent_comment_id)
    VALUES (v_self_com_id, v_self_post_id2, v_user_a, 'Self comment', NULL);

    SELECT COUNT(*) INTO v_count
    FROM notifications
    WHERE user_id = v_user_a AND type = 'post_comment';

    IF v_count = 0 THEN
      RAISE NOTICE '✅ PASS — US-02 AC4: A comments on own post → no notification';
    ELSE
      RAISE NOTICE '❌ FAIL — US-02 AC4: expected 0 notifications, got %', v_count;
    END IF;
  END;


  -- ════════════════════════════════════════════════════════════════════════
  -- US-03 AC1 — A replies to B's comment → B gets comment_reply notification
  -- ════════════════════════════════════════════════════════════════════════

  -- First, B posts a comment on the post
  INSERT INTO post_comments (comment_id, post_id, user_id, content, parent_comment_id)
  VALUES (v_b_com_id, v_post_id, v_user_b, 'Thanks for the like!', NULL);

  -- A replies to B's comment
  INSERT INTO post_comments (comment_id, post_id, user_id, content, parent_comment_id)
  VALUES (v_c2_id, v_post_id, v_user_a, 'You are welcome!', v_b_com_id);

  SELECT COUNT(*) INTO v_count
  FROM notifications
  WHERE user_id          = v_user_b
    AND type             = 'comment_reply'
    AND data ->> 'comment_id' = v_c2_id::TEXT;

  IF v_count = 1 THEN
    RAISE NOTICE '✅ PASS — US-03 AC1: A replies to B comment → B gets comment_reply notification';
  ELSE
    RAISE NOTICE '❌ FAIL — US-03 AC1: expected 1 notification, got %', v_count;
  END IF;


  -- ════════════════════════════════════════════════════════════════════════
  -- US-03 AC4 — A replies to own comment → no notification
  -- ════════════════════════════════════════════════════════════════════════
  DECLARE
    v_a_com_id    UUID := gen_random_uuid();
    v_a_reply_id  UUID := gen_random_uuid();
  BEGIN
    INSERT INTO post_comments (comment_id, post_id, user_id, content, parent_comment_id)
    VALUES (v_a_com_id, v_post_id, v_user_a, 'A comment by A', NULL);

    INSERT INTO post_comments (comment_id, post_id, user_id, content, parent_comment_id)
    VALUES (v_a_reply_id, v_post_id, v_user_a, 'A replying to self', v_a_com_id);

    SELECT COUNT(*) INTO v_count
    FROM notifications
    WHERE user_id = v_user_a AND type = 'comment_reply';

    IF v_count = 0 THEN
      RAISE NOTICE '✅ PASS — US-03 AC4: A replies to own comment → no notification';
    ELSE
      RAISE NOTICE '❌ FAIL — US-03 AC4: expected 0 notifications, got %', v_count;
    END IF;
  END;


  -- ════════════════════════════════════════════════════════════════════════
  -- US-04 AC3 — delete_notification_by_ref removes correct notification
  -- ════════════════════════════════════════════════════════════════════════
  DECLARE
    v_sender_id UUID := gen_random_uuid();
    v_recvr_id  UUID := gen_random_uuid();
    v_auth_s    UUID := gen_random_uuid();
    v_auth_r    UUID := gen_random_uuid();
    v_notif_id  UUID;
  BEGIN
    -- Create minimal users
    INSERT INTO users (user_id, auth_id, username, full_name, email)
    VALUES
      (v_sender_id, v_auth_s, 'sender_test', 'Sender',   's@test.local'),
      (v_recvr_id,  v_auth_r, 'recvr_test',  'Receiver', 'r@test.local');

    -- Manually create a friend_request notification
    INSERT INTO notifications (user_id, type, title, message, data, is_read)
    VALUES (
      v_recvr_id, 'friend_request', 'New Request', 'sent you a request',
      jsonb_build_object('sender_user_id', v_sender_id::TEXT, 'username', 'sender_test'),
      FALSE
    ) RETURNING notification_id INTO v_notif_id;

    -- Call the cleanup RPC
    PERFORM delete_notification_by_ref(
      v_recvr_id, 'friend_request', 'sender_user_id', v_sender_id::TEXT
    );

    SELECT COUNT(*) INTO v_count
    FROM notifications WHERE notification_id = v_notif_id;

    IF v_count = 0 THEN
      RAISE NOTICE '✅ PASS — US-04 AC1/2: delete_notification_by_ref removes unread friend_request';
    ELSE
      RAISE NOTICE '❌ FAIL — US-04 AC1/2: notification was not deleted';
    END IF;
  END;


  -- ════════════════════════════════════════════════════════════════════════
  -- US-04 AC2 — Already-read notifications are NOT deleted
  -- ════════════════════════════════════════════════════════════════════════
  DECLARE
    v_sender_id2 UUID := gen_random_uuid();
    v_recvr_id2  UUID := gen_random_uuid();
    v_auth_s2    UUID := gen_random_uuid();
    v_auth_r2    UUID := gen_random_uuid();
    v_notif_id2  UUID;
  BEGIN
    INSERT INTO users (user_id, auth_id, username, full_name, email)
    VALUES
      (v_sender_id2, v_auth_s2, 'sender_test2', 'Sender2',   's2@test.local'),
      (v_recvr_id2,  v_auth_r2, 'recvr_test2',  'Receiver2', 'r2@test.local');

    -- Create an ALREADY-READ friend_request notification
    INSERT INTO notifications (user_id, type, title, message, data, is_read, read_at)
    VALUES (
      v_recvr_id2, 'friend_request', 'Old Request', 'sent you a request',
      jsonb_build_object('sender_user_id', v_sender_id2::TEXT, 'username', 'sender_test2'),
      TRUE, NOW()
    ) RETURNING notification_id INTO v_notif_id2;

    PERFORM delete_notification_by_ref(
      v_recvr_id2, 'friend_request', 'sender_user_id', v_sender_id2::TEXT
    );

    SELECT COUNT(*) INTO v_count
    FROM notifications WHERE notification_id = v_notif_id2;

    IF v_count = 1 THEN
      RAISE NOTICE '✅ PASS — US-04 AC2: already-read notification is preserved (stays as history)';
    ELSE
      RAISE NOTICE '❌ FAIL — US-04 AC2: read notification was incorrectly deleted';
    END IF;
  END;


  -- ════════════════════════════════════════════════════════════════════════
  -- US-06 — Notification message is quoted preview of comment
  -- ════════════════════════════════════════════════════════════════════════
  DECLARE
    v_long_comment_id UUID := gen_random_uuid();
    v_msg             TEXT;
    v_long_text       TEXT := REPEAT('x', 100); -- 100 chars
  BEGIN
    INSERT INTO post_comments (comment_id, post_id, user_id, content, parent_comment_id)
    VALUES (v_long_comment_id, v_post_id, v_user_a, v_long_text, NULL);

    SELECT message INTO v_msg
    FROM notifications
    WHERE user_id = v_user_b
      AND type    = 'post_comment'
      AND data ->> 'comment_id' = v_long_comment_id::TEXT;

    IF v_msg = '"' || REPEAT('x', 80) || '…"' THEN
      RAISE NOTICE '✅ PASS — US-06: comment preview is quoted, capped at 80 chars + ellipsis';
    ELSE
      RAISE NOTICE '❌ FAIL — US-06: unexpected message format: %', v_msg;
    END IF;
  END;


  -- ════════════════════════════════════════════════════════════════════════
  -- Rollback all test data
  -- ════════════════════════════════════════════════════════════════════════
  RAISE NOTICE '--- All tests completed. Rolling back test data. ---';
  RAISE EXCEPTION 'ROLLBACK_TESTS'; -- triggers the EXCEPTION block below

EXCEPTION
  WHEN OTHERS THEN
    IF SQLERRM = 'ROLLBACK_TESTS' THEN
      RAISE NOTICE 'Test data rolled back successfully.';
    ELSE
      RAISE NOTICE '❌ UNEXPECTED ERROR: %', SQLERRM;
    END IF;
END;
$$;
