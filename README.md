# Creative Current Control

Multi-business social-content workspace with a React/TanStack frontend, Express API, and PostgreSQL. It stores business profiles, posts, approvals, users, media, credentials, scheduler runs, and provider analytics.

## App capabilities

- PostgreSQL-backed businesses, brand profiles, posts, approval history, users, media, and analytics.
- Role-based sign-in and business access. Administrators can create team records, assign roles, set or rotate user passwords, and disable sign-in. The app does not send invitation emails.
- HttpOnly idle-expiring sessions, email/password sign-in, login throttling, and a server-side security audit log.
- Per-business AI settings, editable prompts, optional internet research, content planning/drafting, image generation, website analysis, and video transcription.
- Monthly AI planning when explicitly enabled in each business profile. Each run is idempotent, timezone-aware, recorded in `automation_runs`, and creates review items or scheduled posts according to the approval setting. It may incur OpenAI charges.
- Brand template rendering in the media library: apply uploaded background image, logo, font, business colour, headline, and supporting text to a JPEG.
- Video tools: transcript/caption suggestions, SRT/VTT download, clip rendering, and thumbnail extraction. FFmpeg must be available in the API container.
- Facebook Page publishing for text, images, and videos; Instagram professional-account publishing for feed images and Reels; LinkedIn member or organization publishing for text, images, and videos. A due-post worker publishes approved/scheduled records and records provider post IDs, results, and failures.
- Provider metrics can be refreshed from connected accounts. A metric appears only when the provider returns it and the token has the needed read permission.
- OpenAI, Meta, and LinkedIn secrets are configured or replaced in the app. They are encrypted in PostgreSQL with AES-256-GCM and never returned to the frontend. Set a persistent `CREDENTIAL_ENCRYPTION_KEY` before saving credentials.

## Provider account setup

### Meta: Facebook and Instagram

In **Integrations**, enter the Facebook Page ID or Instagram professional-account ID and Page access token, save, then use **Validate**. The token must have the publishing/read permissions required by the requested actions. Instagram publishing requires an eligible professional account and public media URLs; image publishing needs JPEG conversion where needed. Facebook/Instagram API access and app review must be completed by the account owner.

### LinkedIn

In **Integrations**, save the LinkedIn client ID and client secret, optional organization URN, and OAuth permissions; then select **Connect LinkedIn** and authorize as the LinkedIn member. Register the exact callback URI shown by `LINKEDIN_REDIRECT_URI` in the LinkedIn Developer app. Posting for an organization requires the member's company-page role and the organization's approved posting permission. Analytics need separate read permissions. Tokens are encrypted and refreshed automatically only when LinkedIn issues a refresh token to the app; otherwise reconnect when prompted.

### OpenAI

An administrator can add or replace the OpenAI key and model in **Integrations**. AI calls are user-triggered except the separately opted-in monthly planner. Calls may incur usage charges.

## Run locally in VS Code

1. Extract the archive and open the project folder in VS Code.
2. Copy `env.production.example` to `.env`. Replace placeholders with unique values. For local development, set `PUBLIC_APP_URL=http://localhost:3000`, `PUBLIC_API_URL=http://localhost:3001`, `CORS_ORIGIN=http://localhost:3000`, and a localhost LinkedIn callback. Keep `.env` out of Git. PostgreSQL has separate migration-owner and restricted runtime accounts; the API grants the runtime role during startup migrations.
3. Start PostgreSQL and the API:

   ```powershell
   docker compose up -d --build db api
   ```

4. In a second terminal install and start the frontend:

   ```powershell
   npm install
   Set-Content .env.local 'VITE_API_BASE=http://localhost:3001'
   npm run dev -- --port 3000
   ```

5. Open `http://localhost:3000/login` and sign in with the initial administrator from `.env`.
6. Create the first business under **Businesses**, then add Facebook, Instagram, or LinkedIn account records in **Integrations** and enter the provider credentials there. OpenAI credentials are also configured from **Integrations**.
7. Configure account-provider permissions and callback URLs with the client platform account owners before connecting.
8. For local LinkedIn OAuth, set `PUBLIC_APP_URL`, `PUBLIC_API_URL`, and `LINKEDIN_REDIRECT_URI` to the local addresses and register the same callback in the LinkedIn app.

The initial administrator is created once. Sign in with the configured email and password. Changing `ADMIN_PASSWORD` later does not rotate an existing administrator password; sign in and use **Change password** in the profile menu. Provider API keys and social account credentials can be added, replaced, or removed by an administrator in **Integrations**. The server-only encryption key remains in `.env` and must be backed up securely.

## Deploy the app

Copy the project to the server, configure a private `.env` with production database and encryption secrets plus the public API/app origins and provider settings, then run:

```bash
docker compose up -d --build
```

The compose file keeps PostgreSQL on the private Docker network and binds web/API ports to localhost. Configure the existing reverse proxy to route the app hostname to the web/API containers; leave other sites on the server alone. Keep `/uploads/` reachable from Meta so Instagram can fetch media. Set the callback URI to the exact URL registered in the LinkedIn Developer app.

## Database

`server/schema.sql` creates and migrates: `businesses`, `users`, `posts`, `approvals`, `social_accounts`, `media_assets`, `research_sources`, `website_snapshots`, `generated_assets`, `app_settings`, `oauth_states`, `automation_runs`, `post_metrics`, and `account_metrics`.

## External requirements

The app code cannot grant itself platform permissions or complete platform app reviews. Real publishing and analytics require account-owner credentials, authorized Page/member access, the correct scopes, and a successful test against the client's actual accounts. Provider API versions and permissions can change; update the configured API versions when providers deprecate them.
