# User and role management

Approved scope: an administrator manages existing registered users, changes roles with a required reason, and cannot demote the last enabled administrator. Registration remains AUDITOR. No password reset, deletion, invitations or deployment in this slice.

GET /api/users accepts page (default 0), size (default 20, maximum 100) and returns PageResponse<UserResponse>. POST /api/users/{id}/role accepts {role, reason}, with the existing three roles and a nonblank reason of at most 255 characters; returns UserResponse. Both endpoints require the current TREASURY_ADMIN role. Responses contain no password hashes.

Verified JWT subject resolves an enabled persisted user on every authenticated request. Current database role and email determine authorities and audit identity. Missing or disabled users are unauthorized. GET /api/auth/me exposes the current user to refresh the browser session; stale JWT role claims never grant access. Backend outages do not justify trusting stale privileges.

Role mutations serialize through a transaction-wide advisory lock, recheck the acting administrator after obtaining it, lock the target, and check the remaining enabled administrator count. Concurrent demotions cannot remove all administrators. Unchanged role is a no-op. Successful changes commit USER_ROLE_CHANGED audit with the actor, target, old/new roles and reason in the same transaction.

The Users page supports pagination, explicit role selection, required reason, confirmation and clear errors. Self-demotion refreshes local access and navigation. Unknown responses trigger a fresh read rather than a fabricated success. Demo mode clearly reports user management unavailable.

Verification: tests before implementation, stale-token promotion/demotion, permissions, validation, last-admin concurrent race, audit, existing API suite, frontend adapter tests, lint/typecheck/build and browser smoke. Docker PostgreSQL 17 is preferred; isolated PostgreSQL 16 fallback is reported separately when required. Coverage percentages are not claimed without measurement.

Next phase: redesign through frontend-workbench, inspect free reference options and licenses, establish one design system, preserve financial and role behavior, then verify desktop/mobile screens and existing flows.
