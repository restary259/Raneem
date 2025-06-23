
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { NotificationSettings } from '@/types/notifications';

export const useNotificationSettings = (userId: string) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch notification settings
  const { data: settings, isLoading, error } = useQuery({
    queryKey: ['notification-settings', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notification_settings')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) throw error;
      
      // Create default settings if none exist
      if (!data) {
        const defaultSettings = {
          user_id: userId,
          channels: { inApp: true, push: true, email: false },
          frequency: { offer: 'instant', deadline: 'reminder', digest: 'daily' },
          custom_rules: []
        };

        const { data: newSettings, error: insertError } = await supabase
          .from('notification_settings')
          .insert(defaultSettings)
          .select()
          .single();

        if (insertError) throw insertError;
        return newSettings as NotificationSettings;
      }

      return data as NotificationSettings;
    },
    enabled: !!userId,
  });

  // Update notification settings
  const updateSettingsMutation = useMutation({
    mutationFn: async (updates: Partial<NotificationSettings>) => {
      const { error } = await supabase
        .from('notification_settings')
        .update(updates)
        .eq('user_id', userId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-settings'] });
      toast({
        title: "تم حفظ الإعدادات",
        description: "تم تحديث إعدادات الإشعارات بنجاح",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "خطأ في حفظ الإعدادات",
        description: error.message,
      });
    },
  });

  // Register push token
  const registerPushTokenMutation = useMutation({
    mutationFn: async (token: string) => {
      const { error } = await supabase
        .from('notification_settings')
        .update({ push_token: token })
        .eq('user_id', userId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-settings'] });
    },
  });

  return {
    settings,
    isLoading,
    error,
    updateSettings: updateSettingsMutation.mutate,
    registerPushToken: registerPushTokenMutation.mutate,
    isUpdating: updateSettingsMutation.isPending,
  };
};
