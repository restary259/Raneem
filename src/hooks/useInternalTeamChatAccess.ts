import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

/**
 * Per-team-member capability for starting peer-to-peer internal team chats.
 * Admins retain access to the existing broader direct-message flows.
 */
export function useInternalTeamChatAccess() {
  const { user, role } = useAuth();

  const query = useQuery({
    queryKey: ["internal-team-chat-access", user?.id],
    queryFn: async () => {
      if (!user?.id) return false;
      const { data, error } = await (supabase as any)
        .from("profiles")
        .select("internal_team_chat_enabled")
        .eq("id", user.id)
        .maybeSingle();
      if (error) throw error;
      return !!data?.internal_team_chat_enabled;
    },
    enabled: !!user?.id && role === "team_member",
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  if (role === "admin") {
    return { canAccess: true, loading: false, error: null as Error | null };
  }

  if (role !== "team_member") {
    return { canAccess: false, loading: false, error: null as Error | null };
  }

  return {
    canAccess: query.data === true,
    loading: query.isLoading,
    error: (query.error as Error | null) ?? null,
  };
}
