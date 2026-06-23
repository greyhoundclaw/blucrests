# Core Banking System API Documentation

Welcome to the Core Banking API. Below is a comprehensive specification of all the backend endpoints, request formats, headers, and expected response payloads.

## General Information

- **Base URL**: `http://localhost:4000`
- **Content-Type**: `application/json`
- **Authentication**: Bearer Token standard (`Authorization: Bearer <session_token>`)
- **CORS Support**: fully enabled with dynamic preflight support (`Access-Control-Allow-Origin: *`)

---

## 🔑 Authentication Endpoints

### 1. User Login
Authenticates a user/admin and returns a session token.
- **Method**: `POST`
- **Path**: `/api/v1/auth/login`
- **Request Body**:
```json
{
  "email": "user@example.com",
  "password": "Password123"
}
```
- **Response**:
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "token": "a1b2c3d4-e5f6-7a8b-9c0d-e1f2a3b4c5d6",
    "expires_at": "2026-06-03T12:00:00.000Z",
    "user": {
      "id": 2,
      "email": "user@example.com",
      "first_name": "John",
      "last_name": "Doe",
      "role": "USER",
      "account_number": "1000000002"
    }
  }
}
```

### 2. Get Current Session Profile
Fetches the profile details of the currently logged-in user.
- **Method**: `GET`
- **Path**: `/api/v1/auth/me`
- **Headers**:
  - `Authorization: Bearer <session_token>`
- **Response**:
```json
{
  "success": true,
  "message": "Current user fetched",
  "data": {
    "id": 2,
    "account_number": "1000000002",
    "first_name": "John",
    "last_name": "Doe",
    "username": "johndoe",
    "email": "user@example.com",
    "phone": "+1234567890",
    "kyc_status": "PENDING",
    "preferred_currency": "USD",
    "balance": 1500.50,
    "role": "USER",
    "status": "ACTIVE"
  }
}
```

### 3. Logout Session
Destroys the current authenticated session token.
- **Method**: `POST`
- **Path**: `/api/v1/auth/logout`
- **Headers**:
  - `Authorization: Bearer <session_token>`
- **Response**:
```json
{
  "success": true,
  "message": "Logout successful",
  "data": null
}
```

---

## 👤 User & Profile Endpoints

### 1. User Registration
Registers a new customer account.
- **Method**: `POST`
- **Path**: `/api/v1/users/register`
- **Request Body**:
```json
{
  "first_name": "John",
  "last_name": "Doe",
  "username": "johndoe",
  "email": "user@example.com",
  "phone": "+1234567890",
  "password": "Password123"
}
```
- **Response**:
```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "id": 2,
    "account_number": "1000000002",
    "first_name": "John",
    "last_name": "Doe",
    "email": "user@example.com",
    "username": "johndoe",
    "phone": "+1234567890"
  }
}
```

### 2. Set Transfer PIN
Sets or updates the secure 4-digit or 6-digit transaction PIN required for completing transfers.
- **Method**: `POST`
- **Path**: `/api/v1/users/transfer-pin`
- **Headers**:
  - `Authorization: Bearer <session_token>`
- **Request Body**:
```json
{
  "pin": "1234"
}
```

### 3. Submit KYC Details
Submits Government ID details for verification.
- **Method**: `POST`
- **Path**: `/api/v1/users/kyc`
- **Headers**:
  - `Authorization: Bearer <session_token>`
- **Request Body**:
```json
{
  "government_id_number": "AB123456",
  "id_front_image": "base64_or_image_url_front",
  "id_back_image": "base64_or_image_url_back"
}
```

### 4. Update KYC Status (Admin Only)
Approves or rejects a user's KYC submission.
- **Method**: `PATCH`
- **Path**: `/api/v1/users/kyc/:userId`
- **Headers**:
  - `Authorization: Bearer <admin_session_token>`
- **Request Body**:
```json
{
  "status": "VERIFIED" // Options: PENDING, VERIFIED, REJECTED
}
```

### 5. Adjust User Balance (Admin Only)
Directly updates the wallet balance of a user.
- **Method**: `PATCH`
- **Path**: `/api/v1/users/:userId`
- **Headers**:
  - `Authorization: Bearer <admin_session_token>`
- **Request Body**:
```json
{
  "balance": 50000.00
}
```

---

## 💸 Money Transfer Endpoints

### 1. Create a Transfer
Initiates a transfer. Can be INTERNAL (within the same bank) or EXTERNAL (wire transfer to another bank).
- **Method**: `POST`
- **Path**: `/api/v1/transfers`
- **Headers**:
  - `Authorization: Bearer <session_token>`
- **Request Body (Internal Transfer)**:
```json
{
  "transfer_type": "INTERNAL",
  "recipient_account_number": "1000000001",
  "amount": 250.00,
  "pin": "1234",
  "description": "Internal payment to Admin"
}
```
- **Request Body (External Transfer)**:
```json
{
  "transfer_type": "EXTERNAL",
  "recipient_name": "Ahmad Wire Recipient",
  "recipient_bank": "Global Finance Bank",
  "recipient_account_number": "9876543210",
  "amount": 1200.00,
  "pin": "1234",
  "description": "Invoice wire payment"
}
```

### 2. Get User Transfers
Fetches all transfer history initiated by the authenticated user.
- **Method**: `GET`
- **Path**: `/api/v1/transfers`
- **Headers**:
  - `Authorization: Bearer <session_token>`

### 3. Get Transfer Receipt Details
Retrieves transfer receipt data.
- **Method**: `GET`
- **Path**: `/api/v1/transfers/:transferId/receipt`
- **Headers**:
  - `Authorization: Bearer <session_token>`

### 4. Update Transfer Status (Admin Only)
Approves, rejects, or updates the status of any transaction transfer.
- **Method**: `PATCH`
- **Path**: `/api/v1/transfers/:transferId`
- **Headers**:
  - `Authorization: Bearer <admin_session_token>`
- **Request Body**:
```json
{
  "status": "COMPLETED" // Options: PENDING, COMPLETED, REJECTED, FAILED
}
```

---

## 📊 Transactions & Ledger Endpoints

### 1. Create Transaction Entry
Directly log a credit or debit ledger entry.
- **Method**: `POST`
- **Path**: `/api/v1/transactions`
- **Headers**:
  - `Authorization: Bearer <session_token>`
- **Request Body**:
```json
{
  "user_id": 2,
  "type": "CREDIT", // Options: CREDIT, DEBIT
  "amount": 500.00,
  "category": "deposit",
  "description": "Wire deposit"
}
```

### 2. Fetch User Transactions
Fetches all account transactions for a specific user ID.
- **Method**: `GET`
- **Path**: `/api/v1/transactions/user/:userId`
- **Headers**:
  - `Authorization: Bearer <session_token>`

### 3. Batch Create Transactions (Admin Only)
Logs multiple transactions in a single batch.
- **Method**: `POST`
- **Path**: `/api/v1/transactions/batch`
- **Headers**:
  - `Authorization: Bearer <admin_session_token>`
- **Request Body**:
```json
{
  "transactions": [
    {
      "user_id": 2,
      "type": "CREDIT",
      "amount": 1000.00,
      "description": "Salary Bonus"
    },
    {
      "user_id": 2,
      "type": "DEBIT",
      "amount": 45.50,
      "description": "Monthly Maintenance Fee"
    }
  ]
}
```

---

## 🏦 Loan Application Endpoints

Note: Loans require the user's KYC status to be `VERIFIED`.

### 1. Apply for a Loan
Submits a new loan application.
- **Method**: `POST`
- **Path**: `/api/v1/loans`
- **Headers**:
  - `Authorization: Bearer <session_token>`
- **Request Body**:
```json
{
  "requested_amount": 10000.00,
  "purpose": "Business Expansion",
  "repayment_months": 24,
  "monthly_payment": 450.00,
  "interest_rate": 8.0
}
```

### 2. Get User Loans
Fetches loan history and status for a specific user.
- **Method**: `GET`
- **Path**: `/api/v1/loans/user/:userId`
- **Headers**:
  - `Authorization: Bearer <session_token>`

### 3. Update Loan Status (Admin Only)
Approves or rejects a loan.
- **Method**: `PATCH`
- **Path**: `/api/v1/loans/:loanId`
- **Headers**:
  - `Authorization: Bearer <admin_session_token>`
- **Request Body**:
```json
{
  "status": "APPROVED" // Options: PENDING, APPROVED, AWAITING_DISBURSEMENT_FEE, READY_FOR_DISBURSEMENT, DISBURSED, REJECTED
}
```

### 4. Assign Disbursement Fee (Admin Only)
Sets a disbursement fee on the loan application.
- **Method**: `PATCH`
- **Path**: `/api/v1/loans/:loanId/fee`
- **Headers**:
  - `Authorization: Bearer <admin_session_token>`
- **Request Body**:
```json
{
  "disbursement_fee": 150.00
}
```

### 5. Confirm Fee Paid (Admin Only)
Confirms receipt of the disbursement fee.
- **Method**: `PATCH`
- **Path**: `/api/v1/loans/:loanId/confirm-fee`
- **Headers**:
  - `Authorization: Bearer <admin_session_token>`

### 6. Disburse Loan Amount (Admin Only)
Disburses the loan principal to the customer's account balance.
- **Method**: `PATCH`
- **Path**: `/api/v1/loans/:loanId/disburse`
- **Headers**:
  - `Authorization: Bearer <admin_session_token>`

---

## 📈 Activity Logging Endpoints

### 1. Fetch User Activities
- **Method**: `GET`
- **Path**: `/api/v1/activities`
- **Headers**:
  - `Authorization: Bearer <session_token>`

---

## 💼 Admin Panel Endpoints

All admin panel endpoints require an authorized Administrator account token.

### 1. Get All Bank Customers
- **Method**: `GET`
- **Path**: `/api/v1/admin/users`

### 2. Get All Pending/Completed Transfers
- **Method**: `GET`
- **Path**: `/api/v1/admin/transfers`

### 3. Get All System Audit Logs
- **Method**: `GET`
- **Path**: `/api/v1/admin/activities`

### 4. Get Backoffice System Statistics
Retrieves total bank balances, pending KYC counts, loan statistics, and total transfers.
- **Method**: `GET`
- **Path**: `/api/v1/admin/stats`
