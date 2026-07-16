import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type GroupTheme = "aurora" | "sunset" | "midnight" | "sakura" | "forest" | "mono";

export const GROUP_THEMES: { id: GroupTheme; label: string; emoji: string; swatch: string[] }[] = [
  { id: "aurora", label: "Aurora", emoji: "🌌", swatch: ["#1a0f2e", "#5b2a86", "#c084fc"] },
  { id: "sunset", label: "Sunset", emoji: "🌇", swatch: ["#3a0d1a", "#c2410c", "#fbbf24"] },
  { id: "midnight", label: "Midnight", emoji: "🌙", swatch: ["#020617", "#1e293b", "#38bdf8"] },
  { id: "sakura", label: "Sakura", emoji: "🌸", swatch: ["#2a0f1e", "#be185d", "#fbcfe8"] },
  { id: "forest", label: "Forest", emoji: "🌿", swatch: ["#0b1f14", "#166534", "#86efac"] },
  { id: "mono", label: "Mono", emoji: "🖤", swatch: ["#0a0a0a", "#404040", "#e5e5e5"] },
];

function invalidateGroup(qc: ReturnType<typeof useQueryClient>, groupId: string) {
  qc.invalidateQueries({ queryKey: ["group", groupId] });
  qc.invalidateQueries({ queryKey: ["groups"] });
}

export function useUpdateGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      groupId: string;
      name?: string;
      avatar_url?: string | null;
      theme?: GroupTheme;
    }) => {
      const patch: { name?: string; avatar_url?: string | null; theme?: string } = {};
      if (input.name !== undefined) patch.name = input.name.trim();
      if (input.avatar_url !== undefined) patch.avatar_url = input.avatar_url;
      if (input.theme !== undefined) patch.theme = input.theme;
      const { error } = await supabase.from("chat_groups").update(patch).eq("id", input.groupId);
      if (error) throw error;
    },
    onSuccess: (_r, v) => invalidateGroup(qc, v.groupId),
  });
}

export function useSetMemberRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { groupId: string; userId: string; role: "admin" | "member" }) => {
      // Prevent demoting the last admin
      if (input.role === "member") {
        const { data: admins } = await supabase
          .from("chat_group_members")
          .select("user_id")
          .eq("group_id", input.groupId)
          .eq("role", "admin");
        if ((admins?.length ?? 0) <= 1 && admins?.[0]?.user_id === input.userId) {
          throw new Error("Groups need at least one admin");
        }
      }
      const { error } = await supabase
        .from("chat_group_members")
        .update({ role: input.role })
        .eq("group_id", input.groupId)
        .eq("user_id", input.userId);
      if (error) throw error;
    },
    onSuccess: (_r, v) => invalidateGroup(qc, v.groupId),
  });
}

export function useRemoveMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { groupId: string; userId: string }) => {
      const { error } = await supabase
        .from("chat_group_members")
        .delete()
        .eq("group_id", input.groupId)
        .eq("user_id", input.userId);
      if (error) throw error;
    },
    onSuccess: (_r, v) => invalidateGroup(qc, v.groupId),
  });
}

export function useAddMembers() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { groupId: string; userIds: string[] }) => {
      if (input.userIds.length === 0) return;
      const rows = input.userIds.map((user_id) => ({
        group_id: input.groupId,
        user_id,
        role: "member" as const,
      }));
      const { error } = await supabase.from("chat_group_members").insert(rows);
      if (error) throw error;
    },
    onSuccess: (_r, v) => invalidateGroup(qc, v.groupId),
  });
}

const MUTE_KEY = (id: string) => `panda_group_mute_${id}`;

export function isGroupMuted(groupId: string): boolean {
  try {
    return localStorage.getItem(MUTE_KEY(groupId)) === "1";
  } catch {
    return false;
  }
}

export function setGroupMuted(groupId: string, muted: boolean) {
  try {
    if (muted) localStorage.setItem(MUTE_KEY(groupId), "1");
    else localStorage.removeItem(MUTE_KEY(groupId));
  } catch {
    // ignore
  }
}
