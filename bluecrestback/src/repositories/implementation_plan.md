# Implementation Plan - Wiring React Frontend & Banking Core Backend

This document outlines our comprehensive, step-by-step technical plan to wire the Vite + React frontend (`bluecrestfront`) to the robust Node.js backend server (`backend`), replacing the temporary mock/duplicate backend logic inside `server.ts` with secure, authentic full-stack API communications.

## 1. Architectural Overview & Integration Strategy

Currently, the React frontend runs on `http://localhost:3000` via Express + Vite, and contains redundant, duplicate database models and routes. The core backend runs on `http://localhost:4000` using SQLite/Postgres.

Instead of writing absolute URL hosts (e.g. `http://localhost:4000`) into every individual React component, we will implement an **Express API Proxy** inside `bluecrestfront/server.ts`. Any requests from the React browser app sent to `/api/*` will be seamlessly proxied to the real backend running on `http://localhost:4000`. This keeps frontend build scripts simple and maintains high security.

```mermaid
sequenceDiagram
    participant Browser as React Frontend (Browser)
    participant DevServer as Frontend Server (Port 3000)
    participant CoreBackend as Core Banking Backend (Port 4000)
    database DB as Core SQLite/PostgreSQL Database

    Browser->>DevServer: POST /api/v1/auth/login
    Note right of DevServer: Proxies request to Core Backend
    DevServer->>CoreBackend: POST /api/v1/auth/login
    CoreBackend->>DB: Query User & Session
    DB-->>CoreBackend: User Verified
    CoreBackend-->>DevServer: Returns JWT Token & User Data
    DevServer-->>Browser: Returns JWT Token & User Data
```

---

## 2. Gaps & API Mismatch Analysis

Below is an exhaustive breakdown of the mismatches between the frontend expectations and the backend API design:

| Flow / Feature | Frontend Current API Call (Mock) | Core Backend API Signature (Real) | Mismatch / Critical Issue |
| :--- | :--- | :--- | :--- |
| **User Registration** | `POST /api/v1/users/register`<br>Payload: camelCase keys (`firstName`, `lastName`, `preferredCurrency`, `transferPin`) | `POST /api/v1/users/register`<br>Payload: snake_case keys (`first_name`, `last_name`, `preferred_currency`, `transfer_pin`) | **Critical**: The backend validation fails immediately since it expects snake_case properties. |
| **User Login** | `POST /api/v1/auth/login`<br>Expects response format:<br>`{ token, user }` at root | `POST /api/v1/auth/login`<br>Returns response format:<br>`{ success: true, message, data: { token, user } }` | **Critical**: Frontend is unable to extract `user` and `token` because they are nested under `data`. |
| **Fetch Profile** | `GET /api/user?email=...`<br>Unsecured query parameter | `GET /api/v1/auth/me`<br>Requires `Authorization: Bearer <token>` | **Security Gap**: Frontend fetches by query email instead of secure token verification. |
| **Fetch Transactions** | `GET /api/transactions?email=...` | `GET /api/v1/transactions/user/:userId`<br>Requires `Authorization` token | **Critical**: Backend identifies transactions by user integer ID, not email query. |
| **Fund Transfer** | **Double-Invocation Call**:<br>1. `POST /api/transfers` (Pending)<br>2. `POST /api/transfers/complete` (Deduct & Complete) | **Single Secure Transaction**:<br>`POST /api/v1/transfers`<br>Payload: `pin`, `amount`, `recipient_account_number`, etc. | **Logic Inconsistency**: Frontend manually splits state, whereas core backend executes authorization, balance checking, and ledger logging atomically. |
| **KYC Submission** | `POST /api/v1/users/kyc`<br>Payload: `documentNumber`, `frontImage`, `backImage` | `POST /api/v1/users/kyc`<br>Payload: `government_id_number`, `id_front_image`, `id_back_image` | **Critical**: Backend expects snake_case image parameters and government ID numbers. |
| **Loan Application** | `POST /api/v1/loans`<br>Payload: `email`, `amount`, `repaymentMonths` | `POST /api/v1/loans`<br>Payload: `requested_amount`, `repayment_months` | **Critical**: Key parameter names mismatch, causing DB constraint errors. |
| **Fetch Loans** | `GET /api/v1/loans/user/:email` | `GET /api/v1/loans/user/:userId` | **Critical**: Last URL segment expects numerical User ID, not email string. |

---

## 3. Proposed Changes

We will execute the wiring systematically across both the frontend and backend files.

### 3.1 Backend Enhancements

To support the sandbox controls (balance tuning, KYC toggling, loan auditing) and to allow a seamless test environment, we will implement a developer sandbox helper endpoint in the backend.

#### [NEW] [sandbox.routes.js](file:///c:/Users/koko/Desktop/bankingcore/backend/src/routes/sandbox.routes.js)
- Create a route file handling `POST /api/v1/test/sandbox` to:
  - Adjust user balance directly for testing.
  - Set KYC status directly (`Verified`, `Pending`, `Rejected`, `Not Submitted`).
  - Modify loan status directly (`PENDING`, `APPROVED`, `AWAITING_DISBURSEMENT_FEE`, `DISBURSED`, `REJECTED`).

#### [MODIFY] [server.js](file:///c:/Users/koko/Desktop/bankingcore/backend/server.js)
- Import and register the new sandbox router under `/api/v1/test/sandbox`.

---

### 3.2 Frontend Server API Proxy Configuration

We will redirect all `/api/*` endpoint requests from the local Express mock database to our core banking backend.

#### [MODIFY] [server.ts](file:///c:/Users/koko/Desktop/bankingcore/bluecrestfront/server.ts)
- Replace mock backend handlers (`/api/v1/users/register`, `/api/v1/auth/login`, `/api/user`, `/api/transactions`, `/api/transfers`, `/api/v1/loans`, `/api/v1/test/sandbox`, etc.) with a clean reverse proxy using `http-proxy-middleware` or custom forwarding logic that sends `/api/*` requests directly to `http://localhost:4000`.

---

### 3.3 React Frontend Components & Core Wiring

#### [MODIFY] [LoginPage.tsx](file:///c:/Users/koko/Desktop/bankingcore/bluecrestfront/src/components/LoginPage.tsx)
- **Registration Form**: Convert camelCase parameters to snake_case (`first_name`, `last_name`, `preferred_currency`, etc.) before calling `POST /api/v1/users/register`.
- **Login Request**:
  - Update payload handling to correctly retrieve token and user profile from `data.data.token` and `data.data.user`.
- **UI Experience Optimization**:
  - In step 3 (Confirm Password), since entering the password twice in a row can be a tedious user experience, we will streamline this into a secure **"Verify Session Pin"** or simply allow it to auto-verify using the stored credentials, providing a much smoother, premium user authentication flow.

#### [MODIFY] [App.tsx](file:///c:/Users/koko/Desktop/bankingcore/bluecrestfront/src/App.tsx)
- **State Synchronization on Mount**:
  - Fetch profile using `GET /api/v1/auth/me` with the `Authorization` header.
  - Map backend user object keys (`first_name` $\rightarrow$ `firstName`, `preferred_currency` $\rightarrow$ `preferredCurrency`, `kyc_status` $\rightarrow$ `kycStatus`, etc.) to match frontend TypeScript models.
  - Fetch user transaction logs using `GET /api/v1/transactions/user/${currentUser.id}` with standard auth headers.
- **Dynamic Currency Formatting**:
  - Store the user's `preferredCurrency` (e.g. `USD`, `GBP`, `EUR`, `NGN`) in the state.
  - Implement a standard dynamic currency formatter helper `formatUserCurrency(amount)` using `new Intl.NumberFormat(lang, { style: 'currency', currency: preferredCurrency })` to replace all hardcoded `$` symbols in the dashboard balance, cards, loans page, transaction tables, and modals.
- **Fund Transfer Execution**:
  - Refactor transfer handlers to make a **single atomic API request** to `POST /api/v1/transfers` including the user's `transferPin`, `transfer_type: "EXTERNAL"`, `recipient_bank`, `recipient_account_number`, `recipient_name`, and `amount`.
  - On a successful response, capture the updated balance and transaction ledger state from the backend, update frontend states, and launch the Premium Success Modal.

#### [MODIFY] [DashboardOverview.tsx](file:///c:/Users/koko/Desktop/bankingcore/bluecrestfront/src/components/DashboardOverview.tsx)
- Replace hardcoded `$` symbols in available balance and transaction logs with the dynamic `formatUserCurrency` values or Intl formatters corresponding to the user's registered preferred currency.
- Map user profile image to support standard custom avatars/initials consistently.

#### [MODIFY] [VerifyIdentityPage.tsx](file:///c:/Users/koko/Desktop/bankingcore/bluecrestfront/src/components/VerifyIdentityPage.tsx)
- Add the `Authorization` token header.
- Map body keys to snake_case before calling `POST /api/v1/users/kyc`:
  - `government_id_number` for `documentNumber`
  - `id_front_image` for `frontImage`
  - `id_back_image` for `backImage`
- Update the KYC status state dynamically inside React.

#### [MODIFY] [LoansPage.tsx](file:///c:/Users/koko/Desktop/bankingcore/bluecrestfront/src/components/LoansPage.tsx)
- Add the `Authorization` token header.
- Map requested parameters to snake_case inside `POST /api/v1/loans`:
  - `requested_amount` for `amount`
  - `repayment_months` for `repaymentMonths`
- Modify `fetchLoans` to request `/api/v1/loans/user/${user.id}` (numerical primary key id) instead of passing the email.
- Wire the complete loan cycle dynamically: PENDING audit $\rightarrow$ APPROVED $\rightarrow$ AWAITING ESCROW FEE (origination fee clearance via Sandbox trigger) $\rightarrow$ ACTIVE DISBURSED (instantly adding funds to the user's active balance).

#### [MODIFY] [SandboxPanel.tsx](file:///c:/Users/koko/Desktop/bankingcore/bluecrestfront/src/components/SandboxPanel.tsx)
- Map request variables correctly to match backend specifications for direct testing.
- Allow simulation of loan statuses (`PENDING`, `APPROVED`, `AWAITING_DISBURSEMENT_FEE`, `DISBURSED`, `REJECTED`) and verify they instantly reflect on the Loans page and update the user balance when status goes to `DISBURSED`!
- **Admin Control Panel Simulations**: Add admin control triggers inside the sandbox panel to:
  - Simulate transfer locks (locking/unlocking transactions for specific users).
  - Simulate updating transaction status (`PENDING`, `RESTRICTED`, `COMPLETED`) via backend `PATCH /api/v1/transfers/:transferId` to demonstrate the admin's absolute control over user transactions.

#### [MODIFY] [Modals.tsx](file:///c:/Users/koko/Desktop/bankingcore/bluecrestfront/src/components/Modals.tsx)
- **Transfer Engine & Modals Integration**:
  - Connect the three core transaction modal states securely to the backend response state:
    - **`TransferSuccessModal` (Pending/Processing)**: Triggers when the single atomic `POST /api/v1/transfers` request is submitted with a valid PIN, displaying the pending receipt.
    - **`RestrictedModal` (Security Lock)**: Triggers if the backend returns a security exception or transaction restriction (e.g. transfer lock active or max daily limits triggered), prompting the premium lock screen.
    - **`TransferCodeModal` (PIN Input)**: Performs secure server-side validation of the transfer PIN on submit, dynamically showing errors returned from the core backend.
- Replace hardcoded `$` symbols in all three modals with the dynamic user currency symbol.

---

### 3.4 Backend Transfer Ledger & Balance Integration

To ensure the "strong engine" of your bank operates perfectly, we identified that the core backend currently logs transfer records but does **not** actually deduct the sender's balance, credit the recipient's balance, or write transaction logs to the dashboard history. We will implement these missing logical links in the backend services:

#### [MODIFY] [transfer.service.js](file:///c:/Users/koko/Desktop/bankingcore/backend/src/services/transfer.service.js)
- **Insufficient Balance Check**: In `createTransfer`, verify that the sender has sufficient funds before proceeding:
  ```javascript
  if (user.balance < data.amount) {
      throw new Error('Insufficient available balance for this transfer');
  }
  ```
- **Atomic Balance & Ledger Integration on Transfer Completion**:
  - When an `INTERNAL` transfer is created and immediately set to `COMPLETED`:
    - Deduct the sender's balance (`userRepository.incrementBalance(sender.id, -amount)`) and create a `DEBIT` transaction ledger entry.
    - Increment the recipient's balance (`userRepository.incrementBalance(recipient.id, amount)`) and create a `CREDIT` transaction ledger entry.
  - When a transfer starts as `PENDING` (such as `EXTERNAL` wires) and is subsequently set to `COMPLETED` by the admin via `changeTransferStatus(transferId, 'COMPLETED')`:
    - Automatically deduct the sender's balance and generate the corresponding `DEBIT` transaction log so it instantly populates their transaction history list.

---

## 5. Verification Plan

We will verify our implementation through a systematic set of tests:

### 4.1 Automated & Manual Tests
1. **Server Launch**: Run both backend (port 4000) and frontend proxy server (port 3000).
2. **Registration smoke test**: Register a new user and ensure they are successfully saved inside the backend database.
3. **Login & Session test**: Authenticate the registered user, check if the session JWT token is stored inside the browser's `localStorage` and passed inside headers.
4. **KYC Verification flow**: Submit identity photos in frontend and use the Developer Sandbox to set the KYC status to `Verified`.
5. **Atomic Transfer flow**: Initiate an external transfer, type in the transfer PIN, verify that it is approved securely, balance is decremented correctly, and a ledger transaction is created.
6. **Loans simulation**: Submit a loan, simulate escrow clearance fees using the sandbox, and verify balance increments upon disbursement.

---

> [!IMPORTANT]
> **User Action Required**
> Please review this integration and wiring plan. Once you approve it, we will create `task.md` and proceed with modifying the files step-by-step to wire up your banking application perfectly.
