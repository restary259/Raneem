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
      accommodations: {
        Row: {
          created_at: string
          currency: string
          description: string | null
          id: string
          is_active: boolean
          name_ar: string
          name_en: string
          photos: string[] | null
          price: number | null
          school_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name_ar: string
          name_en: string
          photos?: string[] | null
          price?: number | null
          school_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name_ar?: string
          name_en?: string
          photos?: string[] | null
          price?: number | null
          school_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "accommodations_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      active_sessions: {
        Row: {
          created_at: string
          ip_address: string | null
          session_id: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          ip_address?: string | null
          session_id: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          ip_address?: string | null
          session_id?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      activity_log: {
        Row: {
          action: string
          actor_id: string | null
          actor_name: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          metadata: Json | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_name?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          metadata?: Json | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_name?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          metadata?: Json | null
        }
        Relationships: []
      }
      admin_audit_log: {
        Row: {
          action: string
          admin_id: string | null
          created_at: string
          details: string | null
          id: string
          target_id: string | null
          target_table: string | null
        }
        Insert: {
          action: string
          admin_id?: string | null
          created_at?: string
          details?: string | null
          id?: string
          target_id?: string | null
          target_table?: string | null
        }
        Update: {
          action?: string
          admin_id?: string | null
          created_at?: string
          details?: string | null
          id?: string
          target_id?: string | null
          target_table?: string | null
        }
        Relationships: []
      }
      admin_security_sessions: {
        Row: {
          admin_id: string
          expires_at: string
          id: string
          verified_at: string
        }
        Insert: {
          admin_id: string
          expires_at?: string
          id?: string
          verified_at?: string
        }
        Update: {
          admin_id?: string
          expires_at?: string
          id?: string
          verified_at?: string
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
      appointments: {
        Row: {
          case_id: string | null
          created_at: string
          duration_minutes: number
          guest_name: string | null
          id: string
          notes: string | null
          outcome: string | null
          outcome_notes: string | null
          outcome_recorded_at: string | null
          outcome_recorded_by: string | null
          rescheduled_to: string | null
          scheduled_at: string
          team_member_id: string
          updated_at: string
        }
        Insert: {
          case_id?: string | null
          created_at?: string
          duration_minutes?: number
          guest_name?: string | null
          id?: string
          notes?: string | null
          outcome?: string | null
          outcome_notes?: string | null
          outcome_recorded_at?: string | null
          outcome_recorded_by?: string | null
          rescheduled_to?: string | null
          scheduled_at: string
          team_member_id: string
          updated_at?: string
        }
        Update: {
          case_id?: string | null
          created_at?: string
          duration_minutes?: number
          guest_name?: string | null
          id?: string
          notes?: string | null
          outcome?: string | null
          outcome_notes?: string | null
          outcome_recorded_at?: string | null
          outcome_recorded_by?: string | null
          rescheduled_to?: string | null
          scheduled_at?: string
          team_member_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_rescheduled_to_fkey"
            columns: ["rescheduled_to"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
        ]
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
      case_service_snapshots: {
        Row: {
          case_id: string
          created_at: string
          currency: string
          id: string
          influencer_commission_type: string
          influencer_commission_value: number
          master_service_id: string
          payment_status: string
          refundable: boolean
          sale_price: number
          service_name: string
          team_commission_type: string
          team_commission_value: number
        }
        Insert: {
          case_id: string
          created_at?: string
          currency?: string
          id?: string
          influencer_commission_type?: string
          influencer_commission_value?: number
          master_service_id: string
          payment_status?: string
          refundable?: boolean
          sale_price?: number
          service_name: string
          team_commission_type?: string
          team_commission_value?: number
        }
        Update: {
          case_id?: string
          created_at?: string
          currency?: string
          id?: string
          influencer_commission_type?: string
          influencer_commission_value?: number
          master_service_id?: string
          payment_status?: string
          refundable?: boolean
          sale_price?: number
          service_name?: string
          team_commission_type?: string
          team_commission_value?: number
        }
        Relationships: [
          {
            foreignKeyName: "case_service_snapshots_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "student_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_service_snapshots_master_service_id_fkey"
            columns: ["master_service_id"]
            isOneToOne: false
            referencedRelation: "master_services"
            referencedColumns: ["id"]
          },
        ]
      }
      case_submissions: {
        Row: {
          accommodation_id: string | null
          accommodation_price: number
          case_id: string
          created_at: string
          deleted_at: string | null
          enrollment_paid_at: string | null
          enrollment_paid_by: string | null
          extra_data: Json | null
          id: string
          insurance_id: string | null
          insurance_price: number
          payment_confirmed: boolean
          payment_confirmed_at: string | null
          payment_confirmed_by: string | null
          program_end_date: string | null
          program_id: string | null
          program_price: number
          program_start_date: string | null
          remaining_balance: number
          service_fee: number
          submitted_at: string | null
          submitted_by: string | null
          total_paid: number
          translation_fee: number
          updated_at: string
        }
        Insert: {
          accommodation_id?: string | null
          accommodation_price?: number
          case_id: string
          created_at?: string
          deleted_at?: string | null
          enrollment_paid_at?: string | null
          enrollment_paid_by?: string | null
          extra_data?: Json | null
          id?: string
          insurance_id?: string | null
          insurance_price?: number
          payment_confirmed?: boolean
          payment_confirmed_at?: string | null
          payment_confirmed_by?: string | null
          program_end_date?: string | null
          program_id?: string | null
          program_price?: number
          program_start_date?: string | null
          remaining_balance?: number
          service_fee?: number
          submitted_at?: string | null
          submitted_by?: string | null
          total_paid?: number
          translation_fee?: number
          updated_at?: string
        }
        Update: {
          accommodation_id?: string | null
          accommodation_price?: number
          case_id?: string
          created_at?: string
          deleted_at?: string | null
          enrollment_paid_at?: string | null
          enrollment_paid_by?: string | null
          extra_data?: Json | null
          id?: string
          insurance_id?: string | null
          insurance_price?: number
          payment_confirmed?: boolean
          payment_confirmed_at?: string | null
          payment_confirmed_by?: string | null
          program_end_date?: string | null
          program_id?: string | null
          program_price?: number
          program_start_date?: string | null
          remaining_balance?: number
          service_fee?: number
          submitted_at?: string | null
          submitted_by?: string | null
          total_paid?: number
          translation_fee?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_submissions_accommodation_id_fkey"
            columns: ["accommodation_id"]
            isOneToOne: false
            referencedRelation: "accommodations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_submissions_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: true
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_submissions_insurance_id_fkey"
            columns: ["insurance_id"]
            isOneToOne: false
            referencedRelation: "insurances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_submissions_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      cases: {
        Row: {
          assigned_to: string | null
          bagrut_score: number | null
          city: string | null
          created_at: string
          created_by_team: boolean
          degree_interest: string | null
          deleted_at: string | null
          discount_amount: number
          education_level: string | null
          english_level: string | null
          english_units: number | null
          full_name: string
          id: string
          intake_notes: string | null
          is_no_show: boolean
          last_activity_at: string
          math_units: number | null
          origin: string | null
          partner_id: string | null
          passport_type: string | null
          phone_number: string
          referred_by: string | null
          source: string
          status: string
          student_user_id: string | null
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          bagrut_score?: number | null
          city?: string | null
          created_at?: string
          created_by_team?: boolean
          degree_interest?: string | null
          deleted_at?: string | null
          discount_amount?: number
          education_level?: string | null
          english_level?: string | null
          english_units?: number | null
          full_name: string
          id?: string
          intake_notes?: string | null
          is_no_show?: boolean
          last_activity_at?: string
          math_units?: number | null
          origin?: string | null
          partner_id?: string | null
          passport_type?: string | null
          phone_number: string
          referred_by?: string | null
          source?: string
          status?: string
          student_user_id?: string | null
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          bagrut_score?: number | null
          city?: string | null
          created_at?: string
          created_by_team?: boolean
          degree_interest?: string | null
          deleted_at?: string | null
          discount_amount?: number
          education_level?: string | null
          english_level?: string | null
          english_units?: number | null
          full_name?: string
          id?: string
          intake_notes?: string | null
          is_no_show?: boolean
          last_activity_at?: string
          math_units?: number | null
          origin?: string | null
          partner_id?: string | null
          passport_type?: string | null
          phone_number?: string
          referred_by?: string | null
          source?: string
          status?: string
          student_user_id?: string | null
          updated_at?: string
        }
        Relationships: []
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
      commission_tiers: {
        Row: {
          base_amount: number
          created_at: string
          description: string | null
          id: number
          max_students: number | null
          min_students: number
          percentage: number
        }
        Insert: {
          base_amount?: number
          created_at?: string
          description?: string | null
          id?: number
          max_students?: number | null
          min_students: number
          percentage: number
        }
        Update: {
          base_amount?: number
          created_at?: string
          description?: string | null
          id?: number
          max_students?: number | null
          min_students?: number
          percentage?: number
        }
        Relationships: []
      }
      commission_transactions: {
        Row: {
          case_id: string
          created_at: string
          id: string
          partner_commission_ils: number
          partner_id: string | null
          platform_revenue_ils: number
          team_member_commission_ils: number
          team_member_id: string | null
          total_payment_ils: number
        }
        Insert: {
          case_id: string
          created_at?: string
          id?: string
          partner_commission_ils?: number
          partner_id?: string | null
          platform_revenue_ils?: number
          team_member_commission_ils?: number
          team_member_id?: string | null
          total_payment_ils?: number
        }
        Update: {
          case_id?: string
          created_at?: string
          id?: string
          partner_commission_ils?: number
          partner_id?: string | null
          platform_revenue_ils?: number
          team_member_commission_ils?: number
          team_member_id?: string | null
          total_payment_ils?: number
        }
        Relationships: [
          {
            foreignKeyName: "commission_transactions_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: true
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
        ]
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
      deletion_logs: {
        Row: {
          categories: string[]
          deleted_at: string
          deleted_by: string
          id: string
          mode: string
          restored_at: string | null
          restored_by: string | null
          snapshot_json: Json | null
          target_id: string
          target_type: string
        }
        Insert: {
          categories?: string[]
          deleted_at?: string
          deleted_by: string
          id?: string
          mode?: string
          restored_at?: string | null
          restored_by?: string | null
          snapshot_json?: Json | null
          target_id: string
          target_type: string
        }
        Update: {
          categories?: string[]
          deleted_at?: string
          deleted_by?: string
          id?: string
          mode?: string
          restored_at?: string | null
          restored_by?: string | null
          snapshot_json?: Json | null
          target_id?: string
          target_type?: string
        }
        Relationships: []
      }
      documents: {
        Row: {
          case_id: string | null
          category: string
          created_at: string
          deleted_at: string | null
          expiry_date: string | null
          file_name: string
          file_size: number | null
          file_type: string | null
          file_url: string
          id: string
          is_visible_to_student: boolean
          notes: string | null
          service_id: string | null
          student_id: string
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          case_id?: string | null
          category?: string
          created_at?: string
          deleted_at?: string | null
          expiry_date?: string | null
          file_name: string
          file_size?: number | null
          file_type?: string | null
          file_url: string
          id?: string
          is_visible_to_student?: boolean
          notes?: string | null
          service_id?: string | null
          student_id: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          case_id?: string | null
          category?: string
          created_at?: string
          deleted_at?: string | null
          expiry_date?: string | null
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          id?: string
          is_visible_to_student?: boolean
          notes?: string | null
          service_id?: string | null
          student_id?: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      eligibility_config: {
        Row: {
          created_at: string
          field_name: string
          id: string
          is_active: boolean
          label: string
          updated_at: string
          weight: number
        }
        Insert: {
          created_at?: string
          field_name: string
          id?: string
          is_active?: boolean
          label?: string
          updated_at?: string
          weight?: number
        }
        Update: {
          created_at?: string
          field_name?: string
          id?: string
          is_active?: boolean
          label?: string
          updated_at?: string
          weight?: number
        }
        Relationships: []
      }
      eligibility_thresholds: {
        Row: {
          eligible_min: number
          id: string
          review_min: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          eligible_min?: number
          id?: string
          review_min?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          eligible_min?: number
          id?: string
          review_min?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      important_contacts: {
        Row: {
          category: string
          created_at: string
          display_order: number
          email: string | null
          id: string
          is_active: boolean
          link: string | null
          name_ar: string
          name_en: string
          phone: string | null
          role_ar: string | null
          role_en: string | null
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          display_order?: number
          email?: string | null
          id?: string
          is_active?: boolean
          link?: string | null
          name_ar: string
          name_en: string
          phone?: string | null
          role_ar?: string | null
          role_en?: string | null
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          display_order?: number
          email?: string | null
          id?: string
          is_active?: boolean
          link?: string | null
          name_ar?: string
          name_en?: string
          phone?: string | null
          role_ar?: string | null
          role_en?: string | null
          updated_at?: string
        }
        Relationships: []
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
      insurances: {
        Row: {
          created_at: string
          currency: string
          id: string
          is_active: boolean
          name: string
          price: number
          tier: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency?: string
          id?: string
          is_active?: boolean
          name: string
          price?: number
          tier?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: string
          id?: string
          is_active?: boolean
          name?: string
          price?: number
          tier?: string
          updated_at?: string
        }
        Relationships: []
      }
      leads: {
        Row: {
          accommodation: boolean
          age: number | null
          arab48_flag: boolean
          budget_range: string | null
          city: string | null
          companion_lead_id: string | null
          created_at: string
          deleted_at: string | null
          education_level: string | null
          eligibility_reason: string | null
          eligibility_score: number | null
          email: string | null
          english_units: number | null
          fraud_flags: string[] | null
          full_name: string
          german_level: string | null
          id: string
          is_stale: boolean | null
          last_contacted: string | null
          math_units: number | null
          notes: string | null
          passport_type: string | null
          phone: string
          preferred_city: string | null
          preferred_major: string | null
          ref_code: string | null
          service_requested: string | null
          source_id: string | null
          source_type: string
          status: string
          student_portal_created: boolean
          study_destination: string | null
          visa_history: string | null
        }
        Insert: {
          accommodation?: boolean
          age?: number | null
          arab48_flag?: boolean
          budget_range?: string | null
          city?: string | null
          companion_lead_id?: string | null
          created_at?: string
          deleted_at?: string | null
          education_level?: string | null
          eligibility_reason?: string | null
          eligibility_score?: number | null
          email?: string | null
          english_units?: number | null
          fraud_flags?: string[] | null
          full_name: string
          german_level?: string | null
          id?: string
          is_stale?: boolean | null
          last_contacted?: string | null
          math_units?: number | null
          notes?: string | null
          passport_type?: string | null
          phone: string
          preferred_city?: string | null
          preferred_major?: string | null
          ref_code?: string | null
          service_requested?: string | null
          source_id?: string | null
          source_type?: string
          status?: string
          student_portal_created?: boolean
          study_destination?: string | null
          visa_history?: string | null
        }
        Update: {
          accommodation?: boolean
          age?: number | null
          arab48_flag?: boolean
          budget_range?: string | null
          city?: string | null
          companion_lead_id?: string | null
          created_at?: string
          deleted_at?: string | null
          education_level?: string | null
          eligibility_reason?: string | null
          eligibility_score?: number | null
          email?: string | null
          english_units?: number | null
          fraud_flags?: string[] | null
          full_name?: string
          german_level?: string | null
          id?: string
          is_stale?: boolean | null
          last_contacted?: string | null
          math_units?: number | null
          notes?: string | null
          passport_type?: string | null
          phone?: string
          preferred_city?: string | null
          preferred_major?: string | null
          ref_code?: string | null
          service_requested?: string | null
          source_id?: string | null
          source_type?: string
          status?: string
          student_portal_created?: boolean
          study_destination?: string | null
          visa_history?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_companion_lead_id_fkey"
            columns: ["companion_lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_companion_lead_id_fkey"
            columns: ["companion_lead_id"]
            isOneToOne: false
            referencedRelation: "leads_lawyer_safe"
            referencedColumns: ["id"]
          },
        ]
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
      major_categories: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          sort_order: number
          title_ar: string
          title_en: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          sort_order?: number
          title_ar: string
          title_en: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          sort_order?: number
          title_ar?: string
          title_en?: string
          updated_at?: string
        }
        Relationships: []
      }
      majors: {
        Row: {
          arab48_notes_ar: string | null
          arab48_notes_en: string | null
          career_opportunities_ar: string | null
          career_opportunities_en: string | null
          career_prospects_ar: string | null
          career_prospects_en: string | null
          category_id: string
          created_at: string
          description_ar: string | null
          description_en: string | null
          detailed_description_ar: string | null
          detailed_description_en: string | null
          duration_ar: string | null
          duration_en: string | null
          id: string
          is_active: boolean
          language_requirements_ar: string | null
          language_requirements_en: string | null
          name_ar: string
          name_de: string | null
          name_en: string
          required_background_ar: string | null
          required_background_en: string | null
          requirements_ar: string | null
          requirements_en: string | null
          sort_order: number
          suitable_for_ar: string | null
          suitable_for_en: string | null
          updated_at: string
        }
        Insert: {
          arab48_notes_ar?: string | null
          arab48_notes_en?: string | null
          career_opportunities_ar?: string | null
          career_opportunities_en?: string | null
          career_prospects_ar?: string | null
          career_prospects_en?: string | null
          category_id: string
          created_at?: string
          description_ar?: string | null
          description_en?: string | null
          detailed_description_ar?: string | null
          detailed_description_en?: string | null
          duration_ar?: string | null
          duration_en?: string | null
          id?: string
          is_active?: boolean
          language_requirements_ar?: string | null
          language_requirements_en?: string | null
          name_ar: string
          name_de?: string | null
          name_en: string
          required_background_ar?: string | null
          required_background_en?: string | null
          requirements_ar?: string | null
          requirements_en?: string | null
          sort_order?: number
          suitable_for_ar?: string | null
          suitable_for_en?: string | null
          updated_at?: string
        }
        Update: {
          arab48_notes_ar?: string | null
          arab48_notes_en?: string | null
          career_opportunities_ar?: string | null
          career_opportunities_en?: string | null
          career_prospects_ar?: string | null
          career_prospects_en?: string | null
          category_id?: string
          created_at?: string
          description_ar?: string | null
          description_en?: string | null
          detailed_description_ar?: string | null
          detailed_description_en?: string | null
          duration_ar?: string | null
          duration_en?: string | null
          id?: string
          is_active?: boolean
          language_requirements_ar?: string | null
          language_requirements_en?: string | null
          name_ar?: string
          name_de?: string | null
          name_en?: string
          required_background_ar?: string | null
          required_background_en?: string | null
          requirements_ar?: string | null
          requirements_en?: string | null
          sort_order?: number
          suitable_for_ar?: string | null
          suitable_for_en?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "majors_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "major_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      master_services: {
        Row: {
          commission_eligible: boolean
          created_at: string
          currency: string
          id: string
          influencer_commission_type: string
          influencer_commission_value: number
          internal_cost: number | null
          is_active: boolean
          refundable: boolean
          requires_document_upload: boolean
          sale_price: number
          service_name: string
          sort_order: number
          team_commission_type: string
          team_commission_value: number
          updated_at: string
        }
        Insert: {
          commission_eligible?: boolean
          created_at?: string
          currency?: string
          id?: string
          influencer_commission_type?: string
          influencer_commission_value?: number
          internal_cost?: number | null
          is_active?: boolean
          refundable?: boolean
          requires_document_upload?: boolean
          sale_price?: number
          service_name: string
          sort_order?: number
          team_commission_type?: string
          team_commission_value?: number
          updated_at?: string
        }
        Update: {
          commission_eligible?: boolean
          created_at?: string
          currency?: string
          id?: string
          influencer_commission_type?: string
          influencer_commission_value?: number
          internal_cost?: number | null
          is_active?: boolean
          refundable?: boolean
          requires_document_upload?: boolean
          sale_price?: number
          service_name?: string
          sort_order?: number
          team_commission_type?: string
          team_commission_value?: number
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string
          body_ar: string | null
          body_en: string | null
          case_id: string | null
          created_at: string
          id: string
          is_read: boolean
          link: string | null
          metadata: Json
          read: boolean
          source: string
          title: string
          title_ar: string | null
          title_en: string | null
          user_id: string
        }
        Insert: {
          body: string
          body_ar?: string | null
          body_en?: string | null
          case_id?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          metadata?: Json
          read?: boolean
          source?: string
          title: string
          title_ar?: string | null
          title_en?: string | null
          user_id: string
        }
        Update: {
          body?: string
          body_ar?: string | null
          body_en?: string | null
          case_id?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          metadata?: Json
          read?: boolean
          source?: string
          title?: string
          title_ar?: string | null
          title_en?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_commission_overrides: {
        Row: {
          commission_amount: number
          created_at: string
          id: string
          notes: string | null
          partner_id: string
          show_all_cases: boolean | null
          updated_at: string
        }
        Insert: {
          commission_amount?: number
          created_at?: string
          id?: string
          notes?: string | null
          partner_id: string
          show_all_cases?: boolean | null
          updated_at?: string
        }
        Update: {
          commission_amount?: number
          created_at?: string
          id?: string
          notes?: string | null
          partner_id?: string
          show_all_cases?: boolean | null
          updated_at?: string
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
      payout_requests: {
        Row: {
          admin_notes: string | null
          amount: number
          approved_at: string | null
          approved_by: string | null
          id: string
          linked_reward_ids: string[]
          linked_student_names: string[] | null
          paid_at: string | null
          paid_by: string | null
          payment_method: string | null
          reject_reason: string | null
          requested_at: string
          requestor_id: string
          requestor_role: string
          status: string
          transaction_ref: string | null
        }
        Insert: {
          admin_notes?: string | null
          amount?: number
          approved_at?: string | null
          approved_by?: string | null
          id?: string
          linked_reward_ids?: string[]
          linked_student_names?: string[] | null
          paid_at?: string | null
          paid_by?: string | null
          payment_method?: string | null
          reject_reason?: string | null
          requested_at?: string
          requestor_id: string
          requestor_role?: string
          status?: string
          transaction_ref?: string | null
        }
        Update: {
          admin_notes?: string | null
          amount?: number
          approved_at?: string | null
          approved_by?: string | null
          id?: string
          linked_reward_ids?: string[]
          linked_student_names?: string[] | null
          paid_at?: string | null
          paid_by?: string | null
          payment_method?: string | null
          reject_reason?: string | null
          requested_at?: string
          requestor_id?: string
          requestor_role?: string
          status?: string
          transaction_ref?: string | null
        }
        Relationships: []
      }
      platform_settings: {
        Row: {
          forgotten_contacted_days: number
          forgotten_new_case_days: number
          id: string
          partner_commission_rate: number
          partner_dashboard_show_all_cases: boolean
          team_member_commission_rate: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          forgotten_contacted_days?: number
          forgotten_new_case_days?: number
          id?: string
          partner_commission_rate?: number
          partner_dashboard_show_all_cases?: boolean
          team_member_commission_rate?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          forgotten_contacted_days?: number
          forgotten_new_case_days?: number
          id?: string
          partner_commission_rate?: number
          partner_dashboard_show_all_cases?: boolean
          team_member_commission_rate?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          arrival_date: string | null
          bank_account_number: string | null
          bank_branch: string | null
          bank_name: string | null
          biometric_photo_url: string | null
          case_id: string | null
          city: string | null
          commission_amount: number
          consent_accepted_at: string | null
          consent_version: string | null
          country: string | null
          created_at: string
          created_by: string | null
          criminal_record_details: string | null
          date_of_birth: string | null
          deleted_at: string | null
          email: string
          emergency_contact: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          eye_color: string | null
          full_name: string
          gender: string | null
          has_changed_legal_name: boolean
          has_criminal_record: boolean
          has_dual_citizenship: boolean
          iban: string | null
          iban_confirmed_at: string | null
          id: string
          influencer_id: string | null
          intake_month: string | null
          linked_case_id: string | null
          must_change_password: boolean
          nationality: string | null
          notes: string | null
          passport_expiry: string | null
          passport_number: string | null
          phone_number: string | null
          previous_legal_name: string | null
          second_passport_country: string | null
          student_status: string
          university_name: string | null
          updated_at: string
          updated_by_student_at: string | null
          visa_status: string
        }
        Insert: {
          arrival_date?: string | null
          bank_account_number?: string | null
          bank_branch?: string | null
          bank_name?: string | null
          biometric_photo_url?: string | null
          case_id?: string | null
          city?: string | null
          commission_amount?: number
          consent_accepted_at?: string | null
          consent_version?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          criminal_record_details?: string | null
          date_of_birth?: string | null
          deleted_at?: string | null
          email?: string
          emergency_contact?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          eye_color?: string | null
          full_name?: string
          gender?: string | null
          has_changed_legal_name?: boolean
          has_criminal_record?: boolean
          has_dual_citizenship?: boolean
          iban?: string | null
          iban_confirmed_at?: string | null
          id: string
          influencer_id?: string | null
          intake_month?: string | null
          linked_case_id?: string | null
          must_change_password?: boolean
          nationality?: string | null
          notes?: string | null
          passport_expiry?: string | null
          passport_number?: string | null
          phone_number?: string | null
          previous_legal_name?: string | null
          second_passport_country?: string | null
          student_status?: string
          university_name?: string | null
          updated_at?: string
          updated_by_student_at?: string | null
          visa_status?: string
        }
        Update: {
          arrival_date?: string | null
          bank_account_number?: string | null
          bank_branch?: string | null
          bank_name?: string | null
          biometric_photo_url?: string | null
          case_id?: string | null
          city?: string | null
          commission_amount?: number
          consent_accepted_at?: string | null
          consent_version?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          criminal_record_details?: string | null
          date_of_birth?: string | null
          deleted_at?: string | null
          email?: string
          emergency_contact?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          eye_color?: string | null
          full_name?: string
          gender?: string | null
          has_changed_legal_name?: boolean
          has_criminal_record?: boolean
          has_dual_citizenship?: boolean
          iban?: string | null
          iban_confirmed_at?: string | null
          id?: string
          influencer_id?: string | null
          intake_month?: string | null
          linked_case_id?: string | null
          must_change_password?: boolean
          nationality?: string | null
          notes?: string | null
          passport_expiry?: string | null
          passport_number?: string | null
          phone_number?: string | null
          previous_legal_name?: string | null
          second_passport_country?: string | null
          student_status?: string
          university_name?: string | null
          updated_at?: string
          updated_by_student_at?: string | null
          visa_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_linked_case_id_fkey"
            columns: ["linked_case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
        ]
      }
      programs: {
        Row: {
          created_at: string
          currency: string
          description: string | null
          duration: string | null
          duration_in_months: number | null
          fixed_start_day_of_month: number | null
          id: string
          is_active: boolean
          lessons_per_week: number | null
          name_ar: string
          name_en: string
          price: number | null
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency?: string
          description?: string | null
          duration?: string | null
          duration_in_months?: number | null
          fixed_start_day_of_month?: number | null
          id?: string
          is_active?: boolean
          lessons_per_week?: number | null
          name_ar: string
          name_en: string
          price?: number | null
          type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: string
          description?: string | null
          duration?: string | null
          duration_in_months?: number | null
          fixed_start_day_of_month?: number | null
          id?: string
          is_active?: boolean
          lessons_per_week?: number | null
          name_ar?: string
          name_en?: string
          price?: number | null
          type?: string
          updated_at?: string
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
          discount_applied: boolean
          id: string
          referred_case_id: string | null
          referred_name: string
          referred_phone: string
          referrer_user_id: string
        }
        Insert: {
          created_at?: string
          discount_applied?: boolean
          id?: string
          referred_case_id?: string | null
          referred_name: string
          referred_phone: string
          referrer_user_id: string
        }
        Update: {
          created_at?: string
          discount_applied?: boolean
          id?: string
          referred_case_id?: string | null
          referred_name?: string
          referred_phone?: string
          referrer_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "referrals_referred_case_id_fkey"
            columns: ["referred_case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: []
      }
      schools: {
        Row: {
          city: string | null
          country: string | null
          created_at: string
          id: string
          is_active: boolean
          name_ar: string
          name_en: string
          updated_at: string
        }
        Insert: {
          city?: string | null
          country?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name_ar: string
          name_en: string
          updated_at?: string
        }
        Update: {
          city?: string | null
          country?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name_ar?: string
          name_en?: string
          updated_at?: string
        }
        Relationships: []
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
          admin_notes: string | null
          assigned_at: string | null
          assigned_lawyer_id: string | null
          case_status: string
          commission_created: boolean | null
          country_of_birth: string | null
          created_at: string
          deleted_at: string | null
          fraud_flagged: boolean | null
          fraud_notes: string | null
          gender: string | null
          has_translation_service: boolean
          housing_description: string | null
          id: string
          influencer_commission: number
          intensive_course: string | null
          is_paid_admin: boolean | null
          language_proficiency: string | null
          lawyer_commission: number
          lead_id: string
          nationality: string | null
          notes: string | null
          paid_at: string | null
          paid_countdown_started_at: string | null
          passport_number: string | null
          reassigned_from: string | null
          reassignment_history: Json | null
          reassignment_notes: string | null
          referral_discount: number
          refund_status: string | null
          requires_reassignment: boolean | null
          school_commission: number
          selected_city: string | null
          selected_school: string | null
          service_fee: number
          student_address: string | null
          student_age: number | null
          student_email: string | null
          student_full_name: string | null
          student_phone: string | null
          student_profile_id: string | null
          submitted_to_admin_at: string | null
          translation_added_by_user_id: string | null
          translation_fee: number
          updated_at: string
        }
        Insert: {
          accommodation_status?: string | null
          admin_notes?: string | null
          assigned_at?: string | null
          assigned_lawyer_id?: string | null
          case_status?: string
          commission_created?: boolean | null
          country_of_birth?: string | null
          created_at?: string
          deleted_at?: string | null
          fraud_flagged?: boolean | null
          fraud_notes?: string | null
          gender?: string | null
          has_translation_service?: boolean
          housing_description?: string | null
          id?: string
          influencer_commission?: number
          intensive_course?: string | null
          is_paid_admin?: boolean | null
          language_proficiency?: string | null
          lawyer_commission?: number
          lead_id: string
          nationality?: string | null
          notes?: string | null
          paid_at?: string | null
          paid_countdown_started_at?: string | null
          passport_number?: string | null
          reassigned_from?: string | null
          reassignment_history?: Json | null
          reassignment_notes?: string | null
          referral_discount?: number
          refund_status?: string | null
          requires_reassignment?: boolean | null
          school_commission?: number
          selected_city?: string | null
          selected_school?: string | null
          service_fee?: number
          student_address?: string | null
          student_age?: number | null
          student_email?: string | null
          student_full_name?: string | null
          student_phone?: string | null
          student_profile_id?: string | null
          submitted_to_admin_at?: string | null
          translation_added_by_user_id?: string | null
          translation_fee?: number
          updated_at?: string
        }
        Update: {
          accommodation_status?: string | null
          admin_notes?: string | null
          assigned_at?: string | null
          assigned_lawyer_id?: string | null
          case_status?: string
          commission_created?: boolean | null
          country_of_birth?: string | null
          created_at?: string
          deleted_at?: string | null
          fraud_flagged?: boolean | null
          fraud_notes?: string | null
          gender?: string | null
          has_translation_service?: boolean
          housing_description?: string | null
          id?: string
          influencer_commission?: number
          intensive_course?: string | null
          is_paid_admin?: boolean | null
          language_proficiency?: string | null
          lawyer_commission?: number
          lead_id?: string
          nationality?: string | null
          notes?: string | null
          paid_at?: string | null
          paid_countdown_started_at?: string | null
          passport_number?: string | null
          reassigned_from?: string | null
          reassignment_history?: Json | null
          reassignment_notes?: string | null
          referral_discount?: number
          refund_status?: string | null
          requires_reassignment?: boolean | null
          school_commission?: number
          selected_city?: string | null
          selected_school?: string | null
          service_fee?: number
          student_address?: string | null
          student_age?: number | null
          student_email?: string | null
          student_full_name?: string | null
          student_phone?: string | null
          student_profile_id?: string | null
          submitted_to_admin_at?: string | null
          translation_added_by_user_id?: string | null
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
          {
            foreignKeyName: "student_cases_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads_lawyer_safe"
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
      team_member_commission_overrides: {
        Row: {
          commission_amount: number
          created_at: string
          id: string
          notes: string | null
          team_member_id: string
          updated_at: string
        }
        Insert: {
          commission_amount?: number
          created_at?: string
          id?: string
          notes?: string | null
          team_member_id: string
          updated_at?: string
        }
        Update: {
          commission_amount?: number
          created_at?: string
          id?: string
          notes?: string | null
          team_member_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      transaction_log: {
        Row: {
          amount: number
          approved_by: string | null
          created_at: string
          currency: string | null
          exchange_rate: number | null
          id: string
          notes: string | null
          payment_method: string | null
          payout_request_id: string | null
          related_student_ids: string[] | null
          transaction_ref: string | null
          type: string
        }
        Insert: {
          amount?: number
          approved_by?: string | null
          created_at?: string
          currency?: string | null
          exchange_rate?: number | null
          id?: string
          notes?: string | null
          payment_method?: string | null
          payout_request_id?: string | null
          related_student_ids?: string[] | null
          transaction_ref?: string | null
          type: string
        }
        Update: {
          amount?: number
          approved_by?: string | null
          created_at?: string
          currency?: string | null
          exchange_rate?: number | null
          id?: string
          notes?: string | null
          payment_method?: string | null
          payout_request_id?: string | null
          related_student_ids?: string[] | null
          transaction_ref?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "transaction_log_payout_request_id_fkey"
            columns: ["payout_request_id"]
            isOneToOne: false
            referencedRelation: "payout_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      visa_applications: {
        Row: {
          accommodation_proof_url: string | null
          additional_notes: string | null
          address_abroad: string | null
          bank_statement_url: string | null
          case_id: string
          contact_abroad: string | null
          created_at: string
          health_insurance_url: string | null
          id: string
          student_user_id: string | null
          updated_at: string
          visa_applied_at: string | null
          visa_notes: string | null
          visa_outcome: string | null
        }
        Insert: {
          accommodation_proof_url?: string | null
          additional_notes?: string | null
          address_abroad?: string | null
          bank_statement_url?: string | null
          case_id: string
          contact_abroad?: string | null
          created_at?: string
          health_insurance_url?: string | null
          id?: string
          student_user_id?: string | null
          updated_at?: string
          visa_applied_at?: string | null
          visa_notes?: string | null
          visa_outcome?: string | null
        }
        Update: {
          accommodation_proof_url?: string | null
          additional_notes?: string | null
          address_abroad?: string | null
          bank_statement_url?: string | null
          case_id?: string
          contact_abroad?: string | null
          created_at?: string
          health_insurance_url?: string | null
          id?: string
          student_user_id?: string | null
          updated_at?: string
          visa_applied_at?: string | null
          visa_notes?: string | null
          visa_outcome?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "visa_applications_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: true
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      leads_lawyer_safe: {
        Row: {
          accommodation: boolean | null
          age: number | null
          arab48_flag: boolean | null
          budget_range: string | null
          city: string | null
          companion_lead_id: string | null
          created_at: string | null
          deleted_at: string | null
          education_level: string | null
          eligibility_reason: string | null
          eligibility_score: number | null
          english_units: number | null
          fraud_flags: string[] | null
          full_name: string | null
          german_level: string | null
          id: string | null
          is_stale: boolean | null
          last_contacted: string | null
          math_units: number | null
          notes: string | null
          passport_type: string | null
          phone: string | null
          preferred_city: string | null
          preferred_major: string | null
          ref_code: string | null
          service_requested: string | null
          source_id: string | null
          source_type: string | null
          status: string | null
          student_portal_created: boolean | null
          study_destination: string | null
          visa_history: string | null
        }
        Insert: {
          accommodation?: boolean | null
          age?: number | null
          arab48_flag?: boolean | null
          budget_range?: string | null
          city?: string | null
          companion_lead_id?: string | null
          created_at?: string | null
          deleted_at?: string | null
          education_level?: string | null
          eligibility_reason?: string | null
          eligibility_score?: number | null
          english_units?: number | null
          fraud_flags?: string[] | null
          full_name?: string | null
          german_level?: string | null
          id?: string | null
          is_stale?: boolean | null
          last_contacted?: string | null
          math_units?: number | null
          notes?: string | null
          passport_type?: string | null
          phone?: string | null
          preferred_city?: string | null
          preferred_major?: string | null
          ref_code?: string | null
          service_requested?: string | null
          source_id?: string | null
          source_type?: string | null
          status?: string | null
          student_portal_created?: boolean | null
          study_destination?: string | null
          visa_history?: string | null
        }
        Update: {
          accommodation?: boolean | null
          age?: number | null
          arab48_flag?: boolean | null
          budget_range?: string | null
          city?: string | null
          companion_lead_id?: string | null
          created_at?: string | null
          deleted_at?: string | null
          education_level?: string | null
          eligibility_reason?: string | null
          eligibility_score?: number | null
          english_units?: number | null
          fraud_flags?: string[] | null
          full_name?: string | null
          german_level?: string | null
          id?: string | null
          is_stale?: boolean | null
          last_contacted?: string | null
          math_units?: number | null
          notes?: string | null
          passport_type?: string | null
          phone?: string | null
          preferred_city?: string | null
          preferred_major?: string | null
          ref_code?: string | null
          service_requested?: string | null
          source_id?: string | null
          source_type?: string | null
          status?: string | null
          student_portal_created?: boolean | null
          study_destination?: string | null
          visa_history?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_companion_lead_id_fkey"
            columns: ["companion_lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_companion_lead_id_fkey"
            columns: ["companion_lead_id"]
            isOneToOne: false
            referencedRelation: "leads_lawyer_safe"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      get_forgotten_cases: {
        Args: never
        Returns: {
          assigned_to: string | null
          bagrut_score: number | null
          city: string | null
          created_at: string
          created_by_team: boolean
          degree_interest: string | null
          deleted_at: string | null
          discount_amount: number
          education_level: string | null
          english_level: string | null
          english_units: number | null
          full_name: string
          id: string
          intake_notes: string | null
          is_no_show: boolean
          last_activity_at: string
          math_units: number | null
          origin: string | null
          partner_id: string | null
          passport_type: string | null
          phone_number: string
          referred_by: string | null
          source: string
          status: string
          student_user_id: string | null
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "cases"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_influencer_lead_ids: {
        Args: { _influencer_id: string }
        Returns: string[]
      }
      get_influencer_tier_commission: {
        Args: { p_influencer_id: string }
        Returns: number
      }
      get_lawyer_lead_ids: { Args: { _lawyer_id: string }; Returns: string[] }
      get_my_role: { Args: never; Returns: string }
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
          p_companion_name?: string
          p_companion_phone?: string
          p_education_level?: string
          p_english_units?: number
          p_full_name: string
          p_german_level?: string
          p_math_units?: number
          p_passport_type?: string
          p_phone: string
          p_preferred_city?: string
          p_preferred_major?: string
          p_source_id?: string
          p_source_type?: string
        }
        Returns: undefined
      }
      log_activity: {
        Args: {
          p_action: string
          p_actor_id: string
          p_actor_name: string
          p_entity_id?: string
          p_entity_type: string
          p_metadata?: Json
        }
        Returns: undefined
      }
      log_user_activity: {
        Args: {
          p_action: string
          p_details?: string
          p_target_id?: string
          p_target_table?: string
        }
        Returns: undefined
      }
      record_case_commission: {
        Args: { p_case_id: string; p_total_payment_ils: number }
        Returns: Json
      }
      request_payout: {
        Args: {
          p_amount: number
          p_notes?: string
          p_payment_method?: string
          p_requestor_role?: string
          p_reward_ids: string[]
          p_student_names?: string[]
        }
        Returns: string
      }
      validate_influencer_ref: { Args: { ref_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "team_member" | "social_media_partner" | "student"
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
      app_role: ["admin", "team_member", "social_media_partner", "student"],
    },
  },
} as const
