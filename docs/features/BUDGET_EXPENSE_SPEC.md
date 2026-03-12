# Trip Budget & Expense Tracking — Feature Spec

> **Status:** Implemented (as of 2026-03-12)
> **Migrations:** 073–087
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
| `split_evenly` | All expenses divided equally among all members | No | Yes |
| `organizer_shoulders_all` | Owner covers everything; no splits for members | No | No |
| `everyone_pays_own` | Each member tracks personal expenses | No | Optional |
| `custom_split` | Each expense assigned to specific recipients | No | Yes |
| `event_fee` | Organizer charges a fixed fee per person | Yes | No |
| `budget_pool` | Members contribute to a shared pool that covers group expenses | Yes | Optional |

---

## Section Visibility by Method

| Section | split_evenly | custom_split | organizer_shoulders_all | everyone_pays_own | event_fee | budget_pool |
|---------|:---:|:---:|:---:|:---:|:---:|:---:|
| Summary cards | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Budget progress bar | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Expenses list + Add button | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| Member balances | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ |
| Fee Collection (event_fee) | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| Pool Contributions | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Pool Balance Card | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Pending Refunds | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |

> **Pending Refunds** — shown on non-pool methods when the trip previously used a pool method and members have unrefunded paid contributions.

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
- **From Pool**: drawn from shared funds → no splits; hides Who Paid + Covered Members; sets `paid_from_pool = true` on the expense row

---

## Pool Balance Tracking (`budget_pool` only)

### Pool Balance Card

Displayed above Pool Contributions when there is any pool activity (collected > 0 or spent > 0).

| State | Display |
|-------|---------|
| Balance > 0 | Blue border, "Available Balance ₱X", sub-line: "₱Y collected · ₱Z used" |
| Balance = 0 | Gray "₱0", sub-line: "₱Y collected · ₱Z used" |
| Balance < 0 (overdrawn) | Red border, "Pool Overdrawn −₱X", sub-line: "Overdrawn by ₱X · consider topping up" |

### Accounting Model

```
Pool Collected  = SUM(amount_paid) across paid/partial contributions
Pool Spent      = SUM(amount) from expenses where paid_from_pool = true
Pool Balance    = Pool Collected − Pool Spent  (can be negative = overdrawn)

Member Refundable (if pool dissolved today):
  = (member_amount_paid / total_collected) × pool_balance
  = 0 when pool_balance ≤ 0
```

### Per-Member Refundable Hints

On each `paid` contribution row in the Pool Contributions list:
- Shows `est. refund ₱X` when `refundable > 0` and `refundable ≠ amount_paid`
- Hidden when `refundable = 0` (pool fully consumed or overdrawn)

### Mark Refunded Button

- Shown on `paid` contribution rows for the trip owner
- Hidden when `refundable = 0` (nothing to give back)
- Clicking shows inline two-step confirm: "Refunded ₱X to Name?"
- Sets contribution `status = 'refunded'`; amount locked at `amount_paid`

---

## Pool Overdraft Handling

When a pool expense is added that causes `spent > collected`:
- Pool balance goes negative (no blocking — owner may expect late contributions)
- Balance card turns red with overdraft warning
- All member `refundable` amounts drop to ₱0

**To recover from overdraft:** Owner opens Budget Settings → increases "Target per Person" → save. The system auto-applies `transfer`, reopening any contributions that haven't met the new target (including previously-paid rows). Members see "₱X left" and can top up.

---

## Pool Contributions

### event_fee
- Auto-created for each member when they join (excluding trip owner)
- Fixed amount per person set by owner in Budget Settings
- Status: `pending` → `partial` → `paid`
- Owner records payments; partial amounts supported
- Shown in Fee Collection section

### budget_pool
- Auto-created for each member (including owner) when they join
- Same `pending → partial → paid` flow
- Owner can record full or partial payments
- `refunded` status when owner marks a paid contribution as reimbursed

---

## Selective Expense Splitting

The `add_trip_expense` RPC accepts `p_recipient_ids UUID[]`.

- When provided: splits only among those members (ignores cost_sharing_method)
- When NULL/empty: falls back to method-driven splitting
- Used by the expense form's member checkboxes

Pool-sourced expenses (`paid_from_pool = true`) **never generate splits** — the pool absorbs the full cost.

---

## Cost Sharing Method Changes

The owner can change the cost-sharing method mid-trip. The UI shows a **reconciliation panel** before saving with warnings for:

| Warning | When shown |
|---------|-----------|
| Unsettled splits | Switching from split_evenly / custom_split with outstanding splits |
| Pending pool contributions | Switching away from a pool method with pending/partial rows |
| Fully paid contributions (refund needed) | Switching away from pool with paid rows |
| Between pool methods | Switching event_fee ↔ budget_pool |

### Pool Action Options

When switching away from or between pool methods, the owner chooses what to do with pending/partial contributions:

| Action | Effect |
|--------|--------|
| `keep` | Leave pending contributions as-is; members still owe |
| `cancel` | Delete fully-pending rows; close partial rows at amount already paid |
| `transfer` | Adjust all contribution targets to the new per-person amount; reopens paid rows if new target > what they paid |

> **Auto-transfer:** When the owner saves settings *without* changing the method (just adjusting `pool_per_person`), `transfer` is applied automatically. This is the mechanism for recovering an overdrawn pool.

---

## Database Schema

### Tables

| Table | Purpose |
|-------|---------|
| `trip_budget_settings` | Per-trip config: method, budget estimate, pool settings, pool_status |
| `trip_expenses` | Individual expenses with `is_shared` and `paid_from_pool` flags |
| `expense_splits` | Who owes what per expense |
| `pool_contributions` | Per-member pool payment tracking (`pending/partial/paid/refunded`) |

### Key Columns

| Migration | Change |
|-----------|--------|
| 075 | `trip_expenses.is_shared BOOLEAN` |
| 078 | Auto-create pool_contributions on member join (trigger) |
| 079 | `event_fee`, `budget_pool` enum values; `pool_contributions.amount_paid` |
| 080 | `pool_contributions.partial_amount`; `pending→partial→paid` status flow |
| 081 | Trigger excludes owner for event_fee contributions |
| 082 | `p_recipient_ids UUID[]` on `add_trip_expense` |
| 086 | `trip_expenses.paid_from_pool BOOLEAN DEFAULT FALSE` |

### RPCs

| RPC | Migration | Description |
|-----|-----------|-------------|
| `get_trip_budget_settings(trip_id)` | 073 | Budget settings + cost sharing method |
| `upsert_trip_budget_settings(...)` | 073 | Update method, estimate, pool config |
| `add_trip_expense(...)` | 073+086 | Insert expense + create splits; accepts `p_paid_from_pool` |
| `get_trip_expenses(trip_id)` | 073+086 | All expenses with payer info + `paid_from_pool` column |
| `delete_trip_expense(expense_id)` | 073 | Remove expense and its splits |
| `get_member_balances(trip_id)` | 073 | Net balance per member |
| `get_member_owes(trip_id, user_id)` | 073 | Per-expense breakdown of what a member owes |
| `settle_expense_split(split_id)` | 073 | Mark a split as settled |
| `calculate_trip_settlement(trip_id)` | 073 | Settlement suggestions |
| `get_trip_expense_summary(trip_id)` | 073 | Expenses by category |
| `get_pool_contributions(trip_id)` | 079 | Per-member contribution rows |
| `upsert_pool_contribution(...)` | 079 | Member contributes to pool |
| `record_pool_payment(...)` | 080 | Owner records full or partial payment |
| `mark_contribution_refunded(contribution_id)` | 085 | Owner marks paid contribution as reimbursed |
| `get_pool_balance(trip_id)` | 086 | Pool balance + per-member refundable amounts |
| `get_unsettled_summary(trip_id)` | 084 | Snapshot of outstanding obligations before method change |
| `change_cost_sharing_method(...)` | 084+087 | Atomically change method with reconciliation (write-off splits, cancel/transfer pool) |

---

## Actions (`src/actions/budget.ts`)

| Action | Description |
|--------|-------------|
| `budget.getSettings` | Fetch budget settings |
| `budget.updateSettings` | Save budget settings (use `changeCostSharing` when changing method) |
| `budget.addExpense` | Add expense (recipientIds, isShared, paidFromPool) |
| `budget.deleteExpense` | Remove expense (owner only) |
| `budget.getExpenses` | List all expenses |
| `budget.getMemberBalances` | Member net balances |
| `budget.getMemberOwes` | Per-expense breakdown for a member |
| `budget.settleExpenseSplit` | Mark split settled |
| `budget.calculateSettlement` | Settlement suggestions |
| `budget.getExpenseSummary` | Expenses by category |
| `budget.getPoolContributions` | List pool/fee contribution rows |
| `budget.getPoolBalance` | Pool balance + per-member refundable amounts |
| `budget.contributeToPool` | Member self-contributes |
| `budget.recordPoolPayment` | Owner records full or partial payment |
| `budget.markContributionRefunded` | Owner marks a paid contribution as reimbursed (owner only) |
| `budget.markContributionPaid` | Legacy: mark paid (kept for backwards compat) |
| `budget.getUnsettledSummary` | Pre-flight check before method change (owner only) |
| `budget.changeCostSharing` | Change method with reconciliation options (owner only) |

---

## UI Components

All consolidated into `src/components/Trip/Budget/BudgetTab.astro`.

| Section | Description |
|---------|-------------|
| Summary cards | Total spent + budget bar (standard) / Collected + Pending (pool methods) |
| Pool Balance Card | `budget_pool` only — shows available balance, spent from pool; red when overdrawn |
| Progress bar | Shown when budget estimate is set (not for event_fee/budget_pool) |
| Expenses list | Date, description, category, payer (or "🏦 Pool" for pool-sourced), amount |
| Add Expense modal | Adaptive form (payment source toggle for budget_pool) |
| Budget Settings modal | Owner-only; method change with reconciliation warnings panel |
| Member Balances | Net ± per member; owes button with per-expense drill-down + settle action |
| Fee Collection | `event_fee`: per-member status, record full/partial payment |
| Pool Contributions | `budget_pool`: per-member status + est. refund hints + Mark Refunded button |
| Pending Refunds | Non-pool methods: shows paid contributions from a previous pool method |

### Expense List — Pool-sourced Display

Pool-sourced expenses (`paid_from_pool = true`) show:
- Sub-line: `🏦 Pool` instead of payer name
- Category badge: `from pool` in blue instead of category color

### Budget Settings — Reconciliation Warnings

Before committing a method change, the UI fetches `getUnsettledSummary` and conditionally renders:
- **Amber card** — unsettled expense splits with write-off checkbox
- **Blue card** — pending/partial pool contributions with keep/cancel radio
- **Purple card** — existing contributions when switching between pool methods (transfer/cancel)
- **Red card** — fully-paid contributions that need offline reimbursement
- **Green** — clean transition (no obligations)

---

## Known Limitations / Future Work

- No receipt photo upload (P2)
- No expense-by-day view linked to itinerary (P2)
- No GCash deep links (P2)
- Budget alerts (80% / 100%) not yet implemented
- Mid-trip join logic (only split from join date) not yet implemented
