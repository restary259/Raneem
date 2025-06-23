export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      academic_backgrounds: {
        Row: {
          created_at: string | null
          degree: string | null
          field_of_study: string | null
          gpa: number | null
          graduation_year: number | null
          id: string
          institution: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          degree?: string | null
          field_of_study?: string | null
          gpa?: number | null
          graduation_year?: number | null
          id?: string
          institution: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          degree?: string | null
          field_of_study?: string | null
          gpa?: number | null
          graduation_year?: number | null
          id?: string
          institution?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "academic_backgrounds_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_submissions: {
        Row: {
          created_at: string
          data: Json
          form_source: string
          id: string
        }
        Insert: {
          created_at?: string
          data: Json
          form_source: string
          id?: string
        }
        Update: {
          created_at?: string
          data?: Json
          form_source?: string
          id?: string
        }
        Relationships: []
      }
      documents: {
        Row: {
          file_name: string
          file_path: string
          file_size: number | null
          id: string
          mime_type: string | null
          notes: string | null
          service_id: string | null
          student_id: string
          upload_date: string
        }
        Insert: {
          file_name: string
          file_path: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          notes?: string | null
          service_id?: string | null
          student_id: string
          upload_date?: string
        }
        Update: {
          file_name?: string
          file_path?: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          notes?: string | null
          service_id?: string | null
          student_id?: string
          upload_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_documents_service"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      email_logs: {
        Row: {
          email_type: string
          error_message: string | null
          id: string
          recipient_email: string
          sent_at: string | null
          status: string | null
          subject: string | null
        }
        Insert: {
          email_type: string
          error_message?: string | null
          id?: string
          recipient_email: string
          sent_at?: string | null
          status?: string | null
          subject?: string | null
        }
        Update: {
          email_type?: string
          error_message?: string | null
          id?: string
          recipient_email?: string
          sent_at?: string | null
          status?: string | null
          subject?: string | null
        }
        Relationships: []
      }
      notification_settings: {
        Row: {
          channels: Json | null
          created_at: string | null
          custom_rules: Json | null
          frequency: Json | null
          push_token: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          channels?: Json | null
          created_at?: string | null
          custom_rules?: Json | null
          frequency?: Json | null
          push_token?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          channels?: Json | null
          created_at?: string | null
          custom_rules?: Json | null
          frequency?: Json | null
          push_token?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_settings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          category: string
          channel: Json
          created_at: string | null
          data: Json | null
          delivered_at: Json | null
          id: string
          is_read: boolean | null
          message: string
          reference_id: string | null
          title: string
          type: string
          url: string | null
          user_id: string
        }
        Insert: {
          category: string
          channel?: Json
          created_at?: string | null
          data?: Json | null
          delivered_at?: Json | null
          id?: string
          is_read?: boolean | null
          message: string
          reference_id?: string | null
          title: string
          type: string
          url?: string | null
          user_id: string
        }
        Update: {
          category?: string
          channel?: Json
          created_at?: string | null
          data?: Json | null
          delivered_at?: Json | null
          id?: string
          is_read?: boolean | null
          message?: string
          reference_id?: string | null
          title?: string
          type?: string
          url?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount_paid: number
          amount_remaining: number | null
          amount_total: number
          created_at: string
          due_date: string | null
          id: string
          notes: string | null
          payment_date: string | null
          payment_method: string | null
          payment_status: Database["public"]["Enums"]["payment_status"] | null
          service_id: string | null
          student_id: string
        }
        Insert: {
          amount_paid?: number
          amount_remaining?: number | null
          amount_total?: number
          created_at?: string
          due_date?: string | null
          id?: string
          notes?: string | null
          payment_date?: string | null
          payment_method?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"] | null
          service_id?: string | null
          student_id: string
        }
        Update: {
          amount_paid?: number
          amount_remaining?: number | null
          amount_total?: number
          created_at?: string
          due_date?: string | null
          id?: string
          notes?: string | null
          payment_date?: string | null
          payment_method?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status"] | null
          service_id?: string | null
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_payments_service"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          city: string | null
          country: string | null
          created_at: string
          email: string
          first_name: string | null
          full_name: string
          id: string
          intake_month: string | null
          is_admin: boolean | null
          last_name: string | null
          notes: string | null
          phone: string | null
          phone_number: string | null
          preferred_name: string | null
          pronouns: string | null
          university_name: string | null
          updated_at: string
          visa_status: Database["public"]["Enums"]["visa_status"] | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          email: string
          first_name?: string | null
          full_name: string
          id: string
          intake_month?: string | null
          is_admin?: boolean | null
          last_name?: string | null
          notes?: string | null
          phone?: string | null
          phone_number?: string | null
          preferred_name?: string | null
          pronouns?: string | null
          university_name?: string | null
          updated_at?: string
          visa_status?: Database["public"]["Enums"]["visa_status"] | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          email?: string
          first_name?: string | null
          full_name?: string
          id?: string
          intake_month?: string | null
          is_admin?: boolean | null
          last_name?: string | null
          notes?: string | null
          phone?: string | null
          phone_number?: string | null
          preferred_name?: string | null
          pronouns?: string | null
          university_name?: string | null
          updated_at?: string
          visa_status?: Database["public"]["Enums"]["visa_status"] | null
        }
        Relationships: []
      }
      services: {
        Row: {
          assigned_date: string | null
          completion_date: string | null
          created_at: string
          description: string | null
          id: string
          notes: string | null
          service_type: Database["public"]["Enums"]["service_type"]
          status: string | null
          student_id: string
        }
        Insert: {
          assigned_date?: string | null
          completion_date?: string | null
          created_at?: string
          description?: string | null
          id?: string
          notes?: string | null
          service_type: Database["public"]["Enums"]["service_type"]
          status?: string | null
          student_id: string
        }
        Update: {
          assigned_date?: string | null
          completion_date?: string | null
          created_at?: string
          description?: string | null
          id?: string
          notes?: string | null
          service_type?: Database["public"]["Enums"]["service_type"]
          status?: string | null
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "services_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      student_documents: {
        Row: {
          file_size: number | null
          file_url: string
          id: string
          mime_type: string | null
          name: string
          status: string | null
          type: string
          updated_at: string | null
          uploaded_at: string | null
          user_id: string
        }
        Insert: {
          file_size?: number | null
          file_url: string
          id?: string
          mime_type?: string | null
          name: string
          status?: string | null
          type: string
          updated_at?: string | null
          uploaded_at?: string | null
          user_id: string
        }
        Update: {
          file_size?: number | null
          file_url?: string
          id?: string
          mime_type?: string | null
          name?: string
          status?: string | null
          type?: string
          updated_at?: string | null
          uploaded_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_documents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      student_preferences: {
        Row: {
          created_at: string | null
          destinations: string[] | null
          interests: string[] | null
          languages: string[] | null
          notifications: Json | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          destinations?: string[] | null
          interests?: string[] | null
          languages?: string[] | null
          notifications?: Json | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          destinations?: string[] | null
          interests?: string[] | null
          languages?: string[] | null
          notifications?: Json | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          enrollment_date: string | null
          id: number
          profile_id: string
        }
        Insert: {
          enrollment_date?: string | null
          id?: never
          profile_id: string
        }
        Update: {
          enrollment_date?: string | null
          id?: never
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_profile"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      test_scores: {
        Row: {
          created_at: string | null
          date_taken: string | null
          document_url: string | null
          id: string
          score: string
          test_name: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          date_taken?: string | null
          document_url?: string | null
          id?: string
          score: string
          test_name: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          date_taken?: string | null
          document_url?: string | null
          id?: string
          score?: string
          test_name?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "test_scores_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      views: {
        Row: {
          id: string
          item_data: Json | null
          item_id: string
          item_type: string
          user_id: string | null
          viewed_at: string | null
        }
        Insert: {
          id?: string
          item_data?: Json | null
          item_id: string
          item_type: string
          user_id?: string | null
          viewed_at?: string | null
        }
        Update: {
          id?: string
          item_data?: Json | null
          item_id?: string
          item_type?: string
          user_id?: string | null
          viewed_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      send_signup_email: {
        Args: Record<PropertyKey, never> | { user_email: string }
        Returns: undefined
      }
      trigger_password_reset: {
        Args: { user_email: string }
        Returns: undefined
      }
    }
    Enums: {
      payment_status: "pending" | "partial" | "completed" | "overdue"
      service_type:
        | "university_application"
        | "visa_assistance"
        | "accommodation"
        | "scholarship"
        | "language_support"
        | "travel_booking"
      visa_status:
        | "not_applied"
        | "applied"
        | "approved"
        | "rejected"
        | "received"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      payment_status: ["pending", "partial", "completed", "overdue"],
      service_type: [
        "university_application",
        "visa_assistance",
        "accommodation",
        "scholarship",
        "language_support",
        "travel_booking",
      ],
      visa_status: [
        "not_applied",
        "applied",
        "approved",
        "rejected",
        "received",
      ],
    },
  },
} as const
