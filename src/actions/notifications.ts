import { z } from "astro:content";
import { supabaseAdmin, getSupabaseClient } from "@/lib/supabase";
import { defineAction } from "astro:actions";

async function getInternalUserId(authId: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('user_id')
    .eq('auth_id', authId)
    .single();

  if (error || !data?.user_id) {
    console.error(`[NOTIF:getInternalUserId] lookup failed for auth_id=${authId}`, error ?? 'no row');
    return null;
  }

  return data.user_id;
}

export type NotificationType = 
  | 'trip_invite'
  | 'trip_join_request'
  | 'trip_join_approved'
  | 'trip_join_declined'
  | 'trip_invite_accepted'
  | 'trip_invite_declined'
  | 'trip_member_added'
  | 'trip_member_removed'
  | 'trip_update'
  | 'trip_reminder'
  | 'friend_request'
  | 'friend_accepted'
  | 'system_announcement';

export interface Notification {
  notification_id: string;
  type: NotificationType;
  title: string;
  message: string;
  data: Record<string, any>;
  is_read: boolean;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  action_url: string | null;
  created_at: string;
  read_at: string | null;
}

export const notificationActions = {
  getNotifications: defineAction({
    input: z.object({
      limit: z.number().min(1).max(50).default(20),
      offset: z.number().min(0).default(0),
      unreadOnly: z.boolean().default(false),
    }),
    handler: async (input, context) => {
      const userId = context.locals.user_id;
      if (!userId) {
        return { notifications: [], unreadCount: 0 };
      }

      const internalUserId = await getInternalUserId(userId);
      if (!internalUserId) {
        return { notifications: [], unreadCount: 0 };
      }

      const { data: notifications, error } = await supabaseAdmin.rpc('get_user_notifications', {
        p_user_id: internalUserId,
        p_limit: input.limit,
        p_offset: input.offset,
        p_unread_only: input.unreadOnly,
      });

      if (error) {
        console.error('Error fetching notifications:', error);
        return { notifications: [], unreadCount: 0 };
      }

      const { data: unreadData } = await supabaseAdmin.rpc('get_unread_count', {
        p_user_id: internalUserId,
      });

      return {
        notifications: notifications || [],
        unreadCount: unreadData || 0,
      };
    },
  }),

  getUnreadCount: defineAction({
    input: z.object({}),
    handler: async (_, context) => {
      const userId = context.locals.user_id;
      if (!userId) {
        return { count: 0 };
      }

      const internalUserId = await getInternalUserId(userId);
      if (!internalUserId) {
        return { count: 0 };
      }

      const { data, error } = await supabaseAdmin.rpc('get_unread_count', {
        p_user_id: internalUserId,
      });

      if (error) {
        console.error('Error fetching unread count:', error);
        return { count: 0 };
      }

      return { count: data || 0 };
    },
  }),

  markAsRead: defineAction({
    input: z.object({
      notificationId: z.string().uuid(),
    }),
    handler: async (input, context) => {
      const userId = context.locals.user_id;
      if (!userId) {
        return { success: false, message: 'Unauthorized' };
      }

      const internalUserId = await getInternalUserId(userId);
      if (!internalUserId) {
        return { success: false, message: 'User not found' };
      }

      const { data, error } = await supabaseAdmin.rpc('mark_notification_read', {
        p_notification_id: input.notificationId,
        p_user_id: internalUserId,
      });

      if (error) {
        console.error('Error marking notification as read:', error);
        return { success: false, message: error.message };
      }

      return { success: true };
    },
  }),

  markAllAsRead: defineAction({
    input: z.object({}),
    handler: async (_, context) => {
      const userId = context.locals.user_id;
      if (!userId) {
        return { success: false, message: 'Unauthorized' };
      }

      const internalUserId = await getInternalUserId(userId);
      if (!internalUserId) {
        return { success: false, message: 'User not found' };
      }

      const { data, error } = await supabaseAdmin.rpc('mark_all_notifications_read', {
        p_user_id: internalUserId,
      });

      if (error) {
        console.error('Error marking all notifications as read:', error);
        return { success: false, message: error.message };
      }

      return { success: true, count: data || 0 };
    },
  }),

  deleteNotification: defineAction({
    input: z.object({
      notificationId: z.string().uuid(),
    }),
    handler: async (input, context) => {
      const userId = context.locals.user_id;
      if (!userId) {
        return { success: false, message: 'Unauthorized' };
      }

      const internalUserId = await getInternalUserId(userId);
      if (!internalUserId) {
        return { success: false, message: 'User not found' };
      }

      const { error } = await supabaseAdmin.rpc('delete_notification', {
        p_notification_id: input.notificationId,
        p_user_id: internalUserId,
      });

      if (error) {
        console.error('Error deleting notification:', error);
        return { success: false, message: error.message };
      }

      return { success: true };
    },
  }),

  // Internal: Create notification (used by other actions)
  createNotification: defineAction({
    input: z.object({
      userId: z.string().uuid(),
      type: z.enum([
        'trip_invite', 'trip_join_request', 'trip_join_approved', 'trip_join_declined',
        'trip_invite_accepted', 'trip_invite_declined', 'trip_member_added', 
        'trip_member_removed', 'trip_update', 'trip_reminder',
        'friend_request', 'friend_accepted', 'system_announcement'
      ]),
      title: z.string(),
      message: z.string(),
      data: z.record(z.any()).optional(),
      actionUrl: z.string().optional(),
      priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
      expiresInDays: z.number().optional(),
    }),
    handler: async (input) => {
      const expiresAt = input.expiresInDays 
        ? new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000).toISOString()
        : null;

      const { data, error } = await supabaseAdmin.rpc('create_notification', {
        p_user_id: input.userId,
        p_type: input.type,
        p_title: input.title,
        p_message: input.message,
        p_data: input.data || {},
        p_action_url: input.actionUrl || null,
        p_priority: input.priority || 'normal',
        p_expires_at: expiresAt,
      });

      if (error) {
        console.error('Error creating notification:', error);
        return { success: false, notificationId: null };
      }

      return { success: true, notificationId: data };
    },
  }),
};
