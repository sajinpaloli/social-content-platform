<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Application architecture
- The app has a real Express/PostgreSQL API in `server/` and a React/TanStack frontend in `src/`. Keep frontend data access in `src/services/api.ts` and backend persistence in the API; do not reintroduce in-memory mock services for live features.
- Sample records are clearly marked and must not be treated as real client activity. Never imply that sample analytics or disconnected social accounts are live.
- Use the root WorkspaceProvider and Shell for shared navigation and cross-route updates; leaf routes own their unique social metadata.
- Define semantic application colors in the global stylesheet; editable business colors are data and are applied only to brand previews through CSS custom properties.
- Sample dates are computed from `demoToday()`/`relDate()` in the API layer, never hard-coded, so the demo stays current.
- Website analysis, quality checks, AI content drafting, planning, and media analysis/generation should call authenticated server endpoints. Keep integrations that need client credentials disabled until those credentials and redirect URLs are configured.
- Business colours are stored as service-labelled `colorGroups`; `colors` is the flattened copy kept in sync.
- Per-business AI planning settings (research, prompt) are optional Business fields with defaults from the API layer; required content rules are constants outside the editable prompt so edits cannot remove them.
- Any AI image, text, transcription, or analysis call must be triggered by a user action and clearly disclose that it sends content to the configured provider and may incur charges. Do not add background AI jobs without an explicit per-business opt-in and idempotent scheduling.
- Do not store social network passwords. OAuth tokens, when implemented, must be encrypted server-side and must never be returned to the browser.
