import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type LiteProfile = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
};

/**
 * Fetches a minimal profile for any user id. Used to resolve friend/opponent
 * display names in games so the UI never falls back to a generic "Panda".
 */
export function useProfileById(id: string | null | undefined) {
  return useQuery({
    queryKey: ["profile", "byId", id],
    enabled: !!id,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<LiteProfile | null> => {
      if (!id) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return (data as LiteProfile) ?? null;
    },
  });
}
