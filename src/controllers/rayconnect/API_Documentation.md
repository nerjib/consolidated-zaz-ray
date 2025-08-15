# PayGo Backend API Documentation

This document provides a comprehensive overview of the API endpoints for the PayGo backend system.

## Base URL
`http://localhost:5000/api` (assuming default port)

---

## 1. Authentication Endpoints (`/api/auth`)

### 1.1. Register User
- **Route:** `POST /api/auth/register`
- **Description:** Registers a new user (admin, agent, or customer).
- **Access:** Public
- **Request Body:**
  ```json
  {
    "username": "newuser",
    "email": "newuser@example.com",
    "password": "password123",
    "role": "customer", // or "admin", "agent"
    "phone_number": "+254712345678",
    "state": "Nairobi",
    "city": "Nairobi",
    "address": "123 Main St",
    "landmark": "Near City Mall",
    "gps": "1.2921, 36.8219"
  }
  ```
- **Response Sample (Success - 200 OK):**
  ```json
  {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
  ```
- **Response Sample (Error - 400 Bad Request):**
  ```json
  {
    "msg": "User already exists"
  }
  ```

### 1.2. Login User
- **Route:** `POST /api/auth/login`
- **Description:** Logs in an existing user and returns a JWT token.
- **Access:** Public
- **Request Body:**
  ```json
  {
    "username": "existinguser",
    "password": "password123"
  }
  ```
- **Response Sample (Success - 200 OK):**
  ```json
  {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
  ```
- **Response Sample (Error - 400 Bad Request):**
  ```json
  {
    "msg": "Invalid Credentials"
  }
  ```

---

## 2. Agent Endpoints (`/api/agents`)

### 2.1. Get Current Agent's Profile
- **Route:** `GET /api/agents/me`
- **Description:** Retrieves the profile of the authenticated agent.
- **Access:** Private (Agent, Admin)
- **Headers:** `x-auth-token: <JWT_TOKEN>`
- **Response Sample (Success - 200 OK):**
  ```json
  {
    "id": "a1b2c3d4-e5f6-7890-1234-567890abcdef",
    "username": "agent_john",
    "email": "agent.john@example.com",
    "role": "agent",
    "phone_number": "+254711223344",
    "state": "Nairobi",
    "city": "Nairobi",
    "address": "Agent's Office, 10 Main St",
    "landmark": "Near Agent HQ",
    "gps": "1.2345, 36.7890"
  }
  ```
- **Response Sample (Error - 401 Unauthorized):**
  ```json
  {
    "msg": "No token, authorization denied"
  }
  ```
- **Response Sample (Error - 403 Forbidden):**
  ```json
  {
    "msg": "Access denied: You do not have the required role."
  }
  ```

### 2.2. Assign Device to Customer
- **Route:** `POST /api/agents/assign-device`
- **Description:** Assigns an available device to a customer.
- **Access:** Private (Agent, Admin)
- **Headers:** `x-auth-token: <JWT_TOKEN>`
- **Request Body:**
  ```json
  {
    "device_id": "d1e2f3a4-b5c6-7890-1234-567890abcdef",
    "customer_id": "c1d2e3f4-a5b6-7890-1234-567890abcdef"
  }
  ```
- **Response Sample (Success - 200 OK):**
  ```json
  {
    "msg": "Device assigned successfully",
    "device": {
      "id": "d1e2f3a4-b5c6-7890-1234-567890abcdef",
      "serial_number": "DEV-001",
      "model": "Model X",
      "status": "assigned",
      "assigned_to": "c1d2e3f4-a5b6-7890-1234-567890abcdef",
      "assigned_by": "a1b2c3d4-e5f6-7890-1234-567890abcdef",
      "price": "150.00",
      "created_at": "2025-07-26T10:00:00.000Z",
      "updated_at": "2025-07-26T10:30:00.000Z"
    }
  }
  ```
- **Response Sample (Error - 400 Bad Request):**
  ```json
  {
    "msg": "Device not found or not available for assignment"
  }
  ```

---

## 3. Customer Endpoints (`/api/customers`)

### 3.1. Get Current Customer's Profile
- **Route:** `GET /api/customers/me`
- **Description:** Retrieves the profile of the authenticated customer.
- **Access:** Private (Customer, Admin)
- **Headers:** `x-auth-token: <JWT_TOKEN>`
- **Response Sample (Success - 200 OK):**
  ```json
  {
    "id": "c1d2e3f4-a5b6-7890-1234-567890abcdef",
    "username": "customer_jane",
    "email": "customer.jane@example.com",
    "role": "customer",
    "phone_number": "+254799887766",
    "state": "Mombasa",
    "city": "Mombasa",
    "address": "456 Beach Rd",
    "landmark": "Near Ocean View Hotel",
    "gps": "-4.0437, 39.6682"
  }
  ```
- **Response Sample (Error - 401 Unauthorized):**
  ```json
  {
    "msg": "No token, authorization denied"
  }
  ```
- **Response Sample (Error - 403 Forbidden):**
  ```json
  {
    "msg": "Access denied: You do not have the required role."
  }
  ```

---

## 4. Admin Endpoints (`/api/admin`)

### 4.1. Create New Agent
- **Route:** `POST /api/admin/create-agent`
- **Description:** Creates a new agent user account.
- **Access:** Private (Admin only)
- **Headers:** `x-auth-token: <JWT_TOKEN>`
- **Request Body:**
  ```json
  {
    "username": "new_agent",
    "email": "new.agent@example.com",
    "password": "agentpassword",
    "phone_number": "+254700112233",
    "state": "Kisumu",
    "city": "Kisumu",
    "address": "789 Lake St",
    "landmark": "Near Lake Victoria",
    "gps": "-0.1022, 34.7679"
  }
  ```
- **Response Sample (Success - 200 OK):**
  ```json
  {
    "msg": "Agent created successfully",
    "agent": {
      "id": "f1e2d3c4-b5a6-7890-1234-567890abcdef",
      "username": "new_agent",
      "email": "new.agent@example.com",
      "role": "agent",
      "phone_number": "+254700112233",
      "state": "Kisumu",
      "city": "Kisumu",
      "address": "789 Lake St",
      "landmark": "Near Lake Victoria",
      "gps": "-0.1022, 34.7679"
    }
  }
  ```
- **Response Sample (Error - 400 Bad Request):**
  ```json
  {
    "msg": "User already exists"
  }
  ```

### 4.2. Set Agent Commission Rate
- **Route:** `PUT /api/admin/set-agent-commission/:id`
- **Description:** Sets the commission rate for a specific agent.
- **Access:** Private (Admin only)
- **Headers:** `x-auth-token: <JWT_TOKEN>`
- **URL Parameters:**
  - `id`: The UUID of the agent.
- **Request Body:**
  ```json
  {
    "commission_rate": 7.5 // Percentage (e.g., 7.5 for 7.5%)
  }
  ```
- **Response Sample (Success - 200 OK):**
  ```json
  {
    "msg": "Agent commission rate updated successfully",
    "agent": {
      "id": "f1e2d3c4-b5a6-7890-1234-567890abcdef",
      "username": "new_agent",
      "email": "new.agent@example.com",
      "role": "agent",
      "commission_rate": "7.50",
      "phone_number": "+254700112233",
      "state": "Kisumu",
      "city": "Kisumu",
      "address": "789 Lake St",
      "landmark": "Near Lake Victoria",
      "gps": "-0.1022, 34.7679"
    }
  }
  ```
- **Response Sample (Error - 400 Bad Request):**
  ```json
  {
    "msg": "Commission rate must be a number between 0 and 100."
  }
  ```
- **Response Sample (Error - 404 Not Found):**
  ```json
  {
    "msg": "Agent not found"
  }
  ```

---

## 5. Device Endpoints (`/api/devices`)

### 5.1. Add New Device
- **Route:** `POST /api/devices`
- **Description:** Adds a new device to the system. Initially, the device status will be `pending_approval`.
- **Access:** Private (Admin only)
- **Headers:** `x-auth-token: <JWT_TOKEN>`
- **Request Body:**
  ```json
  {
    "serial_number": "DEV-002",
    "model": "Solar Lamp Pro",
    "price": 150.00
  }
  ```
- **Response Sample (Success - 200 OK):**
  ```json
  {
    "msg": "Device added successfully, pending approval",
    "device": {
      "id": "g1h2i3j4-k5l6-7890-1234-567890abcdef",
      "serial_number": "DEV-002",
      "model": "Solar Lamp Pro",
      "status": "pending_approval",
      "assigned_to": null,
      "assigned_by": null,
      "price": "150.00",
      "created_at": "2025-07-26T11:00:00.000Z",
      "updated_at": "2025-07-26T11:00:00.000Z"
    }
  }
  ```
- **Response Sample (Error - 400 Bad Request):**
  ```json
  {
    "msg": "Device with this serial number already exists"
  }
  ```

### 5.2. Approve Device
- **Route:** `PUT /api/devices/:id/approve`
- **Description:** Approves a device, changing its status to `available`.
- **Access:** Private (Admin only)
- **Headers:** `x-auth-token: <JWT_TOKEN>`
- **URL Parameters:**
  - `id`: The UUID of the device to approve.
- **Response Sample (Success - 200 OK):**
  ```json
  {
    "msg": "Device approved and is now available",
    "device": {
      "id": "g1h2i3j4-k5l6-7890-1234-567890abcdef",
      "serial_number": "DEV-002",
      "model": "Solar Lamp Pro",
      "status": "available",
      "assigned_to": null,
      "assigned_by": null,
      "price": "150.00",
      "created_at": "2025-07-26T11:00:00.000Z",
      "updated_at": "2025-07-26T11:05:00.000Z"
    }
  }
  ```
- **Response Sample (Error - 404 Not Found):**
  ```json
  {
    "msg": "Device not found"
  }
  ```

### 5.3. Get All Devices
- **Route:** `GET /api/devices`
- **Description:** Retrieves a list of all devices in the system.
- **Access:** Private (Admin, Agent)
- **Headers:** `x-auth-token: <JWT_TOKEN>`
- **Response Sample (Success - 200 OK):**
  ```json
  [
    {
      "id": "d1e2f3a4-b5c6-7890-1234-567890abcdef",
      "serial_number": "DEV-001",
      "model": "Model X",
      "status": "assigned",
      "assigned_to": "c1d2e3f4-a5b6-7890-1234-567890abcdef",
      "assigned_by": "a1b2c3d4-e5f6-7890-1234-567890abcdef",
      "price": "150.00",
      "created_at": "2025-07-26T10:00:00.000Z",
      "updated_at": "2025-07-26T10:30:00.000Z"
    },
    {
      "id": "g1h2i3j4-k5l6-7890-1234-567890abcdef",
      "serial_number": "DEV-002",
      "model": "Solar Lamp Pro",
      "status": "available",
      "assigned_to": null,
      "assigned_by": null,
      "price": "150.00",
      "created_at": "2025-07-26T11:00:00.000Z",
      "updated_at": "2025-07-26T11:05:00.000Z"
    }
  ]
  ```

---

## 6. Payment Endpoints (`/api/payments`)

### 6.1. Record Manual Payment
- **Route:** `POST /api/payments/manual`
- **Description:** Records a payment made manually (e.g., cash payment to an agent).
- **Access:** Private (Admin only)
- **Headers:** `x-auth-token: <JWT_TOKEN>`
- **Request Body:**
  ```json
  {
    "user_id": "c1d2e3f4-a5b6-7890-1234-567890abcdef",
    "amount": 50.00,
    "currency": "NGN",
    "payment_method": "cash",
    "transaction_id": "MANUAL-TXN-001"
  }
  ```
- **Response Sample (Success - 200 OK):**
  ```json
  {
    "msg": "Manual payment recorded successfully",
    "payment": {
      "id": "p1a2y3m4-e5n6-7890-1234-567890abcdef",
      "user_id": "c1d2e3f4-a5b6-7890-1234-567890abcdef",
      "amount": "50.00",
      "currency": "NGN",
      "payment_method": "cash",
      "transaction_id": "MANUAL-TXN-001",
      "status": "completed",
      "payment_date": "2025-07-26T12:00:00.000Z",
      "created_at": "2025-07-26T12:00:00.000Z"
    }
  }
  ```
- **Response Sample (Error - 404 Not Found):**
  ```json
  {
    "msg": "Customer not found"
  }
  ```

### 6.2. Verify Paystack Payment
- **Route:** `POST /api/payments/paystack/verify`
- **Description:** Verifies a Paystack transaction and records the payment.
- **Access:** Private (Customer, Admin)
- **Headers:** `x-auth-token: <JWT_TOKEN>`
- **Request Body:**
  ```json
  {
    "reference": "PAYSTACK_TXN_REF_12345",
    "user_id": "c1d2e3f4-a5b6-7890-1234-567890abcdef",
    "amount": 100.00 // Optional, for your own validation
  }
  ```
- **Response Sample (Success - 200 OK):**
  ```json
  {
    "msg": "Paystack payment verified and recorded",
    "payment": {
      "id": "p1a2y3m4-e5n6-7890-1234-567890abcdef",
      "user_id": "c1d2e3f4-a5b6-7890-1234-567890abcdef",
      "amount": "100.00",
      "currency": "NGN",
      "payment_method": "paystack",
      "transaction_id": "PAYSTACK_TXN_REF_12345",
      "status": "completed",
      "payment_date": "2025-07-26T12:30:00.000Z",
      "created_at": "2025-07-26T12:30:00.000Z"
    }
  }
  ```
- **Response Sample (Error - 400 Bad Request):**
  ```json
  {
    "msg": "Payment reference is required"
  }
  ```
  ```json
  {
    "msg": "Paystack payment verification failed",
    "details": {
      "message": "Transaction not found"
    }
  }
  ```

---

## 7. Loan Endpoints (`/api/loans`)

### 7.1. Create New Loan
- **Route:** `POST /api/loans`
- **Description:** Creates a new loan for a customer, calculating monthly payments and setting the next payment date.
- **Access:** Private (Admin, Agent)
- **Headers:** `x-auth-token: <JWT_TOKEN>`
- **Request Body:**
  ```json
  {
    "customer_id": "c1d2e3f4-a5b6-7890-1234-567890abcdef",
    "device_id": "d1e2f3a4-b5c6-7890-1234-567890abcdef",
    "device_price": 200.00,
    "term_months": 12,
    "down_payment": 20.00,
    "guarantor_details": {
      "name": "Guarantor Name",
      "phone": "+254712345678",
      "relationship": "Sibling"
    }
  }
  ```
- **Response Sample (Success - 200 OK):**
  ```json
  {
    "msg": "Loan created successfully",
    "loan": {
      "id": "l1o2a3n4-e5x6-7890-1234-567890abcdef",
      "customer_id": "c1d2e3f4-a5b6-7890-1234-567890abcdef",
      "device_id": "d1e2f3a4-b5c6-7890-1234-567890abcdef",
      "total_amount": "180.00",
      "amount_paid": "20.00",
      "balance": "180.00",
      "start_date": "2025-07-26T00:00:00.000Z",
      "end_date": null,
      "status": "active",
      "term_months": 12,
      "payment_amount_per_cycle": "15.00",
      "down_payment": "20.00",
      "next_payment_date": "2025-08-26T00:00:00.000Z",
      "guarantor_details": {
        "name": "Guarantor Name",
        "phone": "+254712345678",
        "relationship": "Sibling"
      },
      "created_at": "2025-07-26T13:00:00.000Z",
      "updated_at": "2025-07-26T13:00:00.000Z"
    }
  }
  ```
- **Response Sample (Error - 400 Bad Request):**
  ```json
  {
    "msg": "Please provide customer_id, device_id, device_price, and term_months"
  }
  ```
- **Response Sample (Error - 404 Not Found):**
  ```json
  {
    "msg": "Customer not found"
  }
  ```

### 7.2. Get All Loans
- **Route:** `GET /api/loans`
- **Description:** Retrieves a list of all loans in the system.
- **Access:** Private (Admin only)
- **Headers:** `x-auth-token: <JWT_TOKEN>`
- **Response Sample (Success - 200 OK):**
  ```json
  [
    {
      "id": "l1o2a3n4-e5x6-7890-1234-567890abcdef",
      "customer_id": "c1d2e3f4-a5b6-7890-1234-567890abcdef",
      "device_id": "d1e2f3a4-b5c6-7890-1234-567890abcdef",
      "total_amount": "180.00",
      "amount_paid": "20.00",
      "balance": "180.00",
      "start_date": "2025-07-26T00:00:00.000Z",
      "end_date": null,
      "status": "active",
      "term_months": 12,
      "payment_amount_per_cycle": "15.00",
      "down_payment": "20.00",
      "next_payment_date": "2025-08-26T00:00:00.000Z",
      "guarantor_details": {
        "name": "Guarantor Name",
        "phone": "+254712345678",
        "relationship": "Sibling"
      },
      "created_at": "2025-07-26T13:00:00.000Z",
      "updated_at": "2025-07-26T13:00:00.000Z"
    }
  ]
  ```

### 7.3. Get Loan by ID
- **Route:** `GET /api/loans/:id`
- **Description:** Retrieves details of a specific loan by its ID.
- **Access:** Private (Admin, Agent, Customer - customers can only view their own loans)
- **Headers:** `x-auth-token: <JWT_TOKEN>`
- **URL Parameters:**
  - `id`: The UUID of the loan.
- **Response Sample (Success - 200 OK):**
  ```json
  {
    "id": "l1o2a3n4-e5x6-7890-1234-567890abcdef",
    "customer_id": "c1d2e3f4-a5b6-7890-1234-567890abcdef",
    "device_id": "d1e2f3a4-b5c6-7890-1234-567890abcdef",
    "total_amount": "180.00",
    "amount_paid": "20.00",
    "balance": "180.00",
    "start_date": "2025-07-26T00:00:00.000Z",
    "end_date": null,
    "status": "active",
    "term_months": 12,
    "payment_amount_per_cycle": "15.00",
    "down_payment": "20.00",
    "next_payment_date": "2025-08-26T00:00:00.000Z",
    "guarantor_details": {
      "name": "Guarantor Name",
      "phone": "+254712345678",
      "relationship": "Sibling"
    },
    "created_at": "2025-07-26T13:00:00.000Z",
    "updated_at": "2025-07-26T13:00:00.000Z"
  }
  ```
- **Response Sample (Error - 404 Not Found):**
  ```json
  {
    "msg": "Loan not found"
  }
  ```
- **Response Sample (Error - 403 Forbidden):**
  ```json
  {
    "msg": "Access denied: You can only view your own loans."
  }
  ```

---

## 8. Analytics Endpoints (`/api/analytics`)

### 8.1. Get Overall Platform Performance Analytics
- **Route:** `GET /api/analytics/overview`
- **Description:** Provides key performance indicators for the entire platform.
- **Access:** Private (Admin only)
- **Headers:** `x-auth-token: <JWT_TOKEN>`
- **Response Sample (Success - 200 OK):**
  ```json
  {
    "totalPayments": 15000.00,
    "totalLoans": 150,
    "activeLoans": 120,
    "totalCustomers": 500,
    "totalAgents": 20,
    "totalDevices": 300,
    "assignedDevices": 250,
    "availableDevices": 50
  }
  ```

### 8.2. Get Agent Performance Metrics
- **Route:** `GET /api/analytics/agent-performance`
- **Description:** Retrieves performance metrics for all agents, including commissions earned and devices assigned.
- **Access:** Private (Admin only)
- **Headers:** `x-auth-token: <JWT_TOKEN>`
- **Response Sample (Success - 200 OK):**
  ```json
  [
    {
      "agentId": "a1b2c3d4-e5f6-7890-1234-567890abcdef",
      "username": "agent_john",
      "email": "agent.john@example.com",
      "commissionRate": "7.50",
      "totalCommissionsEarned": 750.50,
      "devicesAssigned": 25,
      "customersServed": 15
    },
    {
      "agentId": "f1e2d3c4-b5a6-7890-1234-567890abcdef",
      "username": "new_agent",
      "email": "new.agent@example.com",
      "commissionRate": "5.00",
      "totalCommissionsEarned": 300.00,
      "devicesAssigned": 10,
      "customersServed": 8
    }
  ]
  ```

---

---

## 10. Device Type Endpoints (`/api/device-types`)

### 10.1. Add New Device Type
- **Route:** `POST /api/device-types`
- **Description:** Adds a new device type to the system.
- **Access:** Private (Admin only)
- **Headers:** `x-auth-token: <JWT_TOKEN>`
- **Request Body:**
  ```json
  {
    "device_name": "Solar Home System",
    "manufacturer": "Bright Solar",
    "device_model": "SHS-50W",
    "amount": 25000.00
  }
  ```
- **Response Sample (Success - 200 OK):**
  ```json
  {
    "msg": "Device type added successfully",
    "deviceType": {
      "id": "dt1e2f3a4-b5c6-7890-1234-567890abcdef",
      "device_name": "Solar Home System",
      "manufacturer": "Bright Solar",
      "device_model": "SHS-50W",
      "amount": "25000.00",
      "created_at": "2025-07-26T14:00:00.000Z",
      "updated_at": "2025-07-26T14:00:00.000Z"
    }
  }
  ```
- **Response Sample (Error - 400 Bad Request):**
  ```json
  {
    "msg": "Device type with this model already exists"
  }
  ```

### 10.2. Get All Device Types
- **Route:** `GET /api/device-types`
- **Description:** Retrieves a list of all device types in the system.
- **Access:** Private (Admin, Agent)
- **Headers:** `x-auth-token: <JWT_TOKEN>`
- **Response Sample (Success - 200 OK):**
  ```json
  [
    {
      "id": "dt1e2f3a4-b5c6-7890-1234-567890abcdef",
      "device_name": "Solar Home System",
      "manufacturer": "Bright Solar",
      "device_model": "SHS-50W",
      "amount": "25000.00",
      "created_at": "2025-07-26T14:00:00.000Z",
      "updated_at": "2025-07-26T14:00:00.000Z"
    }
  ]
  ```

### 10.3. Update Device Type
- **Route:** `PUT /api/device-types/:id`
- **Description:** Updates an existing device type.
- **Access:** Private (Admin only)
- **Headers:** `x-auth-token: <JWT_TOKEN>`
- **URL Parameters:**
  - `id`: The UUID of the device type.
- **Request Body:**
  ```json
  {
    "device_name": "Updated Solar Home System",
    "manufacturer": "Bright Solar Inc.",
    "device_model": "SHS-50W-V2",
    "amount": 27000.00
  }
  ```
- **Response Sample (Success - 200 OK):**
  ```json
  {
    "msg": "Device type updated successfully",
    "deviceType": {
      "id": "dt1e2f3a4-b5c6-7890-1234-567890abcdef",
      "device_name": "Updated Solar Home System",
      "manufacturer": "Bright Solar Inc.",
      "device_model": "SHS-50W-V2",
      "amount": "27000.00",
      "created_at": "2025-07-26T14:00:00.000Z",
      "updated_at": "2025-07-26T14:15:00.000Z"
    }
  }
  ```
- **Response Sample (Error - 404 Not Found):**
  ```json
  {
    "msg": "Device type not found"
  }
  ```

### 10.4. Delete Device Type
- **Route:** `DELETE /api/device-types/:id`
- **Description:** Deletes a device type from the system.
- **Access:** Private (Admin only)
- **Headers:** `x-auth-token: <JWT_TOKEN>`
- **URL Parameters:**
  - `id`: The UUID of the device type.
- **Response Sample (Success - 200 OK):**
  ```json
  {
    "msg": "Device type deleted successfully",
    "deviceType": {
      "id": "dt1e2f3a4-b5c6-7890-1234-567890abcdef",
      "device_name": "Solar Home System",
      "manufacturer": "Bright Solar",
      "device_model": "SHS-50W",
      "amount": "25000.00",
      "created_at": "2025-07-26T14:00:00.000Z",
      "updated_at": "2025-07-26T14:00:00.000Z"
    }
  }
  ```
- **Response Sample (Error - 404 Not Found):**
  ```json
  {
    "msg": "Device type not found"
  }
  ```