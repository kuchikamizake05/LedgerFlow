# LedgerFlow JWT Authentication and RBAC — Phase 1

## Scope

This phase protects the Spring Boot API with stateless JWT bearer authentication and three application roles. The Next.js login UI, refresh tokens, password-reset flow, OAuth, and user-administration screens are intentionally out of scope.

## Goals

- Persist application users with a BCrypt password hash; never store or return a plaintext password.
- Provide registration and login endpoints that return a short-lived JWT access token.
- Require valid bearer authentication for LedgerFlow business endpoints.
- Enforce role-based authorization at the backend boundary.
- Keep the JWT signing secret outside version control and configurable through an environment variable.

## Roles and permissions

| Role | Read accounts, statements, transfers and journal entries | Create account | Create transfer | Treasury deposit |
| --- | --- | --- | --- | --- |
| `AUDITOR` | Yes | No | No | No |
| `OPERATOR` | Yes | No | Yes | No |
| `TREASURY_ADMIN` | Yes | Yes | Yes | Yes |

The public endpoints are limited to `POST /api/auth/register`, `POST /api/auth/login`, and the actuator health endpoint. Registration creates an `AUDITOR` by default so an unauthenticated caller cannot mint a privileged user. A privileged bootstrap user is seeded only from explicit deployment configuration in a later phase; this phase can use a migration with development-only sample users if required for local demonstration.

## Data model

Migration V5 adds `app_users`:

- `id` UUID primary key
- `email` unique, normalized to lowercase
- `password_hash` BCrypt encoded
- `role` one of the three roles above
- `enabled` boolean
- `created_at` timestamp

## API contract

### Register

`POST /api/auth/register`

Accepts email and password. Password validation requires a minimum of 12 characters. A duplicate email returns `409 Conflict`. Success returns the created identity without the password hash and an access token.

### Login

`POST /api/auth/login`

Accepts email and password. Incorrect credentials or a disabled account return the same `401 Unauthorized` response, avoiding account-enumeration detail. Success returns `{ accessToken, tokenType: "Bearer", expiresAt, user }`.

### Protected endpoints

Clients send `Authorization: Bearer <accessToken>`. Missing, malformed, expired, or tampered tokens receive `401 Unauthorized`; an authenticated identity without the required role receives `403 Forbidden`.

## JWT and security design

- HMAC SHA-256 JWT signed using an environment-provided secret of at least 32 bytes.
- Claims: subject is the user UUID; `email`, `role`, `iat`, and `exp` are included.
- Access-token lifetime: 30 minutes.
- Stateless security: no server session and CSRF disabled because browser cookies are not used for authentication.
- CORS only permits the configured frontend origin; no wildcard production origin.
- A request filter validates the bearer token, maps the role to Spring Security authorities, and never exposes the token in logs or API errors.

## Flow

1. User registers or logs in.
2. Backend validates credentials against BCrypt hash and issues a signed JWT.
3. Frontend or API client attaches bearer token to each protected request.
4. JWT filter validates signature and expiry, then creates the authenticated Spring Security context.
5. Authorization rules allow or reject the operation before controller business logic runs.

## Tests

- Registration hashes the password and returns no hash.
- Login succeeds with correct credentials and fails generically with invalid credentials.
- Requests without a token receive `401`.
- Auditor cannot create transfers or treasury deposits (`403`).
- Operator can create transfers but cannot use treasury deposits (`403`).
- Treasury admin can use protected write operations.
- Tampered and expired JWTs return `401`.
- Existing functional API tests are updated to authenticate with the minimum required role.

## Deferred work
- Next.js sign-in UI and secure client-side token handling.
- Refresh-token rotation and revocation.
- Password resets, MFA, OAuth/OIDC, rate limiting, and audit trail of authenticated actors.
