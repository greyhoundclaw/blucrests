# Bluecrest Stabilization Implementation Plan

This plan focuses first on the backend stability risks that can corrupt balances or make the app impossible to run consistently. The older plan in `bluecrestback/src/repositories/implementation_plan.md` is still useful for frontend/backend wiring, but it should come after the database and ledger engine are stable.

## Current Findings

- Backend dependencies are not installed in `bluecrestback`, so the backend cannot currently inspect or use `local.db` until `npm install` is run there.
- `bluecrestback/src/database/db.js` switches to Postgres whenever `DATABASE_URL` exists, but the SQL uses SQLite placeholders and SQLite-only syntax throughout the codebase.
- `bluecrestback/src/database/init.js` is not a stable migration system. It creates tables imperatively, uses `INSERT OR IGNORE`, and only patches one user column after the fact.
- `bluecrestback/src/database/init.js` seeds the admin with fixed `id = 1` and account number `1000000001`. If the complaint is that the database is "only set to 1 number", this fixed seed is the first place to normalize.
- Balance mutation is coupled to ledger creation in `transaction.service.js`. A `COMPLETED` debit or credit updates `users.balance` automatically.
- Transfer approval also mutates balance directly in `transfer.service.js`. This creates double-deduction or missing-credit risks depending on transfer status and flow.
- `transfer_flow` lives on the user record and controls whether new transfers become `COMPLETED` or `PENDING`. That makes transfer state global to the user instead of explicit per transfer.
- Repository methods often return every row after an insert, then callers assume `rows[0]` is the newly created record. This can point to the wrong transfer or transaction under real use.
- Money is stored as `REAL`, which can create rounding errors. Banking amounts should move to integer minor units, for example cents, kobo, pence.
- There are no automated backend tests for transfer creation, transfer approval, rejection, loan disbursement, or ledger/balance reconciliation.

## Stabilization Principles

- One source of truth for money movement: ledger posting should be the only code path that changes available balance.
- Every financial operation should happen inside a database transaction.
- Every transfer status transition should be idempotent. Re-approving a completed transfer must not move money twice.
- Database schema changes should be versioned migrations, not ad hoc table creation.
- SQLite can stay for local development, but the app should use one SQL dialect intentionally. If production is Postgres, make Postgres the target and keep SQLite only as a dev adapter or remove it.

## Phase 0 - Reproducible Local Baseline

1. Run dependency install inside both project roots:
   - `npm install`
   - `cd bluecrestback && npm install`
2. Add backend scripts:
   - `dev`
   - `start`
   - `test`
   - `db:migrate`
   - `db:seed`
   - `db:reset:dev`
3. Move environment defaults into documented `.env.example` files:
   - frontend API proxy target
   - backend `PORT`
   - database provider or `DATABASE_URL`
   - JWT/session settings if introduced later
4. Add a smoke check:
   - start backend
   - call `/health`
   - verify admin seed exists
   - verify a non-admin user can register and login

Acceptance criteria:

- A fresh clone can install and run without manual file edits.
- `bluecrestback` can start with an empty database.
- The database can be reset and reseeded deterministically in development.

## Phase 1 - Database Foundation

1. Choose the primary database target.
   - Recommended: Postgres for production.
   - Keep SQLite only if the adapter layer translates placeholders and transaction behavior correctly.
2. Replace `initializeDatabase()` table creation with versioned migrations.
3. Introduce stable schema constraints:
   - foreign keys for `sessions.user_id`, `transfers.sender_id`, `transfers.recipient_user_id`, `transactions.user_id`, `loans.user_id`
   - allowed status checks for users, KYC, transfers, transactions, loans
   - unique references for ledger entries
   - indexes for account number, user email, transaction reference, transfer status
4. Replace `REAL` money columns with integer minor-unit columns:
   - `users.balance_minor`
   - `transfers.amount_minor`
   - `transactions.amount_minor`
   - `loans.requested_amount_minor`
   - `loans.disbursement_fee_minor`
5. Normalize account number generation.
   - Stop relying on hard-coded `id = 1` behavior.
   - Generate account numbers from a deterministic service with uniqueness retry.
   - Reserve admin account number explicitly.
6. Add a compatibility migration for existing `local.db`:
   - back up the file
   - convert `REAL` amounts into minor units
   - preserve existing users, transfers, transactions, and loans

Acceptance criteria:

- Migrations run cleanly on an empty database and on the current local database.
- Account numbers are unique and no longer effectively stuck around a single seeded number.
- The app has a documented answer for SQLite versus Postgres.

## Phase 2 - Ledger Engine

1. Split ledger recording from balance posting:
   - `transactionRepository.createLedgerEntry()` should only write a ledger row.
   - `ledgerService.postEntry()` should write the ledger row and apply the balance movement inside the same database transaction.
2. Add a `balance_entries` or stronger `transactions` schema with:
   - `id`
   - `user_id`
   - `reference`
   - `source_type`
   - `source_id`
   - `direction`
   - `amount_minor`
   - `currency`
   - `status`
   - `posted_at`
   - `created_at`
3. Make posted ledger references idempotent:
   - unique key on `reference`
   - unique key on `source_type`, `source_id`, `direction`, `user_id`
4. Add reconciliation helpers:
   - recompute expected balance from posted ledger entries
   - compare with `users.balance_minor`
   - report mismatches without changing data automatically
5. Restrict direct balance updates.
   - Sandbox/admin balance changes should create an adjustment ledger entry.
   - Remove or tightly limit direct use of `userRepository.incrementBalance()`.

Acceptance criteria:

- No service can change a real balance without a matching ledger entry.
- Running the same approval request twice does not duplicate ledger rows or move money twice.
- Reconciliation passes after every tested transfer and loan flow.

## Phase 3 - Transfer Flow Stabilization

1. Replace user-level `transfer_flow` control with explicit transfer statuses:
   - `PENDING`
   - `PROCESSING`
   - `COMPLETED`
   - `REJECTED`
   - `FAILED`
   - `RESTRICTED`
2. Change `createTransfer()` behavior:
   - validate auth, account status, KYC rules if required, PIN, amount, currency, recipient
   - create a transfer row
   - create pending ledger reservations if you want funds held, or leave no balance change until approval
   - return the created transfer, not the full transfer list
3. Change `completeTransfer()` behavior:
   - begin database transaction
   - lock sender row or use atomic conditional update
   - verify transfer is not already completed
   - verify sender has available funds
   - post sender debit ledger entry
   - for internal transfer, post recipient credit ledger entry
   - update transfer status to `COMPLETED`
   - commit
4. Change rejection behavior:
   - if pending, mark transfer rejected and pending ledger rejected
   - if completed, require a separate reversal flow instead of changing history
5. Add transfer service tests:
   - invalid PIN fails without ledger row
   - insufficient funds fails without ledger row
   - pending external transfer does not move balance
   - completing pending external transfer debits once
   - completing pending internal transfer debits sender and credits recipient once
   - duplicate completion is idempotent
   - rejection does not move balance

Acceptance criteria:

- Transfer state and ledger state match after every transfer operation.
- `createTransfer()` never returns unrelated rows.
- Admin status updates cannot accidentally debit or credit multiple times.

## Phase 4 - Loan And Sandbox Stabilization

1. Route loan disbursement through the same ledger posting service.
2. Make loan disbursement idempotent:
   - one credit ledger entry per loan disbursement
   - second disbursement call returns the existing posted result or a clear conflict
3. Replace sandbox direct balance mutation with adjustment ledger entries.
4. Make sandbox routes development-only or admin-only, controlled by environment.
5. Add tests:
   - loan approval does not change balance
   - loan disbursement credits once
   - sandbox balance adjustment creates an audit ledger entry

Acceptance criteria:

- Loans and sandbox cannot bypass ledger reconciliation.
- Production can disable sandbox behavior.

## Phase 5 - API Contract And Frontend Wiring

1. Keep the existing backend response envelope:
   - `{ success, message, data }`
2. Add a small frontend API client that:
   - attaches `Authorization`
   - unwraps `data`
   - maps snake_case backend fields to camelCase UI models
   - maps camelCase UI payloads to snake_case API payloads
3. Replace old frontend mock/double-transfer flows with the single backend transfer API.
4. Use numeric user IDs for user-specific transaction and loan routes.
5. Replace hard-coded currency display with `Intl.NumberFormat` using the user's preferred currency.

Acceptance criteria:

- The frontend reads balances and transactions from backend state only.
- Transfer, transaction, loan, KYC, and auth payloads match documented backend contracts.

## Phase 6 - Observability And Guardrails

1. Add structured request logging with request IDs.
2. Add audit events for:
   - login
   - transfer create
   - transfer approve/reject
   - ledger post
   - balance adjustment
   - loan status change
3. Standardize errors:
   - validation errors should be 400
   - auth errors should be 401 or 403
   - not found should be 404
   - unexpected errors should be 500
4. Add a reconciliation command:
   - `npm run ledger:reconcile`

Acceptance criteria:

- A failed transfer tells the client what went wrong without exposing internals.
- Admin/audit screens can explain why balance changed.

## Suggested First Implementation Sprint

1. Install backend dependencies and confirm current backend starts.
2. Add automated tests around the current broken transfer cases before changing behavior.
3. Add database transaction support to the database adapter.
4. Refactor `transaction.service.js` so ledger creation no longer secretly changes balances.
5. Create `ledger.service.js` as the only balance-posting path.
6. Refactor `transfer.service.js` to use `ledger.service.js` for completion.
7. Update loan and sandbox balance changes to use `ledger.service.js`.
8. Run reconciliation tests and fix any mismatches.

## Files To Touch First

- `bluecrestback/src/database/db.js`
- `bluecrestback/src/database/init.js`
- `bluecrestback/src/database/sqlite.js`
- `bluecrestback/src/database/postgres.js`
- `bluecrestback/src/services/transaction.service.js`
- `bluecrestback/src/services/transfer.service.js`
- `bluecrestback/src/services/loan.service.js`
- `bluecrestback/src/routes/sandbox.routes.js`
- `bluecrestback/src/repositories/transaction.repository.js`
- `bluecrestback/src/repositories/transfer.repository.js`
- `bluecrestback/src/repositories/user.repository.js`
- `bluecrestback/package.json`
