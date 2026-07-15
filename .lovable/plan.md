# Rebuild the call system

Goal: reliable 1:1 voice/video, group calls, ring on all your devices, join from any, and a real call history — like Instagram/WhatsApp. Same UI, new backend.

## What breaks today (why the rebuild)

- Signals go to a user, not a device — second device sees "Connecting…" forever after the first accepts.
- No source of truth for a call's state, so both sides can disagree (one is "ringing", the other "ended").
- No history — missed calls just vanish.
- No group call support.
- No TURN — cellular-to-cellular calls silently fail.

## Two decisions I need from you before building

1. **Group call engine.** Group calls need one of:
   - **Mesh WebRTC** (what I'll build by default). Free, no extra service. Works well up to ~4 people voice / ~3 people video. Beyond that, quality degrades because each phone uploads to every other phone.
   - **SFU (LiveKit / Cloudflare Realtime)**. Scales to many participants with clean quality, but adds a paid third-party service and API keys.
   - Ship mesh now, add SFU later if group calls grow. **← I recommend this.**

2. **TURN server (relay for cellular / strict NAT).** Without it, ~20% of calls fail with "no voice". Options:
   - **Metered.ca free tier** (50GB/mo, one signup) — I'll wire it if you paste the credentials.
   - **Cloudflare Realtime TURN** (generous free tier, needs Cloudflare account).
   - **Skip for now**, accept some calls will fail. Not recommended.

Reply with your pick for each and I'll build. Everything below is fixed regardless.

## New backend model

### Tables

```text
calls
  id, kind (voice|video), scope (direct|group),
  initiator_id, peer_id (nullable), group_id (nullable),
  status (ringing|active|ended|missed),
  started_at, answered_at, ended_at,
  ended_reason (hangup|declined|missed|timeout|failed),
  duration_seconds

call_participants
  id, call_id, user_id, device_id,
  state (ringing|joined|declined|left|missed),
  joined_at, left_at

call_signals            -- rewired for per-device routing
  id, call_id,
  from_user, from_device,
  to_user,   to_device,
  kind (offer|answer|ice|bye|mute|track-update),
  payload jsonb, created_at
```

- One row per invited user in `call_participants`. When a user is on 2 devices, both devices ring using the same participant row — accepting on one flips its state to `joined` and broadcasts a "stop ringing" to the other device.
- `device_id` is a per-tab UUID stored in `localStorage`.
- Signals are addressed to a specific device, so the second device never gets stale offers.

### RLS

- `calls`: readable by initiator and any participant; writable by initiator (create) and participants (state transitions via RPC only).
- `call_participants`: readable by anyone in the same call; user can update only their own row.
- `call_signals`: readable only by the addressed device's user; auto-purged after 60s (`purge_stale_signals` cron).

### Server-side RPCs (single source of truth)

- `call_start(kind, scope, peer_or_group)` — creates `calls` row + `call_participants` for each invitee, returns call.
- `call_ring(call_id)` — bumps `last_ring_at`, keeps ringing until answered/timeout.
- `call_answer(call_id, device_id)` — flips my participant to `joined`, sets `calls.answered_at`, `status='active'`.
- `call_decline(call_id)` — my participant → `declined`. If direct call, ends call with `declined`.
- `call_leave(call_id, device_id)` — my participant → `left`. If last active participant, ends call.
- `call_end(call_id, reason)` — initiator or server can end.
- `call_timeout(call_id)` — server-side auto-miss after 45s no answer.

Realtime is enabled on `calls` and `call_participants` so every device stays in sync.

## Client changes

- `useWebRTCCall` becomes a mesh manager: one `RTCPeerConnection` per remote **device** in the call, keyed by `device_id`. Direct call = one peer. Group call = N-1 peers.
- Signaling goes through `call_signals` inserts (per-device addressed), NOT realtime broadcast — so offers survive brief disconnects.
- ICE servers: STUN + TURN (from decision 2).
- Ring-all/join-any: every device subscribes to a personal realtime channel `user:${userId}:calls`. On a new `call_participants` row for you, all your devices ring. First device to call `call_answer` wins its `device_id`; other devices receive the `call_participants` update and stop ringing.
- Multi-device same user in one call: allowed. Each joined device is its own peer. We auto-mute your other devices' incoming audio of yourself (echo prevention) using `device_id` matching.
- Call screen shows real state from `calls.status` + your `call_participants.state`, not local guesses.
- Call history page (`/app/calls`) reads `calls` where you were initiator or participant, newest first, with kind/duration/who/missed badge.

## Migration + cleanup

- New migration creates the tables, indexes, RLS, RPCs, cron job for timeouts + signal purge.
- Old `call_signals` rows are dropped (schema changes shape).
- Existing `useWebRTCCall`, `IncomingCallListener`, and `app.call.$peerId.tsx` are rewritten against the new RPCs; UI is preserved.

## Not in scope (say if you want any of these)

- Screen sharing
- Call recording
- Push notifications when the app is closed (needs FCM/APNs setup)
- End-to-end encryption beyond WebRTC's default DTLS-SRTP

---

**Please reply with:**
1. Group engine → **mesh now / SFU now / mesh now + SFU later**
2. TURN → **Metered.ca (I'll paste creds) / Cloudflare / skip**