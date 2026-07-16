## Group Chat Feature Upgrade

Adding four feature tiers to group chats. Existing tables: `chat_groups`, `chat_group_members` (role admin/member), `messages`.

### 1. Basic essentials (Group Info screen)
New route `src/routes/_authenticated/app.chat.group.$groupId.info.tsx`:
- Rename group (admin only)
- Change group avatar — upload to `chat-media` bucket (admin only)
- Members list with role badges
- Add members (from friends + partner)
- Remove member (admin only)
- Promote / demote admin (admin only) — **admin switch**
- Leave group (existing `useLeaveGroup`)
- Mute notifications (local per-device via `localStorage`, keyed by group id)

Header of `app.chat.group.$groupId.tsx` links to the info screen.

### 2. Message tools (extend existing chat UI)
Reuse for both direct + group chats where feasible:
- **Reply/quote**: add `reply_to_id` column on `messages`; long-press/hover shows Reply; composer displays quoted preview; bubble renders quoted snippet that scrolls to source
- **Reactions**: new `message_reactions` table (`message_id`, `user_id`, `emoji`); tap emoji on bubble; grouped counts under bubble
- **Pin messages**: add `pinned_at`, `pinned_by` on `messages`; pinned banner at top of group thread; admin-only pin/unpin
- **Search within group**: reuse `ChatSearch` component, wired to group message list
- **Delete for everyone**: admin OR original sender; sets `deleted_at` and renders "message deleted"

### 3. Media & sharing (Media tab in Group Info)
- Tabs: Media (images/video), Files, Links
- Query `messages` filtered by group + type in ('image','video','file') sorted desc
- Link previews: extract first URL, store `link_preview` jsonb (title, description, image) fetched by a server function using existing infra pattern; render inline in bubbles

### 4. Step 3 — Theme selection + Admin switch
- **Theme selection**: add `theme` text column on `chat_groups` (default `'aurora'`). Options: `aurora`, `sunset`, `midnight`, `sakura`, `forest`, `mono`. Admin picks from Info screen. Chat background + accent tokens driven by `data-group-theme` attribute mapped in `styles.css`.
- **Admin switch**: Promote/demote handled in Members list. Enforced by RLS via existing `is_group_admin()` function. At least one admin must remain (checked in mutation).

### Data changes (single migration)
```sql
alter table public.messages
  add column reply_to_id uuid references public.messages(id) on delete set null,
  add column pinned_at timestamptz,
  add column pinned_by uuid references auth.users(id),
  add column deleted_at timestamptz,
  add column link_preview jsonb;

alter table public.chat_groups add column theme text not null default 'aurora';

create table public.message_reactions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now(),
  unique(message_id, user_id, emoji)
);
-- GRANTs + RLS: users can react to messages they can read; delete own reactions.
```

New RLS on new columns/table + policies for admin pin/unpin, admin/sender delete, admin theme/rename/avatar/role changes.

### Files touched (est.)
- 1 migration
- New: `app.chat.group.$groupId.info.tsx`, `GroupInfo/` components (Members, MediaTab, ThemePicker), `useMessageReactions.ts`, `useGroupMedia.ts`
- Edited: `app.chat.group.$groupId.tsx`, `ChatBubble.tsx`, `ChatComposer.tsx`, `useGroupChat.ts`, `useGroups.ts`, `styles.css`, `types.ts` (auto-regen after migration)

### Notes
- Message tools (reply/reactions/pin/delete) will also appear in direct chats since they share `ChatBubble`/`ChatComposer` — acceptable and expected.
- Link preview fetching runs via server function; failures degrade to plain link.
- Notification mute is device-local (no push infra yet).

Confirm to proceed and I'll ship it in order: migration → basics + admin switch → message tools → media tab → themes.