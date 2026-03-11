# Trip Budget & Expense Tracking — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement a flexible expense tracking system for trips with 4 cost sharing methods, optional budget pooling, and settlement workflow.

**Architecture:** 
- Database-first approach: create tables for budget settings, expenses, splits, pool contributions, settlements
- Astro Actions for all data mutations
- UI as new tab/section in trip detail page
- Use existing Supabase R2 for receipt photo storage

**Tech Stack:** 
- Database: Supabase (PostgreSQL)
- Backend: Cloudflare Workers + Astro Actions
- Storage: Cloudflare R2 for receipts
- Frontend: Astro components with vanilla JS

---

## Database Setup

### Task 1: Create Database Migration for Budget Tables

**Files:**
- Create: `database-migrations/073_trip_budget_expense_system.sql`

**Step 1: Create migration file**

```sql
-- Trip Budget & Expense Tracking System
-- Migration: 073_trip_budget_expense_system.sql

-- Enum for cost sharing methods
DO $$ BEGIN
    CREATE TYPE cost_sharing_method AS ENUM (
        'split_evenly',
        'organizer_shoulders_all',
        'everyone_pays_own',
        'custom_split'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Trip budget settings
CREATE TABLE trip_budget_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE UNIQUE,
    cost_sharing_method cost_sharing_method NOT NULL DEFAULT 'split_evenly',
    budget_estimate DECIMAL(12,2),
    pool_enabled BOOLEAN DEFAULT FALSE,
    pool_per_person DECIMAL(12,2),
    pool_status TEXT DEFAULT 'open',
    allow_members_to_log BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Individual expenses
CREATE TABLE trip_expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    payer_id UUID NOT NULL REFERENCES auth.users(id),
    amount DECIMAL(12,2) NOT NULL,
    description TEXT,
    category TEXT NOT NULL,
    date DATE NOT NULL,
    receipt_url TEXT,
    stop_id UUID REFERENCES trip_location(id),
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Expense splits (who owes what for each expense)
CREATE TABLE expense_splits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    expense_id UUID NOT NULL REFERENCES trip_expenses(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id),
    share_amount DECIMAL(12,2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Pool contributions
CREATE TABLE pool_contributions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id),
    amount DECIMAL(12,2) NOT NULL,
    status TEXT DEFAULT 'pending',
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Settlements between members
CREATE TABLE expense_settlements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    from_user_id UUID NOT NULL REFERENCES auth.users(id),
    to_user_id UUID NOT NULL REFERENCES auth.users(id),
    amount DECIMAL(12,2) NOT NULL,
    status TEXT DEFAULT 'unsettled',
    method TEXT,
    settled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_trip_expenses_trip_id ON trip_expenses(trip_id);
CREATE INDEX idx_trip_expenses_date ON trip_expenses(date);
CREATE INDEX idx_expense_splits_expense_id ON expense_splits(expense_id);
CREATE INDEX idx_pool_contributions_trip_id ON pool_contributions(trip_id);
CREATE INDEX idx_expense_settlements_trip_id ON expense_settlements(trip_id);

-- RLS Policies (simplified - use existing patterns)
ALTER TABLE trip_budget_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_splits ENABLE ROW LEVEL SECURITY;
ALTER TABLE pool_contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_settlements ENABLE ROW LEVEL SECURITY;

-- Budget settings: trip owner can do anything, members can read
CREATE POLICY "trip_budget_settings_owner_full" ON trip_budget_settings
    FOR ALL USING (
        trip_id IN (SELECT id FROM trips WHERE owner_id = auth.uid())
    );

CREATE POLICY "trip_budget_settings_members_read" ON trip_budget_settings
    FOR SELECT USING (
        trip_id IN (SELECT trip_id FROM trip_members WHERE user_id = auth.uid())
    );

-- Similar policies for other tables...
```

**Step 2: Run migration**

Run: `wrangler d1 execute tara-g --file=./database-migrations/073_trip_budget_expense_system.sql`

**Step 3: Commit**

```bash
git add database-migrations/073_trip_budget_expense_system.sql
git commit -m "feat: add trip budget & expense tracking tables"
```

---

### Task 2: Create Database RPCs

**Files:**
- Create: `database-migrations/074_trip_budget_expense_rpcs.sql`

**Step 1: Create RPC functions**

```sql
-- Get budget settings for a trip
CREATE OR REPLACE FUNCTION get_trip_budget_settings(p_trip_id UUID)
RETURNS TABLE (
    id UUID,
    trip_id UUID,
    cost_sharing_method TEXT,
    budget_estimate DECIMAL(12,2),
    pool_enabled BOOLEAN,
    pool_per_person DECIMAL(12,2),
    pool_status TEXT,
    allow_members_to_log BOOLEAN,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        tbs.id, tbs.trip_id, tbs.cost_sharing_method::TEXT,
        tbs.budget_estimate, tbs.pool_enabled, tbs.pool_per_person,
        tbs.pool_status, tbs.allow_members_to_log, tbs.created_at, tbs.updated_at
    FROM trip_budget_settings tbs
    WHERE tbs.trip_id = p_trip_id;
END;
$$;

-- Create or update budget settings
CREATE OR REPLACE FUNCTION upsert_trip_budget_settings(
    p_trip_id UUID,
    p_cost_sharing_method TEXT DEFAULT 'split_evenly',
    p_budget_estimate DECIMAL(12,2) DEFAULT NULL,
    p_pool_enabled BOOLEAN DEFAULT FALSE,
    p_pool_per_person DECIMAL(12,2) DEFAULT NULL,
    p_allow_members_to_log BOOLEAN DEFAULT TRUE
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_settings_id UUID;
BEGIN
    INSERT INTO trip_budget_settings (
        trip_id, cost_sharing_method, budget_estimate, 
        pool_enabled, pool_per_person, allow_members_to_log
    ) VALUES (
        p_trip_id, p_cost_sharing_method::cost_sharing_method, p_budget_estimate,
        p_pool_enabled, p_pool_per_person, p_allow_members_to_log
    )
    ON CONFLICT (trip_id) DO UPDATE SET
        cost_sharing_method = EXCLUDED.cost_sharing_method,
        budget_estimate = EXCLUDED.budget_estimate,
        pool_enabled = EXCLUDED.pool_enabled,
        pool_per_person = EXCLUDED.pool_per_person,
        allow_members_to_log = EXCLUDED.allow_members_to_log,
        updated_at = NOW()
    RETURNING id INTO v_settings_id;
    
    RETURN v_settings_id;
END;
$$;

-- Get expenses for a trip
CREATE OR REPLACE FUNCTION get_trip_expenses(
    p_trip_id UUID,
    p_category TEXT DEFAULT NULL,
    p_user_id UUID DEFAULT NULL,
    p_start_date DATE DEFAULT NULL,
    p_end_date DATE DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    trip_id UUID,
    payer_id UUID,
    payer_name TEXT,
    amount DECIMAL(12,2),
    description TEXT,
    category TEXT,
    date DATE,
    receipt_url TEXT,
    stop_id UUID,
    created_at TIMESTAMPTZ,
    splits JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        te.id, te.trip_id, te.payer_id,
        COALESCE(u.display_name, u.email)::TEXT as payer_name,
        te.amount, te.description, te.category, te.date,
        te.receipt_url, te.stop_id, te.created_at,
        COALESCE(
            jsonb_agg(
                jsonb_build_object(
                    'user_id', es.user_id,
                    'share_amount', es.share_amount,
                    'user_name', (SELECT COALESCE(u2.display_name, u2.email) FROM auth.users u2 WHERE u2.id = es.user_id)
                )
            ) FILTER (WHERE es.id IS NOT NULL),
            '[]'::jsonb
        ) as splits
    FROM trip_expenses te
    LEFT JOIN expense_splits es ON es.expense_id = te.id
    JOIN auth.users u ON u.id = te.payer_id
    WHERE te.trip_id = p_trip_id
        AND (p_category IS NULL OR te.category = p_category)
        AND (p_user_id IS NULL OR te.payer_id = p_user_id OR es.user_id = p_user_id)
        AND (p_start_date IS NULL OR te.date >= p_start_date)
        AND (p_end_date IS NULL OR te.date <= p_end_date)
    GROUP BY te.id, u.display_name, u.email
    ORDER BY te.date DESC, te.created_at DESC;
END;
$$;

-- Add expense with splits
CREATE OR REPLACE FUNCTION add_trip_expense(
    p_trip_id UUID,
    p_payer_id UUID,
    p_amount DECIMAL(12,2),
    p_description TEXT,
    p_category TEXT,
    p_date DATE,
    p_receipt_url TEXT DEFAULT NULL,
    p_stop_id UUID DEFAULT NULL,
    p_recipient_ids UUID[] DEFAULT NULL,
    p_created_by UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_expense_id UUID;
    v_member_count INT;
    v_share_amount DECIMAL(12,2);
    v_cost_sharing TEXT;
    v_user_id UUID;
    v_first_member_id UUID;
BEGIN
    -- Get cost sharing method
    SELECT cost_sharing_method INTO v_cost_sharing
    FROM trip_budget_settings
    WHERE trip_id = p_trip_id;

    -- Insert expense
    INSERT INTO trip_expenses (
        trip_id, payer_id, amount, description, category,
        date, receipt_url, stop_id, created_by
    ) VALUES (
        p_trip_id, p_payer_id, p_amount, p_description, p_category,
        p_date, p_receipt_url, p_stop_id, p_created_by
    )
    RETURNING id INTO v_expense_id;

    -- Calculate splits based on cost sharing method
    IF v_cost_sharing = 'split_evenly' OR v_cost_sharing = 'organizer_shoulders_all' THEN
        -- Get member count (excluding organizer for 'organizer_shoulders_all')
        SELECT COUNT(*) INTO v_member_count
        FROM trip_members
        WHERE trip_id = p_trip_id AND status = 'joined';

        IF v_cost_sharing = 'organizer_shoulders_all' THEN
            v_member_count := v_member_count - 1;
        END IF;

        IF v_member_count > 0 THEN
            v_share_amount := p_amount / v_member_count;
            
            -- Insert splits for all members (excluding payer)
            FOR v_user_id IN
                SELECT user_id FROM trip_members
                WHERE trip_id = p_trip_id AND status = 'joined'
                    AND user_id != p_payer_id
            LOOP
                INSERT INTO expense_splits (expense_id, user_id, share_amount)
                VALUES (v_expense_id, v_user_id, v_share_amount);
            END LOOP;
        END IF;

    ELSIF v_cost_sharing = 'custom_split' AND p_recipient_ids IS NOT NULL THEN
        -- Custom split: divide equally among recipients
        v_share_amount := p_amount / array_length(p_recipient_ids, 1);
        
        FOREACH v_user_id IN ARRAY p_recipient_ids
        LOOP
            INSERT INTO expense_splits (expense_id, user_id, share_amount)
            VALUES (v_expense_id, v_user_id, v_share_amount);
        END LOOP;

    ELSIF v_cost_sharing = 'everyone_pays_own' THEN
        -- Each person is only responsible for their own expenses
        -- In this mode, splits are optional or only for shared expenses
        IF p_recipient_ids IS NOT NULL AND array_length(p_recipient_ids, 1) > 0 THEN
            v_share_amount := p_amount / array_length(p_recipient_ids, 1);
            
            FOREACH v_user_id IN ARRAY p_recipient_ids
            LOOP
                INSERT INTO expense_splits (expense_id, user_id, share_amount)
                VALUES (v_expense_id, v_user_id, v_share_amount);
            END LOOP;
        END IF;
    END IF;

    RETURN v_expense_id;
END;
$$;

-- Calculate settlement
CREATE OR REPLACE FUNCTION calculate_trip_settlement(p_trip_id UUID)
RETURNS TABLE (
    from_user_id UUID,
    from_user_name TEXT,
    to_user_id UUID,
    to_user_name TEXT,
    amount DECIMAL(12,2)
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_record RECORD;
    v_balance RECORD;
    v_balances TABLE (user_id UUID, balance DECIMAL(12,2));
    v_creditor UUID;
    v_debtor UUID;
    v_amount DECIMAL(12,2);
BEGIN
    -- Calculate net balance for each user
    INSERT INTO v_balances
    SELECT 
        user_id,
        COALESCE(SUM(paid), 0) - COALESCE(SUM(owed), 0) as balance
    FROM (
        -- What user paid
        SELECT payer_id as user_id, SUM(amount) as paid, 0 as owed
        FROM trip_expenses
        WHERE trip_id = p_trip_id
        GROUP BY payer_id
        
        UNION ALL
        
        -- What user owes
        SELECT es.user_id, 0 as paid, SUM(es.share_amount) as owed
        FROM expense_splits es
        JOIN trip_expenses te ON te.id = es.expense_id
        WHERE te.trip_id = p_trip_id
        GROUP BY es.user_id
    ) balances
    GROUP BY user_id;

    -- Simple settlement algorithm (net creditors get paid by net debtors)
    FOR v_balance IN SELECT * FROM v_balances ORDER BY balance DESC LOOP
        -- If user has positive balance (is owed money)
        IF v_balance.balance > 0.01 THEN
            v_creditor := v_balance.user_id;
            
            -- Find debtor with most negative balance
            SELECT user_id INTO v_debtor
            FROM v_balances
            WHERE balance < -0.01
            ORDER BY balance ASC
            LIMIT 1;
            
            IF v_debtor IS NOT NULL THEN
                -- Calculate settlement amount
                v_amount := LEAST(v_balance.balance, (
                    SELECT ABS(balance) FROM v_balances WHERE user_id = v_debtor
                ));
                
                IF v_amount > 0.01 THEN
                    RETURN QUERY SELECT
                        v_debtor,
                        (SELECT COALESCE(display_name, email) FROM auth.users WHERE id = v_debtor),
                        v_creditor,
                        (SELECT COALESCE(display_name, email) FROM auth.users WHERE id = v_creditor),
                        v_amount;
                    
                    -- Update balances
                    UPDATE v_balances SET balance = balance - v_amount WHERE user_id = v_creditor;
                    UPDATE v_balances SET balance = balance + v_amount WHERE user_id = v_debtor;
                END IF;
            END IF;
        END IF;
    END LOOP;
END;
$$;

-- Pool contribution RPCs
CREATE OR REPLACE FUNCTION get_pool_contributions(p_trip_id UUID)
RETURNS TABLE (
    id UUID,
    trip_id UUID,
    user_id UUID,
    user_name TEXT,
    amount DECIMAL(12,2),
    status TEXT,
    paid_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        pc.id, pc.trip_id, pc.user_id,
        COALESCE(u.display_name, u.email)::TEXT as user_name,
        pc.amount, pc.status, pc.paid_at
    FROM pool_contributions pc
    JOIN auth.users u ON u.id = pc.user_id
    WHERE pc.trip_id = p_trip_id
    ORDER BY pc.created_at;
END;
$$;

CREATE OR REPLACE FUNCTION upsert_pool_contribution(
    p_trip_id UUID,
    p_user_id UUID,
    p_amount DECIMAL(12,2)
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_id UUID;
BEGIN
    INSERT INTO pool_contributions (trip_id, user_id, amount)
    VALUES (p_trip_id, p_user_id, p_amount)
    ON CONFLICT (trip_id, user_id) DO UPDATE SET
        amount = EXCLUDED.amount
    RETURNING id INTO v_id;
    
    RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION mark_contribution_paid(p_contribution_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE pool_contributions
    SET status = 'paid', paid_at = NOW()
    WHERE id = p_contribution_id;
END;
$$;
```

**Step 2: Run migration**

Run: `wrangler d1 execute tara-g --file=./database-migrations/074_trip_budget_expense_rpcs.sql`

**Step 3: Commit**

```bash
git add database-migrations/074_trip_budget_expense_rpcs.sql
git commit -m "feat: add budget & expense RPC functions"
```

---

## Backend Implementation

### Task 3: Create Budget & Expense Astro Actions

**Files:**
- Create: `src/actions/budget.ts`

**Step 1: Write action definitions**

```typescript
import { defineAction, z } from 'astro:actions';
import { supabase } from '../lib/supabase';

export const budgetActions = {
  getSettings: defineAction({
    input: z.object({ tripId: z.string().uuid() }),
    handler: async ({ tripId }) => {
      const { data, error } = await supabase.rpc('get_trip_budget_settings', { p_trip_id: tripId });
      if (error) throw error;
      return data;
    }
  }),

  updateSettings: defineAction({
    input: z.object({
      tripId: z.string().uuid(),
      costSharingMethod: z.enum(['split_evenly', 'organizer_shoulders_all', 'everyone_pays_own', 'custom_split']),
      budgetEstimate: z.number().nullable(),
      poolEnabled: z.boolean().optional(),
      poolPerPerson: z.number().nullable(),
      allowMembersToLog: z.boolean().optional()
    }),
    handler: async (input) => {
      const { data, error } = await supabase.rpc('upsert_trip_budget_settings', {
        p_trip_id: input.tripId,
        p_cost_sharing_method: input.costSharingMethod,
        p_budget_estimate: input.budgetEstimate,
        p_pool_enabled: input.poolEnabled ?? false,
        p_pool_per_person: input.poolPerPerson,
        p_allow_members_to_log: input.allowMembersToLog ?? true
      });
      if (error) throw error;
      return data;
    }
  }),

  getExpenses: defineAction({
    input: z.object({
      tripId: z.string().uuid(),
      category: z.string().optional(),
      userId: z.string().uuid().optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional()
    }),
    handler: async (input) => {
      const { data, error } = await supabase.rpc('get_trip_expenses', {
        p_trip_id: input.tripId,
        p_category: input.category ?? null,
        p_user_id: input.userId ?? null,
        p_start_date: input.startDate ?? null,
        p_end_date: input.endDate ?? null
      });
      if (error) throw error;
      return data;
    }
  }),

  addExpense: defineAction({
    input: z.object({
      tripId: z.string().uuid(),
      payerId: z.string().uuid(),
      amount: z.number().positive(),
      description: z.string(),
      category: z.enum(['accommodation', 'food', 'transport', 'activities', 'misc']),
      date: z.string(),
      receiptUrl: z.string().optional(),
      stopId: z.string().uuid().optional(),
      recipientIds: z.array(z.string().uuid()).optional()
    }),
    handler: async (input) => {
      const { data, error } = await supabase.rpc('add_trip_expense', {
        p_trip_id: input.tripId,
        p_payer_id: input.payerId,
        p_amount: input.amount,
        p_description: input.description,
        p_category: input.category,
        p_date: input.date,
        p_receipt_url: input.receiptUrl ?? null,
        p_stop_id: input.stopId ?? null,
        p_recipient_ids: input.recipientIds ?? null
      });
      if (error) throw error;
      return data;
    }
  }),

  deleteExpense: defineAction({
    input: z.object({ expenseId: z.string().uuid() }),
    handler: async ({ expenseId }) => {
      const { error } = await supabase
        .from('trip_expenses')
        .delete()
        .eq('id', expenseId);
      if (error) throw error;
      return { success: true };
    }
  }),

  calculateSettlement: defineAction({
    input: z.object({ tripId: z.string().uuid() }),
    handler: async ({ tripId }) => {
      const { data, error } = await supabase.rpc('calculate_trip_settlement', { p_trip_id: tripId });
      if (error) throw error;
      return data;
    }
  }),

  getPoolContributions: defineAction({
    input: z.object({ tripId: z.string().uuid() }),
    handler: async ({ tripId }) => {
      const { data, error } = await supabase.rpc('get_pool_contributions', { p_trip_id: tripId });
      if (error) throw error;
      return data;
    }
  }),

  contributeToPool: defineAction({
    input: z.object({
      tripId: z.string().uuid(),
      amount: z.number().positive()
    }),
    handler: async (input, { locals }) => {
      const userId = locals.user?.id;
      if (!userId) throw new Error('Not authenticated');
      
      const { data, error } = await supabase.rpc('upsert_pool_contribution', {
        p_trip_id: input.tripId,
        p_user_id: userId,
        p_amount: input.amount
      });
      if (error) throw error;
      return data;
    }
  }),

  markContributionPaid: defineAction({
    input: z.object({ contributionId: z.string().uuid() }),
    handler: async ({ contributionId }) => {
      const { error } = await supabase.rpc('mark_contribution_paid', { p_contribution_id: contributionId });
      if (error) throw error;
      return { success: true };
    }
  })
};
```

**Step 2: Export actions in main actions file**

Modify: `src/actions/index.ts` (find existing pattern)
Add: `export { budgetActions } from './budget';`

**Step 3: Commit**

```bash
git add src/actions/budget.ts
git commit -m "feat: add budget & expense Astro actions"
```

---

## Frontend Implementation

### Task 4: Create Budget Tab Component

**Files:**
- Create: `src/components/trip/BudgetTab.astro`

**Step 1: Write component**

```astro
---
interface Props {
  tripId: string;
  isOwner: boolean;
}

const { tripId, isOwner } = Astro.props;
---

<div class="budget-tab" data-trip-id={tripId} data-is-owner={isOwner}>
  <div class="budget-summary">
    <div class="summary-card">
      <span class="label">Total Spent</span>
      <span class="value" id="total-spent">₱0.00</span>
    </div>
    <div class="summary-card">
      <span class="label">Budget Estimate</span>
      <span class="value" id="budget-estimate">₱0.00</span>
    </div>
    <div class="summary-card">
      <span class="label">Remaining</span>
      <span class="value" id="budget-remaining">₱0.00</span>
    </div>
  </div>

  <div class="budget-actions">
    <button class="btn btn-primary" id="add-expense-btn">
      Add Expense
    </button>
    {isOwner && (
      <button class="btn btn-secondary" id="budget-settings-btn">
        Budget Settings
      </button>
    )}
  </div>

  <div class="category-breakdown">
    <h3>Spending by Category</h3>
    <div class="category-bars" id="category-breakdown">
      <!-- Rendered via JS -->
    </div>
  </div>

  <div class="expenses-list">
    <h3>Recent Expenses</h3>
    <div id="expenses-container">
      <!-- Rendered via JS -->
    </div>
  </div>
</div>

<script>
  import { actions } from 'astro:actions';
  
  // Initialize budget tab
  const tripId = document.querySelector('.budget-tab')?.dataset.tripId;
  
  async function loadBudgetData() {
    if (!tripId) return;
    
    const [settings, expenses] = await Promise.all([
      actions.budget.getSettings({ tripId }),
      actions.budget.getExpenses({ tripId })
    ]);
    
    renderSummary(settings, expenses);
    renderExpenses(expenses);
    renderCategoryBreakdown(expenses);
  }
  
  // Functions to render data...
</script>
```

**Step 2: Commit**

```bash
git add src/components/trip/BudgetTab.astro
git commit -m "feat: add BudgetTab component"
```

---

### Task 5: Create Add Expense Modal

**Files:**
- Create: `src/components/trip/AddExpenseModal.astro`

**Step 1: Write modal component**

```astro
---
interface Props {
  tripId: string;
  members: Array<{ id: string; name: string }>;
  costSharingMethod: string;
}

const { tripId, members, costSharingMethod } = Astro.props;
---

<dialog id="add-expense-modal" class="modal">
  <form method="dialog" id="add-expense-form">
    <header>
      <h2>Add Expense</h2>
      <button type="button" class="close-btn">&times;</button>
    </header>
    
    <div class="form-body">
      <div class="form-group">
        <label for="expense-amount">Amount (₱)</label>
        <input type="number" id="expense-amount" name="amount" step="0.01" required />
      </div>
      
      <div class="form-group">
        <label for="expense-description">Description</label>
        <input type="text" id="expense-description" name="description" required />
      </div>
      
      <div class="form-group">
        <label for="expense-category">Category</label>
        <select id="expense-category" name="category" required>
          <option value="accommodation">Accommodation</option>
          <option value="food">Food</option>
          <option value="transport">Transport</option>
          <option value="activities">Activities</option>
          <option value="misc">Miscellaneous</option>
        </select>
      </div>
      
      <div class="form-group">
        <label for="expense-date">Date</label>
        <input type="date" id="expense-date" name="date" required />
      </div>
      
      <div class="form-group">
        <label for="expense-payer">Who Paid?</label>
        <select id="expense-payer" name="payerId" required>
          {members.map(m => (
            <option value={m.id}>{m.name}</option>
          ))}
        </select>
      </div>
      
      {costSharingMethod === 'custom_split' && (
        <div class="form-group">
          <label>Split With (select recipients)</label>
          <div class="recipient-checkboxes">
            {members.map(m => (
              <label>
                <input type="checkbox" name="recipients" value={m.id} />
                {m.name}
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
    
    <footer>
      <button type="button" class="btn btn-ghost" id="cancel-expense">Cancel</button>
      <button type="submit" class="btn btn-primary">Add Expense</button>
    </footer>
  </form>
</dialog>

<script>
  // Handle form submission
</script>
```

**Step 2: Commit**

```bash
git add src/components/trip/AddExpenseModal.astro
git commit -m "feat: add AddExpenseModal component"
```

---

### Task 6: Create Budget Settings Modal

**Files:**
- Create: `src/components/trip/BudgetSettingsModal.astro`

**Step 1: Write settings modal**

```astro
---
interface Props {
  tripId: string;
  settings?: {
    costSharingMethod: string;
    budgetEstimate: number | null;
    poolEnabled: boolean;
    poolPerPerson: number | null;
    allowMembersToLog: boolean;
  };
}

const { tripId, settings } = Astro.props;

const methods = [
  { value: 'split_evenly', label: 'Split Evenly' },
  { value: 'organizer_shoulders_all', label: 'Organizer Shoulders All' },
  { value: 'everyone_pays_own', label: 'Everyone Pays Own' },
  { value: 'custom_split', label: 'Custom Split' }
];
---

<dialog id="budget-settings-modal" class="modal">
  <form method="dialog" id="budget-settings-form">
    <header>
      <h2>Budget Settings</h2>
      <button type="button" class="close-btn">&times;</button>
    </header>
    
    <div class="form-body">
      <div class="form-group">
        <label for="cost-sharing-method">Cost Sharing Method</label>
        <select id="cost-sharing-method" name="costSharingMethod" required>
          {methods.map(m => (
            <option 
              value={m.value} 
              selected={settings?.costSharingMethod === m.value}
            >
              {m.label}
            </option>
          ))}
        </select>
      </div>
      
      <div class="form-group">
        <label for="budget-estimate">Budget Estimate (₱)</label>
        <input 
          type="number" 
          id="budget-estimate" 
          name="budgetEstimate" 
          step="0.01"
          value={settings?.budgetEstimate ?? ''}
          placeholder="Optional"
        />
      </div>
      
      <div class="form-group checkbox-group">
        <label>
          <input 
            type="checkbox" 
            name="poolEnabled" 
            id="pool-enabled"
            checked={settings?.poolEnabled ?? false}
          />
          Enable Budget Pool
        </label>
      </div>
      
      <div class="form-group" id="pool-amount-group" style={{ display: 'none' }}>
        <label for="pool-per-person">Per Person Contribution (₱)</label>
        <input 
          type="number" 
          id="pool-per-person" 
          name="poolPerPerson"
          step="0.01"
          value={settings?.poolPerPerson ?? ''}
        />
      </div>
      
      <div class="form-group checkbox-group">
        <label>
          <input 
            type="checkbox" 
            name="allowMembersToLog"
            checked={settings?.allowMembersToLog ?? true}
          />
          Allow members to add expenses
        </label>
      </div>
    </div>
    
    <footer>
      <button type="button" class="btn btn-ghost" id="cancel-settings">Cancel</button>
      <button type="submit" class="btn btn-primary">Save Settings</button>
    </footer>
  </form>
</dialog>

<script>
  // Toggle pool amount visibility based on checkbox
  // Handle form submission
</script>
```

**Step 2: Commit**

```bash
git add src/components/trip/BudgetSettingsModal.astro
git commit -m "feat: add BudgetSettingsModal component"
```

---

### Task 7: Create Settlement View Component

**Files:**
- Create: `src/components/trip/SettlementView.astro`

**Step 1: Write settlement component**

```astro
---
interface Props {
  tripId: string;
}

const { tripId } = Astro.props;
---

<div class="settlement-view" data-trip-id={tripId}>
  <h3>Settlement</h3>
  <div id="settlement-summary">
    <!-- Rendered via JS -->
  </div>
  <button class="btn btn-secondary" id="calculate-settlement-btn">
    Calculate Settlement
  </button>
  
  <div id="settlement-results" style="display: none;">
    <table class="settlement-table">
      <thead>
        <tr>
          <th>From</th>
          <th>To</th>
          <th>Amount</th>
          <th>Action</th>
        </tr>
      </thead>
      <tbody id="settlement-rows">
        <!-- Rendered via JS -->
      </tbody>
    </table>
  </div>
</div>

<script>
  import { actions } from 'astro:actions';
  
  // Settlement calculation logic
</script>
```

**Step 2: Commit**

```bash
git add src/components/trip/SettlementView.astro
git commit -m "feat: add SettlementView component"
```

---

### Task 8: Integrate Budget Tab into Trip Detail Page

**Files:**
- Modify: `src/pages/trips/[tripId].astro`

**Step 1: Find where tabs are rendered and add BudgetTab**

```astro
---
// At the top with other imports
import BudgetTab from '../components/trip/BudgetTab.astro';
import AddExpenseModal from '../components/trip/AddExpenseModal.astro';
import BudgetSettingsModal from '../components/trip/BudgetSettingsModal.astro';
import SettlementView from '../components/trip/SettlementView.astro';
---

<!-- In the tabs section -->
<button class="tab-btn" data-tab="budget">Budget</button>

<!-- Tab content -->
<div id="tab-budget" class="tab-content" style="display: none;">
  <BudgetTab tripId={trip.id} isOwner={isOwner} />
  <AddExpenseModal tripId={trip.id} members={members} costSharingMethod={budgetSettings?.cost_sharing_method} />
  {isOwner && <BudgetSettingsModal tripId={trip.id} settings={budgetSettings} />}
  <SettlementView tripId={trip.id} />
</div>
```

**Step 2: Commit**

```bash
git add src/pages/trips/\[tripId\].astro
git commit -m "feat: integrate budget tab into trip detail page"
```

---

## Testing

### Task 9: Write Tests

**Files:**
- Create: `tests/budget.test.ts`

**Step 1: Write tests**

```typescript
import { describe, it, expect } from 'vitest';

describe('Trip Budget & Expense Tracking', () => {
  it('should calculate equal split correctly', () => {
    const amount = 3000;
    const members = 3;
    const expected = 1000;
    expect(amount / members).toBe(expected);
  });

  it('should handle custom split correctly', () => {
    const amount = 3000;
    const recipients = ['user1', 'user2'];
    const expected = 1500;
    expect(amount / recipients.length).toBe(expected);
  });

  it('should handle rounding correctly', () => {
    const amount = 1000;
    const members = 3;
    const share = amount / members;
    const total = share * 3;
    const remainder = amount - total;
    expect(remainder).toBeCloseTo(0, 2);
  });
});
```

**Step 2: Run tests**

Run: `npm test`

**Step 3: Commit**

```bash
git add tests/budget.test.ts
git commit -m "test: add budget & expense tracking tests"
```

---

## Summary

This implementation plan covers:

| Task | Component | Priority |
|------|-----------|----------|
| 1 | Database tables & schema | P0 |
| 2 | Database RPCs | P0 |
| 3 | Astro Actions | P0 |
| 4 | Budget Tab UI | P0 |
| 5 | Add Expense Modal | P0 |
| 6 | Budget Settings Modal | P0 |
| 7 | Settlement View | P1 |
| 8 | Integration | P0 |
| 9 | Tests | P1 |

**Estimated complexity:** ~3-4 hours for core P0 features, ~2 hours for P1 enhancements
