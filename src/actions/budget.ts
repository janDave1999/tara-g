// File: src/actions/budget.ts
// Astro actions for budget & expense tracking

import { defineAction } from 'astro:actions';
import { z } from 'astro:schema';
import { supabaseAdmin, getSupabaseClient } from '@/lib/supabase';
import type { AstroCookies } from 'astro';

const expenseCategory = z.enum(['accommodation', 'food', 'transport', 'activities', 'misc']);
const costSharingMethod = z.enum(['split_evenly', 'organizer_shoulders_all', 'everyone_pays_own', 'custom_split', 'event_fee', 'budget_pool']);

// ── Auth helpers ──────────────────────────────────────────────────────────────

async function getAuthUser(cookies: AstroCookies) {
  const client = await getSupabaseClient(cookies);
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) throw new Error('Not authenticated');
  return user;
}

async function verifyTripMember(userId: string, tripId: string) {
  const { data, error } = await supabaseAdmin
    .from('trip_members')
    .select('role')
    .eq('trip_id', tripId)
    .eq('user_id', userId)
    .eq('member_status', 'joined')
    .single();
  if (error || !data) throw new Error('Not a trip member');
  return data.role as string;
}

async function verifyTripOwner(userId: string, tripId: string) {
  const role = await verifyTripMember(userId, tripId);
  if (role !== 'owner') throw new Error('Not trip owner');
}

/** Throws if the trip has allow_members_to_log = false and user is not the owner. */
async function verifyCanLogExpense(userId: string, tripId: string) {
  const role = await verifyTripMember(userId, tripId);
  if (role === 'owner') return; // owners can always log

  const { data } = await supabaseAdmin
    .from('trip_budget_settings')
    .select('allow_members_to_log')
    .eq('trip_id', tripId)
    .single();

  // Default to allowed if no settings row exists yet
  if (data && data.allow_members_to_log === false) {
    throw new Error('Members are not allowed to log expenses for this trip');
  }
}

/** Throws if the split does not belong to userId and userId is not the trip owner. */
async function verifyCanSettleSplit(userId: string, splitId: string, tripId: string) {
  const { data, error } = await supabaseAdmin
    .from('expense_splits')
    .select('user_id')
    .eq('id', splitId)
    .single();

  if (error || !data) throw new Error('Split not found');

  // Allow: split owner settling their own debt, or trip owner settling on behalf
  if (data.user_id !== userId) {
    await verifyTripOwner(userId, tripId);
  }
}

// ─────────────────────────────────────────────────────────────────────────────

export const budget = {
  // Get budget settings for a trip
  getSettings: defineAction({
    input: z.object({ tripId: z.string().uuid() }),
    handler: async ({ tripId }, { cookies }) => {
      const user = await getAuthUser(cookies);
      await verifyTripMember(user.id, tripId);
      const { data, error } = await supabaseAdmin.rpc('get_trip_budget_settings', { p_trip_id: tripId });
      if (error) throw error;
      return data;
    }
  }),

  // Create or update budget settings (owner only)
  updateSettings: defineAction({
    input: z.object({
      tripId: z.string().uuid(),
      costSharingMethod,
      budgetEstimate: z.number().nullable().optional(),
      poolEnabled: z.boolean().optional(),
      poolPerPerson: z.number().nullable().optional(),
      allowMembersToLog: z.boolean().optional()
    }),
    handler: async (input, { cookies }) => {
      const user = await getAuthUser(cookies);
      await verifyTripOwner(user.id, input.tripId);
      const { data, error } = await supabaseAdmin.rpc('upsert_trip_budget_settings', {
        p_trip_id: input.tripId,
        p_cost_sharing_method: input.costSharingMethod,
        p_budget_estimate: input.budgetEstimate ?? null,
        p_pool_enabled: input.poolEnabled ?? false,
        p_pool_per_person: input.poolPerPerson ?? null,
        p_allow_members_to_log: input.allowMembersToLog ?? true
      });
      if (error) throw error;
      return data;
    }
  }),

  // Get expenses for a trip
  getExpenses: defineAction({
    input: z.object({ tripId: z.string().uuid() }),
    handler: async ({ tripId }, { cookies }) => {
      const user = await getAuthUser(cookies);
      await verifyTripMember(user.id, tripId);
      const { data, error } = await supabaseAdmin.rpc('get_trip_expenses', { p_trip_id: tripId });
      if (error) throw error;
      return data;
    }
  }),

  // Add new expense (any trip member)
  addExpense: defineAction({
    input: z.object({
      tripId: z.string().uuid(),
      payerId: z.string().uuid(),
      amount: z.number().positive(),
      description: z.string().min(1),
      category: expenseCategory,
      date: z.string(),
      isShared: z.boolean().default(true),
      receiptUrl: z.string().optional(),
      stopId: z.string().uuid().optional(),
      recipientIds: z.array(z.string().uuid()).optional(),
      paidFromPool: z.boolean().default(false),
    }),
    handler: async (input, { cookies }) => {
      const user = await getAuthUser(cookies);
      await verifyCanLogExpense(user.id, input.tripId);
      const { data, error } = await supabaseAdmin.rpc('add_trip_expense', {
        p_trip_id: input.tripId,
        p_payer_id: input.payerId,
        p_amount: input.amount,
        p_description: input.description,
        p_category: input.category,
        p_date: input.date,
        p_is_shared: input.isShared,
        p_receipt_url: input.receiptUrl ?? null,
        p_stop_id: input.stopId ?? null,
        p_recipient_ids: input.recipientIds ?? null,
        p_paid_from_pool: input.paidFromPool ?? false,
      });
      if (error) throw error;
      return data;
    }
  }),

  // Delete expense (owner only)
  deleteExpense: defineAction({
    input: z.object({ expenseId: z.string().uuid(), tripId: z.string().uuid() }),
    handler: async ({ expenseId, tripId }, { cookies }) => {
      const user = await getAuthUser(cookies);
      await verifyTripOwner(user.id, tripId);
      const { error } = await supabaseAdmin.rpc('delete_trip_expense', { p_expense_id: expenseId });
      if (error) throw error;
      return { success: true };
    }
  }),

  // Get member balances
  getMemberBalances: defineAction({
    input: z.object({ tripId: z.string().uuid() }),
    handler: async ({ tripId }, { cookies }) => {
      const user = await getAuthUser(cookies);
      await verifyTripMember(user.id, tripId);
      const { data, error } = await supabaseAdmin.rpc('get_member_balances', { p_trip_id: tripId });
      if (error) throw error;
      return data;
    }
  }),

  // Get what a specific member owes (per expense)
  getMemberOwes: defineAction({
    input: z.object({
      tripId: z.string().uuid(),
      userId: z.string().uuid()
    }),
    handler: async ({ tripId, userId }, { cookies }) => {
      const user = await getAuthUser(cookies);
      await verifyTripMember(user.id, tripId);
      const { data, error } = await supabaseAdmin.rpc('get_member_owes', {
        p_trip_id: tripId,
        p_user_id: userId
      });
      if (error) throw error;
      return data;
    }
  }),

  // Settle a single expense split (split owner or trip owner)
  settleExpenseSplit: defineAction({
    input: z.object({ splitId: z.string().uuid(), tripId: z.string().uuid() }),
    handler: async ({ splitId, tripId }, { cookies }) => {
      const user = await getAuthUser(cookies);
      await verifyCanSettleSplit(user.id, splitId, tripId);
      const { error } = await supabaseAdmin.rpc('settle_expense_split', { p_split_id: splitId });
      if (error) throw error;
      return { success: true };
    }
  }),

  // Calculate settlement
  calculateSettlement: defineAction({
    input: z.object({ tripId: z.string().uuid() }),
    handler: async ({ tripId }, { cookies }) => {
      const user = await getAuthUser(cookies);
      await verifyTripMember(user.id, tripId);
      const { data, error } = await supabaseAdmin.rpc('calculate_trip_settlement', { p_trip_id: tripId });
      if (error) throw error;
      return data;
    }
  }),

  // Get pool contributions
  getPoolContributions: defineAction({
    input: z.object({ tripId: z.string().uuid() }),
    handler: async ({ tripId }, { cookies }) => {
      const user = await getAuthUser(cookies);
      await verifyTripMember(user.id, tripId);
      const { data, error } = await supabaseAdmin.rpc('get_pool_contributions', { p_trip_id: tripId });
      if (error) throw error;
      return data;
    }
  }),

  // Get current pool balance (collected − spent from pool) and per-member refundable amounts
  getPoolBalance: defineAction({
    input: z.object({ tripId: z.string().uuid() }),
    handler: async ({ tripId }, { cookies }) => {
      const user = await getAuthUser(cookies);
      await verifyTripMember(user.id, tripId);
      const { data, error } = await supabaseAdmin.rpc('get_pool_balance', { p_trip_id: tripId });
      if (error) throw error;
      return data as {
        collected: number;
        spent:     number;
        balance:   number;
        members:   Array<{ auth_id: string; display_name: string; amount_paid: number; refundable: number }>;
      };
    }
  }),

  // Contribute to pool (as user)
  contributeToPool: defineAction({
    input: z.object({
      tripId: z.string().uuid(),
      amount: z.number().positive()
    }),
    handler: async (input, { cookies }) => {
      const user = await getAuthUser(cookies);
      await verifyTripMember(user.id, input.tripId);
      const { data, error } = await supabaseAdmin.rpc('upsert_pool_contribution', {
        p_trip_id: input.tripId,
        p_user_id: user.id,
        p_amount: input.amount
      });
      if (error) throw error;
      return data;
    }
  }),

  // Mark contribution as refunded (owner only) — for when a paid member is reimbursed offline
  markContributionRefunded: defineAction({
    input: z.object({ contributionId: z.string().uuid(), tripId: z.string().uuid() }),
    handler: async ({ contributionId, tripId }, { cookies }) => {
      const user = await getAuthUser(cookies);
      await verifyTripOwner(user.id, tripId);
      const { error } = await supabaseAdmin.rpc('mark_contribution_refunded', {
        p_contribution_id: contributionId,
      });
      if (error) throw error;
      return { success: true };
    }
  }),

  // Mark contribution as paid (owner only) — kept for backwards compat
  markContributionPaid: defineAction({
    input: z.object({ contributionId: z.string().uuid(), tripId: z.string().uuid() }),
    handler: async ({ contributionId, tripId }, { cookies }) => {
      const user = await getAuthUser(cookies);
      await verifyTripOwner(user.id, tripId);
      const { error } = await supabaseAdmin.rpc('record_pool_payment', {
        p_contribution_id: contributionId,
        p_payment_amount: 0,
        p_full_payment: true,
      });
      if (error) throw error;
      return { success: true };
    }
  }),

  // Record a full or partial pool/fee payment (owner only)
  recordPoolPayment: defineAction({
    input: z.object({
      contributionId: z.string().uuid(),
      tripId:         z.string().uuid(),
      paymentAmount:  z.number().min(0),
      fullPayment:    z.boolean(),
    }),
    handler: async ({ contributionId, tripId, paymentAmount, fullPayment }, { cookies }) => {
      const user = await getAuthUser(cookies);
      await verifyTripOwner(user.id, tripId);
      const { data, error } = await supabaseAdmin.rpc('record_pool_payment', {
        p_contribution_id: contributionId,
        p_payment_amount:  paymentAmount,
        p_full_payment:    fullPayment,
      });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      return {
        newStatus:   row?.new_status   ?? 'pending',
        newPaid:     row?.new_paid     ?? 0,
        totalAmount: row?.total_amount ?? 0,
        remaining:   row?.remaining    ?? 0,
      };
    }
  }),

  // Get expense summary by category
  getExpenseSummary: defineAction({
    input: z.object({ tripId: z.string().uuid() }),
    handler: async ({ tripId }, { cookies }) => {
      const user = await getAuthUser(cookies);
      await verifyTripMember(user.id, tripId);
      const { data, error } = await supabaseAdmin.rpc('get_trip_expense_summary', { p_trip_id: tripId });
      if (error) throw error;
      return data;
    }
  }),

  // Get a snapshot of unsettled obligations (splits + pool) for the owner's
  // awareness before changing the cost-sharing method.
  getUnsettledSummary: defineAction({
    input: z.object({ tripId: z.string().uuid() }),
    handler: async ({ tripId }, { cookies }) => {
      const user = await getAuthUser(cookies);
      await verifyTripOwner(user.id, tripId);
      const { data, error } = await supabaseAdmin.rpc('get_unsettled_summary', { p_trip_id: tripId });
      if (error) throw error;
      return data as {
        current_method: string;
        splits:     { count: number; total: number; members: Array<{ auth_id: string; display_name: string; amount_owed: number }> };
        pool:       { count: number; pending_total: number; paid_total: number; members: Array<{ auth_id: string; display_name: string; amount_paid: number; amount_remaining: number; status: string }> };
        refundable: { count: number; total: number; members: Array<{ auth_id: string; display_name: string; amount_paid: number }> };
      };
    }
  }),

  // Get unified transaction log for the budget tab
  getTransactionLog: defineAction({
    input: z.object({ tripId: z.string().uuid() }),
    handler: async ({ tripId }, { cookies }) => {
      const user = await getAuthUser(cookies);
      await verifyTripMember(user.id, tripId);
      const { data, error } = await supabaseAdmin.rpc('get_transaction_log', { p_trip_id: tripId });
      if (error) throw error;
      return (data ?? []) as Array<{
        event_id:        string;
        event_type:      'contribution' | 'refund' | 'pool_expense' | 'expense' | 'settlement';
        event_at:        string;
        actor_name:      string | null;
        actor_avatar:    string | null;
        direction:       'in' | 'out' | 'neutral';
        amount:          number;
        label:           string;
        sub_label:       string;
        running_balance: number | null;
      }>;
    }
  }),

  // Atomically change the cost-sharing method with reconciliation options.
  // Always use this instead of updateSettings when the method itself is changing.
  //
  // writeOffSplits:
  //   false (default) — existing unsettled splits remain as-is
  //   true            — mark all unsettled splits as settled (owner absorbs debts)
  //
  // poolAction (for pending/partial pool_contributions):
  //   'keep'     — leave them untouched (default)
  //   'cancel'   — delete fully-pending; close partial at amount already paid
  //   'transfer' — adjust contribution targets to new poolPerPerson amount
  //                (only valid when new method is event_fee or budget_pool)
  changeCostSharing: defineAction({
    input: z.object({
      tripId:              z.string().uuid(),
      newMethod:           costSharingMethod,
      budgetEstimate:      z.number().nullable().optional(),
      poolPerPerson:       z.number().nullable().optional(),
      allowMembersToLog:   z.boolean().optional(),
      writeOffSplits:      z.boolean().default(false),
      poolAction:          z.enum(['keep', 'cancel', 'transfer']).default('keep'),
    }),
    handler: async (input, { cookies }) => {
      const user = await getAuthUser(cookies);
      await verifyTripOwner(user.id, input.tripId);
      const { data, error } = await supabaseAdmin.rpc('change_cost_sharing_method', {
        p_trip_id:              input.tripId,
        p_new_method:           input.newMethod,
        p_budget_estimate:      input.budgetEstimate ?? null,
        p_pool_per_person:      input.poolPerPerson  ?? null,
        p_allow_members_to_log: input.allowMembersToLog ?? true,
        p_write_off_splits:     input.writeOffSplits,
        p_pool_action:          input.poolAction,
      });
      if (error) throw error;
      return data as {
        new_method:         string;
        splits_written_off: number;
        pool_cancelled:     number;
        pool_transferred:   number;
      };
    }
  }),
};
