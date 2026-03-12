# Trip Budget & Expense Tracking — Feature Spec

> **Status:** Implemented (as of 2026-03-12)
> **Migrations:** 073–082
> **Component:** `src/components/Trip/Budget/BudgetTab.astro`
> **Actions:** `src/actions/budget.ts`
> **Page:** `src/pages/trips/[trip_id]/expenses.astro`

---

## Overview

A flexible expense tracking system for trips. The UI adapts based on the trip's **cost sharing method** so members only see what's relevant to their trip's payment model.

---

## Cost Sharing Methods

| Method | Description | Pool Support | Splits Created |
|--------|-------------|:---:|:---:|
| `split_evenly` | All expenses divided equally among all members | Yes | Yes |
| `organizer_shoulders_all` | Owner covers everything; no splits for members | No | No |
| `everyone_pays_own` | Each member tracks personal expenses | Yes | Optional |
| `custom_split` | Each expense assigned to specific recipients | Yes | Yes |
| `event_fee` | Organizer charges a fixed fee per person (members must pay to join) | — | No |
| `budget_pool` | Members contribute to a shared pool that covers group expenses | — | Optional |

---

## Section Visibility by Method

| Section | split_evenly | custom_split | organizer_shoulders_all | everyone_pays_own | event_fee | budget_pool |
|---------|:---:|:---:|:---:|:---:|:---:|:---:|
| Summary cards | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Budget progress bar | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Expenses list + Add button | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| Member balances | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ |
| Fee Collection (event_fee) | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| Pool Contributions | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |

---

## Expense Form — Adaptive Fields

All methods that support expenses show:
- Category, Amount, Description, Date

**Who Paid?** — shown unless Payment Source = "From Pool"

**Covered Members** (checkboxes) — shown for `split_evenly`, `custom_split`, `everyone_pays_own`, `budget_pool` (Personal)
- All members checked by default
- Payer row marked with green "Paid" badge (always included)
- Select All / None buttons
- Live per-person calculator: `₱X.XX each · N covered`

**Payment Source** (radio) — shown only for `budget_pool`
- **Personal**: someone paid out of pocket → creates splits among covered members
- **From Pool**: drawn from shared funds → no splits; hides Who Paid + Covered Members

---

## Pool Contributions

### event_fee
- Auto-created for each member when they join (excluding trip owner)
- Fixed amount per person set by owner in Budget Settings
- Status: `pending` → `partial` → `paid`
- Owner records payments; partial amounts supported
- Shown in Fee Collection tab

### budget_pool
- Auto-created for each member including owner when they join
- Same `pending → partial → paid` flow
- Shown in Pool Contributions tab
- Pool balance = total paid contributions − total pool expenses

---

## Selective Expense Splitting

The `add_trip_expense` RPC accepts `p_recipient_ids UUID[]`.

- When provided: splits only among those members (ignores cost_sharing_method logic)
- When NULL/empty: falls back to method-driven splitting (all members for split_evenly, etc.)
- Used by the expense form's member checkboxes

---

## Database Schema

### Tables

| Table | Purpose |
|-------|---------|
| `trip_budget_settings` | Per-trip config: method, budget estimate, pool settings |
| `trip_expenses` | Individual expenses with `is_shared` flag |
| `expense_splits` | Who owes what per expense |
| `pool_contributions` | Per-member pool payment tracking (`pending/partial/paid`) |

### Key Columns Added Over Time

| Migration | Change |
|-----------|--------|
| 075 | `trip_expenses.is_shared BOOLEAN` |
| 078 | Auto-create pool_contributions on member join (trigger) |
| 079 | `event_fee`, `budget_pool` enum values; `pool_contributions.amount_paid` |
| 080 | `pool_contributions.partial_amount`; `pending→partial→paid` status |
| 081 | Trigger excludes owner for event_fee contributions |
| 082 | `p_recipient_ids UUID[]` param on `add_trip_expense` |

### RPCs

| RPC | Description |
|-----|-------------|
| `get_trip_budget_settings(trip_id)` | Budget settings + cost sharing method |
| `update_budget_settings(...)` | Update method, estimate, pool config |
| `add_trip_expense(...)` | Insert expense + create splits |
| `get_trip_expenses(trip_id)` | All expenses with payer info |
| `get_member_balances(trip_id)` | Net balance per member (receivable-based) |
| `record_pool_contribution(...)` | Mark contribution paid/partial |

---

## Actions (`src/actions/budget.ts`)

| Action | Description |
|--------|-------------|
| `budget.getSettings` | Fetch budget settings |
| `budget.updateSettings` | Save budget settings |
| `budget.addExpense` | Add expense (with optional recipientIds, isShared, paymentSource) |
| `budget.getExpenses` | List expenses |
| `budget.getMemberBalances` | Member net balances + pool status |
| `budget.recordContribution` | Record pool/fee payment |

---

## UI Components

All consolidated into `src/components/Trip/Budget/BudgetTab.astro`.

| Section | Description |
|---------|-------------|
| Summary cards | Total spent, budget, remaining / pool balance |
| Progress bar | Shown when budget estimate is set (not for event_fee/budget_pool) |
| Expenses list | Tabular list per expense: date, description, category, payer, amount |
| Add Expense modal | Adaptive form (see above) |
| Budget Settings modal | Owner-only; change method, estimate, pool config |
| Member Balances | Net ± per member; positive = owed money, negative = owes money |
| Fee Collection tab | event_fee: per-member payment status, record payment |
| Pool Contributions tab | budget_pool: per-member contribution status |

---

## Known Limitations / Future Work

- No receipt photo upload (P2)
- No expense-by-day view linked to itinerary (P2)
- No GCash deep links (P2)
- Settlement "mark as settled" flow not yet implemented
- Budget alerts (80% / 100%) not yet implemented
- Mid-trip join logic (only split from join date) not yet implemented
