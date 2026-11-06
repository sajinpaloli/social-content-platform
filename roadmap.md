# Completion status

## Implemented in the application

- PostgreSQL persistence for business profiles, users, posts, approvals, social accounts, media, research records, provider settings, OAuth state, monthly automation runs, and cached analytics.
- Role-based authentication, access control, administrator-managed users, password setup/rotation, and self-service password change.
- Business profile research toggle and editable generation prompt; AI draft, image, website-analysis, and video-analysis workflows.
- Optional monthly AI planning with explicit per-business opt-in, timezone-aware slots, run records, and idempotent post IDs. Approval-required profiles create review items; fully automatic profiles create scheduled posts. Instagram slots generate JPEG images.
- Brand image composition with uploaded logo/font assets, palette, headline, and supporting copy.
- Video caption/transcript generation, SRT/VTT export, thumbnail generation, and clip rendering.
- Meta Page/Instagram credential validation, LinkedIn member OAuth, encrypted account secrets, image/video/text publication handlers, scheduled-post worker, publish status/error history, and manual publish action for approved posts.
- On-demand analytics refresh and cached reporting based on provider responses.

## Requires client or provider setup before live use

- OpenAI key and model configured in Integrations.
- Meta Page or professional-account IDs and access tokens with the required permissions; Page/Instagram linkage and any required Meta review.
- LinkedIn client ID/secret, exact registered OAuth callback, member authorization, organization URN where posting to a company Page, company-page role, and the provider-approved read/write scopes.
- Publicly reachable media URLs for Instagram and client account checks. LinkedIn tokens may need reauthorization if refresh tokens are not issued.
- A working PostgreSQL database and persistent `CREDENTIAL_ENCRYPTION_KEY` on the host.

## Not included

- Email invitation delivery. Administrators can create a user and set a temporary password in the app, then share that password securely outside the app.
- Automated verification against the client's real social accounts. These credentials and provider permissions are not present in this development workspace.
