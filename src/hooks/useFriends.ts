import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export type Friendship = {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: "pending" | "accepted" | "blocked";
  created_at: string;
};

export type FriendProfile = {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
};

export function useFriendships() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["friendships"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return { me: null, friendships: [], profiles: {} as Record<string, FriendProfile> };
      const { data: fs, error } = await supabase
        .from("friendships")
        .select("*")
        .or(`requester_id.eq.${u.user.id},addressee_id.eq.${u.user.id}`)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const ids = Array.from(
        new Set((fs ?? []).flatMap((f) => [f.requester_id, f.addressee_id]).filter((id) => id !== u.user!.id))
      );
      const profiles: Record<string, FriendProfile> = {};
      if (ids.length) {
        const { data: ps, error: profilesError } = await supabase.rpc("friend_profiles_for_me", { _ids: ids });
        if (profilesError) throw profilesError;
        (ps ?? []).forEach((p) => (profiles[p.id] = p as FriendProfile));
      }
      return { me: u.user.id, friendships: (fs ?? []) as Friendship[], profiles };
    },
  });

  useEffect(() => {
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let debounce: ReturnType<typeof setTimeout> | null = null;
    const schedule = () => {
      if (debounce) return;
      debounce = setTimeout(() => {
        debounce = null;
        qc.invalidateQueries({ queryKey: ["friendships"] });
      }, 300);
    };

    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (cancelled || !u.user) return;
      const uid = u.user.id;
      channel = supabase
        .channel(`friendships-rt:${uid}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "friendships", filter: `requester_id=eq.${uid}` },
          schedule,
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "friendships", filter: `addressee_id=eq.${uid}` },
          schedule,
        )
        .subscribe();
    })();

    return () => {
      cancelled = true;
      if (debounce) clearTimeout(debounce);
      if (channel) supabase.removeChannel(channel);
    };
  }, [qc]);

  return q;
}

export function useFriendActions() {
  const qc = useQueryClient();
  return {
    request: useMutation({
      mutationFn: async (addresseeId: string) => {
        const { data: u } = await supabase.auth.getUser();
        if (!u.user) throw new Error("Not signed in");
        if (addresseeId === u.user.id) throw new Error("You can't send a friend request to yourself");
        // Guard against duplicate friendships in either direction so we surface
        // a friendly error instead of a raw unique-constraint violation.
        const { data: existing } = await supabase
          .from("friendships")
          .select("id,status,requester_id,addressee_id")
          .or(
            `and(requester_id.eq.${u.user.id},addressee_id.eq.${addresseeId}),` +
            `and(requester_id.eq.${addresseeId},addressee_id.eq.${u.user.id})`
          )
          .maybeSingle();
        if (existing) {
          if (existing.status === "accepted") throw new Error("You're already friends");
          if (existing.status === "blocked") throw new Error("Unable to send request");
          throw new Error("A friend request is already pending");
        }
        const { error } = await supabase.from("friendships").insert({
          requester_id: u.user.id,
          addressee_id: addresseeId,
          status: "pending",
        });
        if (error) throw error;
      },
      onSuccess: () => qc.invalidateQueries({ queryKey: ["friendships"] }),
    }),
    accept: useMutation({
      mutationFn: async (id: string) => {
        const { error } = await supabase.from("friendships").update({ status: "accepted" }).eq("id", id);
        if (error) throw error;
      },
      onSuccess: () => qc.invalidateQueries({ queryKey: ["friendships"] }),
    }),
    remove: useMutation({
      mutationFn: async (id: string) => {
        const { error } = await supabase.from("friendships").delete().eq("id", id);
        if (error) throw error;
      },
      onSuccess: () => qc.invalidateQueries({ queryKey: ["friendships"] }),
    }),
  };
}
