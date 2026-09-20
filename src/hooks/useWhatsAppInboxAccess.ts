import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

/**
 * Per-team-member permission for the shared WhatsApp inbox.
 * Admins always have access. Team members default to denied until an admin
 * explicitly enables the profile flag.
 */
export function useWhatsAppInboxAccess() {
  const { user, role } = useAuth();

  const query = useQuery({
    queryKey: ["whatsapp-inbox-access", user?.id],
    queryFn: async () => {
      if (!user?.id) return false;
      const { data, error } = await (supabase as any)
        .from("profiles")
        .select("whatsapp_inbox_enabled")
        .eq("id", user.id)
        .maybeSingle();
      if (error) throw error;
      return !!data?.whatsapp_inbox_enabled;
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
