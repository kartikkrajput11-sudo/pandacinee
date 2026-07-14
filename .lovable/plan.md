## Punishment Lock — Playful chat lock between partners

A fun, consent-based feature where one partner can temporarily lock the other's chat input until a chosen playful challenge is completed. Both partners can read history; only the "locked" partner's composer is disabled with a full-screen overlay showing the challenge and live progress.

---

### 1. Data model (new table)

`punishment_locks` — one active row per (locker → target) pair.

Columns:
- `locker_id` (uuid, creator)
- `target_id` (uuid, the one who must complete it)
- `type` — enum: `write` | `compliment` | `funny` | `draw` | `photo` | `voice` | `quiz`
- `prompt` (text) — e.g. `Sorry ❤️`
- `required_count` (int) — e.g. 20
- `progress` (int, default 0)
- `status` — `active` | `completed` | `cancelled` | `expired`
- `max_duration_seconds` (int, nullable) — 300 / 1800 / 3600 / null
- `expires_at` (timestamptz, nullable)
- `completed_at`, `created_at`, `updated_at`

RLS: both partners can `SELECT` rows involving them. Only `locker_id` can `INSERT` / `cancel`. Only `target_id` can update `progress` / mark `completed`.

Also add opt-out to `profiles`: `punishment_lock_enabled boolean default true`.

---

### 2. Hook — `usePunishmentLock(meId, peerId)`

- Subscribes via Supabase realtime to active lock rows for the pair.
- Returns `{ activeLock, iAmLocked, iAmLocker, createLock, updateProgress, completeLock, cancelLock }`.
- Auto-expires locks whose `expires_at` has passed (client tick every 5s, mirrors vanish reaper).

---

### 3. Chat menu entry (locker side)

In `ChatBubble` action panel / header dropdown of `app.chat.$peerId.tsx`, add **"Lock Chat as Punishment"** (only visible in 1:1 partner chats, not groups, and only when `punishment_lock_enabled` for both).

Opens a new `PunishmentLockDialog`:
- Step 1: pick a **type** (7 cards with icon + description).
- Step 2: pick preset prompt or type custom + choose `required_count` (for write / compliment / funny / quiz) OR just prompt (for photo / voice / draw).
- Step 3: pick **max duration** (5 min / 30 min / 1 hr / Until completed).
- Basic safety filter on custom prompt (list of blocked words → toast "Keep it playful ❤️").
- Confirm → inserts row.

---

### 4. Full-screen overlay (target side)

New component `PunishmentLockOverlay.tsx`, rendered inside `app.chat.$peerId.tsx` when `iAmLocked`.

Contents:
- 🔒 Lock icon (animated pulse)
- Type label + prompt
- Progress bar `progress / required_count`
- Task-specific input area:
  - **write / compliment / funny**: textarea; on each submit, compares trimmed lowercase to expected prompt (fuzzy for compliment/funny — just non-empty distinct entries ≥ min length 5). Increments `progress`.
  - **quiz**: pulls 5 questions from `generateLoveQuiz`; each correct answer = +1.
  - **draw**: "Open Paint" button → routes to `/app/paint` with `?punish=<lockId>`; on save from paint page, marks complete.
  - **photo**: opens `ChatComposer`'s image upload flow directly → on successful media send, marks complete.
  - **voice**: uses existing `VoiceRecorder`; on send, marks complete.
- Bottom row: countdown timer if `expires_at`, "Give up" only if `max_duration` set (marks `cancelled` after expiry).

Locker-side view: smaller banner at top of chat showing live progress + a "Cancel punishment" button.

---

### 5. Composer lock

In `ChatComposer`, accept new `locked?: { reason: string }` prop. When set:
- Textarea disabled, placeholder = "🔒 Chat locked — complete your punishment".
- Send / attach / voice / sticker buttons disabled.
- Wired from `app.chat.$peerId.tsx` when `iAmLocked`.

---

### 6. Completion flow

When `progress >= required_count` (or single-shot type completes):
- Client sets `status='completed'`, `completed_at=now()`.
- Overlay swaps to confetti + "Punishment completed! 🎉" (reuse existing `KissOverlay` style + a lightweight confetti burst using CSS `@keyframes`).
- Realtime → both sides get toast: `Chat unlocked successfully.`
- Overlay auto-dismisses after 2.5s; composer re-enables.

Auto-cleanup: after 30s post-completion, delete row so it doesn't clutter.

---

### 7. Settings toggle

In `app.me.tsx` (profile/settings), add a "Punishment Lock" switch bound to `profiles.punishment_lock_enabled`. When either partner disables it, the "Lock Chat as Punishment" menu item is hidden for both.

---

### 8. Safety

- Blocked-words list in `src/lib/punishment.ts` (mild filter, extensible).
- Duration hard-capped at 1 hour.
- Target can `cancelLock` if they've been locked > 1 hour with no `expires_at` (safety escape hatch).
- Feature disabled entirely for non-partner chats and group chats.

---

### Files touched / created

**New**
- `supabase/migrations/*_punishment_locks.sql`
- `src/hooks/usePunishmentLock.ts`
- `src/lib/punishment.ts` (presets, blocked words, helpers)
- `src/components/chat/PunishmentLockDialog.tsx`
- `src/components/chat/PunishmentLockOverlay.tsx`
- `src/components/chat/PunishmentLockBanner.tsx` (locker's view)

**Edited**
- `src/routes/_authenticated/app.chat.$peerId.tsx` — mount overlay/banner, pass `locked` to composer, add menu item.
- `src/components/chat/ChatComposer.tsx` — accept `locked` prop.
- `src/routes/_authenticated/app.me.tsx` — settings toggle.
- `src/routes/_authenticated/app.paint.tsx` — on save, if `?punish=<id>` complete lock.

Feature is partner-only (1:1) and skipped for groups.

### Technical notes

- Realtime uses `postgres_changes` on `punishment_locks` filtered by `or(locker_id.eq.<me>,target_id.eq.<me>)` (Supabase requires two channels or a broader filter — I'll use one channel per pair with `id=eq.<lockId>` for updates plus initial fetch).
- Progress increment uses optimistic UI + `.update({ progress: current+1 }).eq('id', lockId).eq('progress', current)` for a light race guard.
- Confetti implemented in CSS to avoid new deps.
