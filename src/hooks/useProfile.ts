import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Profile = {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  invite_code: string;
  partner_id: string | null;
  paired_at: string | null;
  favorite_color: string | null;
  favorite_emoji: string | null;
  anniversary_date: string | null;
  partner_nickname: string | null;
  bio: string | null;
};

export function useProfile() {
  return useQuery({
    queryKey: ["profile", "me"],
    queryFn: async (): Promise<{ profile: Profile | null; partner: Profile | null }> => {
      const { data: userRes } = await supabase.auth.getUser();
      if (!userRes.user) return { profile: null, partner: null };
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userRes.user.id)
        .maybeSingle();
      if (error) throw error;
      let partner: Profile | null = null;
      if (profile?.partner_id) {
        const { data: p } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", profile.partner_id)
          .maybeSingle();
        partner = (p as Profile) ?? null;
      }
      return { profile: (profile as Profile) ?? null, partner };
    },
  });
}
