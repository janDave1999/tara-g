# Budget & Expenses Adaptive UI Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the Budget & Expenses UI adapt intelligently to the selected cost-sharing method, so users always see only what's relevant to their trip's payment model.

**Architecture:** Two independent concerns — (1) how expenses are split (`cost_sharing_method`) and (2) whether there's a fixed per-person fee (`pool_per_person`) — drive conditional rendering of four distinct section types. Two new enum values (`event_fee`, `budget_pool`) make intent explicit. `BudgetTab.astro` reads `costSharingMethod` server-side to show/hide sections, and client-side JS calls only the relevant data loaders.

**Tech Stack:** Astro SSR, TypeScript, Tailwind CSS, Supabase PostgreSQL (RPCs), DaisyUI modals, Astro Actions

---

## Context: Current State

| File | Status |
|------|--------|
| `database-migrations/073-078_*.sql` | Existing schema + RPCs |
| `src/components/Trip/Budget/BudgetTab.astro` | Needs full rewrite |
| `src/actions/budget.ts` | No changes needed |
| `src/pages/trips/[trip_id]/expenses.astro` | Minor prop pass-through |

### Existing cost_sharing_method enum values
`split_evenly`, `organizer_shoulders_all`, `everyone_pays_own`, `custom_split`

---

## Section Visibility Matrix

| Section | split_evenly | custom_split | organizer_shoulders_all | everyone_pays_own | event_fee | budget_pool |
|---------|:---:|:---:|:---:|:---:|:---:|:---:|
| Summary cards | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Budget progress bar | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Fee Collection** | ❌ | ❌ | ❌ | ❌ | ✅ primary | ❌ |
| **Pool Contributions** | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ primary |
| **Member Balances** | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Expense Log | ✅ | ✅ | ✅ | ✅ (grouped) | optional | ✅ |
| Add Expense button | ✅ | ✅ | owner only | ✅ | ❌ | ✅ |

### Summary Card Labels per Method

| Method | Card 1 | Card 2 | Card 3 |
|--------|--------|--------|--------|
| split_evenly / custom_split | Total Spent | Budget | Remaining |
| organizer_shoulders_all | Total Spent | Budget | Remaining |
| everyone_pays_own | Total Spent | Members | — |
| **event_fee** | Fees Collected | Fee / Person | Outstanding |
| **budget_pool** | Pool Balance | Total Spent | Remaining |

---

## Task 1: DB Migration — Add enum values

**Files:**
- Create: `database-migrations/079_new_cost_sharing_methods.sql`

**Step 1: Write the migration**

```sql
-- 079_new_cost_sharing_methods.sql
-- Adds event_fee and budget_pool to the cost_sharing_method enum.
-- NOTE: ALTER TYPE ADD VALUE cannot run inside a transaction block.
-- Run each statement separately in Supabase SQL editor if needed.

ALTER TYPE cost_sharing_method ADD VALUE IF NOT EXISTS 'event_fee';
ALTER TYPE cost_sharing_method ADD VALUE IF NOT EXISTS 'budget_pool';

-- No changes needed to add_trip_expense:
-- New values fall through the existing CASE/IF without matching,
-- so no splits are created — correct behavior for both new modes.
```

**Step 2: Run in Supabase SQL editor**

Run each `ALTER TYPE` statement **separately** (not in a transaction). Verify with:
```sql
SELECT unnest(enum_range(NULL::cost_sharing_method));
```
Expected: 6 rows including `event_fee` and `budget_pool`.

---

## Task 2: BudgetTab Frontmatter + HTML Structure

**Files:**
- Modify: `src/components/Trip/Budget/BudgetTab.astro` (full rewrite of `---` section and HTML)

**Step 1: Replace Props interface and computed values**

```astro
---
interface Props {
  tripId: string;
  isOwner: boolean;
  userId?: string;
  costSharingMethod?: string;
  budgetEstimate?: number;
  poolEnabled?: boolean;
  poolPerPerson?: number;
  allowMembersToLog?: boolean;
}

const {
  tripId,
  isOwner,
  costSharingMethod = 'split_evenly',
  budgetEstimate,
  poolEnabled = false,
  poolPerPerson,
  allowMembersToLog = true,
} = Astro.props;

// Section visibility (server-side)
const isFeeMode     = costSharingMethod === 'event_fee';
const isPoolMode    = costSharingMethod === 'budget_pool';
const isBalanceMode = ['split_evenly', 'custom_split'].includes(costSharingMethod);
const isOwnMode     = costSharingMethod === 'everyone_pays_own';

// Add Expense: hidden for event_fee (fee IS the expense), owner-only for org_shoulders
const canAddExpense = !isFeeMode && (
  isOwner || (allowMembersToLog && costSharingMethod !== 'organizer_shoulders_all')
);

// Summary card labels
const summaryLabels = isFeeMode
  ? ['Fees Collected', 'Fee / Person', 'Outstanding']
  : isPoolMode
    ? ['Pool Balance', 'Total Spent', 'Remaining']
    : ['Total Spent', 'Budget', 'Remaining'];

// Card 2 static value (set server-side)
const card2StaticValue = isFeeMode
  ? (poolPerPerson ? `₱${Number(poolPerPerson).toLocaleString()}` : '—')
  : (budgetEstimate ? `₱${Number(budgetEstimate).toLocaleString()}` : '—');

const costSharingLabels: Record<string, string> = {
  split_evenly: 'Split Evenly',
  organizer_shoulders_all: 'Organizer Shoulders All',
  everyone_pays_own: 'Everyone Pays Own',
  custom_split: 'Custom Split',
  event_fee: 'Event Fee',
  budget_pool: 'Budget Pool',
};
const costSharingIcons: Record<string, string> = {
  split_evenly: '⚖️',
  organizer_shoulders_all: '🤝',
  everyone_pays_own: '👤',
  custom_split: '✏️',
  event_fee: '🎟️',
  budget_pool: '🏦',
};
const costSharingOptions = [
  { value: 'split_evenly',             label: '⚖️ Split Evenly' },
  { value: 'organizer_shoulders_all',  label: '🤝 Organizer Shoulders All' },
  { value: 'everyone_pays_own',        label: '👤 Everyone Pays Own' },
  { value: 'custom_split',             label: '✏️ Custom Split' },
  { value: 'event_fee',               label: '🎟️ Event Fee (fixed per person)' },
  { value: 'budget_pool',             label: '🏦 Budget Pool (shared fund)' },
];
---
```

**Step 2: Write the HTML structure**

Key data attributes on the container drive client-side JS:
- `data-cost-sharing` — the method
- `data-pool-per-person` — for event_fee summary math
- `data-budget-estimate` — for progress bar math

```astro
<div class="budget-container"
  data-trip-id={tripId}
  data-is-owner={isOwner}
  data-cost-sharing={costSharingMethod}
  data-pool-per-person={poolPerPerson || ''}
  data-budget-estimate={budgetEstimate || ''}>

  <!-- ── Header ── -->
  <div class="flex items-center justify-between gap-3 mb-5 px-1">
    <div>
      <h2 class="text-lg font-bold text-gray-900">Budget & Expenses</h2>
      <span class="text-xs text-gray-400 font-medium">
        {costSharingIcons[costSharingMethod]} {costSharingLabels[costSharingMethod] || costSharingMethod}
      </span>
    </div>
    <div class="flex gap-2 shrink-0">
      {isOwner && (
        <button id="budget-settings-btn" class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 border border-gray-200 text-sm font-medium transition-colors">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Settings
        </button>
      )}
      {canAddExpense && (
        <button id="add-expense-btn" class="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-colors">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4" />
          </svg>
          Add Expense
        </button>
      )}
    </div>
  </div>

  <!-- ── Summary Cards ── -->
  <div class="grid grid-cols-3 gap-2 mb-4">
    <div class="bg-white rounded-xl p-3 border border-gray-100">
      <p class="text-xs text-gray-400 mb-1">{summaryLabels[0]}</p>
      <p class="text-xl font-bold text-gray-900 tabular-nums" id="summary-c1">—</p>
    </div>
    <div class="bg-white rounded-xl p-3 border border-gray-100">
      <p class="text-xs text-gray-400 mb-1">{summaryLabels[1]}</p>
      <p class="text-xl font-bold text-gray-900 tabular-nums" id="summary-c2">{card2StaticValue}</p>
    </div>
    <div class="bg-white rounded-xl p-3 border border-gray-100">
      <p class="text-xs text-gray-400 mb-1">{summaryLabels[2]}</p>
      <p class="text-xl font-bold tabular-nums" id="summary-c3">—</p>
    </div>
  </div>

  <!-- ── Budget Progress (not for event_fee / budget_pool) ── -->
  {budgetEstimate && !isFeeMode && !isPoolMode && (
    <div class="mb-5 bg-white rounded-xl p-3 border border-gray-100">
      <div class="flex justify-between items-center mb-2">
        <span class="text-xs font-medium text-gray-500">Budget used</span>
        <span class="text-xs font-bold text-gray-700" id="budget-progress-text">0%</span>
      </div>
      <div class="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
        <div id="budget-progress-bar" class="h-1.5 rounded-full bg-blue-500 transition-all duration-500" style="width: 0%"></div>
      </div>
    </div>
  )}

  <!-- ── Fee Collection (event_fee only) ── -->
  {isFeeMode && (
    <div class="mb-4 bg-white rounded-xl border border-gray-100 overflow-hidden">
      <div class="px-4 py-3 border-b border-gray-50 flex items-center justify-between">
        <h3 class="text-sm font-bold text-gray-800">Fee Collection</h3>
        <span class="text-xs text-gray-400" id="fee-summary-label">Loading…</span>
      </div>
      <div id="fee-collection-body">
        <div class="px-4 py-6 text-center text-sm text-gray-400">Loading...</div>
      </div>
    </div>
  )}

  <!-- ── Pool Contributions (budget_pool only) ── -->
  {isPoolMode && (
    <div class="mb-4 bg-white rounded-xl border border-gray-100 overflow-hidden">
      <div class="px-4 py-3 border-b border-gray-50 flex items-center justify-between">
        <h3 class="text-sm font-bold text-gray-800">Contributions</h3>
        <span class="text-xs text-gray-400" id="pool-summary-label">Shared fund</span>
      </div>
      <div id="pool-contributions-body">
        <div class="px-4 py-6 text-center text-sm text-gray-400">Loading...</div>
      </div>
    </div>
  )}

  <!-- ── Member Balances (split_evenly, custom_split) ── -->
  {isBalanceMode && (
    <div class="mb-4 bg-white rounded-xl border border-gray-100 overflow-hidden">
      <div class="px-4 py-3 border-b border-gray-50 flex items-center justify-between">
        <h3 class="text-sm font-bold text-gray-800">Member Balances</h3>
        <span class="text-xs text-gray-400">tap owes to settle</span>
      </div>
      <div id="member-balances-body">
        <div class="px-4 py-6 text-center text-sm text-gray-400">Loading...</div>
      </div>
    </div>
  )}

  <!-- ── Expenses ── -->
  <div class="bg-white rounded-xl border border-gray-100 overflow-hidden">
    <div class="px-4 py-3 border-b border-gray-50">
      <h3 class="text-sm font-bold text-gray-800">
        {isFeeMode ? 'Additional Expenses' : isOwnMode ? 'Individual Expenses' : 'Expenses'}
      </h3>
    </div>
    <div id="expenses-body">
      <div class="px-4 py-6 text-center text-sm text-gray-400">No expenses yet</div>
    </div>
  </div>

</div>
```

---

## Task 3: Updated Modals

**Files:**
- Modify: `src/components/Trip/Budget/BudgetTab.astro` (modal section)

### Add Expense Modal — no changes needed

Keep as-is. The `canAddExpense` flag on the button already prevents it from rendering in event_fee mode.

### Budget Settings Modal — updated

Key changes:
1. Add new cost sharing options to the `<select>`
2. Replace "Charge a fixed fee" checkbox with a dynamic per-person field that shows/hides based on method selection
3. Add `allowMembersToLog` toggle (hidden for event_fee/budget_pool)

```astro
<dialog id="budget-settings-modal" class="modal">
  <div class="modal-box max-w-sm rounded-2xl p-0 overflow-hidden">
    <div class="px-5 py-4 border-b border-gray-100">
      <h3 class="font-bold text-base text-gray-900">Budget Settings</h3>
    </div>
    <form id="budget-settings-form" class="p-5 space-y-3">
      <input type="hidden" name="tripId" value={tripId} />

      <div>
        <label class="block text-xs font-semibold text-gray-600 mb-1">Cost Sharing Method</label>
        <select name="costSharingMethod" id="cost-sharing-select" required
          class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white">
          {costSharingOptions.map(opt => (
            <option value={opt.value} selected={costSharingMethod === opt.value}>{opt.label}</option>
          ))}
        </select>
        <p class="text-xs text-gray-400 mt-1" id="method-description"></p>
      </div>

      <div>
        <label class="block text-xs font-semibold text-gray-600 mb-1">Budget Estimate (₱)</label>
        <input type="number" name="budgetEstimate" step="0.01" min="0" placeholder="Optional"
          value={budgetEstimate || ''}
          class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
      </div>

      <!-- Per-person amount: shown for event_fee and budget_pool -->
      <div id="per-person-group" class={`${(isFeeMode || isPoolMode) ? '' : 'hidden'}`}>
        <label class="block text-xs font-semibold text-gray-600 mb-1" id="per-person-label">
          {isFeeMode ? 'Fee per Person (₱)' : 'Target Contribution per Person (₱)'}
        </label>
        <input type="number" name="poolPerPerson" step="0.01" min="0" value={poolPerPerson || ''}
          class="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
        <p class="text-xs text-gray-400 mt-1" id="per-person-hint">
          {isFeeMode
            ? 'Charged automatically when a member joins.'
            : 'Target amount each member should contribute to the shared fund.'}
        </p>
      </div>

      <!-- Allow members to log: hidden for event_fee / budget_pool -->
      <div id="allow-log-group" class={`${(isFeeMode || isPoolMode) ? 'hidden' : ''}`}>
        <label class="flex items-center gap-2 cursor-pointer select-none">
          <input type="checkbox" name="allowMembersToLog"
            class="w-4 h-4 rounded border-gray-300 text-blue-600"
            checked={allowMembersToLog} />
          <span class="text-sm text-gray-700">Allow members to log expenses</span>
        </label>
      </div>

      <div class="flex gap-2 pt-2 border-t border-gray-100">
        <button type="button" class="flex-1 px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          onclick="document.getElementById('budget-settings-modal').close()">Cancel</button>
        <button type="submit" class="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-colors">
          Save Settings
        </button>
      </div>
    </form>
  </div>
  <form method="dialog" class="modal-backdrop"><button>close</button></form>
</dialog>
```

### Owes Details Modal — keep as-is

---

## Task 4: Client-Side Script — Core Setup

**Files:**
- Modify: `src/components/Trip/Budget/BudgetTab.astro` (`<script>` section)

```typescript
<script>
  import { actions } from 'astro:actions';
  import { showToast } from '@/scripts/Toast';
  import { showConfirmModal } from '@/scripts/NewModal';

  const container = document.querySelector('.budget-container') as HTMLElement;
  const tripId    = container?.dataset.tripId;
  const isOwner   = container?.dataset.isOwner === 'true';
  const costSharing    = container?.dataset.costSharing || 'split_evenly';
  const poolPerPerson  = parseFloat(container?.dataset.poolPerPerson || '0');
  const budgetEstimate = parseFloat(container?.dataset.budgetEstimate || '0');

  const isFeeMode     = costSharing === 'event_fee';
  const isPoolMode    = costSharing === 'budget_pool';
  const isBalanceMode = ['split_evenly', 'custom_split'].includes(costSharing);
  const isOwnMode     = costSharing === 'everyone_pays_own';

  const CATEGORY_COLORS: Record<string, { bar: string; text: string; bg: string }> = {
    accommodation: { bar: 'bg-purple-400', text: 'text-purple-600', bg: 'bg-purple-50' },
    food:          { bar: 'bg-orange-400', text: 'text-orange-600', bg: 'bg-orange-50' },
    transport:     { bar: 'bg-blue-400',   text: 'text-blue-600',   bg: 'bg-blue-50'   },
    activities:    { bar: 'bg-green-400',  text: 'text-green-600',  bg: 'bg-green-50'  },
    misc:          { bar: 'bg-gray-400',   text: 'text-gray-500',   bg: 'bg-gray-50'   },
  };

  const AVATAR_COLORS = [
    'bg-blue-100 text-blue-700',
    'bg-purple-100 text-purple-700',
    'bg-green-100 text-green-700',
    'bg-amber-100 text-amber-700',
    'bg-rose-100 text-rose-700',
    'bg-cyan-100 text-cyan-700',
  ];

  const initials = (name: string) =>
    name.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase();

  let currentMembers: Array<{ id: string; name: string }> = [];

  function populatePayerSelect(members: Array<{ id: string; name: string }>) {
    const select = document.getElementById('payer-select') as unknown as HTMLSelectElement;
    if (!select) return;
    select.innerHTML = '<option value="">Select who paid</option>' +
      members.map(m => `<option value="${m.id}">${m.name}</option>`).join('');
  }

  async function loadData() {
    if (!tripId) return;
    try {
      const loaders: Promise<void>[] = [];
      if (isFeeMode)     loaders.push(loadFeeCollection());
      else if (isPoolMode) loaders.push(loadPoolContributions());
      else if (isBalanceMode) loaders.push(loadMemberBalances());
      else loaders.push(loadMemberListOnly()); // populate payer select for other modes

      if (!isFeeMode) loaders.push(loadExpenses());

      await Promise.all(loaders);
    } catch (e) {
      console.error('Budget data load failed:', e);
      showToast({ message: 'Failed to load budget data. Please refresh.', type: 'error' });
    }
  }

  // Populate payer select for modes that don't load balances/contributions
  async function loadMemberListOnly() {
    if (!tripId) return;
    const result = await actions.budget.getMemberBalances({ tripId });
    const balances = Array.isArray(result) ? result : (result?.data || []);
    currentMembers = balances.map((b: any) => ({ id: b.user_id, name: b.user_name }));
    populatePayerSelect(currentMembers);
  }
```

---

## Task 5: loadFeeCollection()

```typescript
  async function loadFeeCollection() {
    if (!tripId) return;
    const [balanceRes, poolRes] = await Promise.all([
      actions.budget.getMemberBalances({ tripId }),
      actions.budget.getPoolContributions({ tripId }),
    ]);
    const members = Array.isArray(balanceRes) ? balanceRes : (balanceRes?.data || []);
    const contribs: any[] = Array.isArray(poolRes) ? poolRes : (poolRes?.data || []);

    currentMembers = members.map((b: any) => ({ id: b.user_id, name: b.user_name }));

    const poolByUser = new Map<string, any>(contribs.map((c: any) => [c.user_id, c]));
    const paidCount  = contribs.filter((c: any) => c.status === 'paid').length;
    const totalCount = members.length;
    const unpaidCount = contribs.filter((c: any) => c.status !== 'paid').length;
    const outstanding = unpaidCount * poolPerPerson;

    // Summary cards
    const c1 = document.getElementById('summary-c1');
    const c3 = document.getElementById('summary-c3');
    if (c1) c1.textContent = `${paidCount} / ${totalCount}`;
    if (c3) {
      c3.textContent = `₱${outstanding.toLocaleString()}`;
      c3.className   = `text-xl font-bold tabular-nums ${outstanding > 0 ? 'text-amber-500' : 'text-green-600'}`;
    }
    const feeLabel = document.getElementById('fee-summary-label');
    if (feeLabel) feeLabel.textContent = `${paidCount} of ${totalCount} paid`;

    const body = document.getElementById('fee-collection-body')!;
    if (!body) return;
    if (members.length === 0) {
      body.innerHTML = `<div class="px-4 py-6 text-center text-sm text-gray-400">No members yet</div>`;
      return;
    }

    body.innerHTML = members.map((m: any, i: number) => {
      const contrib  = poolByUser.get(m.user_id);
      const isPaid   = contrib?.status === 'paid';
      const avatarColor = AVATAR_COLORS[i % AVATAR_COLORS.length];
      return `
        <div class="flex items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-b-0">
          <div class="w-9 h-9 rounded-full ${avatarColor} flex items-center justify-center text-xs font-bold shrink-0">
            ${initials(m.user_name)}
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-semibold text-gray-900 truncate">${m.user_name}</p>
            <p class="text-xs font-medium ${isPaid ? 'text-green-500' : 'text-amber-500'}">
              ${contrib ? `₱${parseFloat(contrib.amount).toLocaleString()} · ${isPaid ? 'Paid ✓' : 'Pending'}` : 'No fee assigned'}
            </p>
          </div>
          ${isOwner && contrib && !isPaid ? `
            <button class="mark-fee-paid-btn text-xs font-semibold text-blue-500 hover:text-blue-700 transition-colors"
              data-contribution-id="${contrib.id}" data-user-name="${m.user_name}" data-amount="${contrib.amount}">
              Mark paid
            </button>` : ''}
          <div class="w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${isPaid ? 'bg-green-100' : 'bg-gray-100'}">
            ${isPaid
              ? `<svg class="w-3 h-3 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"/></svg>`
              : `<span class="w-2 h-2 rounded-full bg-gray-300 block"></span>`}
          </div>
        </div>
      `;
    }).join('');

    setupMarkPaidHandlers(body, loadFeeCollection);
  }
```

---

## Task 6: loadPoolContributions()

```typescript
  async function loadPoolContributions() {
    if (!tripId) return;
    const [poolRes, expRes] = await Promise.all([
      actions.budget.getPoolContributions({ tripId }),
      actions.budget.getExpenses({ tripId }),
    ]);
    const contribs: any[] = Array.isArray(poolRes) ? poolRes : (poolRes?.data || []);
    const expenses: any[] = Array.isArray(expRes)  ? expRes  : (expRes?.data  || []);

    currentMembers = contribs.map((c: any) => ({ id: c.user_id, name: c.user_name }));
    populatePayerSelect(currentMembers);

    const poolTotal  = contribs.filter((c: any) => c.status === 'paid')
                               .reduce((s: number, c: any) => s + parseFloat(c.amount), 0);
    const totalSpent = expenses.reduce((s: number, e: any) => s + parseFloat(e.amount), 0);
    const remaining  = poolTotal - totalSpent;

    const c1 = document.getElementById('summary-c1');
    const c2 = document.getElementById('summary-c2');
    const c3 = document.getElementById('summary-c3');
    if (c1) c1.textContent = `₱${poolTotal.toLocaleString()}`;
    if (c2) c2.textContent = `₱${totalSpent.toLocaleString()}`;
    if (c3) {
      c3.textContent = remaining >= 0
        ? `₱${remaining.toLocaleString()}`
        : `-₱${Math.abs(remaining).toLocaleString()}`;
      c3.className = `text-xl font-bold tabular-nums ${remaining < 0 ? 'text-red-500' : 'text-green-600'}`;
    }

    const body = document.getElementById('pool-contributions-body')!;
    if (!body) return;
    if (contribs.length === 0) {
      body.innerHTML = `<div class="px-4 py-6 text-center text-sm text-gray-400">No contributions yet</div>`;
      return;
    }

    body.innerHTML = contribs.map((c: any, i: number) => {
      const isPaid = c.status === 'paid';
      const avatarColor = AVATAR_COLORS[i % AVATAR_COLORS.length];
      return `
        <div class="flex items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-b-0">
          <div class="w-9 h-9 rounded-full ${avatarColor} flex items-center justify-center text-xs font-bold shrink-0">
            ${initials(c.user_name)}
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-semibold text-gray-900 truncate">${c.user_name}</p>
            <p class="text-xs text-gray-400">₱${parseFloat(c.amount).toLocaleString()} contribution</p>
          </div>
          ${isOwner && !isPaid ? `
            <button class="mark-fee-paid-btn text-xs font-semibold text-blue-500 hover:text-blue-700 transition-colors"
              data-contribution-id="${c.id}" data-user-name="${c.user_name}" data-amount="${c.amount}">
              Mark received
            </button>` : ''}
          <span class="text-xs font-semibold ${isPaid ? 'text-green-500' : 'text-amber-500'}">
            ${isPaid ? 'Received ✓' : 'Pending'}
          </span>
        </div>
      `;
    }).join('');

    setupMarkPaidHandlers(body, loadPoolContributions);
  }
```

---

## Task 7: loadMemberBalances() — simplified (no pool fee in this mode)

```typescript
  async function loadMemberBalances() {
    if (!tripId) return;
    const result = await actions.budget.getMemberBalances({ tripId });
    const balances: any[] = Array.isArray(result) ? result : (result?.data || []);

    currentMembers = balances.map((b: any) => ({ id: b.user_id, name: b.user_name }));
    populatePayerSelect(currentMembers);

    const body = document.getElementById('member-balances-body')!;
    if (!body) return;
    if (balances.length === 0) {
      body.innerHTML = `<div class="px-4 py-6 text-center text-sm text-gray-400">No members yet</div>`;
      return;
    }

    body.innerHTML = balances.map((b: any, i: number) => {
      const balance  = parseFloat(b.net_balance) || 0;
      const owes     = parseFloat(b.total_owed)  || 0;
      const paid     = parseFloat(b.total_paid)  || 0;
      const avatarColor   = AVATAR_COLORS[i % AVATAR_COLORS.length];
      const balancePositive = balance >= 0;

      return `
        <div class="flex items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-b-0">
          <div class="w-9 h-9 rounded-full ${avatarColor} flex items-center justify-center text-xs font-bold shrink-0">
            ${initials(b.user_name)}
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-semibold text-gray-900 truncate">${b.user_name}</p>
            <p class="text-xs text-gray-400">Paid ₱${paid.toLocaleString()}</p>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            ${owes > 0
              ? `<button class="owes-btn text-xs px-2 py-0.5 rounded-full bg-orange-50 border border-orange-200 text-orange-600 font-semibold hover:bg-orange-100 transition-colors"
                   data-user-id="${b.user_id}" data-user-name="${b.user_name}">
                   owes ₱${owes.toLocaleString()}
                 </button>`
              : `<span class="text-xs text-gray-300">settled</span>`}
            <span class="text-sm font-bold tabular-nums min-w-[4rem] text-right ${balancePositive ? 'text-green-600' : 'text-red-500'}">
              ${balancePositive ? '+' : ''}₱${Math.abs(balance).toLocaleString()}
            </span>
          </div>
        </div>
      `;
    }).join('');

    // Update summary-c1 (total spent)
    const totalPaid = balances.reduce((s: number, b: any) => s + (parseFloat(b.total_paid) || 0), 0);
    // (total spent is set from loadExpenses, but set a reasonable default)
    // Owes handlers (same as before — see existing code)
    setupOwesHandlers(body);
  }
```

---

## Task 8: loadExpenses() — with everyone_pays_own grouping

```typescript
  async function loadExpenses() {
    if (!tripId) return;
    const result = await actions.budget.getExpenses({ tripId });
    const expenses: any[] = Array.isArray(result) ? result : (result?.data || []);

    const body = document.getElementById('expenses-body')!;
    if (!body) return;

    if (expenses.length === 0) {
      body.innerHTML = `<div class="px-4 py-8 text-center text-sm text-gray-400">No expenses yet</div>`;
      updateSummaryFromExpenses(0, expenses);
      return;
    }

    if (isOwnMode) {
      // Group by payer
      const byPayer = new Map<string, { name: string; items: any[]; total: number }>();
      for (const exp of expenses) {
        if (!byPayer.has(exp.payer_id)) byPayer.set(exp.payer_id, { name: exp.payer_name, items: [], total: 0 });
        const entry = byPayer.get(exp.payer_id)!;
        entry.items.push(exp);
        entry.total += parseFloat(exp.amount);
      }

      body.innerHTML = Array.from(byPayer.values()).map(({ name, items, total }) => `
        <div class="border-b border-gray-50 last:border-b-0">
          <div class="flex items-center justify-between px-4 py-2 bg-gray-50/70">
            <span class="text-xs font-bold text-gray-600">${name}</span>
            <span class="text-xs font-bold text-gray-600">₱${total.toLocaleString()}</span>
          </div>
          ${items.map(exp => expenseRow(exp)).join('')}
        </div>
      `).join('');
    } else {
      body.innerHTML = expenses.map((exp: any) => expenseRow(exp)).join('');
    }

    const total = expenses.reduce((s: number, e: any) => s + parseFloat(e.amount), 0);
    updateSummaryFromExpenses(total, expenses);

    // Delete handlers
    body.querySelectorAll('.delete-expense-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const expenseId = (e.currentTarget as HTMLElement).dataset.expenseId;
        if (!expenseId) return;
        const confirmed = await showConfirmModal({
          title: 'Delete Expense',
          message: 'This expense and all its splits will be permanently removed.',
          confirmText: 'Delete',
          confirmVariant: 'danger',
        });
        if (confirmed) {
          const res = await actions.budget.deleteExpense({ expenseId, tripId: tripId! });
          if (!(res as any).error) {
            showToast({ message: 'Expense deleted', type: 'success' });
            loadData();
          }
        }
      });
    });
  }

  function expenseRow(exp: any): string {
    const cat  = CATEGORY_COLORS[exp.category] ?? CATEGORY_COLORS.misc;
    const date = new Date(exp.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `
      <div class="flex items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-b-0 hover:bg-gray-50/50 transition-colors">
        <div class="w-1 self-stretch rounded-full ${cat.bar} shrink-0"></div>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-semibold text-gray-900 truncate">${exp.description || '—'}</p>
          <p class="text-xs text-gray-400">${date} · ${exp.payer_name}</p>
        </div>
        <div class="text-right shrink-0">
          <p class="text-sm font-bold text-gray-900">₱${parseFloat(exp.amount).toLocaleString()}</p>
          <span class="text-xs font-medium ${cat.text}">${exp.category}</span>
        </div>
        ${isOwner ? `
          <button class="delete-expense-btn p-1.5 text-gray-300 hover:text-red-400 hover:bg-red-50 rounded-lg transition-colors ml-1"
            data-expense-id="${exp.id}" title="Delete">
            <svg class="w-3.5 h-3.5 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>` : ''}
      </div>
    `;
  }

  function updateSummaryFromExpenses(total: number, expenses: any[]) {
    if (isFeeMode || isPoolMode) return; // handled by their own loaders

    const c1 = document.getElementById('summary-c1');
    if (c1) c1.textContent = `₱${total.toLocaleString()}`;

    // Remaining / diff
    const c3 = document.getElementById('summary-c3');
    if (c3 && budgetEstimate > 0) {
      const diff = budgetEstimate - total;
      c3.textContent = diff >= 0
        ? `₱${diff.toLocaleString()}`
        : `-₱${Math.abs(diff).toLocaleString()}`;
      c3.className = `text-xl font-bold tabular-nums ${diff < 0 ? 'text-red-500' : 'text-green-600'}`;
    }

    // Progress bar
    const bar  = document.getElementById('budget-progress-bar') as HTMLElement;
    const text = document.getElementById('budget-progress-text');
    if (bar && budgetEstimate > 0) {
      const pct = Math.min((total / budgetEstimate) * 100, 100);
      bar.style.width = `${pct}%`;
      bar.className   = `h-1.5 rounded-full transition-all duration-500 ${pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : 'bg-blue-500'}`;
      if (text) text.textContent = `${pct.toFixed(0)}%`;
    }
  }
```

---

## Task 9: Shared Handlers — setupMarkPaidHandlers + setupOwesHandlers

```typescript
  function setupMarkPaidHandlers(body: HTMLElement, reload: () => Promise<void>) {
    body.querySelectorAll('.mark-fee-paid-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const el = e.currentTarget as HTMLElement;
        const contributionId = el.dataset.contributionId;
        const userName       = el.dataset.userName;
        const amount         = parseFloat(el.dataset.amount || '0');
        if (!contributionId) return;

        const originalText = el.textContent!.trim();
        el.textContent = 'Confirm?';
        el.classList.add('text-green-600');
        el.dataset.confirming = 'true';

        const cancelEl = document.createElement('button');
        cancelEl.textContent = 'Cancel';
        cancelEl.className   = 'text-xs text-gray-400 hover:text-gray-600 font-semibold transition-colors mr-1';
        el.insertAdjacentElement('beforebegin', cancelEl);

        cancelEl.addEventListener('click', () => {
          cancelEl.remove();
          el.textContent = originalText;
          el.classList.remove('text-green-600');
          delete el.dataset.confirming;
        });

        el.addEventListener('click', async () => {
          if (!el.dataset.confirming) return;
          const res = await actions.budget.markContributionPaid({ contributionId, tripId: tripId! });
          if (!(res as any).error) {
            showToast({ message: `Marked as paid for ${userName}`, type: 'success' });
            await reload();
          }
        }, { once: true });
      });
    });
  }

  function setupOwesHandlers(body: HTMLElement) {
    body.querySelectorAll('.owes-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const target   = e.currentTarget as HTMLElement;
        const uid      = target.dataset.userId;
        const userName = target.dataset.userName;
        if (!uid || !tripId) return;

        const modalTitle = document.getElementById('owes-modal-title');
        if (modalTitle) modalTitle.textContent = `${userName} owes`;

        const modalContent = document.getElementById('owes-modal-content')!;
        modalContent.innerHTML = `<p class="text-sm text-gray-400 text-center py-4">Loading...</p>`;
        (document.getElementById('owes-modal') as HTMLDialogElement)?.showModal();

        try {
          const result = await actions.budget.getMemberOwes({ tripId, userId: uid });
          const owes: any[] = Array.isArray(result) ? result : (result?.data || []);

          if (owes.length === 0) {
            modalContent.innerHTML = `<p class="text-sm text-gray-400 text-center py-4">No outstanding balances</p>`;
          } else {
            modalContent.innerHTML = `
              <div class="space-y-2">
                ${owes.map((o: any) => `
                  <div class="flex items-center gap-3 p-3 bg-gray-50 rounded-xl owes-item" data-split-id="${o.split_id}">
                    <div class="flex-1 min-w-0">
                      <p class="text-sm font-semibold text-gray-900 truncate">${o.expense_description || '—'}</p>
                      <p class="text-xs text-gray-400">
                        ${new Date(o.expense_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        · to ${o.payer_name}
                      </p>
                    </div>
                    <div class="text-right shrink-0">
                      <p class="text-sm font-bold text-gray-900">₱${parseFloat(o.share_amount).toLocaleString()}</p>
                      <button class="settle-expense-btn text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors mt-0.5"
                        data-split-id="${o.split_id}"
                        data-amount="${o.share_amount}"
                        data-payer="${o.payer_name}">
                        Settle →
                      </button>
                    </div>
                  </div>
                `).join('')}
              </div>
            `;

            modalContent.querySelectorAll('.settle-expense-btn').forEach(settleBtn => {
              settleBtn.addEventListener('click', async (e) => {
                const btn   = e.currentTarget as HTMLElement;
                const splitId = btn.dataset.splitId;
                if (!splitId) return;

                const item           = btn.closest('.owes-item') as HTMLElement;
                const amount         = btn.dataset.amount || '0';
                const originalContent = item.innerHTML;

                item.innerHTML = `
                  <div class="flex items-center justify-between w-full gap-3">
                    <p class="text-sm text-gray-600">Settle ₱${parseFloat(amount).toLocaleString()}?</p>
                    <div class="flex gap-2 shrink-0">
                      <button class="confirm-settle-no px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-200 rounded-lg transition-colors">Cancel</button>
                      <button class="confirm-settle-yes px-3 py-1.5 text-xs font-semibold bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors">Confirm</button>
                    </div>
                  </div>
                `;

                item.querySelector('.confirm-settle-no')?.addEventListener('click', () => {
                  item.innerHTML = originalContent;
                });

                item.querySelector('.confirm-settle-yes')?.addEventListener('click', async () => {
                  const res = await actions.budget.settleExpenseSplit({ splitId, tripId: tripId! });
                  if (!(res as any).error) {
                    showToast({ message: 'Settled!', type: 'success' });
                    item.remove();
                    await loadMemberBalances();
                    if (!modalContent.querySelector('.owes-item')) {
                      modalContent.innerHTML = `<p class="text-sm text-gray-400 text-center py-4">No outstanding balances</p>`;
                    }
                  }
                });
              });
            });
          }
        } catch (err) {
          console.error('Error loading owes:', err);
          modalContent.innerHTML = `<p class="text-sm text-red-500 text-center py-4">Error loading details</p>`;
        }
      });
    });
  }
```

---

## Task 10: Event Listeners + Settings Form

```typescript
  // Button listeners
  document.getElementById('add-expense-btn')?.addEventListener('click', () => {
    (document.getElementById('expense-modal') as HTMLDialogElement)?.showModal();
  });
  document.getElementById('budget-settings-btn')?.addEventListener('click', () => {
    (document.getElementById('budget-settings-modal') as HTMLDialogElement)?.showModal();
  });

  // Expense form
  const expenseForm = document.getElementById('expense-form') as HTMLFormElement;
  expenseForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd  = new FormData(expenseForm);
    const btn = expenseForm.querySelector('[type="submit"]') as HTMLButtonElement;
    btn.disabled = true; btn.textContent = 'Adding...';
    try {
      const res = await actions.budget.addExpense({
        tripId:      tripId!,
        payerId:     fd.get('payerId') as string,
        amount:      parseFloat(fd.get('amount') as string),
        description: fd.get('description') as string,
        category:    fd.get('category') as any,
        date:        fd.get('date') as string,
        isShared:    fd.has('isShared'),
      });
      if (!(res as any).error) {
        showToast({ message: 'Expense added!', type: 'success' });
        (document.getElementById('expense-modal') as HTMLDialogElement)?.close();
        expenseForm.reset();
        loadData();
      }
    } catch (err) {
      console.error('Error adding expense:', err);
      showToast({ message: 'Error adding expense', type: 'error' });
    } finally {
      btn.disabled = false; btn.textContent = 'Add Expense';
    }
  });

  // Settings form
  const settingsForm = document.getElementById('budget-settings-form') as HTMLFormElement;
  settingsForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd  = new FormData(settingsForm);
    const btn = settingsForm.querySelector('[type="submit"]') as HTMLButtonElement;
    btn.disabled = true; btn.textContent = 'Saving...';
    try {
      const method = fd.get('costSharingMethod') as string;
      const res = await actions.budget.updateSettings({
        tripId:             tripId!,
        costSharingMethod:  method as any,
        budgetEstimate:     fd.get('budgetEstimate') ? parseFloat(fd.get('budgetEstimate') as string) : null,
        poolEnabled:        ['event_fee', 'budget_pool'].includes(method),
        poolPerPerson:      fd.get('poolPerPerson') ? parseFloat(fd.get('poolPerPerson') as string) : null,
        allowMembersToLog:  fd.has('allowMembersToLog'),
      });
      if (!(res as any).error) {
        showToast({ message: 'Settings saved!', type: 'success' });
        (document.getElementById('budget-settings-modal') as HTMLDialogElement)?.close();
        window.location.reload();
      }
    } catch (err) {
      console.error('Error saving settings:', err);
      showToast({ message: 'Error saving settings', type: 'error' });
    } finally {
      btn.disabled = false; btn.textContent = 'Save Settings';
    }
  });

  // Settings modal — show/hide per-person field and allow-log field based on method
  const methodSelect = document.getElementById('cost-sharing-select') as unknown as HTMLSelectElement;
  const METHOD_DESCRIPTIONS: Record<string, string> = {
    split_evenly:            'All expenses divided equally among members.',
    organizer_shoulders_all: 'Organizer covers all costs. Members see expenses but owe nothing.',
    everyone_pays_own:       'Each member logs and tracks their own expenses independently.',
    custom_split:            'Manually assign how much each member owes per expense.',
    event_fee:               'Charge each member a fixed joining fee. Fee status tracked here.',
    budget_pool:             'Members contribute to a shared fund. Expenses drawn from the pool.',
  };

  function updateSettingsVisibility(method: string) {
    const isNewMode = ['event_fee', 'budget_pool'].includes(method);
    document.getElementById('per-person-group')?.classList.toggle('hidden', !isNewMode);
    document.getElementById('allow-log-group')?.classList.toggle('hidden', isNewMode);
    const label = document.getElementById('per-person-label');
    if (label) label.textContent = method === 'event_fee' ? 'Fee per Person (₱)' : 'Target Contribution per Person (₱)';
    const hint = document.getElementById('per-person-hint');
    if (hint) hint.textContent = method === 'event_fee'
      ? 'Charged automatically when a member joins.'
      : 'Target amount each member should contribute.';
    const desc = document.getElementById('method-description');
    if (desc) desc.textContent = METHOD_DESCRIPTIONS[method] || '';
  }

  methodSelect?.addEventListener('change', (e) => {
    updateSettingsVisibility((e.target as HTMLSelectElement).value);
  });
  // Initialize on modal open
  document.getElementById('budget-settings-btn')?.addEventListener('click', () => {
    updateSettingsVisibility(methodSelect?.value || costSharing);
  });

  loadData();
</script>
```

---

## Task 11: Owes Details Modal — add to HTML

Keep existing owes modal HTML exactly as-is (it's only used in `split_evenly`/`custom_split` mode via `isBalanceMode`).

---

## Verification Checklist

| Scenario | Expected |
|----------|----------|
| `split_evenly` trip | Summary + Member Balances + Expenses visible |
| `event_fee` trip | Summary (X/Y Paid, ₱X/person, ₱X outstanding) + Fee Collection + NO Add Expense btn |
| `budget_pool` trip | Summary (pool total, spent, remaining) + Contributions + Expenses |
| `everyone_pays_own` trip | Summary + Expenses grouped by person, NO Member Balances |
| `organizer_shoulders_all` trip | Summary + Expenses (no Add btn for members) |
| Change method via Settings | Page reloads, correct sections shown |
| Mark fee paid (event_fee) | Inline confirm → success toast → collection refreshes |
| Mark contribution received (budget_pool) | Same flow |
| Settle expense (split_evenly) | Owes modal settle → balances refresh |

---

## Files Summary

| File | Change |
|------|--------|
| `database-migrations/079_new_cost_sharing_methods.sql` | **Create** — add enum values |
| `src/components/Trip/Budget/BudgetTab.astro` | **Full rewrite** |
| `src/actions/budget.ts` | **No changes** |
| `src/pages/trips/[trip_id]/expenses.astro` | **No changes** (all props already passed) |
