export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      admin_audit_log: {
        Row: {
          action: string
          admin_id: string
          created_at: string
          details: string | null
          id: string
          target_id: string | null
          target_table: string | null
        }
        Insert: {
          action: string
          admin_id: string
          created_at?: string
          details?: string | null
          id?: string
          target_id?: string | null
          target_table?: string | null
        }
        Update: {
          action?: string
          admin_id?: string
          created_at?: string
          details?: string | null
          id?: string
          target_id?: string | null
          target_table?: string | null
        }
        Relationships: []
      }
      ai_chat_logs: {
        Row: {
          created_at: string
          id: string
          message_preview: string | null
          tokens_used: number | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          message_preview?: string | null
          tokens_used?: number | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          message_preview?: string | null
          tokens_used?: number | null
          user_id?: string | null
        }
        Relationships: []
      }
      case_payments: {
        Row: {
          amount: number
          case_id: string
          created_at: string
          id: string
          paid_date: string | null
          paid_status: string
          payment_type: string
        }
        Insert: {
          amount?: number
          case_id: string
          created_at?: string
          id?: string
          paid_date?: string | null
          paid_status?: string
          payment_type?: string
        }
        Update: {
          amount?: number
          case_id?: string
          created_at?: string
          id?: string
          paid_date?: string | null
          paid_status?: string
          payment_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_payments_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "student_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_items: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_required: boolean
          item_name: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_required?: boolean
          item_name: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_required?: boolean
          item_name?: string
          sort_order?: number
        }
        Relationships: []
      }
      commissions: {
        Row: {
          case_id: string
          created_at: string
          id: string
          influencer_amount: number
          lawyer_amount: number
          status: string
          updated_at: string
        }
        Insert: {
          case_id: string
          created_at?: string
          id?: string
          influencer_amount?: number
          lawyer_amount?: number
          status?: string
          updated_at?: string
        }
        Update: {
          case_id?: string
          created_at?: string
          id?: string
          influencer_amount?: number
          lawyer_amount?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "commissions_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "student_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_submissions: {
        Row: {
          admin_notes: string | null
          created_at: string
          data: Json
          form_source: string
          id: string
          status: string
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          data?: Json
          form_source?: string
          id?: string
          status?: string
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          data?: Json
          form_source?: string
          id?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      documents: {
        Row: {
          category: string
          created_at: string
          expiry_date: string | null
          file_name: string
          file_size: number | null
          file_type: string | null
          file_url: string
          id: string
          notes: string | null
          service_id: string | null
          student_id: string
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          expiry_date?: string | null
          file_name: string
          file_size?: number | null
          file_type?: string | null
          file_url: string
          id?: string
          notes?: string | null
          service_id?: string | null
          student_id: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          expiry_date?: string | null
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          id?: string
          notes?: string | null
          service_id?: string | null
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      influencer_invites: {
        Row: {
          created_at: string
          created_user_id: string | null
          email: string
          full_name: string
          id: string
          invited_by: string
          status: string
        }
        Insert: {
          created_at?: string
          created_user_id?: string | null
          email: string
          full_name: string
          id?: string
          invited_by: string
          status?: string
        }
        Update: {
          created_at?: string
          created_user_id?: string | null
          email?: string
          full_name?: string
          id?: string
          invited_by?: string
          status?: string
        }
        Relationships: []
      }
      leads: {
        Row: {
          accommodation: boolean
          age: number | null
          budget_range: string | null
          city: string | null
          created_at: string
          education_level: string | null
          eligibility_score: number | null
          email: string | null
          full_name: string
          german_level: string | null
          id: string
          notes: string | null
          phone: string
          preferred_city: string | null
          service_requested: string | null
          source_id: string | null
          source_type: string
          status: string
          study_destination: string | null
        }
        Insert: {
          accommodation?: boolean
          age?: number | null
          budget_range?: string | null
          city?: string | null
          created_at?: string
          education_level?: string | null
          eligibility_score?: number | null
          email?: string | null
          full_name: string
          german_level?: string | null
          id?: string
          notes?: string | null
          phone: string
          preferred_city?: string | null
          service_requested?: string | null
          source_id?: string | null
          source_type?: string
          status?: string
          study_destination?: string | null
        }
        Update: {
          accommodation?: boolean
          age?: number | null
          budget_range?: string | null
          city?: string | null
          created_at?: string
          education_level?: string | null
          eligibility_score?: number | null
          email?: string | null
          full_name?: string
          german_level?: string | null
          id?: string
          notes?: string | null
          phone?: string
          preferred_city?: string | null
          service_requested?: string | null
          source_id?: string | null
          source_type?: string
          status?: string
          study_destination?: string | null
        }
        Relationships: []
      }
      login_attempts: {
        Row: {
          created_at: string
          email: string
          id: string
          ip_address: string | null
          success: boolean
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          ip_address?: string | null
          success?: boolean
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          ip_address?: string | null
          success?: boolean
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          currency: string
          id: string
          notes: string | null
          payment_date: string | null
          service_id: string | null
          status: string
          student_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          notes?: string | null
          payment_date?: string | null
          service_id?: string | null
          status?: string
          student_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          notes?: string | null
          payment_date?: string | null
          service_id?: string | null
          status?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          city: string | null
          country: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          influencer_id: string | null
          intake_month: string | null
          notes: string | null
          phone_number: string | null
          student_status: string
          university_name: string | null
          updated_at: string
          visa_status: string
        }
        Insert: {
          city?: string | null
          country?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id: string
          influencer_id?: string | null
          intake_month?: string | null
          notes?: string | null
          phone_number?: string | null
          student_status?: string
          university_name?: string | null
          updated_at?: string
          visa_status?: string
        }
        Update: {
          city?: string | null
          country?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          influencer_id?: string | null
          intake_month?: string | null
          notes?: string | null
          phone_number?: string | null
          student_status?: string
          university_name?: string | null
          updated_at?: string
          visa_status?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth_key: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          user_id: string
        }
        Insert: {
          auth_key: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          user_id: string
        }
        Update: {
          auth_key?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          user_id?: string
        }
        Relationships: []
      }
      referral_milestones: {
        Row: {
          achieved_at: string
          id: string
          milestone_type: string
          notified: boolean
          user_id: string
        }
        Insert: {
          achieved_at?: string
          id?: string
          milestone_type: string
          notified?: boolean
          user_id: string
        }
        Update: {
          achieved_at?: string
          id?: string
          milestone_type?: string
          notified?: boolean
          user_id?: string
        }
        Relationships: []
      }
      referrals: {
        Row: {
          created_at: string
          id: string
          is_family: boolean
          notes: string | null
          referred_city: string | null
          referred_country: string | null
          referred_dob: string | null
          referred_email: string | null
          referred_gender: string | null
          referred_german_level: string | null
          referred_name: string
          referred_phone: string | null
          referred_student_id: string | null
          referrer_id: string
          referrer_type: string
          status: string
          terms_accepted_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_family?: boolean
          notes?: string | null
          referred_city?: string | null
          referred_country?: string | null
          referred_dob?: string | null
          referred_email?: string | null
          referred_gender?: string | null
          referred_german_level?: string | null
          referred_name: string
          referred_phone?: string | null
          referred_student_id?: string | null
          referrer_id: string
          referrer_type?: string
          status?: string
          terms_accepted_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_family?: boolean
          notes?: string | null
          referred_city?: string | null
          referred_country?: string | null
          referred_dob?: string | null
          referred_email?: string | null
          referred_gender?: string | null
          referred_german_level?: string | null
          referred_name?: string
          referred_phone?: string | null
          referred_student_id?: string | null
          referrer_id?: string
          referrer_type?: string
          status?: string
          terms_accepted_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      rewards: {
        Row: {
          admin_notes: string | null
          amount: number
          created_at: string
          currency: string
          id: string
          paid_at: string | null
          payout_requested_at: string | null
          referral_id: string | null
          status: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          paid_at?: string | null
          payout_requested_at?: string | null
          referral_id?: string | null
          status?: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          paid_at?: string | null
          payout_requested_at?: string | null
          referral_id?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rewards_referral_id_fkey"
            columns: ["referral_id"]
            isOneToOne: false
            referencedRelation: "referrals"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          service_type: string
          status: string
          student_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          service_type: string
          status?: string
          student_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          service_type?: string
          status?: string
          student_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      student_cases: {
        Row: {
          accommodation_status: string | null
          assigned_lawyer_id: string | null
          case_status: string
          created_at: string
          id: string
          influencer_commission: number
          lawyer_commission: number
          lead_id: string
          notes: string | null
          referral_discount: number
          school_commission: number
          selected_city: string | null
          selected_school: string | null
          service_fee: number
          student_profile_id: string | null
          translation_fee: number
          updated_at: string
        }
        Insert: {
          accommodation_status?: string | null
          assigned_lawyer_id?: string | null
          case_status?: string
          created_at?: string
          id?: string
          influencer_commission?: number
          lawyer_commission?: number
          lead_id: string
          notes?: string | null
          referral_discount?: number
          school_commission?: number
          selected_city?: string | null
          selected_school?: string | null
          service_fee?: number
          student_profile_id?: string | null
          translation_fee?: number
          updated_at?: string
        }
        Update: {
          accommodation_status?: string | null
          assigned_lawyer_id?: string | null
          case_status?: string
          created_at?: string
          id?: string
          influencer_commission?: number
          lawyer_commission?: number
          lead_id?: string
          notes?: string | null
          referral_discount?: number
          school_commission?: number
          selected_city?: string | null
          selected_school?: string | null
          service_fee?: number
          student_profile_id?: string | null
          translation_fee?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_cases_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      student_checklist: {
        Row: {
          checklist_item_id: string
          completed_at: string | null
          created_at: string
          id: string
          is_completed: boolean
          student_id: string
        }
        Insert: {
          checklist_item_id: string
          completed_at?: string | null
          created_at?: string
          id?: string
          is_completed?: boolean
          student_id: string
        }
        Update: {
          checklist_item_id?: string
          completed_at?: string | null
          created_at?: string
          id?: string
          is_completed?: boolean
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_checklist_checklist_item_id_fkey"
            columns: ["checklist_item_id"]
            isOneToOne: false
            referencedRelation: "checklist_items"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      insert_lead_from_apply: {
        Args: {
          p_accommodation?: boolean
          p_budget_range?: string
          p_city?: string
          p_education_level?: string
          p_full_name: string
          p_german_level?: string
          p_phone: string
          p_preferred_city?: string
          p_source_id?: string
          p_source_type?: string
        }
        Returns: undefined
      }
      upsert_lead_from_contact: {
        Args: {
          p_email: string
          p_full_name: string
          p_notes: string
          p_phone: string
          p_service_requested: string
          p_study_destination: string
        }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user" | "influencer" | "lawyer"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "moderator", "user", "influencer", "lawyer"],
    },
  },
} as const
