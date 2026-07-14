# Ithraa Backend — API Contract for Frontend

> **Source of truth:** Backend source code (not Swagger).
> **Generated:** 2026-07-08
> **Base URL:** `/api`

---

## Table of Contents

1. [Global Response Contract](#1-global-response-contract)
2. [Error Codes Reference](#2-error-codes-reference)
3. [Validation Translation Keys](#3-validation-translation-keys)
4. [Pagination Contract](#4-pagination-contract)
5. [Authentication Flow](#5-authentication-flow)
6. [Roles & Permissions](#6-roles--permissions)
7. [Endpoint Documentation](#7-endpoint-documentation)
   - [Auth](#auth)
   - [Users](#users)
   - [Teachers](#teachers)
   - [Parents](#parents)
   - [Enrichers](#enrichers)
   - [Children](#children)
   - [Parent Children](#parent-children)
   - [Child Transfers](#child-transfers)
   - [Organizations](#organizations)
   - [Classes](#classes)
   - [Grades](#grades)
   - [Evaluations](#evaluations)
   - [Evaluation Attempts](#evaluation-attempts)
   - [Owner Evaluation Results](#owner-evaluation-results)
   - [Admin Private Attempts](#admin-private-attempts)
   - [Deals](#deals)
   - [Proposals](#proposals)
   - [Activities](#activities)
   - [Payments](#payments)
   - [Notifications](#notifications)
   - [Capacity Requests](#capacity-requests)
   - [Sessions](#sessions)
8. [Frontend Checklist](#8-frontend-checklist)

---

## 1. Global Response Contract

### Success Response

Every successful response (2xx) is wrapped by `ApiResponseSuccessIntercepter`:

```json
{
  "success": true,
  "data": "<endpoint-specific payload>",
  "requestId": "req_<uuid>",
  "timestamp": "2026-07-08T12:00:00.000Z"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `success` | `true` | Always `true` for successful responses |
| `data` | `any` | The actual response payload. Shape varies per endpoint. |
| `requestId` | `string` | Unique request identifier. Reuses `X-Request-ID` header if valid, otherwise generates `req_<uuid>`. |
| `timestamp` | `string` | ISO 8601 timestamp of when the response was generated. |

### Error Response

Every error response (4xx/5xx) is produced by `AllExceptionsFilter`:

```json
{
  "success": false,
  "error": {
    "code": "AUTH.INVALID_CREDENTIALS",
    "message": "errors.auth.invalidCredentials",
    "details": {},
    "fieldErrors": []
  },
  "requestId": "req_<uuid>",
  "timestamp": "2026-07-08T12:00:00.000Z",
  "path": "/api/auth/login"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `success` | `false` | Always `false` for error responses. |
| `error.code` | `string` | Machine-readable error code. Use this for logic branching. |
| `error.message` | `string` | i18n translation key. Pass to `next-intl`'s `t()`. **Never** hardcoded English/Arabic. |
| `error.details` | `object \| undefined` | Optional context data (IDs, constraints, etc.). Not present on all errors. |
| `error.fieldErrors` | `FieldError[] \| undefined` | Present only on validation errors (400). |
| `requestId` | `string` | Same as success responses. |
| `timestamp` | `string` | ISO 8601 timestamp. |
| `path` | `string` | The requested URL path. |

### FieldError Shape

```json
{
  "field": "email",
  "code": "VALIDATION.IS_EMAIL",
  "message": "validation.isEmail",
  "context": {}
}
```

| Field | Type | Description |
|-------|------|-------------|
| `field` | `string` | Dot-notation field path (e.g., `email`, `child.name`, `dimensions[0].code`). |
| `code` | `string` | Machine-readable validation error code. |
| `message` | `string` | i18n translation key for the constraint. |
| `context` | `object \| undefined` | Interpolation parameters (e.g., `{ "min": 8 }` for minLength). |

---

## 2. Error Codes Reference

### Auth Errors

| Code | Translation Key | HTTP Status | Description |
|------|----------------|-------------|-------------|
| `AUTH.UNAUTHORIZED` | `errors.auth.unauthorized` | 401 | Missing or invalid JWT token |
| `AUTH.INVALID_CREDENTIALS` | `errors.auth.invalidCredentials` | 401 | Wrong phone/email or password |
| `AUTH.FORBIDDEN` | `errors.auth.forbidden` | 403 | Authenticated but insufficient role |
| `AUTH.REFRESH_TOKEN_MISSING` | `errors.auth.refreshTokenMissing` | 401 | No refresh token provided |
| `AUTH.SESSION_COMPROMISED` | `errors.auth.sessionCompromised` | 401 | Refresh token hash mismatch |
| `AUTH.TOKEN_INVALID` | `errors.auth.tokenInvalid` | 400 | JWT verification failed |
| `AUTH.TOKEN_EXPIRED` | `errors.auth.tokenExpired` | 401 | JWT has expired |
| `AUTH.LOGOUT_FAILED` | `errors.auth.logoutFailed` | 403 | Cannot delete another user's session |

### User Errors

| Code | Translation Key | HTTP Status | Description |
|------|----------------|-------------|-------------|
| `USER.NOT_FOUND` | `errors.user.notFound` | 404 | User does not exist |
| `USER.ALREADY_EXISTS` | `errors.user.alreadyExists` | 409 | User already exists (generic) |
| `USER.EMAIL_IN_USE` | `errors.user.emailInUse` | 409 | Email already registered |
| `USER.PHONE_IN_USE` | `errors.user.phoneInUse` | 409 | Phone number already registered |

### Organization Errors

| Code | Translation Key | HTTP Status | Description |
|------|----------------|-------------|-------------|
| `ORGANIZATION.NOT_FOUND` | `errors.organization.notFound` | 404 | Organization does not exist |
| `ORGANIZATION.ALREADY_EXISTS` | `errors.organization.alreadyExists` | 409 | Organization slug conflict |
| `ORGANIZATION.NOT_APPROVED` | `errors.organization.notApproved` | 403 | Organization pending approval |
| `ORGANIZATION.ALREADY_APPROVED` | `errors.organization.alreadyApproved` | 409 | Already in approved state |
| `ORGANIZATION.ALREADY_REJECTED` | `errors.organization.alreadyRejected` | 409 | Already in rejected state |

### Child Errors

| Code | Translation Key | HTTP Status | Description |
|------|----------------|-------------|-------------|
| `CHILD.NOT_FOUND` | `errors.child.notFound` | 404 | Child does not exist |
| `CHILD.LIMIT_REACHED` | `errors.child.limitReached` | 400/403 | Parent's child limit reached |
| `CHILD.ACCESS_DENIED` | `errors.child.accessDenied` | 403 | No access to this child |
| `CHILD.ALREADY_ASSIGNED` | `errors.child.alreadyAssigned` | 409 | Child already in class |
| `CHILD.INVALID_TYPE` | `errors.child.invalidType` | 400 | Cannot mix org/private child |
| `CHILD.DUPLICATE` | `errors.child.duplicate` | 409 | Child already exists in school |

### Teacher Errors

| Code | Translation Key | HTTP Status | Description |
|------|----------------|-------------|-------------|
| `TEACHER.NOT_FOUND` | `errors.teacher.notFound` | 404 | Teacher does not exist |
| `TEACHER.ALREADY_EXISTS` | `errors.teacher.alreadyExists` | 409 | Teacher already registered |

### Grade Errors

| Code | Translation Key | HTTP Status | Description |
|------|----------------|-------------|-------------|
| `GRADE.NOT_FOUND` | `errors.grade.notFound` | 404 | Grade does not exist |
| `GRADE.ALREADY_EXISTS` | `errors.grade.alreadyExists` | 409 | Grade name conflict in org |

### Class Errors

| Code | Translation Key | HTTP Status | Description |
|------|----------------|-------------|-------------|
| `CLASS.NOT_FOUND` | `errors.class.notFound` | 404 | Class does not exist |
| `CLASS.ALREADY_EXISTS` | `errors.class.alreadyExists` | 409 | Class name conflict in grade |
| `CLASS.FULL` | `errors.class.full` | 400 | Class has reached capacity |

### Evaluation Errors

| Code | Translation Key | HTTP Status | Description |
|------|----------------|-------------|-------------|
| `EVALUATION.NOT_FOUND` | `errors.evaluation.notFound` | 404 | Evaluation does not exist |
| `EVALUATION.ATTEMPT_NOT_FOUND` | `errors.evaluation.attemptNotFound` | 404 | Attempt does not exist |
| `EVALUATION.ATTEMPT_LOCKED` | `errors.evaluation.attemptLocked` | 400 | Attempt is locked/completed |
| `EVALUATION.MAX_ATTEMPTS_REACHED` | `errors.evaluation.maxAttemptsReached` | 409 | No more attempts allowed |
| `EVALUATION.DIMENSION_MISSING` | `errors.evaluation.dimensionMissing` | 400 | Unknown dimension code |
| `EVALUATION.DUPLICATE_DIMENSIONS` | `errors.evaluation.duplicateDimensions` | 400 | Duplicate dimension codes |
| `EVALUATION.DUPLICATE_ANSWERS` | `errors.evaluation.duplicateAnswers` | 400 | Duplicate answers submitted |
| `EVALUATION.INVALID_TRANSITION` | `errors.evaluation.invalidTransition` | 400 | Invalid slot status transition |
| `EVALUATION.SLOT_NOT_FOUND` | `errors.evaluation.slotNotFound` | 404 | No available slot |
| `EVALUATION.INVALID_QUESTION` | `errors.evaluation.invalidQuestion` | 400 | Question not in evaluation |
| `EVALUATION.INVALID_ANSWER` | `errors.evaluation.invalidAnswer` | 400 | Answer not for this question |
| `EVALUATION.NOT_SUITABLE_AGE` | `errors.evaluation.notSuitableAge` | 403 | Child age outside range |
| `EVALUATION.NOT_AVAILABLE` | `errors.evaluation.notAvailable` | 400 | Evaluation not available |

### Payment Errors

| Code | Translation Key | HTTP Status | Description |
|------|----------------|-------------|-------------|
| `PAYMENT.NOT_FOUND` | `errors.payment.notFound` | 404 | Payment does not exist |
| `PAYMENT.FAILED` | `errors.payment.failed` | 400 | Payment failed or not retryable |
| `PAYMENT.EXPIRED` | `errors.payment.expired` | 400 | Payment session expired |
| `PAYMENT.MAX_RETRIES` | `errors.payment.maxRetries` | 400 | Retry limit reached |
| `PAYMENT.INVALID_PROVIDER` | `errors.payment.invalidProvider` | 400 | Provider not configured |
| `PAYMENT.CURRENCY_NOT_SUPPORTED` | `errors.payment.currencyNotSupported` | 400 | Only SAR supported |
| `PAYMENT.WEBHOOK_INVALID` | `errors.payment.webhookInvalid` | 401 | Invalid webhook signature |
| `PAYMENT.WEBHOOK_MISSING` | `errors.payment.webhookMissing` | 400 | Missing webhook data |
| `PAYMENT.PROVIDER_UNAVAILABLE` | `errors.payment.providerUnavailable` | 503 | Provider unreachable |
| `PAYMENT.INVALID_JSON` | `errors.payment.invalidJson` | 400 | Malformed webhook body |

### Deal Errors

| Code | Translation Key | HTTP Status | Description |
|------|----------------|-------------|-------------|
| `DEAL.NOT_FOUND` | `errors.deal.notFound` | 404 | Deal does not exist |
| `DEAL.CLOSED` | `errors.deal.closed` | 400 | Deal is closed |
| `DEAL.DEADLINE_PASSED` | `errors.deal.deadlinePassed` | 400 | Cannot modify after deadline |
| `DEAL.DUPLICATE_PROPOSAL` | `errors.deal.duplicateProposal` | 409 | Already submitted proposal |
| `DEAL.CANNOT_CREATE` | `errors.deal.cannotCreate` | 403 | Not allowed to create deals |
| `DEAL.PROPOSAL_NOT_FOUND` | `errors.deal.proposalNotFound` | 404 | Proposal does not exist |
| `DEAL.PROPOSAL_INVALID_STATE` | `errors.deal.proposalInvalidState` | 400 | Wrong proposal status |

### Activity Errors

| Code | Translation Key | HTTP Status | Description |
|------|----------------|-------------|-------------|
| `ACTIVITY.NOT_FOUND` | `errors.activity.notFound` | 404 | Activity does not exist |
| `ACTIVITY.HAS_DEALS` | `errors.activity.hasDeals` | 400 | Cannot delete — has deals |

### Transfer Errors

| Code | Translation Key | HTTP Status | Description |
|------|----------------|-------------|-------------|
| `TRANSFER.NOT_FOUND` | `errors.transfer.notFound` | 404 | Transfer request does not exist |
| `TRANSFER.ALREADY_RESOLVED` | `errors.transfer.alreadyResolved` | 409 | Already approved/rejected |
| `TRANSFER.INVALID_CHILD_TYPE` | `errors.transfer.invalidChildType` | 400 | Cannot transfer this child type |

### Notification Errors

| Code | Translation Key | HTTP Status | Description |
|------|----------------|-------------|-------------|
| `NOTIFICATION.NOT_FOUND` | `errors.notification.notFound` | 404 | Notification does not exist |
| `NOTIFICATION.EMAIL_REQUIRED` | `errors.notification.emailRequired` | 400 | Email needed for delivery |

### Capacity Errors

| Code | Translation Key | HTTP Status | Description |
|------|----------------|-------------|-------------|
| `CAPACITY.NOT_FOUND` | `errors.capacity.notFound` | 404 | Request does not exist |
| `CAPACITY.ACCESS_DENIED` | `errors.capacity.accessDenied` | 403 | No access to this request |

### Database Errors

| Code | Translation Key | HTTP Status | Description |
|------|----------------|-------------|-------------|
| `DB.UNIQUE_VIOLATION` | `errors.database.duplicateKey` | 409 | Generic unique constraint |
| `DB.FOREIGN_KEY_VIOLATION` | `errors.database.foreignKeyViolation` | 409 | FK reference missing |
| `DB.NOT_NULL_VIOLATION` | `errors.database.notNullViolation` | 400 | Required field is null |
| `DB.CHECK_VIOLATION` | `errors.database.checkViolation` | 400 | Check constraint failed |
| `DB.ERROR` | `errors.database.genericError` | 500 | Unexpected DB error |

### Generic Errors

| Code | Translation Key | HTTP Status | Description |
|------|----------------|-------------|-------------|
| `RATE_LIMIT.EXCEEDED` | `errors.common.tooManyRequests` | 429 | Rate limit hit |
| `INTERNAL.UNEXPECTED` | `errors.common.internalServerError` | 500 | Unexpected server error |
| `VALIDATION.FAILED` | `errors.validation.failed` | 400 | Validation failed (generic) |

---

## 3. Validation Translation Keys

| Translation Key | Constraint | Context |
|----------------|------------|---------|
| `validation.required` | `isNotEmpty` | — |
| `validation.isEmail` | `isEmail` | — |
| `validation.isString` | `isString` | — |
| `validation.isNumber` | `isNumber` | — |
| `validation.isBoolean` | `isBoolean` | — |
| `validation.isDate` | `isDate` | — |
| `validation.invalidEnum` | `isEnum` | `{ "values": ["a", "b"] }` |
| `validation.invalidUuid` | `isUuid` | — |
| `validation.invalidPhone` | `isPhoneNumber` | — |
| `validation.invalidBirthDate` | `isValidBirthDate` | — |
| `validation.minLength` | `minLength` | `{ "min": 8 }` |
| `validation.maxLength` | `maxLength` | `{ "max": 100 }` |
| `validation.min` | `min` | `{ "min": 1 }` |
| `validation.max` | `max` | `{ "max": 100 }` |
| `validation.pattern` | `matches` | `{ "pattern": "..." }` |
| `validation.arrayMinSize` | `arrayMinSize` | `{ "min": 1 }` |
| `validation.arrayMaxSize` | `arrayMaxSize` | `{ "max": 500 }` |
| `validation.arrayNotEmpty` | `arrayNotEmpty` | — |
| `validation.isArray` | `isArray` | — |
| `validation.isObject` | `isObject` | — |
| `validation.isPositive` | `isPositive` | — |
| `validation.isInteger` | `isInt` | — |

---

## 4. Pagination Contract

List endpoints that support pagination return data in this format:

```json
{
  "success": true,
  "data": [...],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "totalPages": 3,
    "hasNextPage": true,
    "hasPreviousPage": false
  },
  "requestId": "...",
  "timestamp": "..."
}
```

**Query Parameters (standard):**

| Param | Type | Default | Range | Description |
|-------|------|---------|-------|-------------|
| `page` | `number` | `1` | ≥ 1 | Page number |
| `limit` | `number` | `20` | 1–100 | Items per page |

**Endpoints with pagination:**

| Endpoint | Extra Filters |
|----------|---------------|
| `GET /children/all` | — |
| `GET /children` | `userId` (UUID) |
| `GET /parent/children` | — |
| `GET /parent/org-children` | — |
| `GET /attempts` | `status`, `evaluationId`, `childId` |
| `GET /attempts/child/:childId` | — |
| `GET /notifications` | `unreadOnly`, `type` |

---

## 5. Authentication Flow

### Login

```
POST /api/auth/login
Body: { phone: string, password: string }
Response: {
  success: true,
  data: {
    accessToken: string,   // JWT, expires in 30d
    refreshToken: string,  // JWT, expires in 60d
    id: string,
    name: string,
    email: string,
    phone: string,
    roles: [{ id: string, name: string }],
    isEmailVerified: boolean,
    isPhoneVerified: boolean,
    expiresIn: "30d"
  }
}
```

### Refresh Token

```
POST /api/auth/refresh
Body: { token: string }   // the refreshToken
Response: same shape as login
```

### Token Usage

```
Authorization: Bearer <accessToken>
```

### Token Expiration

- Access token: 30 days
- Refresh token: 60 days
- On 401: Try refresh. If refresh also fails → redirect to login.

### Logout

```
DELETE /api/auth/logout/:sessionId
Authorization: Bearer <accessToken>
Response: { success: true, data: { message: "Logged out", statusCode: 200 } }

DELETE /api/auth/logout-all
Authorization: Bearer <accessToken>
Response: { success: true, data: null }
```

---

## 6. Roles & Permissions

| Role | Value | Can Access |
|------|-------|-----------|
| Admin | `ADMIN` | Everything |
| Organization Owner | `ORGANIZATIONOWNER` | Own organization, teachers, classes, grades, children in org, deals, evaluations for org |
| Teacher | `TEACHER` | Assigned organization (read), classes, children in org |
| Parent | `PARENT` | Own children, private children, evaluations for own children, payments, capacity requests |
| Enricher | `ENRICHER` | Deals (read), own proposals |

---

## 7. Endpoint Documentation

### Auth

---

#### `POST /api/auth/login`

**Authentication:** Public (no JWT)
**Throttle:** 10 requests per 60 seconds

**Request Body:**

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `phone` | `string` | yes | `@IsPhoneNumber()` — spaces/dashes auto-stripped |
| `password` | `string` | yes | `@Length(8, 100)`, `@Matches(/^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[@$!%*?&])/)` |

**Success (200):**

```json
{
  "success": true,
  "data": {
    "accessToken": "eyJ...",
    "refreshToken": "eyJ...",
    "id": "uuid",
    "name": "string",
    "email": "string",
    "phone": "+20...",
    "roles": [{ "id": "uuid", "name": "PARENT" }],
    "isEmailVerified": false,
    "isPhoneVerified": false,
    "expiresIn": "30d"
  },
  "requestId": "req_...",
  "timestamp": "..."
}
```

**Errors:**

| Status | Code | When |
|--------|------|------|
| 401 | `AUTH.INVALID_CREDENTIALS` | Wrong phone or password |
| 429 | `RATE_LIMIT.EXCEEDED` | Too many attempts |

---

#### `POST /api/auth/beneficiaries-signup`

**Authentication:** Public
**Throttle:** 10 requests per 60 seconds

**Request Body:**

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `name` | `string` | yes | `@Length(2, 50)`, trimmed |
| `email` | `string` | yes | `@IsEmail()`, lowercased + trimmed |
| `password` | `string` | yes | `@Length(8, 100)`, `@Matches(...)` strong password |
| `phone` | `string` | yes | `@IsPhoneNumber()` |
| `accountType` | `"organization"` | yes | `@IsEnum(AccountType)` |
| `organizationName` | `string` | yes | `@Length(2, 120)`, trimmed |
| `organizationType` | `"school" \| "center" \| "nursery" \| "training"` | yes | `@IsEnum(OrganizationType)` |

**Success (200):**

```json
{
  "success": true,
  "data": {
    "user": { /* User entity — password excluded */ },
    "organization": {
      "id": "uuid",
      "organizationName": "string",
      "organizationType": "school",
      "approvalStatus": "pending"
    }
  }
}
```

**Errors:**

| Status | Code | When |
|--------|------|------|
| 409 | `USER.ALREADY_EXISTS` | Phone or email already registered |

---

#### `POST /api/auth/enrichers-signup`

**Authentication:** Public

**Request Body:**

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `name` | `string` | yes | `@Length(2, 50)` |
| `email` | `string` | yes | `@IsEmail()` |
| `password` | `string` | yes | `@Length(8, 100)`, strong |
| `phone` | `string` | yes | `@IsPhoneNumber()` |
| `organizationName` | `string` | yes | `@IsString()` |
| `accountType` | `"enricher"` | yes | `@IsEnum(AccountType)` |

**Success (200):**

```json
{
  "success": true,
  "data": {
    "user": { /* User entity */ },
    "enricher": { "id": "uuid", "organizationName": "string", "approvalStatus": "pending" }
  }
}
```

**Errors:** Same as beneficiaries-signup.

---

#### `POST /api/auth/parent-signup`

**Authentication:** Public

**Request Body:**

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `name` | `string` | yes | `@Length(2, 50)` |
| `email` | `string` | yes | `@IsEmail()` |
| `password` | `string` | yes | `@Length(8, 100)`, strong |
| `phone` | `string` | yes | `@IsPhoneNumber()` |

**Success (200):**

```json
{
  "success": true,
  "data": {
    "user": { /* User entity */ },
    "parentProfile": { "id": "uuid", "userId": "uuid", "maxChildren": 2 }
  }
}
```

**Errors:** Same as beneficiaries-signup.

---

#### `POST /api/auth/refresh`

**Authentication:** Public

**Request Body:**

| Field | Type | Required |
|-------|------|----------|
| `token` | `string` | yes (sent as `@Body('token')`) |

**Success (200):** Same shape as login response.

**Errors:**

| Status | Code | When |
|--------|------|------|
| 401 | `AUTH.REFRESH_TOKEN_MISSING` | No token provided |
| 401 | `AUTH.SESSION_COMPROMISED` | Token hash mismatch |
| 400 | `AUTH.TOKEN_INVALID` | JWT invalid or expired |

---

#### `DELETE /api/auth/logout/:sessionId`

**Authentication:** JWT Required

**Path Params:** `sessionId` (UUID)

**Success (200):**

```json
{
  "success": true,
  "data": { "message": "Logged out", "statusCode": 200 }
}
```

**Errors:**

| Status | Code | When |
|--------|------|------|
| 403 | `AUTH.LOGOUT_FAILED` | Session belongs to another user |

---

#### `DELETE /api/auth/logout-all`

**Authentication:** JWT Required

**Success (200):**

```json
{
  "success": true,
  "data": null
}
```

---

#### `GET /api/auth/verify-email`

**Authentication:** Public

**Query Params:** `token` (string — JWT)

**Success (200):**

```json
{
  "success": true,
  "data": { "message": "Email verified successfully", "ok": true }
}
```

**Errors:**

| Status | Code | When |
|--------|------|------|
| 400 | `AUTH.TOKEN_INVALID` | Invalid or expired token |

---

### Users

---

#### `GET /api/users`

**Authentication:** JWT Required
**Roles:** `ADMIN`

**Success (200):**

```json
{
  "success": true,
  "data": {
    "users": [
      {
        "id": "uuid",
        "name": "string",
        "email": "string",
        "phone": "string",
        "isEmailVerified": false,
        "isPhoneVerified": false,
        "roles": [{ "id": "uuid", "name": "ADMIN" }]
      }
    ]
  }
}
```

---

#### `GET /api/users/roles`

**Authentication:** JWT Required
**Roles:** `ADMIN`

**Success (200):**

```json
{
  "success": true,
  "data": {
    "teachers": [ /* User[] */ ],
    "organizationOwners": [ /* User[] */ ],
    "enrichers": [ /* User[] */ ]
  }
}
```

---

#### `GET /api/users/me`

**Authentication:** JWT Required (any role)

**Success (200):**

```json
{
  "success": true,
  "data": { /* User entity — password excluded */ }
}
```

**Errors:**

| Status | Code | When |
|--------|------|------|
| 404 | `USER.NOT_FOUND` | User not found |

---

#### `GET /api/users/:id`

**Authentication:** JWT Required
**Ownership:** Admin or self

**Path Params:** `id` (UUID)

**Success (200):** User entity.

**Errors:**

| Status | Code | When |
|--------|------|------|
| 403 | `AUTH.FORBIDDEN` | Not admin and not self |
| 404 | `USER.NOT_FOUND` | User not found |

---

#### `GET /api/users/organization-owner/:id`

**Authentication:** JWT Required
**Roles:** `ORGANIZATIONOWNER`, `ADMIN`

**Path Params:** `id` (UUID — ownerId)

**Success (200):**

```json
{
  "success": true,
  "data": { "user": { /* User with ownedOrganization */ } }
}
```

---

#### `POST /api/users/seed-roles`

**Authentication:** JWT Required
**Roles:** `ADMIN`

**Success (200):** TypeORM UpsertResult.

---

#### `DELETE /api/users/:id`

**Authentication:** JWT Required
**Roles:** `ADMIN`

**Path Params:** `id` (UUID)

**Success (200):**

```json
{
  "success": true,
  "data": { "message": "Deleted successfully" }
}
```

**Errors:**

| Status | Code | When |
|--------|------|------|
| 404 | `USER.NOT_FOUND` | User not found |

---

### Teachers

---

#### `POST /api/teachers`

**Authentication:** JWT Required
**Roles:** `ORGANIZATIONOWNER`

**Request Body:**

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `name` | `string` | yes | `@Length(2, 50)` |
| `email` | `string` | yes | `@IsEmail()` |
| `password` | `string` | yes | `@Length(8, 100)`, strong |
| `phone` | `string` | yes | `@IsPhoneNumber()` |
| `jobTitle` | `string` | yes | `@Length(2, 100)` |

**Success (200):**

```json
{
  "success": true,
  "data": { "teacher": { /* Teacher entity */ } }
}
```

**Errors:**

| Status | Code | When |
|--------|------|------|
| 409 | `TEACHER.ALREADY_EXISTS` | Teacher already exists |
| 404 | `ORGANIZATION.NOT_FOUND` | Org not found |

---

#### `PATCH /api/teachers/:id`

**Authentication:** JWT Required
**Roles:** `ORGANIZATIONOWNER`

**Path Params:** `id` (UUID)
**Request Body:** Partial `CreateTeacherDto`

**Success (200):** Teacher entity.

---

#### `GET /api/teachers/organization/:organizationId`

**Authentication:** JWT Required
**Roles:** `ORGANIZATIONOWNER`, `ADMIN`, `TEACHER`

**Path Params:** `organizationId` (UUID)

**Success (200):**

```json
{
  "success": true,
  "data": {
    "teachers": [
      {
        "teacherId": "uuid",
        "userId": "uuid",
        "name": "string",
        "email": "string",
        "phone": "string",
        "isEmailVerified": false,
        "isPhoneVerified": false,
        "organizationId": "uuid",
        "organizationName": "string",
        "jobTitle": "string",
        "classes": ["className1", "className2"]
      }
    ]
  }
}
```

**Errors:**

| Status | Code | When |
|--------|------|------|
| 403 | `AUTH.FORBIDDEN` | No access to this org |
| 404 | `TEACHER.NOT_FOUND` | Teacher not found |
| 404 | `ORGANIZATION.NOT_FOUND` | Org not found |

---

#### `DELETE /api/teachers/:id`

**Authentication:** JWT Required
**Roles:** `ORGANIZATIONOWNER`

**Success (200):**

```json
{
  "success": true,
  "data": { "message": "Deleted successfully" }
}
```

---

### Parents

---

#### `GET /api/parents/search`

**Authentication:** JWT Required
**Roles:** `ORGANIZATIONOWNER`, `ADMIN`

**Query Params:** `phone` (string)

**Success (200):** One of three shapes:

```json
// Not found
{ "success": true, "data": { "status": "not_found" } }

// Found but not a parent
{ "success": true, "data": { "status": "not_parent", "user": { "id": "uuid", "name": "string", "phone": "string" } } }

// Parent found
{
  "success": true,
  "data": {
    "status": "parent_found",
    "parent": { /* User fields + parentProfileId */ },
    "children": [ /* OrganizationChild | PrivateChild with type field */ ]
  }
}
```

---

### Enrichers

---

#### `GET /api/enrichers/deals`

**Authentication:** JWT Required
**Roles:** `ENRICHER`

**Success (200):** `Deal[]` (OPEN status only)

---

#### `GET /api/enrichers/deals/:dealId`

**Authentication:** JWT Required
**Roles:** `ENRICHER`

**Path Params:** `dealId` (UUID)

**Success (200):** `Deal` entity with relations.

---

#### `GET /api/enrichers/proposals`

**Authentication:** JWT Required
**Roles:** `ENRICHER`

**Success (200):** `Proposal[]` with `deal` and `deal.organization` relations.

---

### Children

---

#### `POST /api/children`

**Authentication:** JWT Required
**Roles:** `ORGANIZATIONOWNER`, `TEACHER`

**Request Body:**

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `name` | `string` | yes | `@IsString()` |
| `birthDate` | `string` | yes | `@IsDateString()`, `@IsValidBirthDate()` — format `YYYY-MM-DD` |
| `gender` | `"male" \| "female"` | yes | `@IsEnum(Gender)` |
| `classId` | `string` | yes | `@IsUUID()` |
| `parentPhone` | `string` | yes | `@IsPhoneNumber()` |
| `parentEmail` | `string` | no | `@IsEmail()`, `@IsOptional()` |
| `parentName` | `string` | no | `@Length(2, 50)`, `@IsOptional()` |

**Success (200):**

```json
// CREATED
{ "success": true, "data": { "status": "CREATED", "message": "Child created successfully", "childId": "uuid" } }

// TRANSFER REQUIRED
{ "success": true, "data": { "status": "TRANSFER_REQUIRED", "message": "...", "childId": "uuid", "transferRequestId": "uuid" } }
```

**Errors:**

| Status | Code | When |
|--------|------|------|
| 403 | `CHILD.ACCESS_DENIED` | Policy denied |
| 400 | `CHILD.LIMIT_REACHED` | Parent limit reached |
| 409 | `CHILD.DUPLICATE` | Child already exists in school |

---

#### `GET /api/children/all`

**Authentication:** JWT Required
**Roles:** `ADMIN`

**Query Params:** `page` (number, default 1), `limit` (number, default 20)

**Success (200):**

```json
{
  "success": true,
  "data": [ /* OrganizationChild | PrivateChild */ ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 42,
    "totalPages": 3,
    "hasNextPage": true,
    "hasPreviousPage": false
  }
}
```

---

#### `GET /api/children`

**Authentication:** JWT Required
**Roles:** `ADMIN`, `PARENT`

**Query Params:** `userId` (UUID), `page` (number, default 1), `limit` (number, default 20)

**Success (200):**

```json
{
  "success": true,
  "data": [ /* OrganizationChild | PrivateChild */ ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 5,
    "totalPages": 1,
    "hasNextPage": false,
    "hasPreviousPage": false
  }
}
```

---

#### `GET /api/children/organization/:orgId`

**Authentication:** JWT Required
**Roles:** `ORGANIZATIONOWNER`, `ADMIN`, `TEACHER`

**Path Params:** `orgId` (UUID)

**Success (200):**

```json
{
  "success": true,
  "data": {
    "children": [
      {
        /* OrganizationChild fields */
        "gradeName": "Grade 1",
        "className": "Class A"
      }
    ]
  }
}
```

---

#### `GET /api/children/:id`

**Authentication:** JWT Required
**Roles:** `ADMIN`, `PARENT`, `ORGANIZATIONOWNER`, `TEACHER`

**Path Params:** `id` (UUID)

**Success (200):**

```json
{ "success": true, "data": { "child": { /* OrganizationChild | PrivateChild */ } } }
```

**Errors:**

| Status | Code | When |
|--------|------|------|
| 404 | `CHILD.NOT_FOUND` | Child not found |
| 403 | `CHILD.ACCESS_DENIED` | No access |

---

#### `PATCH /api/children/:id`

**Authentication:** JWT Required
**Roles:** `PARENT`, `ORGANIZATIONOWNER`, `TEACHER`, `ADMIN`

**Path Params:** `id` (UUID)
**Request Body:** Partial `CreateChildDto`

**Success (200):** Updated entity.

---

#### `DELETE /api/children/:id`

**Authentication:** JWT Required
**Roles:** `PARENT`, `ORGANIZATIONOWNER`, `TEACHER`, `ADMIN`

**Success (200):** Removed entity.

---

### Parent Children

---

#### `POST /api/parent/children`

**Authentication:** JWT Required
**Roles:** `PARENT`

**Request Body:**

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `name` | `string` | yes | `@IsString()` |
| `birthDate` | `string` | yes | `@IsDateString()`, `@IsValidBirthDate()` |
| `gender` | `"male" \| "female"` | yes | `@IsEnum(Gender)` |

**Success (200):** `PrivateChild` entity.

---

#### `GET /api/parent/children`

**Authentication:** JWT Required
**Roles:** `PARENT`

**Query Params:** `page` (number, default 1), `limit` (number, default 20)

**Success (200):**

```json
{
  "success": true,
  "data": [
    {
      /* PrivateChild fields */
      "retakeUsed": false,
      "attemptsUsed": 1
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 2,
    "totalPages": 1,
    "hasNextPage": false,
    "hasPreviousPage": false
  }
}
```

---

#### `GET /api/parent/org-children`

**Authentication:** JWT Required
**Roles:** `PARENT`

**Query Params:** `page` (number, default 1), `limit` (number, default 20)

**Success (200):**

```json
{
  "success": true,
  "data": [
    {
      /* OrganizationChild fields with relations */
      "retakeUsed": false,
      "attemptsUsed": 1
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 3,
    "totalPages": 1,
    "hasNextPage": false,
    "hasPreviousPage": false
  }
}
```

---

### Child Transfers

---

#### `POST /api/child-transfers`

**Authentication:** JWT Required
**Roles:** `ORGANIZATIONOWNER`, `ADMIN`

**Request Body:**

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `childId` | `string` | yes | `@IsUUID()` |
| `childType` | `"organization" \| "private"` | yes | `@IsEnum(...)` |
| `toOrganizationId` | `string` | yes | `@IsUUID()` |

**Success (200):** `TransferRequest` entity.

**Errors:**

| Status | Code | When |
|--------|------|------|
| 404 | `CHILD.NOT_FOUND` | Child not found |
| 409 | `CHILD.DUPLICATE` | Child already in target org |
| 400 | `TRANSFER.INVALID_CHILD_TYPE` | Cannot transfer private child |

---

#### `PATCH /api/child-transfers/:id/approve`

**Authentication:** JWT Required
**Roles:** `ORGANIZATIONOWNER`, `ADMIN`

**Path Params:** `id` (UUID)
**Request Body:**

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `classId` | `string` | yes | `@IsUUID()` |

**Success (200):** `TransferRequest` entity.

---

#### `PATCH /api/child-transfers/:id/reject`

**Authentication:** JWT Required
**Roles:** `ORGANIZATIONOWNER`, `ADMIN`

**Success (200):** `TransferRequest` entity.

---

#### `GET /api/child-transfers`

**Authentication:** JWT Required
**Roles:** `ORGANIZATIONOWNER`, `ADMIN`

**Query Params:**

| Param | Type | Required |
|-------|------|----------|
| `toOrganizationId` | UUID | no |
| `fromOrganizationId` | UUID | no |
| `status` | `"PENDING" \| "APPROVED" \| "REJECTED"` | no |

**Success (200):**

```json
{
  "success": true,
  "data": {
    "requests": [
      {
        "id": "uuid",
        "childId": "uuid",
        "childType": "organization",
        "organizationChildId": "uuid",
        "privateChildId": null,
        "fromOrganizationId": "uuid",
        "toOrganizationId": "uuid",
        "status": "pending",
        "createdAt": "2026-01-01T00:00:00Z",
        "child": { "id": "uuid", "name": "string", "birthDate": "2020-01-01", "type": "organization", "class": { "id": "uuid", "name": "Class A" } },
        "fromOrganization": { "id": "uuid", "organizationName": "Org A" },
        "toOrganization": { "id": "uuid", "organizationName": "Org B" }
      }
    ]
  }
}
```

---

### Organizations

---

#### `GET /api/organizations`

**Authentication:** JWT Required
**Roles:** `ADMIN`

**Query Params:** `status` (`"pending" \| "approved" \| "rejected"`) — optional

**Success (200):**

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "organizationName": "string",
      "organizationType": "school",
      "approvalStatus": "pending",
      "ownerId": "uuid",
      "approvedById": null,
      "approvedAt": null,
      "rejectedById": null,
      "rejectedAt": null,
      "rejectionReason": null
    }
  ]
}
```

---

#### `GET /api/organizations/pending`

**Authentication:** JWT Required
**Roles:** `ADMIN`

**Success (200):** Same shape as `GET /organizations` filtered by `PENDING`.

---

#### `GET /api/organizations/me`

**Authentication:** JWT Required
**Roles:** `ORGANIZATIONOWNER`

**Success (200):** `OrganizationResponseDto`.

---

#### `GET /api/organizations/by-parent/:parentProfileId`

**Authentication:** JWT Required
**Roles:** `ADMIN`, `PARENT`

**Path Params:** `parentProfileId` (UUID)

**Success (200):** `OrganizationResponseDto`.

---

#### `GET /api/organizations/owner/:ownerId`

**Authentication:** JWT Required (any role — ownership enforced inline)

**Path Params:** `ownerId` (UUID)

**Success (200):** `OrganizationResponseDto`.

**Errors:**

| Status | Code | When |
|--------|------|------|
| 404 | `ORGANIZATION.NOT_FOUND` | Not found |
| 403 | `AUTH.FORBIDDEN` | Not admin and not owner |

---

#### `GET /api/organizations/:id`

**Authentication:** JWT Required
**Roles:** `ADMIN`, `ORGANIZATIONOWNER`

**Success (200):** `OrganizationResponseDto`.

---

#### `PATCH /api/organizations/:id`

**Authentication:** JWT Required
**Roles:** `ADMIN`, `ORGANIZATIONOWNER`

**Request Body:**

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `organizationName` | `string` | no | `@Length(2, 120)` |
| `organizationType` | `OrganizationType` | no | `@IsEnum(OrganizationType)` |

**Success (200):** `OrganizationResponseDto`.

---

#### `PATCH /api/organizations/:id/approve`

**Authentication:** JWT Required
**Roles:** `ADMIN`

**Success (200):** `OrganizationResponseDto`.

**Errors:**

| Status | Code | When |
|--------|------|------|
| 409 | `ORGANIZATION.ALREADY_APPROVED` | Already approved |

---

#### `PATCH /api/organizations/:id/reject`

**Authentication:** JWT Required
**Roles:** `ADMIN`

**Request Body:**

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `rejectionReason` | `string` | yes | `@Length(3, 500)` |

**Success (200):** `OrganizationResponseDto`.

---

#### `DELETE /api/organizations/:id`

**Authentication:** JWT Required
**Roles:** `ADMIN`

**Success (200):**

```json
{ "success": true, "data": { "message": "Deleted successfully" } }
```

---

### Classes

---

#### `POST /api/classes`

**Authentication:** JWT Required
**Roles:** `ORGANIZATIONOWNER`

**Request Body:**

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `name` | `string` | yes | `@IsString()`, `@IsNotEmpty()` |
| `gradeId` | `string` | yes | `@IsUUID()` |
| `teacherId` | `string` | no | `@IsUUID()`, `@IsOptional()` |

**Success (200):** `Class` entity.

**Errors:**

| Status | Code | When |
|--------|------|------|
| 403 | `AUTH.FORBIDDEN` | Grade not in your org |

---

#### `GET /api/classes`

**Authentication:** JWT Required
**Roles:** `ADMIN`

**Success (200):**

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "string",
      "gradeName": "string",
      "organizationName": "string",
      "children": [ /* OrganizationChild[] */ ]
    }
  ]
}
```

---

#### `GET /api/classes/organization/:orgId`

**Authentication:** JWT Required
**Roles:** `ORGANIZATIONOWNER`, `ADMIN`, `TEACHER`

**Success (200):**

```json
{
  "success": true,
  "data": {
    "classes": [
      {
        "id": "uuid",
        "name": "string",
        "gradeId": "uuid",
        "gradeName": "string",
        "childrenCount": 25,
        "teacherId": "uuid" | undefined,
        "teacherName": "string" | undefined,
        "organizationId": "uuid",
        "organizationName": "string",
        "children": [ /* OrganizationChild[] */ ]
      }
    ]
  }
}
```

---

#### `GET /api/classes/:id`

**Authentication:** JWT Required
**Roles:** `ADMIN`, `ORGANIZATIONOWNER`, `TEACHER`

**Success (200):**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "string",
    "gradeName": "string",
    "children": [ /* OrganizationChild[] */ ]
  }
}
```

---

#### `GET /api/classes/:id/get-children`

**Authentication:** JWT Required
**Roles:** `ORGANIZATIONOWNER`, `ADMIN`, `TEACHER`

**Success (200):** `OrganizationChild[]`

---

#### `PATCH /api/classes/:id`

**Authentication:** JWT Required
**Roles:** `ORGANIZATIONOWNER`

**Request Body:** Partial `CreateClassDto`

**Success (200):** `Class` entity.

---

#### `DELETE /api/classes/:id`

**Authentication:** JWT Required
**Roles:** `ORGANIZATIONOWNER`

**Success (200):**

```json
{ "success": true, "data": { "message": "Deleted successfully" } }
```

---

#### `POST /api/classes/:clsId/asign/:childId`

**Authentication:** JWT Required
**Roles:** `ORGANIZATIONOWNER`

**Path Params:** `clsId` (UUID), `childId` (UUID)

**Success (200):**

```json
{ "success": true, "data": { "message": "child asigned successfully" } }
```

**Errors:**

| Status | Code | When |
|--------|------|------|
| 403 | `AUTH.FORBIDDEN` | Class not in your org |
| 400 | `CHILD.INVALID_TYPE` | Cannot assign private child |

---

### Grades

---

#### `POST /api/grades`

**Authentication:** JWT Required
**Roles:** `ORGANIZATIONOWNER`

**Request Body:**

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `name` | `string` | yes | `@IsString()`, `@IsNotEmpty()` |
| `organizationId` | `string` | yes | `@IsUUID()` |

**Success (200):** `Grade` entity.

---

#### `GET /api/grades`

**Authentication:** JWT Required
**Roles:** `ADMIN`

**Success (200):**

```json
{
  "success": true,
  "data": [
    { "id": "uuid", "name": "string", "organizationName": "string" }
  ]
}
```

---

#### `GET /api/grades/organization/:orgId`

**Authentication:** JWT Required
**Roles:** `ORGANIZATIONOWNER`, `ADMIN`, `TEACHER`

**Success (200):**

```json
{
  "success": true,
  "data": {
    "grades": [
      {
        "id": "uuid",
        "name": "string",
        "classes": [ { "id": "uuid", "name": "string" } ],
        "childrenCount": 30
      }
    ]
  }
}
```

---

#### `GET /api/grades/:id`

**Authentication:** JWT Required
**Roles:** `ORGANIZATIONOWNER`, `ADMIN`, `TEACHER`

**Success (200):**

```json
{
  "success": true,
  "data": {
    "grade": {
      "id": "uuid",
      "name": "string",
      "organizationId": "uuid",
      "classes": [ /* Class[] */ ],
      "classesCount": 3,
      "childrenCount": 45
    }
  }
}
```

---

#### `PATCH /api/grades/:id`

**Authentication:** JWT Required
**Roles:** `ORGANIZATIONOWNER`

**Request Body:** Partial `CreateGradeDto`

**Success (200):** `Grade` entity.

---

#### `DELETE /api/grades/:id`

**Authentication:** JWT Required
**Roles:** `ORGANIZATIONOWNER`

**Success (200):**

```json
{ "success": true, "data": { "message": "Deleted successfully" } }
```

---

### Evaluations

---

#### `POST /api/evaluations`

**Authentication:** JWT Required
**Roles:** `ADMIN`

**Request Body:**

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `title` | `string` | yes | `@MinLength(2)` |
| `type` | `EvaluationType` | yes | `@IsEnum(EvaluationType)` |
| `institutionId` | `string \| null` | no | `@IsUUID()`, `@IsOptional()` |
| `ageFrom` | `number` | no | `@IsNumber()`, `@Min(0)` |
| `ageTo` | `number` | no | `@IsNumber()`, `@Min(0)` |
| `evaluatorTypes` | `string[]` | no | `@IsArray()` |
| `dimensions` | `array` | yes | `@ArrayMinSize(1)`, nested validated |
| `questions` | `array` | yes | `@ArrayMinSize(1)`, nested validated |

**Dimension Object:**

| Field | Type | Required |
|-------|------|----------|
| `name` | `string` | yes |
| `code` | `string` | yes |
| `minScore` | `number` | yes |
| `maxScore` | `number` | yes |
| `interpretationRules` | `object` | no |

**Question Object:**

| Field | Type | Required |
|-------|------|----------|
| `content` | `string` | yes |
| `dimensionCode` | `string` | yes |
| `order` | `number` | no (default 1) |
| `answers` | `array` | yes (`@ArrayMinSize(2)`) |

**Answer Object:**

| Field | Type | Required |
|-------|------|----------|
| `text` | `string` | yes |
| `scoreValue` | `number` | yes |
| `code` | `string` | no |

**Success (200):** `Evaluation` entity with dimensions, questions, answers.

**Errors:**

| Status | Code | When |
|--------|------|------|
| 400 | `EVALUATION.DUPLICATE_DIMENSIONS` | Duplicate dimension codes |

---

#### `GET /api/evaluations`

**Authentication:** JWT Required
**Roles:** `ADMIN`

**Success (200):** `Evaluation[]` with dimensions relation.

---

#### `GET /api/evaluations/available/:childId`

**Authentication:** JWT Required
**Roles:** `PARENT`

**Path Params:** `childId` (UUID)

**Success (200):**

```json
{
  "success": true,
  "data": {
    "childId": "uuid",
    "age": 8,
    "evaluations": [ /* Evaluation[] */ ]
  }
}
```

---

#### `GET /api/evaluations/:id/details`

**Authentication:** JWT Required
**Roles:** `ADMIN`

**Success (200):** `Evaluation` with dimensions, questions, answers.

---

#### `GET /api/evaluations/:id/form`

**Authentication:** JWT Required
**Roles:** `PARENT`, `ADMIN`

**Success (200):**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "title": "string",
    "type": "multiple_intelligences",
    "institutionId": "uuid" | null,
    "ageFrom": 3,
    "ageTo": 15,
    "evaluatorTypes": ["parent", "teacher"],
    "dimensions": [
      { "id": "uuid", "name": "string", "code": "linguistic" }
    ],
    "questions": [
      {
        "id": "uuid",
        "content": "string",
        "order": 1,
        "dimension": { "id": "uuid", "code": "linguistic", "name": "string" },
        "answers": [
          { "id": "uuid", "text": "string", "code": "always", "order": 4 }
        ]
      }
    ]
  }
}
```

---

#### `POST /api/evaluations/:id/start`

**Authentication:** JWT Required
**Roles:** `PARENT`

**Path Params:** `id` (UUID — evaluationId)

**Request Body:**

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `childId` | `string` | yes | `@IsUUID()` |
| `childType` | `"organization" \| "private"` | yes | `@IsEnum(...)` |
| `expiresAt` | `string` | no | `@IsDateString()`, `@IsOptional()` |
| `expiresInSeconds` | `number` | no | `@IsInt()`, `@Min(1)` |

**Success (200):** `EvaluationSlot` entity.

---

### Evaluation Attempts

---

#### `GET /api/attempts`

**Authentication:** JWT Required
**Roles:** `ADMIN`

**Query Params:**

| Param | Type | Required |
|-------|------|----------|
| `status` | `EvaluationAttemptStatus` | no |
| `evaluationId` | UUID | no |
| `childId` | UUID | no |
| `page` | number (default 1) | no |
| `limit` | number (default 20) | no |

**Success (200):**

```json
{
  "success": true,
  "data": [ /* EvaluationAttempt[] */ ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 10,
    "totalPages": 1,
    "hasNextPage": false,
    "hasPreviousPage": false
  }
}
```

---

#### `GET /api/attempts/child/:childId`

**Authentication:** JWT Required
**Roles:** `PARENT`, `ADMIN`

**Query Params:** `page` (number, default 1), `limit` (number, default 20)

**Success (200):**

```json
{
  "success": true,
  "data": [ /* EvaluationAttempt[] with evaluation, approval */ ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 3,
    "totalPages": 1,
    "hasNextPage": false,
    "hasPreviousPage": false
  }
}
```

---

#### `POST /api/attempts/:childId/start`

**Authentication:** JWT Required
**Roles:** `PARENT`

**Path Params:** `childId` (UUID — private child)

**Success (200):** `EvaluationSlot` entity.

---

#### `POST /api/attempts/:childId/retake`

**Authentication:** JWT Required
**Roles:** `PARENT`

**Success (200):** `EvaluationSlot` entity.

**Errors:**

| Status | Code | When |
|--------|------|------|
| 400 | `EVALUATION.ATTEMPT_LOCKED` | Main attempt not completed |
| 409 | `EVALUATION.MAX_ATTEMPTS_REACHED` | Retake already used |

---

#### `POST /api/attempts/:childId/request-extra`

**Authentication:** JWT Required
**Roles:** `PARENT`

**Success (200):** `EvaluationSlot` entity.

---

#### `PATCH /api/attempts/:id/save`

**Authentication:** JWT Required
**Roles:** `PARENT`

**Path Params:** `id` (UUID — attemptId)

**Request Body:**

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `answers` | `AttemptAnswerDto[]` | no | `@ArrayMinSize(1)`, `@ArrayMaxSize(500)` |

**AttemptAnswerDto:**

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `questionId` | `string` | yes | `@IsUUID()` |
| `selectedAnswerId` | `string` | yes | `@IsUUID()` |

**Success (200):** `EvaluationAttempt` entity.

---

#### `POST /api/attempts/:id/submit`

**Authentication:** JWT Required
**Roles:** `PARENT`

**Path Params:** `id` (UUID — attemptId)

**Request Body:** Same as save but `answers` is required.

**Success (200):** `EvaluationAttempt` entity.

**Errors:**

| Status | Code | When |
|--------|------|------|
| 400 | `EVALUATION.ATTEMPT_LOCKED` | Already submitted |
| 400 | `EVALUATION.INVALID_QUESTION` | Question not in evaluation |

---

#### `GET /api/attempts/:id`

**Authentication:** JWT Required
**Roles:** `PARENT`, `ADMIN`, `ORGANIZATIONOWNER`, `TEACHER`

**Success (200):** `EvaluationAttempt` with full relations (answers, evaluation, children, parent).

---

#### `POST /api/attempts/:id/approve`

**Authentication:** JWT Required
**Roles:** `ADMIN`

**Success (200):** `EvaluationAttempt` entity.

**Errors:**

| Status | Code | When |
|--------|------|------|
| 400 | `EVALUATION.ATTEMPT_LOCKED` | Not submitted |
| 409 | `EVALUATION.ATTEMPT_LOCKED` | Already approved |

---

### Owner Evaluation Results

---

#### `GET /api/evaluations/owner/filters`

**Authentication:** JWT Required
**Roles:** `ORGANIZATIONOWNER`, `ADMIN`

**Success (200):**

```json
{
  "success": true,
  "data": {
    "classes": [ { "id": "uuid", "name": "string" } ],
    "evaluations": [ { "id": "uuid", "title": "string", "type": "...", "ageFrom": 3, "ageTo": 15 } ]
  }
}
```

---

#### `GET /api/evaluations/owner/reports`

**Authentication:** JWT Required
**Roles:** `ORGANIZATIONOWNER`, `ADMIN`

**Query Params:** `evaluationId` (UUID, optional)

**Success (200):**

```json
{
  "success": true,
  "data": {
    "reports": [
      {
        "classId": "uuid",
        "className": "string",
        "evaluationId": "uuid",
        "evaluationTitle": "string",
        "title": "string",
        "childrenCount": 25,
        "evaluatedCount": 20,
        "reportDate": "2026-07-08"
      }
    ]
  }
}
```

---

#### `GET /api/evaluations/owner/classes/:classId/evaluations/:evaluationId/summary`

**Authentication:** JWT Required
**Roles:** `ORGANIZATIONOWNER`, `ADMIN`

**Path Params:** `classId` (UUID), `evaluationId` (UUID)

**Success (200):**

```json
{
  "success": true,
  "data": {
    "classId": "uuid",
    "className": "string",
    "evaluationId": "uuid",
    "evaluationTitle": "string",
    "evaluationType": "multiple_intelligences",
    "totalChildren": 25,
    "approvedCount": 20,
    "submittedCount": 3,
    "inProgressCount": 1,
    "notStartedCount": 1,
    "highestScore": 85.5,
    "averageScore": 72.3,
    "lowestScore": 45.0,
    "topDimensions": [
      { "code": "linguistic", "name": "string", "score": 10, "percentage": 83.3 }
    ],
    "children": [
      {
        "organizationChildId": "uuid",
        "childName": "string",
        "className": "string",
        "status": "approved",
        "statusLabel": "Approved",
        "attemptId": "uuid",
        "score": 85.5,
        "topResultLabel": "string",
        "topDimensionName": "string",
        "topDimensionPercentage": 83.3
      }
    ]
  }
}
```

---

#### `GET /api/evaluations/owner/classes/:classId/evaluations/:evaluationId/status`

**Authentication:** JWT Required
**Roles:** `ORGANIZATIONOWNER`, `ADMIN`

**Success (200):**

```json
{
  "success": true,
  "data": {
    "classId": "uuid",
    "className": "string",
    "evaluationId": "uuid",
    "evaluationTitle": "string",
    "children": [
      {
        "organizationChildId": "uuid",
        "childName": "string",
        "className": "string",
        "status": "not_started",
        "statusLabel": "Not Started",
        "lastAttemptId": null,
        "canSendReminder": true
      }
    ]
  }
}
```

---

#### `POST /api/evaluations/owner/children/:childId/reminder`

**Authentication:** JWT Required
**Roles:** `ORGANIZATIONOWNER`, `ADMIN`

**Path Params:** `childId` (UUID)

**Success (200):**

```json
{ "success": true, "data": { "message": "Reminder sent successfully" } }
```

---

### Admin Private Attempts

---

#### `POST /api/admin/attempts/:id/approve`

**Authentication:** JWT Required
**Roles:** `ADMIN`

**Path Params:** `id` (UUID — slot ID)

**Success (200):**

```json
{
  "success": true,
  "data": {
    "attempt": { /* EvaluationSlot */ },
    "payment": {
      "id": "uuid",
      "checkoutUrl": "https://...",
      "expiresAt": "2026-07-15T00:00:00Z",
      "status": "pending"
    }
  }
}
```

---

### Deals

---

#### `POST /api/deals`

**Authentication:** JWT Required
**Roles:** `ORGANIZATIONOWNER`, `TEACHER`

**Request Body:**

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `activityId` | `string` | yes | `@IsUUID()` |
| `studentsCount` | `number` | yes | `@IsInt()`, `@Min(1)` |
| `deadline` | `string` | yes | `@IsDateString()`, must be future date |

**Success (200):** `Deal` entity.

---

#### `GET /api/deals`

**Authentication:** JWT Required
**Roles:** `ORGANIZATIONOWNER`, `TEACHER`, `ENRICHER`

**Query Params:** `status` (string — `OPEN`, `AWARDED`, `CLOSED`) — optional

**Success (200):** `Deal[]`

---

#### `GET /api/deals/:dealId`

**Authentication:** JWT Required
**Roles:** `ORGANIZATIONOWNER`, `TEACHER`, `ENRICHER`

**Success (200):** `Deal` with organization, activity, creator relations.

---

#### `GET /api/deals/:dealId/proposals`

**Authentication:** JWT Required
**Roles:** `ORGANIZATIONOWNER`

**Success (200):** `Proposal[]` with provider relation.

---

#### `POST /api/deals/:dealId/proposals`

**Authentication:** JWT Required
**Roles:** `ENRICHER`

**Request Body:**

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `price` | `number` | yes | `@IsNumber({ maxDecimalPlaces: 2 })`, `@IsPositive()` |

**Success (200):** `Proposal` entity.

**Errors:**

| Status | Code | When |
|--------|------|------|
| 409 | `DEAL.DUPLICATE_PROPOSAL` | Already submitted |
| 404 | `DEAL.NOT_FOUND` | Deal not found |

---

#### `POST /api/deals/:dealId/proposals/:proposalId/select`

**Authentication:** JWT Required
**Roles:** `ORGANIZATIONOWNER`

**Success (200):** `Proposal` entity.

---

#### `POST /api/deals/:dealId/proposals/:proposalId/approve`

**Authentication:** JWT Required
**Roles:** `ADMIN`

**Success (200):** `Proposal` entity.

---

### Proposals

---

#### `PATCH /api/proposals/:id`

**Authentication:** JWT Required
**Roles:** `ENRICHER`

**Path Params:** `id` (UUID)

**Request Body:**

| Field | Type | Required |
|-------|------|----------|
| `price` | `number` | yes |

**Success (200):** `Proposal` entity.

**Errors:**

| Status | Code | When |
|--------|------|------|
| 403 | `AUTH.FORBIDDEN` | Not your proposal |
| 400 | `DEAL.DEADLINE_PASSED` | After deadline |

---

### Activities

---

#### `POST /api/activities`

**Authentication:** JWT Required
**Roles:** `ADMIN`

**Request Body:**

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `name` | `string` | yes | `@Length(2, 255)` |

**Success (200):** `Activity` entity.

---

#### `GET /api/activities`

**Authentication:** JWT Required
**Roles:** `ADMIN`, `ORGANIZATIONOWNER`, `TEACHER`, `ENRICHER`

**Success (200):** `Activity[]` (ordered by createdAt DESC).

---

#### `GET /api/activities/with-deals`

**Authentication:** JWT Required
**Roles:** `ADMIN`, `ORGANIZATIONOWNER`, `TEACHER`, `ENRICHER`

**Success (200):** `Activity[]` with deals, deals.organization, deals.creator.

---

#### `GET /api/activities/:id`

**Authentication:** JWT Required
**Roles:** `ADMIN`, `ORGANIZATIONOWNER`, `TEACHER`, `ENRICHER`

**Success (200):** `Activity` entity.

---

#### `GET /api/activities/:id/with-deals`

**Authentication:** JWT Required
**Roles:** `ADMIN`, `ORGANIZATIONOWNER`, `TEACHER`, `ENRICHER`

**Success (200):** `Activity` with deals relations.

---

#### `PATCH /api/activities/:id`

**Authentication:** JWT Required
**Roles:** `ADMIN`

**Request Body:**

| Field | Type | Required |
|-------|------|----------|
| `name` | `string` | no |

**Success (200):** `Activity` entity.

---

#### `DELETE /api/activities/:id`

**Authentication:** JWT Required
**Roles:** `ADMIN`

**Success (200):**

```json
{ "success": true, "data": { "message": "Activity deleted successfully", "activityId": "uuid" } }
```

**Errors:**

| Status | Code | When |
|--------|------|------|
| 400 | `ACTIVITY.HAS_DEALS` | Activity has related deals |

---

### Payments

---

#### `POST /api/payments`

**Authentication:** JWT Required
**Roles:** `PARENT`

**Request Body:**

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `amount` | `number` | yes | `@IsNumber({ maxDecimalPlaces: 2 })`, `@Min(0.01)` |
| `currency` | `"SAR"` | no | `@IsIn(['SAR'])` default `"SAR"` |
| `privateChildId` | `string` | yes | `@IsUUID()` |
| `attemptRequestId` | `string` | no | `@IsUUID()` |
| `privateAttemptId` | `string` | no | `@IsUUID()` |
| `description` | `string` | no | `@MaxLength(500)` |
| `provider` | `PaymentProviderEnum` | no | `@IsEnum(PaymentProviderEnum)` |

**Success (200):**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "checkoutUrl": "https://checkout.moyasar.com/...",
    "expiresAt": "2026-07-15T00:00:00Z",
    "status": "pending"
  }
}
```

**Errors:**

| Status | Code | When |
|--------|------|------|
| 400 | `PAYMENT.INVALID_PROVIDER` | Provider not active |
| 400 | `PAYMENT.CURRENCY_NOT_SUPPORTED` | Not SAR |
| 404 | `CHILD.NOT_FOUND` | Child not found for this parent |

---

#### `POST /api/payments/webhook`

**Authentication:** Public (Moyasar server calls this)
**Headers:** `x-moyasar-signature` (optional)

**Request Body:** Raw JSON body from Moyasar.

**Success (200):**

```json
{ "accepted": true }
// or
{ "accepted": true, "deduplicated": true }
```

**Note:** This endpoint does NOT use the standard success envelope (raw body is required).

**Errors:**

| Status | Code | When |
|--------|------|------|
| 401 | `PAYMENT.WEBHOOK_INVALID` | Invalid signature |
| 400 | `PAYMENT.INVALID_JSON` | Malformed body |
| 400 | `PAYMENT.WEBHOOK_MISSING` | Missing payment ID |

---

#### `POST /api/payments/:attemptId/initiate`

**Authentication:** JWT Required
**Roles:** `PARENT`

**Path Params:** `attemptId` (UUID)

**Success (200):**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "checkoutUrl": "https://...",
    "expiresAt": "2026-07-15T00:00:00Z",
    "status": "pending"
  }
}
```

---

#### `POST /api/payments/:id/retry`

**Authentication:** JWT Required
**Roles:** `PARENT`

**Path Params:** `id` (UUID — paymentId)

**Request Body:** `{ "note"?: string }` (optional)

**Success (200):** Same checkout shape as create.

**Errors:**

| Status | Code | When |
|--------|------|------|
| 400 | `PAYMENT.FAILED` | Not retryable |
| 400 | `PAYMENT.MAX_RETRIES` | Limit reached |
| 403 | `AUTH.FORBIDDEN` | Not your payment |

---

### Notifications

---

#### `POST /api/notifications/verify-email`

**Authentication:** JWT Required

**Request Body:**

| Field | Type | Required |
|-------|------|----------|
| `email` | `string` | yes |
| `userId` | `string` | yes |

**Success (200):**

```json
{ "success": true, "data": { "success": true, "message": "Verification email queued successfully" } }
```

---

#### `GET /api/notifications`

**Authentication:** JWT Required

**Query Params:** `page`, `limit`, `unreadOnly`, `type` (see Pagination Contract)

**Success (200):**

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "userId": "uuid",
      "title": "string",
      "message": "string",
      "type": "general",
      "metadata": { ... },
      "isRead": false,
      "createdAt": "2026-07-08T00:00:00Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "totalPages": 3,
    "hasNextPage": true,
    "hasPreviousPage": false
  }
}
```

---

#### `GET /api/notifications/unread-count`

**Authentication:** JWT Required

**Success (200):**

```json
{ "success": true, "data": { "count": 5 } }
```

---

#### `PATCH /api/notifications/read-all`

**Authentication:** JWT Required

**Success (200):**

```json
{ "success": true, "data": { "updated": 5 } }
```

---

#### `PATCH /api/notifications/:id/read`

**Authentication:** JWT Required

**Path Params:** `id` (UUID)

**Success (200):**

```json
{ "success": true, "data": null }
```

**Errors:**

| Status | Code | When |
|--------|------|------|
| 404 | `NOTIFICATION.NOT_FOUND` | Not found |

---

#### `POST /api/notifications/dispatch`

**Authentication:** JWT Required
**Roles:** `ADMIN`

**Request Body:**

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `delivery` | `NotificationDelivery` | yes | `@IsEnum(NotificationDelivery)` |
| `userId` | `string` | yes | `@IsUUID()` |
| `email` | `string` | no | `@IsEmail()` |
| `title` | `string` | yes | `@MaxLength(500)` |
| `message` | `string` | yes | `@MaxLength(10000)` |
| `type` | `string` | no | `@MaxLength(50)` |
| `metadata` | `object` | no | |

**Success (200):**

```json
{ "success": true, "data": { "jobId": "123" } }
```

---

### Capacity Requests

---

#### `POST /api/capacity-requests`

**Authentication:** JWT Required
**Roles:** `PARENT`

**Request Body:**

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `requestedCapacity` | `number` | yes | `@IsInt()`, `@Min(1)` |
| `notes` | `string` | no | `@IsString()`, `@IsOptional()` |

**Success (200):** `CapacityRequest` entity.

---

#### `GET /api/capacity-requests`

**Authentication:** JWT Required

**Success (200):** `CapacityRequest[]` (admin sees all, parent sees own).

---

#### `GET /api/capacity-requests/:id`

**Authentication:** JWT Required

**Success (200):** `CapacityRequest` with parent relation.

---

#### `PATCH /api/capacity-requests/:id`

**Authentication:** JWT Required
**Roles:** `ADMIN`

**Request Body:**

| Field | Type | Required |
|-------|------|----------|
| `status` | `CapacityRequestStatus` | no |
| `notes` | `string` | no |
| `paymentId` | `string` (UUID) | no |

**Success (200):** `CapacityRequest` entity.

---

#### `POST /api/capacity-requests/:id/approve`

**Authentication:** JWT Required
**Roles:** `ADMIN`

**Success (200):** `CapacityRequest` entity.

---

#### `POST /api/capacity-requests/:id/reject`

**Authentication:** JWT Required
**Roles:** `ADMIN`

**Success (200):** `CapacityRequest` entity.

---

### Sessions

---

#### `POST /api/session`

**Authentication:** JWT Required

**Request Body:**

| Field | Type | Required |
|-------|------|----------|
| `userId` | `string` | yes |
| `refreshToken` | `string` | yes |
| `device` | `string` | no |
| `ip` | `string` | no |

**Success (200):** `Session` entity.

---

#### `GET /api/session`

**Authentication:** JWT Required

**Success (200):** Returns string `"This action returns all session"` (placeholder).

---

#### `GET /api/session/:id`

**Authentication:** JWT Required

**Path Params:** `id` (UUID)

**Success (200):** `Session` entity or `null`.

---

## 8. Frontend Checklist

### Required Translation Keys

**Error keys (backend may return any of these):**

| Category | Keys |
|----------|------|
| Auth (8) | `errors.auth.unauthorized`, `errors.auth.invalidCredentials`, `errors.auth.forbidden`, `errors.auth.refreshTokenMissing`, `errors.auth.sessionCompromised`, `errors.auth.tokenInvalid`, `errors.auth.tokenExpired`, `errors.auth.logoutFailed` |
| User (4) | `errors.user.notFound`, `errors.user.alreadyExists`, `errors.user.emailInUse`, `errors.user.phoneInUse` |
| Organization (5) | `errors.organization.notFound`, `errors.organization.alreadyExists`, `errors.organization.notApproved`, `errors.organization.alreadyApproved`, `errors.organization.alreadyRejected` |
| Child (6) | `errors.child.notFound`, `errors.child.limitReached`, `errors.child.accessDenied`, `errors.child.alreadyAssigned`, `errors.child.invalidType`, `errors.child.duplicate` |
| Teacher (2) | `errors.teacher.notFound`, `errors.teacher.alreadyExists` |
| Grade (2) | `errors.grade.notFound`, `errors.grade.alreadyExists` |
| Class (3) | `errors.class.notFound`, `errors.class.alreadyExists`, `errors.class.full` |
| Evaluation (13) | `errors.evaluation.notFound`, `errors.evaluation.attemptNotFound`, `errors.evaluation.attemptLocked`, `errors.evaluation.maxAttemptsReached`, `errors.evaluation.dimensionMissing`, `errors.evaluation.duplicateDimensions`, `errors.evaluation.duplicateAnswers`, `errors.evaluation.invalidTransition`, `errors.evaluation.slotNotFound`, `errors.evaluation.invalidQuestion`, `errors.evaluation.invalidAnswer`, `errors.evaluation.notSuitableAge`, `errors.evaluation.notAvailable` |
| Payment (10) | `errors.payment.notFound`, `errors.payment.failed`, `errors.payment.expired`, `errors.payment.maxRetries`, `errors.payment.invalidProvider`, `errors.payment.currencyNotSupported`, `errors.payment.webhookInvalid`, `errors.payment.webhookMissing`, `errors.payment.providerUnavailable`, `errors.payment.invalidJson` |
| Deal (7) | `errors.deal.notFound`, `errors.deal.closed`, `errors.deal.deadlinePassed`, `errors.deal.duplicateProposal`, `errors.deal.cannotCreate`, `errors.deal.proposalNotFound`, `errors.deal.proposalInvalidState` |
| Activity (2) | `errors.activity.notFound`, `errors.activity.hasDeals` |
| Transfer (3) | `errors.transfer.notFound`, `errors.transfer.alreadyResolved`, `errors.transfer.invalidChildType` |
| Notification (2) | `errors.notification.notFound`, `errors.notification.emailRequired` |
| Capacity (2) | `errors.capacity.notFound`, `errors.capacity.accessDenied` |
| Database (5) | `errors.database.duplicateKey`, `errors.database.foreignKeyViolation`, `errors.database.notNullViolation`, `errors.database.checkViolation`, `errors.database.genericError` |
| Common (2) | `errors.common.tooManyRequests`, `errors.common.internalServerError` |

**Validation keys (backend may return any of these):**

| Key | Context |
|-----|---------|
| `validation.required` | — |
| `validation.isEmail` | — |
| `validation.isString` | — |
| `validation.isNumber` | — |
| `validation.isBoolean` | — |
| `validation.isDate` | — |
| `validation.invalidEnum` | `{ values: [...] }` |
| `validation.invalidUuid` | — |
| `validation.invalidPhone` | — |
| `validation.invalidBirthDate` | — |
| `validation.minLength` | `{ min: 8 }` |
| `validation.maxLength` | `{ max: 100 }` |
| `validation.min` | `{ min: 1 }` |
| `validation.max` | `{ max: 100 }` |
| `validation.pattern` | `{ pattern: "..." }` |
| `validation.arrayMinSize` | `{ min: 1 }` |
| `validation.arrayMaxSize` | `{ max: 500 }` |
| `validation.invalid` | — |

**Total: ~90 error keys + ~18 validation keys = ~108 translation keys needed.**

### Integration Rules

1. **Error handling:** Always check `error.code` for branching logic. Never compare `error.message` strings.
2. **Translation:** Pass `error.message` to `t()`. For field errors, pass `fieldErrors[].message` to `t()`.
3. **Interpolation:** Use `fieldErrors[].context` for dynamic values (e.g., `t('validation.minLength', fieldError.context)`).
4. **Login response:** Tokens are at `data.accessToken` and `data.refreshToken` (inside `data`).
5. **Pagination:** List endpoints return `{ data, meta: { page, limit, total, totalPages, hasNextPage, hasPreviousPage } }`. Supported on: children, parent/children, parent/org-children, attempts, notifications.
6. **401 handling:** On 401, try refresh. On refresh failure, redirect to login.
7. **Request ID:** Always present in response. Useful for debugging — show to user or log.
8. **Webhook:** `POST /payments/webhook` returns raw `{ accepted: true }` — do NOT expect standard envelope.

### Audited Summary

| Metric | Count |
|--------|-------|
| Controllers audited | 23 |
| Endpoints documented | 106 |
| ApiErrorCodes documented | 85 |
| Validation rules documented | 18 |
| Enums documented | 15 |
| Entities documented | 20+ |
