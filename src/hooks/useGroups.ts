import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type GroupRow = {
  id: string;
  name: string;
  avatar_url: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type GroupMember = {
  group_id: string;
  user_id: string;
  role: "admin" | "member";
  joined_at: string;
};

export type GroupMemberProfile = {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
};

export type GroupThread = {
  group: GroupRow;
  memberIds: string[];
  members: GroupMemberProfile[];
  last: { content: string; type: string; created_at: string; sender_id: string } | null;
  unread: number;
};

export function useGroups() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["groups"],
    queryFn: async (): Promise<GroupThread[]> => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return [];
      const me = u.user.id;

      const { data: myMemberships } = await supabase
        .from("chat_group_members")
        .select("group_id")
        .eq("user_id", me);
      const groupIds = (myMemberships ?? []).map((m) => m.group_id);
      if (groupIds.length === 0) return [];

      const [{ data: groups }, { data: allMembers }, { data: msgs }] = await Promise.all([
        supabase.from("chat_groups").select("*").in("id", groupIds),
        supabase
          .from("chat_group_members")
          .select("group_id,user_id,role,joined_at")
          .in("group_id", groupIds),
        supabase
          .from("messages")
          .select("group_id,sender_id,content,type,created_at,read_at")
          .in("group_id", groupIds)
          .order("created_at", { ascending: false })
          .limit(500),
      ]);

      const userIds = Array.from(new Set((allMembers ?? []).map((m) => m.user_id)));
      const { data: profiles } = userIds.length
        ? await supabase
            .from("profiles")
            .select("id,username,display_name,avatar_url")
            .in("id", userIds)
        : { data: [] as GroupMemberProfile[] };
      const profMap = new Map((profiles ?? []).map((p) => [p.id, p as GroupMemberProfile]));

      return (groups ?? [])
        .map((g): GroupThread => {
          const gMembers = (allMembers ?? []).filter((m) => m.group_id === g.id);
          const gMsgs = (msgs ?? []).filter((m) => m.group_id === g.id);
          const last = gMsgs[0] ?? null;
          const unread = gMsgs.filter((m) => m.sender_id !== me && !m.read_at).length;
          return {
            group: g as GroupRow,
            memberIds: gMembers.map((m) => m.user_id),
            members: gMembers
              .map((m) => profMap.get(m.user_id))
              .filter((p): p is GroupMemberProfile => !!p),
            last: last
              ? { content: last.content, type: last.type, created_at: last.created_at, sender_id: last.sender_id }
              : null,
            unread,
          };
        })
        .sort((a, b) => {
          const at = a.last?.created_at ?? a.group.created_at;
          const bt = b.last?.created_at ?? b.group.created_at;
          return bt.localeCompare(at);
        });
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel("groups-rt")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chat_groups" },
        () => qc.invalidateQueries({ queryKey: ["groups"] }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chat_group_members" },
        () => qc.invalidateQueries({ queryKey: ["groups"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc]);

  return q;
}

export function useGroup(groupId: string | null) {
  return useQuery({
    enabled: !!groupId,
    queryKey: ["group", groupId],
    queryFn: async () => {
      if (!groupId) return null;
      const { data: group } = await supabase.from("chat_groups").select("*").eq("id", groupId).maybeSingle();
      if (!group) return null;
      const { data: members } = await supabase
        .from("chat_group_members")
        .select("user_id,role,joined_at")
        .eq("group_id", groupId);
      const ids = (members ?? []).map((m) => m.user_id);
      const { data: profiles } = ids.length
        ? await supabase.from("profiles").select("id,username,display_name,avatar_url").in("id", ids)
        : { data: [] };
      const profMap = new Map((profiles ?? []).map((p) => [p.id, p as GroupMemberProfile]));
      return {
        group: group as GroupRow,
        members: (members ?? []).map((m) => ({
          ...m,
          profile: profMap.get(m.user_id) ?? null,
        })),
      };
    },
  });
}

export function useCreateGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; memberIds: string[]; avatar_url?: string | null }) => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      const me = u.user.id;

      const { data: g, error: gErr } = await supabase
        .from("chat_groups")
        .insert({ name: input.name.trim(), avatar_url: input.avatar_url ?? null, created_by: me })
        .select("*")
        .single();
      if (gErr) throw gErr;

      // seed creator as admin (RLS lets creator insert self for a group they created)
      const { error: meErr } = await supabase
        .from("chat_group_members")
        .insert({ group_id: g.id, user_id: me, role: "admin" });
      if (meErr) throw meErr;

      // add other members
      const rest = input.memberIds.filter((id) => id !== me);
      if (rest.length > 0) {
        const { error: mErr } = await supabase
          .from("chat_group_members")
          .insert(rest.map((user_id) => ({ group_id: g.id, user_id, role: "member" as const })));
        if (mErr) throw mErr;
      }
      return g as GroupRow;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["groups"] }),
  });
}

export function useLeaveGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (groupId: string) => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      const { error } = await supabase
        .from("chat_group_members")
        .delete()
        .eq("group_id", groupId)
        .eq("user_id", u.user.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["groups"] }),
  });
}
