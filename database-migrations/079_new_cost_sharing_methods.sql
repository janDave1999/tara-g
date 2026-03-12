-- 079_new_cost_sharing_methods.sql
--
-- Add two new cost sharing methods:
--   event_fee    – organizer charges a fixed fee per person (members must pay to join)
--   budget_pool  – members contribute to a shared pool that covers group expenses
--
-- IMPORTANT: ALTER TYPE ... ADD VALUE must run outside a transaction block.
-- Run each statement separately in the Supabase SQL editor.

ALTER TYPE cost_sharing_method ADD VALUE IF NOT EXISTS 'event_fee';
ALTER TYPE cost_sharing_method ADD VALUE IF NOT EXISTS 'budget_pool';
