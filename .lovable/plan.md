## Friends + Groups for Chat

Extend chat beyond the paired partner. `friendships` already exists — reuse it. Add group chats. Partner is always highlighted and pinned first.

### Database (one migration)

1. `chat_groups(id, name, avatar_url, created_by, created_at, updated_at)`
2. `chat_group_members(group_id, user_id, role ['admin'|'member'], joined_at)` — PK (group_id,user_id)
3. Extend `messages`:
   - add `group_id uuid null` (FK chat_groups)
   - make `receiver_id` nullable
   - CHECK: exactly one of `receiver_id` / `group_id` set
4. `is_group_member(_gid, _uid)` SECURITY DEFINER helper (avoids RLS recursion)
5. RLS:
   - groups: SELECT if member; INSERT any authed (creator); UPDATE if admin
   - members: SELECT if same group member; INSERT self via group creation / admin; DELETE self or admin
   - messages: extend existing policies so group members can SELECT/INSERT when `group_id` matches their membership
6. GRANTs for authenticated/service_role on new tables
7. Add both new tables to `supabase_realtime` publication

### Friends (already have `friendships`)
Wire up UI for existing table:
- Search users (`search_profiles` rpc exists) → send friend request (INSERT pending)
- Incoming/outgoing requests list, accept/decline
- Friends list (status='accepted')

### UI

**`/app/chat` (index) — rebuild as a unified list:**
- Section 1: 💕 Partner (if paired) — velvet gradient card, always on top, "Partner" badge
- Section 2: Groups — group avatar (stack of members), name, last message preview, unread dot
- Section 3: Friends — 1:1 chats with accepted friends, last message + unread
- Header actions: `+ New` menu → New group / Add friend
- Friend requests inbox badge

**New group flow:** modal → name + optional emoji avatar → pick friends (partner pre-selected & highlighted with heart badge) → create.

**`/app/friends` route:** search users, pending requests (in/out), friends list, remove friend.

**Group chat route:** `/app/chat/group/$groupId` — reuses ChatBubble/ChatComposer, header shows member avatars (partner rendered with petal ring + heart). Sender name shown above bubble for non-mine messages.

**Partner highlight rule everywhere:** partner avatar gets `ring-petal petal-glow` and a small ♥ badge; partner name renders in petal color. In group member lists, partner sorts first.

### Code layout
- `src/lib/friends.functions.ts` — search, request, accept, decline, remove, list
- `src/lib/groups.functions.ts` — create, addMember, removeMember, listMine, get
- `src/hooks/useFriends.ts`, `src/hooks/useGroups.ts`
- `src/hooks/useChat.ts` — extend to accept `{ peerId } | { groupId }`
- `src/components/chat/PartnerBadge.tsx`, `FriendRow.tsx`, `GroupRow.tsx`, `NewGroupDialog.tsx`, `AddFriendDialog.tsx`
- `src/routes/_authenticated/app.chat.index.tsx` — rewrite as unified list
- `src/routes/_authenticated/app.chat.group.$groupId.tsx` — new
- `src/routes/_authenticated/app.friends.tsx` — new
- Update `useUnreadMessages` to count receiver_id=me OR group_id in my groups

### Scope kept out
- No group calls / group games in this pass (1:1 only for now)
- No message-level per-recipient read receipts for groups (single `read_at` stays 1:1 only; groups show "seen by N" later)
- No nested folders / friend categories
