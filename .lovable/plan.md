# Watch Party (Cineby-style) on Movies

Add a shareable **watch-party room** on top of the current movie/episode player so multiple friends (not just the paired partner) can watch the same title together, in sync, with a live chat sidebar.

## What the user gets

On any movie or episode page:

1. A new **"Watch Party"** button next to the existing controls.
2. Clicking it creates a room and gives a **6-character invite code** + shareable link.
3. Friends open the link (or paste the code on `/app/watch-party`) and land in the same player.
4. Everyone sees the **same source, same title, same episode**, synced play/pause/seek from whoever is host.
5. A collapsible **chat panel** on the side (text only) so people can react while watching.
6. A small **"● 3 watching"** presence pill showing who's in the room.

Anyone can leave anytime; when the host leaves, the next person becomes host automatically. Rooms auto-expire after 6h of inactivity.

## Scope

- Works for **movies** and **TV episodes** (uses existing `/app/movies/$id/watch` and `/app/movies/$id/episode/$s/$e`).
- Sync sends `play / pause / seek / source change / episode change` events. Third-party iframes (vidking.net) can't be script-controlled, so for those sources sync is **soft** — everyone's iframe reloads to the same episode/source, and the host's play/pause/seek is broadcast as a "resync" nudge (host's timestamp shown; one-tap "Catch up" button). For Pandacine self-hosted sources, sync is **tight** (auto seek + play/pause).
- Chat is room-scoped, ephemeral (cleared when room expires). No media in chat — just text + emoji.
- No changes to auth, movies catalog, or the existing partner-only sync on `/app/watch`.

## Technical details

### Backend (Lovable Cloud migration)

New tables:

- `watch_parties` — `id uuid pk`, `code text unique` (6 chars), `host_id uuid`, `media_kind text` ('movie'|'tv'), `media_id text` (TMDB id or custom id), `season int null`, `episode int null`, `source_idx int`, `position_seconds float`, `is_playing bool`, `last_actor_id uuid`, `last_event text`, `updated_at timestamptz`, `created_at timestamptz`.
- `watch_party_members` — `party_id uuid`, `user_id uuid`, `joined_at`, `last_seen_at`, PK `(party_id, user_id)`.
- `watch_party_messages` — `id`, `party_id`, `sender_id`, `body text`, `created_at`. Realtime enabled.

RLS: only members can SELECT/INSERT rows for a given party; joining by code goes through a `SECURITY DEFINER` RPC `join_watch_party(_code text)` that inserts the caller into `watch_party_members` and returns the party row. GRANTs to `authenticated` + `service_role`. Realtime enabled on all three tables.

### Frontend

- `src/routes/_authenticated/app.watch-party.$code.tsx` — the room page (player + chat + presence).
- `src/routes/_authenticated/app.watch-party.index.tsx` — join-by-code screen.
- **Player reuse**: extract the iframe/player block from `app.movies.$id.watch.tsx` into a small `MoviePlayer` component so the watch-party route can reuse it with `mode="party"`.
- **Sync hook** `useWatchPartySync(partyId)`: postgres_changes subscription on `watch_parties` + `watch_party_members`; debounced host publisher (200ms) for play/pause/seek; follower reconciler with a 1.5s drift threshold (same pattern as the existing partner sync).
- **Chat panel**: right-side drawer on desktop, bottom sheet on mobile; realtime insert subscription on `watch_party_messages`.
- **Entry points**: add a "Watch Party" button to the existing watch page header — opens a small modal to "Start party" (creates room, copies invite link) or "Join with code".

### Non-goals

- No voice/video chat inside the party (calls stay on the existing call routes).
- No download / offline.
- No moderation UI beyond the host being able to kick a member (v2).

```text
┌─────────────────────────────┬──────────────┐
│                             │  ● 3 watching │
│         Player              │──────────────│
│  (iframe or <video>)        │  Chat        │
│                             │  ...         │
│  ▶ ⏸ ⏱ 00:24:11             │  [type...]   │
└─────────────────────────────┴──────────────┘
```
