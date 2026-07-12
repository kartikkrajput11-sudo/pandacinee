
# Refinement Pass 1 — Admin, Custom Movies, Theme, Settings, Auth, Partner

Scope is limited to the items you selected. Existing purple branding, routing, and identity stay untouched.

## 1. Admin panel (PIN 1804)

- New route `/app/admin` gated by a PIN entry screen. Correct PIN unlocks a session flag (sessionStorage), wrong PIN shakes and logs an attempt.
- Admin home: two sections — **Custom Movies** (add / edit / delete) and **Stats** (light: counts of users, pairs, messages via existing tables).
- "Add movie" form: title, year, poster URL (or upload to `movie-posters` bucket), backdrop, overview, runtime, genre tags, and **video source** — either an mp4/HLS URL or an uploaded file to a new `custom-movies` storage bucket.
- Admin identity is client-only via PIN; DB writes still go through the authenticated user. RLS restricts inserts to users flagged `is_admin` in `profiles` (new nullable boolean column, defaults false). PIN alone doesn't grant DB access — we flip `is_admin=true` for the first user who enters the correct PIN (self-serve owner bootstrap) so the security surface stays tight.

**DB migration**
- `profiles.is_admin boolean default false`
- New `custom_movies` table: `id, title, year, overview, poster_url, backdrop_url, runtime, genres text[], video_url, video_storage_path, created_by, created_at, updated_at`. GRANTs + RLS: everyone `SELECT`; only `is_admin` can `INSERT/UPDATE/DELETE`.
- New storage bucket `custom-movies` (private), signed URL playback.

## 2. Custom video player (built for sync)

Because iframe embeds can't be scrubbed programmatically, custom-movies get a real `<video>` element instead of the VidKing iframe. This unlocks accurate two-partner sync.

- New `<CustomMoviePlayer>` component using `<video>` with:
  - Frame-accurate seek bar with hover thumbnail (server-generated is out of scope; we show time only).
  - ±10s, prev/next chapter buttons, keyboard shortcuts (space, ←/→, F, M).
  - Playback rate, quality selector (if multiple sources), captions if provided.
  - PIP + fullscreen.
- Reuses existing `useWatchSync` hook — replaces the current iframe-reload trick with real `video.currentTime = t` and `video.play/pause`. Drift under 300ms auto-corrects; larger drift shows the existing "Jump to partner" prompt.
- The watch route detects `custom:{id}` IDs and renders the custom player; TMDB IDs keep VidKing untouched.

## 3. Light / Dark / System theme

- Add `ThemeProvider` reading `localStorage.theme` (`light` | `dark` | `system`) and applying `.light` or `.dark` class on `<html>`.
- Extend `src/styles.css` `@theme` with a light palette (keeping the same petal/velvet purple accents; only surfaces flip). No component color changes needed since everything already uses semantic tokens.
- Theme selector lives in Settings.

## 4. Expanded Settings screen

Rework `app.me.tsx` (or add `/app/settings`) with grouped rows:

- Account: edit display name, username, avatar; change password (email/password users).
- Appearance: theme selector (Light / Dark / System).
- Partner: link to Partner Profile (see §6), Unpair (with 2-step confirm).
- Notifications: master toggle + granular (messages, daily question, streak) stored on `profiles`.
- Privacy: last-seen visibility, read receipts (stored on `profiles`).
- Danger: sign out, delete account (calls a server fn that deletes profile row and user via admin API).
- Admin entry (only if `is_admin=true`).

## 5. Google + Apple login

- Run `configure_social_auth` with `providers: ["google", "apple"]` (email/password stays enabled).
- Update `/auth` route: add "Continue with Google" and "Continue with Apple" buttons using `lovable.auth.signInWithOAuth`. `redirect_uri: window.location.origin`.
- Apple works out of the box via managed credentials; no user setup required.

## 6. Partner profile + unpair

- New route `/app/partner` showing partner's avatar, display name, username, mood, anniversary date (from existing profile fields), days-together count, shared streak, and shared memory count.
- "Unpair" button opens a confirm modal ("This will disconnect you from {name}. Chats stay, but shared features stop.") → server fn sets both profiles' `partner_id = null`, `paired_at = null`.
- Link from Settings and from the home `PartnerPresenceCard`.

## Technical notes

- All new server writes go through `createServerFn` with `requireSupabaseAuth`; no service-role code in the client bundle.
- `custom_movies` RLS uses a `has_admin(uid)` SQL helper (SECURITY DEFINER) to avoid recursive checks.
- Admin PIN check is client-only UX; real authorization is the `is_admin` column enforced by RLS.
- No changes to existing chat, games, or watch-sync hook APIs.

## Out of scope for this pass

Chat overhaul, 1000-emoji picker, real voice notes, AI games, drawing multiplayer, vanish-mode audit. Those come in follow-up passes so each ships polished.

## Files (rough)

- Migration: `is_admin`, `custom_movies`, `has_admin()`, storage bucket + policies.
- New: `src/routes/_authenticated/app.admin.tsx`, `app.admin.movies.tsx`, `app.partner.tsx`, `src/components/CustomMoviePlayer.tsx`, `src/components/ThemeProvider.tsx`, `src/lib/admin.functions.ts`, `src/lib/partner.functions.ts`.
- Edited: `src/routes/_authenticated/app.movies.$id.watch.tsx` (custom-id branch), `app.me.tsx` (settings expansion), `auth.tsx` (social buttons), `styles.css` (light theme vars), `__root.tsx` (ThemeProvider mount).

Approve to proceed.
