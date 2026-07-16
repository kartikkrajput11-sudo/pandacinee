# Rebuild Group Chat

The backend tables (`chat_groups`, `chat_group_members`, `message_reactions`, `messages` with `reply_to_id`/`pinned_at`/`deleted_at`) and RLS/helpers (`is_group_member`, `is_group_admin`, `chat_group_messages`, `call_start_group`) all still exist from before. This rebuild is frontend-only.

## What ships

### 1. Group list (in Chats)
- Groups section on `/app/chat` above Friends
- "+" menu → New group / Add friend
- `NewGroupDialog`: name, emoji avatar, pick friends/partner
- Unread count + last-message preview per group

### 2. Group chat screen `/app/chat/group/$groupId`
- Header: avatar, name, member count, call button, settings (gear) link
- Message list reusing `ChatBubble`
- Composer reusing `ChatComposer` (text, image, voice, sticker)
- Realtime via `chat_group_messages` RPC + realtime channel
- Reply/quote, react (emoji), pin (admin), delete-for-everyone (admin/sender)
- Pinned banner at top

### 3. Group info / settings `/app/chat/group/$groupId/info`
- Rename group (admin)
- Change avatar emoji (admin)
- **Theme picker** — aurora / sunset / midnight / sakura / forest / mono, applied via `data-group-theme` on chat screen
- Members list with role badges, promote/demote (admin), remove (admin)
- Add members from friends
- Leave group
- Mute notifications (device-local)

### 4. Group calls
- Voice/video group call from header button → `/app/call/group/$groupId`
- Reuses `call_start_group` RPC + existing LiveKit call panel
- `IncomingCallListener` re-enables `scope=group` routing

## Files

Recreate:
- `src/hooks/useGroups.ts` — list + `useGroup(id)` + `useCreateGroup` + `useLeaveGroup`
- `src/hooks/useGroupChat.ts` — messages + send + realtime
- `src/hooks/useGroupAdmin.ts` — rename/avatar/theme, member roles, add/remove, mute
- `src/components/chat/NewGroupDialog.tsx`
- `src/routes/_authenticated/app.chat.group.$groupId.tsx`
- `src/routes/_authenticated/app.chat.group.$groupId.info.tsx`
- `src/routes/_authenticated/app.call.group.$groupId.tsx`

Edit:
- `src/routes/_authenticated/app.chat.index.tsx` — add groups section + "+" menu back
- `src/components/IncomingCallListener.tsx` — restore group-call navigation
- `src/hooks/useUnreadMessages.ts` — include group unreads
- `src/styles.css` — `[data-group-theme]` token overrides for the 6 themes

## Notes
- No DB migration — schema is already in place.
- Reactions/reply/pin surface in group chat only for now (not direct chats) to keep the diff contained.
- After you approve, I ship it in one pass.
