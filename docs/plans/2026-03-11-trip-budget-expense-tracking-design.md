# Trip Budget & Expense Tracking — Design Document

> **Date:** March 11, 2026  
> **Status:** Design Approved  
> **Feature:** Trip Budget & Expense Tracking

---

## 1. Overview

A flexible expense tracking system for trips that supports 4 cost sharing methods, optional budget pooling, and full settlement workflow — while serving as information sharing for public trips.

---

## 2. Cost Sharing Methods

| Method | Behavior | Budget Pool Support |
|--------|----------|---------------------|
| **Split Evenly** | All expenses divided equally among members | Yes |
| **Organizer Shoulders All** | Owner covers everything, members join free | No |
| **Everyone Pays Own** | Each member tracks personal expenses, no splitting | Yes |
| **Custom Split** | Each expense assigned to specific members (can split across multiple) | Yes |

- **Default:** Split Evenly
- **Can change:** Anytime during trip (owner-only)

---

## 3. Budget Estimate

- Optional per-trip setting (owner sets)
- Shows estimated cost per person
- Visible to prospective members before joining (public trips)
- Not required for "Organizer Shoulders All"
- **Budget Alerts:** Notify members at 80% and 100% of budget

---

## 4. Budget Pool

**How it works:**
- Owner enables pool and sets per-person contribution amount
- Members contribute money before trip starts
- Pool acts as a collective fund
- After trip: calculate actual expenses against pool
- Show remaining balance to return or how much organizer owes members

**Supported methods:** Split Evenly, Everyone Pays Own, Custom Split  
**Not supported:** Organizer Shoulders All

---

## 5. Expense Logging

**Who can log:** Owner and all members (configurable by owner)

**Per expense:**
- Amount
- Description
- Category (accommodation, food, transport, activities, misc)
- Date
- Payer (who paid)
- Split recipients (who's responsible) — varies by method
- **Receipt photo** (optional attachment)

**For Custom Split:**
- Payer is auto-filled
- Select recipients (one or multiple)
- System calculates each person's share

**Rounding handling:** Extra cent from uneven splits carries over to organizer's balance

---

## 6. Views & Outputs

### A. Expense Summary (Visibility)
- Total spent vs budget estimate with progress %
- Breakdown by category
- **Expense-by-Day view** — organized by itinerary day
- Per-person contribution summary
- For public trips: visible to anyone with link

### B. Settlement (Calculation)
- Who paid what
- Who owes whom
- Net balance per member
- **Mid-trip join logic:** Only split expenses from join date forward

### C. Reimbursement (Action)
- Mark debts as "settled"
- Optional: track payment method (cash, GCash, etc.)
- **Deep links** for GCash/Cash transfer initiation

---

## 7. Data Model

### Tables

```sql
-- Trip budget settings
CREATE TABLE trip_budget_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID REFERENCES trips(id) ON DELETE CASCADE,
  cost_sharing_method TEXT NOT NULL DEFAULT 'split_evenly',
  budget_estimate DECIMAL(12,2),
  pool_enabled BOOLEAN DEFAULT FALSE,
  pool_per_person DECIMAL(12,2),
  pool_status TEXT DEFAULT 'open', -- open, closed
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Individual expenses
CREATE TABLE trip_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID REFERENCES trips(id) ON DELETE CASCADE,
  payer_id UUID REFERENCES users(id) NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  description TEXT,
  category TEXT NOT NULL, -- accommodation, food, transport, activities, misc
  date DATE NOT NULL,
  receipt_url TEXT,
  stop_id UUID REFERENCES trip_location(id), -- optional link to itinerary stop
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Expense splits (who owes what for each expense)
CREATE TABLE expense_splits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id UUID REFERENCES trip_expenses(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) NOT NULL,
  share_amount DECIMAL(12,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Pool contributions
CREATE TABLE pool_contributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID REFERENCES trips(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  status TEXT DEFAULT 'pending', -- pending, paid
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Settlements between members
CREATE TABLE expense_settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID REFERENCES trips(id) ON DELETE CASCADE,
  from_user_id UUID REFERENCES users(id) NOT NULL,
  to_user_id UUID REFERENCES users(id) NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  status TEXT DEFAULT 'unsettled', -- unsettled, settled
  method TEXT, -- cash, gcash, bank_transfer, other
  settled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 8. API / Actions

| Action | Purpose |
|--------|---------|
| `budget.getSettings` | Get trip budget settings and cost sharing method |
| `budget.updateSettings` | Update budget estimate, cost sharing method, pool settings |
| `expenses.list` | List all expenses for a trip (with filters) |
| `expenses.create` | Add new expense with splits |
| `expenses.update` | Edit expense and splits |
| `expenses.delete` | Remove expense |
| `pool.getContributions` | Get pool status and contributions |
| `pool.contribute` | Mark contribution as paid |
| `settlement.calculate` | Calculate who owes whom |
| `settlement.markSettled` | Mark settlement as complete |

---

## 9. UI Components

| Component | Description |
|-----------|-------------|
| `BudgetTab` | Main budget view with summary cards |
| `BudgetSettingsForm` | Form to set budget estimate and cost sharing method |
| `PoolManager` | Enable pool, set per-person amount, track contributions |
| `ExpenseList` | Filterable list of expenses by day/category/payer |
| `ExpenseModal` | Add/edit expense with category, amount, payer, recipients |
| `ExpenseSummary` | Category breakdown, total vs budget, progress bar |
| `SettlementView` | Per-member balances, who owes whom |
| `SettlementAction` | Mark as settled, optional payment method |

---

## 10. Task Prioritization

### P0 — MVP (Must Have)

| # | Task | Description |
|---|------|-------------|
| P0.1 | Database schema | Create tables: trip_budget_settings, trip_expenses, expense_splits |
| P0.2 | Budget settings UI | Owner can set budget estimate and select cost sharing method |
| P0.3 | Add expense | Owner/members can log expenses with payer and amount |
| P0.4 | Split logic — Split Evenly | Auto-calculate equal splits |
| P0.5 | Expense summary | Show total spent vs budget, category breakdown |
| P0.6 | Settlement calculation | Calculate who owes whom |

### P1 — Core Enhancement

| # | Task | Description |
|---|------|-------------|
| P1.1 | Budget pool | Enable pool, per-person contributions, track paid status |
| P1.2 | Custom Split | Assign expense to specific recipients |
| P1.3 | Expense-by-day view | Organize expenses by itinerary day |
| P1.4 | Budget alerts | Notify at 80% and 100% of budget |
| P1.5 | Mid-trip join logic | Only split expenses from join date forward |
| P1.6 | Settlement actions | Mark debts as settled, track payment method |

### P2 — Nice to Have

| # | Task | Description |
|---|------|-------------|
| P2.1 | Receipt uploads | Attach photo to expense |
| P2.2 | Expense-to-stop sync | Link expense to itinerary stop |
| P2.3 | GCash deep links | Direct GCash transfer link |
| P2.4 | Everyone Pays Own mode | Personal expense tracking per member |
| P2.5 | Rounding handling | Carry over extra cent |
| P2.6 | Public trip visibility | Show budget info on public trip pages |

---

## 11. Acceptance Criteria

| ID | Criteria |
|----|----------|
| AC1 | Owner can set budget estimate (optional) during trip creation |
| AC2 | Owner can select cost sharing method (4 options) |
| AC3 | Owner can change cost sharing method anytime |
| AC4 | Members can add expenses with amount, description, category, date, payer |
| AC5 | Split Evenly divides expense equally among all members |
| AC6 | Custom Split allows selecting one or more recipients per expense |
| AC7 | Budget summary shows total spent, budget, and category breakdown |
| P1.8 | Budget alert triggers at 80% and 100% thresholds |
| P1.9 | Settlement shows net balance per member (who owes whom) |
| P1.10 | Pool can be enabled with per-person amount |
| P1.11 | Members can mark contribution as paid |
| P1.12 | Expenses can be organized by day (itinerary day) |

---

## 12. Dependencies

```
Trip Creation (P0)
    │
    └──► Budget Settings (P0) ──► Cost Sharing Methods (P0)
                                     │
                                     ├──► Expense Logging (P0)
                                     │       │
                                     │       └──► Split Logic (P0)
                                     │
                                     ├──► Budget Pool (P1)
                                     │
                                     └──► Settlement (P0)
```

---

## 13. Future Enhancements (Post-MVP)

- Export expense report as PDF
- Recurring trip templates with budgets
- Multi-currency support
- Expense approval workflow (owner must approve large expenses)
- Budget forecast (predict final cost based on current spending rate)
