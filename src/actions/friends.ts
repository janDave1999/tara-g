import { z } from "astro:content";
import { supabaseAdmin } from "@/lib/supabase";
import { ActionError, defineAction } from "astro:actions";
import { defineProtectedAction } from "./utils";

async function getInternalUserId(authId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from('users')
    .select('user_id')
    .eq('auth_id', authId)
    .single();
  return data?.user_id ?? null;
}

async function sendNotification(
  userId: string,
  type: string,
  title: string,
  message: string,
  data: Record<string, any> = {},
  actionUrl?: string,
) {
  const { error } = await supabaseAdmin.rpc('create_notification', {
    p_user_id: userId,
    p_type: type,
    p_title: title,
    p_message: message,
    p_data: data,
    p_action_url: actionUrl ?? null,
    p_priority: 'normal',
  });
  if (error) {
    console.error(`[FRIENDS:notif] Failed to send ${type} notification:`, error);
  }
}

export const friends = {
  sendFriendRequest: defineAction({
    input: z.object({ targetUserId: z.string().uuid() }),
    handler: defineProtectedAction(async ({ targetUserId }, { userId: authId }) => {
      const callerUserId = await getInternalUserId(authId);
      if (!callerUserId) throw new ActionError({ code: 'UNAUTHORIZED', message: 'User not found.' });
      if (callerUserId === targetUserId) throw new ActionError({ code: 'BAD_REQUEST', message: 'Cannot send a friend request to yourself.' });

      const { data: callerUser } = await supabaseAdmin
        .from('users')
        .select('username, full_name, avatar_url')
        .eq('user_id', callerUserId)
        .single();

      const { error } = await supabaseAdmin.from('friend_requests').insert({
        sender_id: callerUserId,
        receiver_id: targetUserId,
        status: 'pending',
      });

      if (error) {
        if (error.code === '23505') throw new ActionError({ code: 'CONFLICT', message: 'Friend request already sent.' });
        throw new ActionError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to send friend request.' });
      }

      await sendNotification(
        targetUserId,
        'friend_request',
        'New Friend Request',
        'sent you a friend request',
        {
          sender_user_id: callerUserId,
          username: callerUser?.username,
          avatar_url: callerUser?.avatar_url,
        },
        `/profile/${callerUser?.username}`,
      );

      return { success: true };
    }),
  }),

  cancelFriendRequest: defineAction({
    input: z.object({ targetUserId: z.string().uuid() }),
    handler: defineProtectedAction(async ({ targetUserId }, { userId: authId }) => {
      const callerUserId = await getInternalUserId(authId);
      if (!callerUserId) throw new ActionError({ code: 'UNAUTHORIZED', message: 'User not found.' });

      const { error } = await supabaseAdmin
        .from('friend_requests')
        .delete()
        .eq('sender_id', callerUserId)
        .eq('receiver_id', targetUserId)
        .eq('status', 'pending');

      if (error) throw new ActionError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to cancel request.' });

      return { success: true };
    }),
  }),

  acceptFriendRequest: defineAction({
    input: z.object({ senderUserId: z.string().uuid() }),
    handler: defineProtectedAction(async ({ senderUserId }, { userId: authId }) => {
      const callerUserId = await getInternalUserId(authId);
      if (!callerUserId) throw new ActionError({ code: 'UNAUTHORIZED', message: 'User not found.' });

      // Updating status to 'accepted' fires the trigger_create_friendship trigger,
      // which inserts both bidirectional rows into friends automatically.
      const { error: updateError } = await supabaseAdmin
        .from('friend_requests')
        .update({ status: 'accepted' })
        .eq('sender_id', senderUserId)
        .eq('receiver_id', callerUserId)
        .eq('status', 'pending');

      if (updateError) throw new ActionError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to accept request.' });

      const { data: callerUser } = await supabaseAdmin
        .from('users')
        .select('username, full_name, avatar_url')
        .eq('user_id', callerUserId)
        .single();

      await sendNotification(
        senderUserId,
        'friend_accepted',
        'Friend Request Accepted',
        'accepted your friend request',
        {
          receiver_user_id: callerUserId,
          username: callerUser?.username,
          avatar_url: callerUser?.avatar_url,
        },
        `/profile/${callerUser?.username}`,
      );

      return { success: true };
    }),
  }),

  declineFriendRequest: defineAction({
    input: z.object({ senderUserId: z.string().uuid() }),
    handler: defineProtectedAction(async ({ senderUserId }, { userId: authId }) => {
      const callerUserId = await getInternalUserId(authId);
      if (!callerUserId) throw new ActionError({ code: 'UNAUTHORIZED', message: 'User not found.' });

      const { error } = await supabaseAdmin
        .from('friend_requests')
        .update({ status: 'declined', responded_at: new Date().toISOString() })
        .eq('sender_id', senderUserId)
        .eq('receiver_id', callerUserId)
        .eq('status', 'pending');

      if (error) throw new ActionError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to decline request.' });

      return { success: true };
    }),
  }),
};
