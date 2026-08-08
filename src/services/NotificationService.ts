import { supabase } from '@/integrations/supabase/client';

const db = supabase as any;

export const NotificationService = {
  async listForUser(userId: string, limit = 50): Promise<any[]> {
    const { data, error } = await db
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data ?? [];
  },

  async markRead(notificationId: string): Promise<void> {
    const { error } = await db
      .from('notifications')
      .update({ is_read: true, read: true })
      .eq('id', notificationId);
    if (error) throw error;
  },

  async markAllRead(userId: string): Promise<void> {
    const { error } = await db
      .from('notifications')
      .update({ is_read: true, read: true })
      .eq('user_id', userId)
      .eq('is_read', false);
    if (error) throw error;
  },
};

export interface NotificationPrefs {
  notify_in_app: boolean;
  notify_email: boolean;
}

export async function getNotificationPrefs(userId: string): Promise<NotificationPrefs> {
  const { data, error } = await db
    .from('profiles')
    .select('notify_in_app, notify_email')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return {
    notify_in_app: data?.notify_in_app ?? true,
    notify_email: data?.notify_email ?? true,
  };
}

export async function updateNotificationPrefs(
  userId: string,
  prefs: Partial<NotificationPrefs>,
): Promise<void> {
  const { error } = await db.from('profiles').update(prefs).eq('id', userId);
  if (error) throw error;
}

/** Fire-and-forget email fan-out for a message that was just sent. */
export async function notifyNewMessageEmail(payload: {
  threadType: 'case' | 'direct';
  threadId: string;
  preview: string;
}): Promise<void> {
  try {
    await supabase.functions.invoke('notify-new-message', {
      body: {
        thread_type: payload.threadType,
        thread_id: payload.threadId,
        preview: payload.preview.slice(0, 140),
      },
    });
  } catch {
    // Email is best-effort; the in-app notification already landed.
  }
}

/** Sends a delivery-test email to the signed-in user; throws with provider detail on failure. */
export async function sendTestNotificationEmail(): Promise<string> {
  const { data, error } = await supabase.functions.invoke('notify-new-message', {
    body: { test: true },
  });
  if (error) {
    let detail = error.message;
    const ctx = (error as any)?.context;
    if (ctx?.text) {
      try {
        detail = (await ctx.text()) || detail;
      } catch {
        /* keep original message */
      }
    }
    throw new Error(detail);
  }
  const body = data as any;
  if (body?.ok === false) throw new Error(body?.detail ?? 'Email not sent');
  return body?.to ?? '';
}
