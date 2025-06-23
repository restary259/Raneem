
export type NotificationType = 'offer' | 'deadline' | 'message' | 'system' | 'custom';

export type NotificationCategory = 
  | 'scholarship' | 'university_offer' | 'language_school'
  | 'deadline7' | 'deadline3' | 'deadline1'
  | 'chat' | 'partner_message'
  | 'announcement' | 'maintenance' | 'newsletter'
  | 'custom_alert';

export type DeliveryChannel = {
  inApp: boolean;
  push: boolean;
  email: boolean;
};

export type FrequencySettings = {
  offer: 'instant' | 'daily' | 'weekly' | 'off';
  deadline: 'instant' | 'reminder' | 'off';
  digest: 'daily' | 'weekly' | 'monthly' | 'off';
};

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  category: NotificationCategory;
  reference_id?: string;
  title: string;
  message: string;
  url?: string;
  data?: Record<string, any>;
  is_read: boolean;
  channel: DeliveryChannel;
  created_at: string;
  delivered_at?: Record<string, string>;
}

export interface NotificationSettings {
  user_id: string;
  channels: DeliveryChannel;
  frequency: FrequencySettings;
  custom_rules: CustomRule[];
  push_token?: string;
  created_at?: string;
  updated_at?: string;
}

export interface CustomRule {
  id: string;
  name: string;
  keywords: string[];
  countries?: string[];
  categories?: string[];
  enabled: boolean;
}

export interface NotificationFilter {
  type?: NotificationType;
  category?: NotificationCategory;
  is_read?: boolean;
  limit?: number;
  offset?: number;
}
