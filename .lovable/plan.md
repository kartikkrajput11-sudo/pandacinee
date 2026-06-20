Huge scope — splitting into 3 shippable phases so each lands solid instead of half-broken. I'll build Phase 1 in this turn; just say "go" for Phase 2 & 3.

## Phase 1 — Communication & Couple Core (this turn)

**Friend DMs + chat list**
- New `chat_threads` view-style query (last message per peer)
- `/app/chat` becomes a thread list (partner pinned on top, friends below, unread badges, last-message preview, timestamps)
- New `/app/chat/$peerId` route — current chat UI, works with any friend, not just partner
- Reuse existing `useChat` (already peer-agnostic)

**Anniversary countdown**
- Live countdown widget on home + dedicated anniversary page
- Shows days/hours/minutes until next anniversary, plus "X days together" total
- Sweet milestone badges (100 days, 1 year, etc.)

**Streak counter**
- `daily_checkins` table; one tap/day = streak +1
- Both partners must check in to keep flame alive
- Flame badge on home card

**Daily question**
- `daily_questions` table (seeded) + `daily_answers` (per user/day)
- Both answer privately → reveal both when both submitted
- Card on home: "Today's question 🐼"

## Phase 2 — Play & Memories (next turn)

- Real-time multiplayer: tic-tac-toe, rock-paper-scissors, drawing (Pictionary), truth-or-dare wheel via Realtime broadcast
- Memory jar / shared journal: photos + notes, resurface on anniversaries
- Wishlist & gift board with "secretly got it" toggle
- Mood history graph (last 30 days)
- Couple quiz mode ("how well do you know me")

## Phase 3 — Polish & Platform (turn after)

- Push notifications (web push)
- PWA install + offline shell + manifest
- Screen share in video calls
- Call backgrounds (panda ears overlay)
- Themes (velvet / sakura / midnight) — couple-synced
- Message search + per-chat media gallery
- Watch-together sync (YouTube player)

## Why phased
Each phase is ~6–10 files + 1–2 migrations. Doing all 20+ features in one shot guarantees broken realtime channels, RLS holes, and a slow site. Phasing keeps it solid + lets you test.

Starting Phase 1 now unless you say otherwise.