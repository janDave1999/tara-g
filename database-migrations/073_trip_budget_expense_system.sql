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
    trip_id UUID NOT NULL UNIQUE,
    cost_sharing_method cost_sharing_method NOT NULL DEFAULT 'split_evenly',
    budget_estimate DECIMAL(12,2),
    pool_enabled BOOLEAN DEFAULT FALSE,
    pool_per_person DECIMAL(12,2),
    pool_status TEXT DEFAULT 'open',
    allow_members_to_log BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE trip_budget_settings
    ADD CONSTRAINT fk_trip_budget_settings_trip FOREIGN KEY (trip_id) REFERENCES trips(trip_id) ON DELETE CASCADE;

-- Individual expenses
CREATE TABLE trip_expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id UUID NOT NULL,
    payer_id UUID NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    description TEXT,
    category TEXT NOT NULL,
    date DATE NOT NULL,
    receipt_url TEXT,
    stop_id UUID,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE trip_expenses
    ADD CONSTRAINT fk_trip_expenses_trip FOREIGN KEY (trip_id) REFERENCES trips(trip_id) ON DELETE CASCADE;

-- Expense splits (who owes what for each expense)
CREATE TABLE expense_splits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    expense_id UUID NOT NULL,
    user_id UUID NOT NULL,
    share_amount DECIMAL(12,2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE expense_splits
    ADD CONSTRAINT fk_expense_splits_expense FOREIGN KEY (expense_id) REFERENCES trip_expenses(id) ON DELETE CASCADE;

-- Pool contributions
CREATE TABLE pool_contributions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id UUID NOT NULL,
    user_id UUID NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    status TEXT DEFAULT 'pending',
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(trip_id, user_id)
);

ALTER TABLE pool_contributions
    ADD CONSTRAINT fk_pool_contributions_trip FOREIGN KEY (trip_id) REFERENCES trips(trip_id) ON DELETE CASCADE;

-- Settlements between members
CREATE TABLE expense_settlements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id UUID NOT NULL,
    from_user_id UUID NOT NULL,
    to_user_id UUID NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    status TEXT DEFAULT 'unsettled',
    method TEXT,
    settled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE expense_settlements
    ADD CONSTRAINT fk_expense_settlements_trip FOREIGN KEY (trip_id) REFERENCES trips(trip_id) ON DELETE CASCADE;

-- Indexes
CREATE INDEX idx_trip_expenses_trip_id ON trip_expenses(trip_id);
CREATE INDEX idx_trip_expenses_date ON trip_expenses(date);
CREATE INDEX idx_expense_splits_expense_id ON expense_splits(expense_id);
CREATE INDEX idx_pool_contributions_trip_id ON pool_contributions(trip_id);
CREATE INDEX idx_expense_settlements_trip_id ON expense_settlements(trip_id);
