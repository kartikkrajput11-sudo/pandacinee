## PANDACINE v2 — Big build

This is a large slice. I'll ship pragmatic, working versions of each feature in one pass, then we can deepen any of them.

### 1. Profile page (upgrade)
- Editable display name + avatar upload (Lovable Cloud storage bucket `avatars`)
- Favorite color, favorite emoji, anniversary date, nickname for partner
- These feed Anniversary Mode personalization later
- Stats card: days together, messages exchanged, movies watched

### 2. Anniversary Mode
- New `app/anniversary` route + accent on Home when within 7 days
- Pulls personalized data: nicknames, favorite color (re-tints UI), favorite emoji rain, top genres, message count, first-paired date
- "Time Capsule" — table `time_capsules` (sender, recipient, content, unlock_at). Compose → locked until date → unlocks with a reveal animation
- Countdown to next anniversary

### 3. Couple Games (playable)
- `game_sessions` table with realtime sync (current prompt, turn, answers)
- **Truth or Dare** — curated deck, shared prompt, "done/skip" buttons
- **This or That** — both pick A/B simultaneously, reveal together, score match %
- **Would You Rather** — same shape
- **Guess Me** — one writes answer, other guesses
- All synced via Supabase realtime; same prompt on both phones

### 4. Friends section
- Friends are separate from "partner" (partner = romantic, 1:1). Friends = social graph
- `friendships` table (user_id, friend_id, status: pending/accepted)
- `/app/friends` — list + search by `@username` + pending requests + accept/decline
- Search uses public `username` index

### 5. Voice / Video calls
- WebRTC peer-to-peer between partner (and accepted friends)
- Supabase realtime channel as signaling (offer/answer/ICE candidates)
- `/app/call/$peerId` route with local + remote video, mute, camera toggle, hangup
- Incoming call toast with accept/decline (subscribes to a `calls` signaling channel globally inside `_authenticated`)
- Free STUN servers (Google); no TURN (works on most networks; symmetric NAT will fail — acceptable for v1)

### Technical sections

**Migrations**
- `profiles`: add `avatar_url` (exists), `favorite_color`, `favorite_emoji`, `anniversary_date`, `partner_nickname`
- `time_capsules` table + RLS (sender or recipient can read; only recipient sees after unlock_at)
- `game_sessions` table + RLS (only the two players)
- `friendships` table + RLS
- Storage bucket `avatars` (public read, auth write own folder)
- All with GRANTs, realtime publication for game_sessions + a `call_signals` table

**Frontend**
- New routes under `src/routes/_authenticated/`: `app.anniversary.tsx`, `app.friends.tsx`, `app.call.$peerId.tsx`, `app.games.$game.tsx`
- Refactor `app.play.tsx` to list real games
- Refactor `app.me.tsx` to editable form
- New `IncomingCallListener` mounted in `_authenticated/route.tsx`
- New hooks: `useGameSession`, `useWebRTCCall`, `useFriends`

### Out of scope for this pass
- Group calls (1:1 only)
- TURN server (paid)
- Push notifications when app closed
- Relationship Wrapped (separate future slice)

Shall I proceed?