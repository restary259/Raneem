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
          deposit: number | null
          description: string | null
          distance_note: string | null
          id: string
          is_active: boolean
          meals: string | null
          name_ar: string
          name_en: string
          photos: string[] | null
          placement_fee: number | null
          price: number | null
          price_tiers: Json
          room_type: string | null
          school_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency?: string
          deposit?: number | null
          description?: string | null
          distance_note?: string | null
          id?: string
          is_active?: boolean
          meals?: string | null
          name_ar: string
          name_en: string
          photos?: string[] | null
          placement_fee?: number | null
          price?: number | null
          price_tiers?: Json
          room_type?: string | null
          school_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: string
          deposit?: number | null
          description?: string | null
          distance_note?: string | null
          id?: string
          is_active?: boolean
          meals?: string | null
          name_ar?: string
          name_en?: string
          photos?: string[] | null
          placement_fee?: number | null
          price?: number | null
          price_tiers?: Json
          room_type?: string | null
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
      appointment_reminders: {
        Row: {
          appointment_id: string
          created_at: string
          due_at: string
          id: string
          kind: string
          recipient_id: string
          sent_at: string | null
        }
        Insert: {
          appointment_id: string
          created_at?: string
          due_at: string
          id?: string
          kind: string
          recipient_id: string
          sent_at?: string | null
        }
        Update: {
          appointment_id?: string
          created_at?: string
          due_at?: string
          id?: string
          kind?: string
          recipient_id?: string
          sent_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appointment_reminders_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
        ]
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
      auth_failure_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          is_anonymous: boolean
          operation: string | null
          path: string | null
          source: string
          status_code: string | null
          target: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          is_anonymous?: boolean
          operation?: string | null
          path?: string | null
          source?: string
          status_code?: string | null
          target: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          is_anonymous?: boolean
          operation?: string | null
          path?: string | null
          source?: string
          status_code?: string | null
          target?: string
          user_id?: string | null
        }
        Relationships: []
      }
      case_events: {
        Row: {
          actor_id: string | null
          actor_name: string | null
          actor_role: string | null
          case_id: string
          created_at: string
          event_type: string
          id: string
          is_internal: boolean
          payload: Json
        }
        Insert: {
          actor_id?: string | null
          actor_name?: string | null
          actor_role?: string | null
          case_id: string
          created_at?: string
          event_type: string
          id?: string
          is_internal?: boolean
          payload?: Json
        }
        Update: {
          actor_id?: string | null
          actor_name?: string | null
          actor_role?: string | null
          case_id?: string
          created_at?: string
          event_type?: string
          id?: string
          is_internal?: boolean
          payload?: Json
        }
        Relationships: [
          {
            foreignKeyName: "case_events_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
        ]
      }
      case_finance_confirmations: {
        Row: {
          case_id: string
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          finance_type: string
          id: string
          proof_note: string | null
          proof_reference: string | null
          status: string
          updated_at: string
        }
        Insert: {
          case_id: string
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          finance_type: string
          id?: string
          proof_note?: string | null
          proof_reference?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          case_id?: string
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          finance_type?: string
          id?: string
          proof_note?: string | null
          proof_reference?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_finance_confirmations_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
        ]
      }
      case_invoices: {
        Row: {
          case_id: string
          case_reference: string | null
          created_at: string
          email_error: string | null
          email_sent_at: string | null
          email_status: string
          id: string
          invoice_number: string
          issued_at: string
          issued_by: string | null
          public_token: string
          student_email: string | null
          student_name: string | null
          totals: Json
          updated_at: string
        }
        Insert: {
          case_id: string
          case_reference?: string | null
          created_at?: string
          email_error?: string | null
          email_sent_at?: string | null
          email_status?: string
          id?: string
          invoice_number: string
          issued_at?: string
          issued_by?: string | null
          public_token?: string
          student_email?: string | null
          student_name?: string | null
          totals?: Json
          updated_at?: string
        }
        Update: {
          case_id?: string
          case_reference?: string | null
          created_at?: string
          email_error?: string | null
          email_sent_at?: string | null
          email_status?: string
          id?: string
          invoice_number?: string
          issued_at?: string
          issued_by?: string | null
          public_token?: string
          student_email?: string | null
          student_name?: string | null
          totals?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_invoices_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: true
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
        ]
      }
      case_message_reads: {
        Row: {
          case_id: string
          id: string
          last_read_at: string
          user_id: string
        }
        Insert: {
          case_id: string
          id?: string
          last_read_at?: string
          user_id: string
        }
        Update: {
          case_id?: string
          id?: string
          last_read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_message_reads_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
        ]
      }
      case_messages: {
        Row: {
          attachments: Json
          author_id: string | null
          author_name: string | null
          author_role: string
          body: string
          case_id: string
          created_at: string
          deleted_at: string | null
          edited_at: string | null
          id: string
          kind: string
          mentions: string[]
          original_body: string | null
          request_status: string | null
          visibility: string
        }
        Insert: {
          attachments?: Json
          author_id?: string | null
          author_name?: string | null
          author_role?: string
          body: string
          case_id: string
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          kind?: string
          mentions?: string[]
          original_body?: string | null
          request_status?: string | null
          visibility?: string
        }
        Update: {
          attachments?: Json
          author_id?: string | null
          author_name?: string | null
          author_role?: string
          body?: string
          case_id?: string
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          kind?: string
          mentions?: string[]
          original_body?: string | null
          request_status?: string | null
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_messages_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
        ]
      }
      case_payment_proofs: {
        Row: {
          case_id: string
          created_at: string
          file_path: string
          id: string
          payment_id: string
          payment_type: string
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          uploaded_at: string
          uploaded_by: string
        }
        Insert: {
          case_id: string
          created_at?: string
          file_path: string
          id?: string
          payment_id: string
          payment_type: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          uploaded_at?: string
          uploaded_by: string
        }
        Update: {
          case_id?: string
          created_at?: string
          file_path?: string
          id?: string
          payment_id?: string
          payment_type?: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          uploaded_at?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_payment_proofs_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_payment_proofs_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "case_payments"
            referencedColumns: ["id"]
          },
        ]
      }
      case_payments: {
        Row: {
          amount: number
          case_id: string
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          currency: string
          id: string
          idem_key: string | null
          note: string | null
          paid_date: string | null
          paid_status: string
          payment_type: string
          recorded_by: string | null
          rejected_reason: string | null
          status: string
          submitted_at: string | null
          submitted_by: string | null
        }
        Insert: {
          amount?: number
          case_id: string
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          currency?: string
          id?: string
          idem_key?: string | null
          note?: string | null
          paid_date?: string | null
          paid_status?: string
          payment_type?: string
          recorded_by?: string | null
          rejected_reason?: string | null
          status?: string
          submitted_at?: string | null
          submitted_by?: string | null
        }
        Update: {
          amount?: number
          case_id?: string
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          currency?: string
          id?: string
          idem_key?: string | null
          note?: string | null
          paid_date?: string | null
          paid_status?: string
          payment_type?: string
          recorded_by?: string | null
          rejected_reason?: string | null
          status?: string
          submitted_at?: string | null
          submitted_by?: string | null
        }
        Relationships: []
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
            foreignKeyName: "case_service_snapshots_master_service_id_fkey"
            columns: ["master_service_id"]
            isOneToOne: false
            referencedRelation: "master_services"
            referencedColumns: ["id"]
          },
        ]
      }
      case_services: {
        Row: {
          added_by: string | null
          case_id: string
          catalog_version: number | null
          category: string
          commissionable: boolean
          created_at: string
          currency: string
          description: string
          discount: number
          id: string
          notes: string | null
          pricing_model: string
          quantity: number
          service_id: string | null
          snapshot_at: string
          unit_label: string | null
          unit_price: number
          updated_at: string
        }
        Insert: {
          added_by?: string | null
          case_id: string
          catalog_version?: number | null
          category?: string
          commissionable?: boolean
          created_at?: string
          currency?: string
          description: string
          discount?: number
          id?: string
          notes?: string | null
          pricing_model?: string
          quantity?: number
          service_id?: string | null
          snapshot_at?: string
          unit_label?: string | null
          unit_price?: number
          updated_at?: string
        }
        Update: {
          added_by?: string | null
          case_id?: string
          catalog_version?: number | null
          category?: string
          commissionable?: boolean
          created_at?: string
          currency?: string
          description?: string
          discount?: number
          id?: string
          notes?: string | null
          pricing_model?: string
          quantity?: number
          service_id?: string | null
          snapshot_at?: string
          unit_label?: string | null
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_services_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_services_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "service_catalog"
            referencedColumns: ["id"]
          },
        ]
      }
      case_submissions: {
        Row: {
          accommodation_id: string | null
          accommodation_price: number
          accommodation_weekly_price: number | null
          accommodation_weeks: number | null
          case_id: string
          created_at: string
          deleted_at: string | null
          draft_updated_at: string | null
          enrollment_paid_at: string | null
          enrollment_paid_by: string | null
          extra_data: Json | null
          id: string
          insurance_id: string | null
          insurance_price: number
          payment_confirmed: boolean
          payment_confirmed_at: string | null
          payment_confirmed_by: string | null
          profile_completed_at: string | null
          program_end_date: string | null
          program_id: string | null
          program_price: number
          program_start_date: string | null
          program_weekly_price: number | null
          program_weeks: number | null
          remaining_balance: number
          review_note: string | null
          review_status: string
          reviewed_at: string | null
          reviewed_by: string | null
          school_id: string | null
          service_fee: number
          student_email: string | null
          student_phone: string | null
          submitted_at: string | null
          submitted_by: string | null
          total_paid: number
          updated_at: string
        }
        Insert: {
          accommodation_id?: string | null
          accommodation_price?: number
          accommodation_weekly_price?: number | null
          accommodation_weeks?: number | null
          case_id: string
          created_at?: string
          deleted_at?: string | null
          draft_updated_at?: string | null
          enrollment_paid_at?: string | null
          enrollment_paid_by?: string | null
          extra_data?: Json | null
          id?: string
          insurance_id?: string | null
          insurance_price?: number
          payment_confirmed?: boolean
          payment_confirmed_at?: string | null
          payment_confirmed_by?: string | null
          profile_completed_at?: string | null
          program_end_date?: string | null
          program_id?: string | null
          program_price?: number
          program_start_date?: string | null
          program_weekly_price?: number | null
          program_weeks?: number | null
          remaining_balance?: number
          review_note?: string | null
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          school_id?: string | null
          service_fee?: number
          student_email?: string | null
          student_phone?: string | null
          submitted_at?: string | null
          submitted_by?: string | null
          total_paid?: number
          updated_at?: string
        }
        Update: {
          accommodation_id?: string | null
          accommodation_price?: number
          accommodation_weekly_price?: number | null
          accommodation_weeks?: number | null
          case_id?: string
          created_at?: string
          deleted_at?: string | null
          draft_updated_at?: string | null
          enrollment_paid_at?: string | null
          enrollment_paid_by?: string | null
          extra_data?: Json | null
          id?: string
          insurance_id?: string | null
          insurance_price?: number
          payment_confirmed?: boolean
          payment_confirmed_at?: string | null
          payment_confirmed_by?: string | null
          profile_completed_at?: string | null
          program_end_date?: string | null
          program_id?: string | null
          program_price?: number
          program_start_date?: string | null
          program_weekly_price?: number | null
          program_weeks?: number | null
          remaining_balance?: number
          review_note?: string | null
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          school_id?: string | null
          service_fee?: number
          student_email?: string | null
          student_phone?: string | null
          submitted_at?: string | null
          submitted_by?: string | null
          total_paid?: number
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
          {
            foreignKeyName: "case_submissions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      cases: {
        Row: {
          archived: boolean
          archived_at: string | null
          assigned_to: string | null
          bagrut_score: number | null
          case_reference: string | null
          city: string | null
          commission_split_done: boolean
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
          influencer_commission: number
          intake_notes: string | null
          is_no_show: boolean
          last_activity_at: string
          lawyer_commission: number
          math_units: number | null
          origin: string | null
          partner_id: string | null
          partner_link_id: string | null
          passport_type: string | null
          phone_number: string
          platform_revenue_ils: number
          referral_discount: number
          referred_by: string | null
          school_commission: number
          source: string
          source_attribution_method: string | null
          status: string
          student_user_id: string | null
          updated_at: string
        }
        Insert: {
          archived?: boolean
          archived_at?: string | null
          assigned_to?: string | null
          bagrut_score?: number | null
          case_reference?: string | null
          city?: string | null
          commission_split_done?: boolean
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
          influencer_commission?: number
          intake_notes?: string | null
          is_no_show?: boolean
          last_activity_at?: string
          lawyer_commission?: number
          math_units?: number | null
          origin?: string | null
          partner_id?: string | null
          partner_link_id?: string | null
          passport_type?: string | null
          phone_number: string
          platform_revenue_ils?: number
          referral_discount?: number
          referred_by?: string | null
          school_commission?: number
          source?: string
          source_attribution_method?: string | null
          status?: string
          student_user_id?: string | null
          updated_at?: string
        }
        Update: {
          archived?: boolean
          archived_at?: string | null
          assigned_to?: string | null
          bagrut_score?: number | null
          case_reference?: string | null
          city?: string | null
          commission_split_done?: boolean
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
          influencer_commission?: number
          intake_notes?: string | null
          is_no_show?: boolean
          last_activity_at?: string
          lawyer_commission?: number
          math_units?: number | null
          origin?: string | null
          partner_id?: string | null
          partner_link_id?: string | null
          passport_type?: string | null
          phone_number?: string
          platform_revenue_ils?: number
          referral_discount?: number
          referred_by?: string | null
          school_commission?: number
          source?: string
          source_attribution_method?: string | null
          status?: string
          student_user_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cases_partner_link_id_fkey"
            columns: ["partner_link_id"]
            isOneToOne: false
            referencedRelation: "partner_links"
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
        Relationships: []
      }
      consent_records: {
        Row: {
          created_at: string
          email: string | null
          id: string
          locale: string | null
          marketing_channels: Json
          marketing_consent: boolean
          phone: string | null
          policy_version: string
          service_contact_consent: boolean
          source_form: string
          subject_name: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          locale?: string | null
          marketing_channels?: Json
          marketing_consent?: boolean
          phone?: string | null
          policy_version: string
          service_contact_consent?: boolean
          source_form: string
          subject_name?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          locale?: string | null
          marketing_channels?: Json
          marketing_consent?: boolean
          phone?: string | null
          policy_version?: string
          service_contact_consent?: boolean
          source_form?: string
          subject_name?: string | null
          user_id?: string | null
        }
        Relationships: []
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
      data_requests: {
        Row: {
          admin_note: string | null
          created_at: string
          handled_at: string | null
          handled_by: string | null
          id: string
          message: string | null
          request_type: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_note?: string | null
          created_at?: string
          handled_at?: string | null
          handled_by?: string | null
          id?: string
          message?: string | null
          request_type: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_note?: string | null
          created_at?: string
          handled_at?: string | null
          handled_by?: string | null
          id?: string
          message?: string | null
          request_type?: string
          status?: string
          updated_at?: string
          user_id?: string
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
      direct_messages: {
        Row: {
          attachments: Json
          author_id: string | null
          author_name: string | null
          author_role: string | null
          body: string
          created_at: string
          deleted_at: string | null
          edited_at: string | null
          id: string
          kind: string
          mentions: string[]
          original_body: string | null
          payout_request_id: string | null
          request_status: string | null
          thread_id: string
        }
        Insert: {
          attachments?: Json
          author_id?: string | null
          author_name?: string | null
          author_role?: string | null
          body: string
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          kind?: string
          mentions?: string[]
          original_body?: string | null
          payout_request_id?: string | null
          request_status?: string | null
          thread_id: string
        }
        Update: {
          attachments?: Json
          author_id?: string | null
          author_name?: string | null
          author_role?: string | null
          body?: string
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          kind?: string
          mentions?: string[]
          original_body?: string | null
          payout_request_id?: string | null
          request_status?: string | null
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "direct_messages_payout_request_id_fkey"
            columns: ["payout_request_id"]
            isOneToOne: false
            referencedRelation: "payout_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "direct_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "direct_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      direct_thread_participants: {
        Row: {
          created_at: string
          id: string
          last_read_at: string | null
          thread_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_read_at?: string | null
          thread_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_read_at?: string | null
          thread_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "direct_thread_participants_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "direct_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      direct_threads: {
        Row: {
          created_at: string
          created_by: string
          id: string
          last_message_at: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          last_message_at?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          last_message_at?: string
          updated_at?: string
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
      email_send_log: {
        Row: {
          category: string
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          category?: string
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          category?: string
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          scope: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          scope?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          scope?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      important_contacts: {
        Row: {
          address_ar: string | null
          address_en: string | null
          category: string
          city: string | null
          country: string
          created_at: string
          display_order: number
          email: string | null
          id: string
          is_active: boolean
          last_verified_at: string | null
          link: string | null
          name_ar: string
          name_en: string
          phone: string | null
          role_ar: string | null
          role_en: string | null
          source_url: string | null
          updated_at: string
        }
        Insert: {
          address_ar?: string | null
          address_en?: string | null
          category?: string
          city?: string | null
          country?: string
          created_at?: string
          display_order?: number
          email?: string | null
          id?: string
          is_active?: boolean
          last_verified_at?: string | null
          link?: string | null
          name_ar: string
          name_en: string
          phone?: string | null
          role_ar?: string | null
          role_en?: string | null
          source_url?: string | null
          updated_at?: string
        }
        Update: {
          address_ar?: string | null
          address_en?: string | null
          category?: string
          city?: string | null
          country?: string
          created_at?: string
          display_order?: number
          email?: string | null
          id?: string
          is_active?: boolean
          last_verified_at?: string | null
          link?: string | null
          name_ar?: string
          name_en?: string
          phone?: string | null
          role_ar?: string | null
          role_en?: string | null
          source_url?: string | null
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
          age_price_tiers: Json
          billing_period: string
          coverage_scope: string | null
          created_at: string
          currency: string
          description_ar: string | null
          description_en: string | null
          id: string
          is_active: boolean
          max_age: number | null
          max_months: number | null
          min_months: number | null
          name: string
          price: number
          provider: string | null
          terms_url: string | null
          tier: string
          updated_at: string
          waiting_periods: Json
        }
        Insert: {
          age_price_tiers?: Json
          billing_period?: string
          coverage_scope?: string | null
          created_at?: string
          currency?: string
          description_ar?: string | null
          description_en?: string | null
          id?: string
          is_active?: boolean
          max_age?: number | null
          max_months?: number | null
          min_months?: number | null
          name: string
          price?: number
          provider?: string | null
          terms_url?: string | null
          tier?: string
          updated_at?: string
          waiting_periods?: Json
        }
        Update: {
          age_price_tiers?: Json
          billing_period?: string
          coverage_scope?: string | null
          created_at?: string
          currency?: string
          description_ar?: string | null
          description_en?: string | null
          id?: string
          is_active?: boolean
          max_age?: number | null
          max_months?: number | null
          min_months?: number | null
          name?: string
          price?: number
          provider?: string | null
          terms_url?: string | null
          tier?: string
          updated_at?: string
          waiting_periods?: Json
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
          partner_link_id: string | null
          passport_type: string | null
          phone: string
          preferred_city: string | null
          preferred_major: string | null
          ref_code: string | null
          service_requested: string | null
          source_attribution_method: string | null
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
          partner_link_id?: string | null
          passport_type?: string | null
          phone: string
          preferred_city?: string | null
          preferred_major?: string | null
          ref_code?: string | null
          service_requested?: string | null
          source_attribution_method?: string | null
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
          partner_link_id?: string | null
          passport_type?: string | null
          phone?: string
          preferred_city?: string | null
          preferred_major?: string | null
          ref_code?: string | null
          service_requested?: string | null
          source_attribution_method?: string | null
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
          {
            foreignKeyName: "leads_partner_link_id_fkey"
            columns: ["partner_link_id"]
            isOneToOne: false
            referencedRelation: "partner_links"
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
      message_thread_mutes: {
        Row: {
          created_at: string
          id: string
          thread_id: string
          thread_type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          thread_id: string
          thread_type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          thread_id?: string
          thread_type?: string
          user_id?: string
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          cat_appointments: boolean
          cat_cases: boolean
          cat_documents: boolean
          cat_messages: boolean
          cat_payments: boolean
          cat_profile: boolean
          cat_recruitment: boolean
          cat_system: boolean
          created_at: string
          email_enabled: boolean
          push_enabled: boolean
          quiet_hours_end: string | null
          quiet_hours_start: string | null
          timezone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cat_appointments?: boolean
          cat_cases?: boolean
          cat_documents?: boolean
          cat_messages?: boolean
          cat_payments?: boolean
          cat_profile?: boolean
          cat_recruitment?: boolean
          cat_system?: boolean
          created_at?: string
          email_enabled?: boolean
          push_enabled?: boolean
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          timezone?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cat_appointments?: boolean
          cat_cases?: boolean
          cat_documents?: boolean
          cat_messages?: boolean
          cat_payments?: boolean
          cat_profile?: boolean
          cat_recruitment?: boolean
          cat_system?: boolean
          created_at?: string
          email_enabled?: boolean
          push_enabled?: boolean
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          timezone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string
          body_ar: string | null
          body_en: string | null
          case_id: string | null
          category: string
          created_at: string
          dedupe_key: string | null
          id: string
          is_read: boolean
          link: string | null
          metadata: Json
          priority: string
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
          category?: string
          created_at?: string
          dedupe_key?: string | null
          id?: string
          is_read?: boolean
          link?: string | null
          metadata?: Json
          priority?: string
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
          category?: string
          created_at?: string
          dedupe_key?: string | null
          id?: string
          is_read?: boolean
          link?: string | null
          metadata?: Json
          priority?: string
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
      partner_clicks: {
        Row: {
          clicked_at: string
          id: string
          ip_hash: string | null
          partner_link_id: string
          session_id: string | null
          user_agent: string | null
        }
        Insert: {
          clicked_at?: string
          id?: string
          ip_hash?: string | null
          partner_link_id: string
          session_id?: string | null
          user_agent?: string | null
        }
        Update: {
          clicked_at?: string
          id?: string
          ip_hash?: string | null
          partner_link_id?: string
          session_id?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "partner_clicks_partner_link_id_fkey"
            columns: ["partner_link_id"]
            isOneToOne: false
            referencedRelation: "partner_links"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_commission_overrides: {
        Row: {
          commission_amount: number
          created_at: string
          id: string
          master_override_amount: number | null
          notes: string | null
          partner_id: string
          show_all_cases: boolean | null
          updated_at: string
        }
        Insert: {
          commission_amount?: number
          created_at?: string
          id?: string
          master_override_amount?: number | null
          notes?: string | null
          partner_id: string
          show_all_cases?: boolean | null
          updated_at?: string
        }
        Update: {
          commission_amount?: number
          created_at?: string
          id?: string
          master_override_amount?: number | null
          notes?: string | null
          partner_id?: string
          show_all_cases?: boolean | null
          updated_at?: string
        }
        Relationships: []
      }
      partner_links: {
        Row: {
          active: boolean
          code: string
          created_at: string
          id: string
          label: string | null
          partner_id: string
          purpose: string
          target_path: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          id?: string
          label?: string | null
          partner_id: string
          purpose?: string
          target_path?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          id?: string
          label?: string | null
          partner_id?: string
          purpose?: string
          target_path?: string
          updated_at?: string
        }
        Relationships: []
      }
      partner_rate_offers: {
        Row: {
          created_at: string
          id: string
          master_amount: number
          master_partner_id: string
          note: string | null
          offered_at: string
          partner_amount: number
          partner_id: string
          pool_amount: number
          responded_at: string | null
          status: string
          updated_at: string
          version: number
        }
        Insert: {
          created_at?: string
          id?: string
          master_amount: number
          master_partner_id: string
          note?: string | null
          offered_at?: string
          partner_amount: number
          partner_id: string
          pool_amount: number
          responded_at?: string | null
          status?: string
          updated_at?: string
          version?: number
        }
        Update: {
          created_at?: string
          id?: string
          master_amount?: number
          master_partner_id?: string
          note?: string | null
          offered_at?: string
          partner_amount?: number
          partner_id?: string
          pool_amount?: number
          responded_at?: string | null
          status?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "partner_rate_offers_master_partner_id_fkey"
            columns: ["master_partner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_rate_offers_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_recruit_applications: {
        Row: {
          city: string | null
          created_at: string
          created_user_id: string | null
          email: string
          full_name: string
          id: string
          master_partner_id: string
          note: string | null
          phone: string
          recruit_code: string
          reviewed_at: string | null
          reviewed_by: string | null
          social_link: string | null
          status: string
          updated_at: string
        }
        Insert: {
          city?: string | null
          created_at?: string
          created_user_id?: string | null
          email: string
          full_name: string
          id?: string
          master_partner_id: string
          note?: string | null
          phone: string
          recruit_code: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          social_link?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          city?: string | null
          created_at?: string
          created_user_id?: string | null
          email?: string
          full_name?: string
          id?: string
          master_partner_id?: string
          note?: string | null
          phone?: string
          recruit_code?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          social_link?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_recruit_applications_created_user_id_fkey"
            columns: ["created_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_recruit_applications_master_partner_id_fkey"
            columns: ["master_partner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_recruit_applications_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
          message_id: string | null
          paid_at: string | null
          paid_by: string | null
          payment_method: string | null
          payout_reference: string | null
          reject_reason: string | null
          requested_at: string
          requestor_id: string
          requestor_role: string
          status: string
          thread_id: string | null
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
          message_id?: string | null
          paid_at?: string | null
          paid_by?: string | null
          payment_method?: string | null
          payout_reference?: string | null
          reject_reason?: string | null
          requested_at?: string
          requestor_id: string
          requestor_role?: string
          status?: string
          thread_id?: string | null
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
          message_id?: string | null
          paid_at?: string | null
          paid_by?: string | null
          payment_method?: string | null
          payout_reference?: string | null
          reject_reason?: string | null
          requested_at?: string
          requestor_id?: string
          requestor_role?: string
          status?: string
          thread_id?: string | null
          transaction_ref?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payout_requests_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "direct_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      permissions: {
        Row: {
          category: string
          created_at: string
          id: string
          key: string
          label_ar: string
          label_en: string
        }
        Insert: {
          category?: string
          created_at?: string
          id?: string
          key: string
          label_ar: string
          label_en: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          key?: string
          label_ar?: string
          label_en?: string
        }
        Relationships: []
      }
      pipeline_statuses: {
        Row: {
          color: string
          created_at: string
          id: string
          is_active: boolean
          is_terminal: boolean
          key: string
          label_ar: string
          label_en: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_terminal?: boolean
          key: string
          label_ar: string
          label_en: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_terminal?: boolean
          key?: string
          label_ar?: string
          label_en?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      platform_settings: {
        Row: {
          ambassador_commission_rate: number
          default_course_weeks: number
          forgotten_contacted_days: number
          forgotten_new_case_days: number
          id: string
          master_partner_override_rate: number
          partner_commission_rate: number
          partner_dashboard_show_all_cases: boolean
          team_member_commission_rate: number
          updated_at: string
          updated_by: string | null
          vat_rate: number
        }
        Insert: {
          ambassador_commission_rate?: number
          default_course_weeks?: number
          forgotten_contacted_days?: number
          forgotten_new_case_days?: number
          id?: string
          master_partner_override_rate?: number
          partner_commission_rate?: number
          partner_dashboard_show_all_cases?: boolean
          team_member_commission_rate?: number
          updated_at?: string
          updated_by?: string | null
          vat_rate?: number
        }
        Update: {
          ambassador_commission_rate?: number
          default_course_weeks?: number
          forgotten_contacted_days?: number
          forgotten_new_case_days?: number
          id?: string
          master_partner_override_rate?: number
          partner_commission_rate?: number
          partner_dashboard_show_all_cases?: boolean
          team_member_commission_rate?: number
          updated_at?: string
          updated_by?: string | null
          vat_rate?: number
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
          deactivated_by: string | null
          deactivated_reason: string | null
          deleted_at: string | null
          email: string
          emergency_contact: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          emergency_contacts: Json
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
          is_manager: boolean
          is_master_partner: boolean
          linked_case_id: string | null
          master_partner_id: string | null
          must_change_password: boolean
          nationality: string | null
          notes: string | null
          notify_email: boolean
          notify_in_app: boolean
          passport_expiry: string | null
          passport_number: string | null
          phone_number: string | null
          previous_legal_name: string | null
          push_onboarding_state: string
          push_onboarding_updated_at: string | null
          referral_code: string | null
          referral_code_enabled: boolean
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
          deactivated_by?: string | null
          deactivated_reason?: string | null
          deleted_at?: string | null
          email?: string
          emergency_contact?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          emergency_contacts?: Json
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
          is_manager?: boolean
          is_master_partner?: boolean
          linked_case_id?: string | null
          master_partner_id?: string | null
          must_change_password?: boolean
          nationality?: string | null
          notes?: string | null
          notify_email?: boolean
          notify_in_app?: boolean
          passport_expiry?: string | null
          passport_number?: string | null
          phone_number?: string | null
          previous_legal_name?: string | null
          push_onboarding_state?: string
          push_onboarding_updated_at?: string | null
          referral_code?: string | null
          referral_code_enabled?: boolean
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
          deactivated_by?: string | null
          deactivated_reason?: string | null
          deleted_at?: string | null
          email?: string
          emergency_contact?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          emergency_contacts?: Json
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
          is_manager?: boolean
          is_master_partner?: boolean
          linked_case_id?: string | null
          master_partner_id?: string | null
          must_change_password?: boolean
          nationality?: string | null
          notes?: string | null
          notify_email?: boolean
          notify_in_app?: boolean
          passport_expiry?: string | null
          passport_number?: string | null
          phone_number?: string | null
          previous_legal_name?: string | null
          push_onboarding_state?: string
          push_onboarding_updated_at?: string | null
          referral_code?: string | null
          referral_code_enabled?: boolean
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
          {
            foreignKeyName: "profiles_master_partner_id_fkey"
            columns: ["master_partner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      programs: {
        Row: {
          cefr_range: string | null
          created_at: string
          currency: string
          description: string | null
          duration: string | null
          duration_in_months: number | null
          fixed_start_day_of_month: number | null
          hours_per_week: number | null
          id: string
          is_active: boolean
          lessons_per_week: number | null
          name_ar: string
          name_en: string
          price: number | null
          price_tiers: Json
          registration_fee: number | null
          school_id: string | null
          start_rule: string | null
          type: string
          updated_at: string
        }
        Insert: {
          cefr_range?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          duration?: string | null
          duration_in_months?: number | null
          fixed_start_day_of_month?: number | null
          hours_per_week?: number | null
          id?: string
          is_active?: boolean
          lessons_per_week?: number | null
          name_ar: string
          name_en: string
          price?: number | null
          price_tiers?: Json
          registration_fee?: number | null
          school_id?: string | null
          start_rule?: string | null
          type: string
          updated_at?: string
        }
        Update: {
          cefr_range?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          duration?: string | null
          duration_in_months?: number | null
          fixed_start_day_of_month?: number | null
          hours_per_week?: number | null
          id?: string
          is_active?: boolean
          lessons_per_week?: number | null
          name_ar?: string
          name_en?: string
          price?: number | null
          price_tiers?: Json
          registration_fee?: number | null
          school_id?: string | null
          start_rule?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "programs_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      push_delivery_log: {
        Row: {
          attempt: number
          created_at: string
          endpoint_hash: string | null
          error_reason: string | null
          id: string
          notification_id: string | null
          result: string
          sent_at: string | null
          status_code: number | null
          subscription_id: string | null
          user_id: string
        }
        Insert: {
          attempt?: number
          created_at?: string
          endpoint_hash?: string | null
          error_reason?: string | null
          id?: string
          notification_id?: string | null
          result: string
          sent_at?: string | null
          status_code?: number | null
          subscription_id?: string | null
          user_id: string
        }
        Update: {
          attempt?: number
          created_at?: string
          endpoint_hash?: string | null
          error_reason?: string | null
          id?: string
          notification_id?: string | null
          result?: string
          sent_at?: string | null
          status_code?: number | null
          subscription_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          active: boolean
          auth_key: string
          browser: string | null
          created_at: string
          endpoint: string
          id: string
          last_error_at: string | null
          last_error_status: number | null
          last_success_at: string | null
          p256dh: string
          platform: string | null
          revoked_at: string | null
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          active?: boolean
          auth_key: string
          browser?: string | null
          created_at?: string
          endpoint: string
          id?: string
          last_error_at?: string | null
          last_error_status?: number | null
          last_success_at?: string | null
          p256dh: string
          platform?: string | null
          revoked_at?: string | null
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          active?: boolean
          auth_key?: string
          browser?: string | null
          created_at?: string
          endpoint?: string
          id?: string
          last_error_at?: string | null
          last_error_status?: number | null
          last_success_at?: string | null
          p256dh?: string
          platform?: string | null
          revoked_at?: string | null
          updated_at?: string
          user_agent?: string | null
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
          base_amount: number | null
          case_id: string | null
          case_reference: string | null
          commission_reference: string | null
          created_at: string
          created_by_event: string | null
          currency: string
          id: string
          paid_at: string | null
          payment_reference: string | null
          payout_requested_at: string | null
          rate_source: string | null
          rate_used: number | null
          recipient_role: string | null
          referral_id: string | null
          reward_type: string
          source_user_id: string | null
          status: string
          unlock_at: string | null
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          amount?: number
          base_amount?: number | null
          case_id?: string | null
          case_reference?: string | null
          commission_reference?: string | null
          created_at?: string
          created_by_event?: string | null
          currency?: string
          id?: string
          paid_at?: string | null
          payment_reference?: string | null
          payout_requested_at?: string | null
          rate_source?: string | null
          rate_used?: number | null
          recipient_role?: string | null
          referral_id?: string | null
          reward_type?: string
          source_user_id?: string | null
          status?: string
          unlock_at?: string | null
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          amount?: number
          base_amount?: number | null
          case_id?: string | null
          case_reference?: string | null
          commission_reference?: string | null
          created_at?: string
          created_by_event?: string | null
          currency?: string
          id?: string
          paid_at?: string | null
          payment_reference?: string | null
          payout_requested_at?: string | null
          rate_source?: string | null
          rate_used?: number | null
          recipient_role?: string | null
          referral_id?: string | null
          reward_type?: string
          source_user_id?: string | null
          status?: string
          unlock_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rewards_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rewards_source_user_id_fkey"
            columns: ["source_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          created_at: string
          id: string
          permission_id: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          created_at?: string
          id?: string
          permission_id: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          created_at?: string
          id?: string
          permission_id?: string
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
        ]
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
      service_catalog: {
        Row: {
          accommodation_id: string | null
          allows_quantity: boolean
          category: string
          code: string | null
          commissionable: boolean
          created_at: string
          currency: string
          default_price: number
          default_quantity: number
          description_ar: string | null
          description_en: string | null
          id: string
          in_full_service: boolean
          is_active: boolean
          is_optional: boolean
          name_ar: string
          name_en: string
          pricing_model: string
          program_id: string | null
          school_id: string | null
          sort_order: number
          updated_at: string
          version: number
        }
        Insert: {
          accommodation_id?: string | null
          allows_quantity?: boolean
          category?: string
          code?: string | null
          commissionable?: boolean
          created_at?: string
          currency?: string
          default_price?: number
          default_quantity?: number
          description_ar?: string | null
          description_en?: string | null
          id?: string
          in_full_service?: boolean
          is_active?: boolean
          is_optional?: boolean
          name_ar: string
          name_en: string
          pricing_model?: string
          program_id?: string | null
          school_id?: string | null
          sort_order?: number
          updated_at?: string
          version?: number
        }
        Update: {
          accommodation_id?: string | null
          allows_quantity?: boolean
          category?: string
          code?: string | null
          commissionable?: boolean
          created_at?: string
          currency?: string
          default_price?: number
          default_quantity?: number
          description_ar?: string | null
          description_en?: string | null
          id?: string
          in_full_service?: boolean
          is_active?: boolean
          is_optional?: boolean
          name_ar?: string
          name_en?: string
          pricing_model?: string
          program_id?: string | null
          school_id?: string | null
          sort_order?: number
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "service_catalog_accommodation_id_fkey"
            columns: ["accommodation_id"]
            isOneToOne: false
            referencedRelation: "accommodations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_catalog_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_catalog_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
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
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
          scope: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
          scope?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
          scope?: string
        }
        Relationships: []
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
      user_invitations: {
        Row: {
          accepted_at: string | null
          accepted_user_id: string | null
          case_id: string | null
          created_at: string
          expires_at: string
          id: string
          intended_role: Database["public"]["Enums"]["app_role"]
          invitation_type: string
          invited_email: string
          invited_name: string | null
          inviter_id: string | null
          master_partner_id: string | null
          recruit_application_id: string | null
          status: string
          token_hash: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_user_id?: string | null
          case_id?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          intended_role: Database["public"]["Enums"]["app_role"]
          invitation_type: string
          invited_email: string
          invited_name?: string | null
          inviter_id?: string | null
          master_partner_id?: string | null
          recruit_application_id?: string | null
          status?: string
          token_hash: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_user_id?: string | null
          case_id?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          intended_role?: Database["public"]["Enums"]["app_role"]
          invitation_type?: string
          invited_email?: string
          invited_name?: string | null
          inviter_id?: string | null
          master_partner_id?: string | null
          recruit_application_id?: string | null
          status?: string
          token_hash?: string
          updated_at?: string
        }
        Relationships: []
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
      visa_field_values: {
        Row: {
          field_id: string
          id: string
          student_user_id: string
          updated_at: string
          value: string | null
        }
        Insert: {
          field_id: string
          id?: string
          student_user_id: string
          updated_at?: string
          value?: string | null
        }
        Update: {
          field_id?: string
          id?: string
          student_user_id?: string
          updated_at?: string
          value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "visa_field_values_field_id_fkey"
            columns: ["field_id"]
            isOneToOne: false
            referencedRelation: "visa_fields"
            referencedColumns: ["id"]
          },
        ]
      }
      visa_fields: {
        Row: {
          created_at: string
          display_order: number
          field_key: string
          field_type: string
          id: string
          is_active: boolean
          is_required: boolean
          label_ar: string
          label_en: string
          options_json: Json | null
        }
        Insert: {
          created_at?: string
          display_order?: number
          field_key: string
          field_type?: string
          id?: string
          is_active?: boolean
          is_required?: boolean
          label_ar: string
          label_en: string
          options_json?: Json | null
        }
        Update: {
          created_at?: string
          display_order?: number
          field_key?: string
          field_type?: string
          id?: string
          is_active?: boolean
          is_required?: boolean
          label_ar?: string
          label_en?: string
          options_json?: Json | null
        }
        Relationships: []
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
      admin_adjust_case_service: {
        Args: {
          p_case_service_id: string
          p_discount: number
          p_quantity: number
          p_reason: string
          p_unit_price: number
        }
        Returns: Json
      }
      admin_deactivate_account: {
        Args: { _reason?: string; _target_id: string }
        Returns: Json
      }
      admin_reactivate_account: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _target_id: string
        }
        Returns: Json
      }
      admin_respond_payout_request: {
        Args: {
          p_action: string
          p_note?: string
          p_request_id: string
          p_transaction_ref?: string
        }
        Returns: undefined
      }
      anonymize_user: { Args: { p_user_id: string }; Returns: undefined }
      approve_recruit_application: {
        Args: { p_id: string; p_user_id: string }
        Returns: undefined
      }
      assert_case_ready_for_enrollment: {
        Args: { p_case_id: string }
        Returns: Json
      }
      can_access_case_thread: {
        Args: { _case_id: string; _user_id: string }
        Returns: boolean
      }
      cancel_payout_request: {
        Args: { p_request_id: string }
        Returns: undefined
      }
      chat_sender_label: {
        Args: { _lang?: string; _sender: string; _viewer: string }
        Returns: string
      }
      check_identity_conflict: { Args: { _email: string }; Returns: Json }
      check_referral_code: {
        Args: { p_code: string }
        Returns: {
          owner_name: string
          valid: boolean
        }[]
      }
      clear_case_thread: { Args: { p_case_id: string }; Returns: number }
      clear_must_change_password: { Args: never; Returns: undefined }
      confirm_agency_service_fee: { Args: { p_case_id: string }; Returns: Json }
      confirm_agency_service_payment: {
        Args: { p_case_id: string }
        Returns: Json
      }
      confirm_case_payment: {
        Args: { p_payment_id: string }
        Returns: undefined
      }
      confirm_german_finance_item: {
        Args: {
          p_case_id: string
          p_finance_type: string
          p_note?: string
          p_proof_reference?: string
        }
        Returns: Json
      }
      confirm_payout_batch: {
        Args: {
          p_notes?: string
          p_payment_method?: string
          p_payout_request_id: string
          p_transaction_ref?: string
        }
        Returns: undefined
      }
      create_payout_batch: { Args: { p_reward_ids: string[] }; Returns: string }
      delete_chat_message: {
        Args: { p_kind: string; p_message_id: string }
        Returns: undefined
      }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      edit_case_message: {
        Args: { p_body: string; p_message_id: string }
        Returns: undefined
      }
      edit_direct_message: {
        Args: { p_body: string; p_message_id: string }
        Returns: undefined
      }
      email_queue_dispatch: { Args: never; Returns: undefined }
      emit_notification: {
        Args: {
          _actor_id: string
          _body_ar: string
          _body_en: string
          _case_id?: string
          _dedupe_key?: string
          _link?: string
          _source: string
          _title_ar: string
          _title_en: string
          _user_id: string
        }
        Returns: undefined
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      ensure_case_finance_confirmations: {
        Args: { p_case_id: string }
        Returns: undefined
      }
      ensure_master_recruit_link: {
        Args: never
        Returns: {
          code: string
          target_path: string
        }[]
      }
      fulfil_document_request: {
        Args: { p_attachment: Json; p_message_id: string }
        Returns: undefined
      }
      generate_referral_code: { Args: { p_full_name: string }; Returns: string }
      get_auth_failure_spikes: {
        Args: { p_threshold?: number; p_window?: string }
        Returns: {
          failure_count: number
          is_new: boolean
          last_seen: string
          source: string
          target: string
        }[]
      }
      get_case_darb_service_total: {
        Args: { p_case_id: string }
        Returns: number
      }
      get_case_financials: { Args: { p_case_id: string }; Returns: Json }
      get_document_activity_spikes: {
        Args: { p_threshold?: number; p_window?: string }
        Returns: {
          actor_id: string
          actor_name: string
          event_count: number
          last_seen: string
        }[]
      }
      get_effective_partner_split: {
        Args: { p_partner_id: string }
        Returns: {
          master_partner_id: string
          master_share: number
          offer_id: string
          offer_version: number
          partner_amount: number
          pool_amount: number
          responded_at: string
        }[]
      }
      get_forgotten_cases: {
        Args: never
        Returns: {
          archived: boolean
          archived_at: string | null
          assigned_to: string | null
          bagrut_score: number | null
          case_reference: string | null
          city: string | null
          commission_split_done: boolean
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
          influencer_commission: number
          intake_notes: string | null
          is_no_show: boolean
          last_activity_at: string
          lawyer_commission: number
          math_units: number | null
          origin: string | null
          partner_id: string | null
          partner_link_id: string | null
          passport_type: string | null
          phone_number: string
          platform_revenue_ils: number
          referral_discount: number
          referred_by: string | null
          school_commission: number
          source: string
          source_attribution_method: string | null
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
      get_invitation_preview: {
        Args: { p_token: string }
        Returns: {
          case_reference: string
          invitation_type: string
          invited_email: string
          masked_email: string
          recruiter_name: string
          state: string
        }[]
      }
      get_invoice_by_token: { Args: { p_token: string }; Returns: Json }
      get_monthly_tax_report: {
        Args: never
        Returns: {
          commissions_paid: number
          gross_collected: number
          month: string
          net_before_vat: number
          net_margin: number
          transactions_count: number
          vat_amount: number
        }[]
      }
      get_my_case: {
        Args: never
        Returns: {
          archived: boolean
          archived_at: string
          assigned_to: string
          bagrut_score: number
          case_reference: string
          city: string
          created_at: string
          created_by_team: boolean
          degree_interest: string
          education_level: string
          english_level: string
          english_units: number
          full_name: string
          id: string
          intake_notes: string
          is_no_show: boolean
          last_activity_at: string
          math_units: number
          origin: string
          partner_id: string
          partner_link_id: string
          passport_type: string
          phone_number: string
          referred_by: string
          source: string
          status: string
          student_user_id: string
          updated_at: string
        }[]
      }
      get_my_earnings_summary: { Args: never; Returns: Json }
      get_my_network: {
        Args: never
        Returns: {
          city: string
          email: string
          full_name: string
          joined_at: string
          override_earned: number
          paid_cases: number
          partner_id: string
          referral_code: string
          status: string
          students_count: number
        }[]
      }
      get_my_payout_preview: { Args: never; Returns: Json }
      get_my_permissions: { Args: never; Returns: string[] }
      get_my_rate_offers: {
        Args: never
        Returns: {
          id: string
          master_amount: number
          master_name: string
          master_partner_id: string
          note: string
          offered_at: string
          partner_amount: number
          partner_id: string
          partner_name: string
          pool_amount: number
          responded_at: string
          status: string
          version: number
        }[]
      }
      get_my_role: { Args: never; Returns: string }
      get_partner_pool_cases: {
        Args: { p_sources?: string[] }
        Returns: {
          created_at: string
          degree_interest: string
          education_level: string
          full_name: string
          id: string
          partner_id: string
          source: string
          status: string
        }[]
      }
      get_payout_request_detail: {
        Args: { p_request_id: string }
        Returns: Json
      }
      get_staff_directory: {
        Args: never
        Returns: {
          full_name: string
          id: string
          is_manager: boolean
          role: string
        }[]
      }
      get_thread_read_state: {
        Args: { p_id: string; p_kind: string }
        Returns: {
          full_name: string
          last_read_at: string
          user_id: string
        }[]
      }
      has_permission: {
        Args: { _permission: string; _user_id: string }
        Returns: boolean
      }
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
          p_ref_code?: string
          p_source_id?: string
          p_source_type?: string
        }
        Returns: undefined
      }
      is_direct_thread_member: {
        Args: { _thread_id: string; _user_id: string }
        Returns: boolean
      }
      issue_case_invoice: { Args: { p_case_id: string }; Returns: Json }
      list_partner_directory: {
        Args: never
        Returns: {
          available_amount: number
          city: string
          created_at: string
          earned_override: number
          earned_referral: number
          email: string
          full_name: string
          is_master_partner: boolean
          last_request_at: string
          locked_amount: number
          master_partner_name: string
          open_request_amount: number
          open_requests: number
          paid_amount: number
          partner_id: string
          phone_number: string
          recruited_count: number
          referral_code: string
          students_count: number
          total_earned: number
        }[]
      }
      list_payout_requests: {
        Args: never
        Returns: {
          admin_notes: string
          amount: number
          approved_at: string
          case_ids: string[]
          case_references: string[]
          id: string
          linked_reward_ids: string[]
          linked_student_names: string[]
          paid_at: string
          payment_method: string
          payout_reference: string
          reject_reason: string
          requested_at: string
          requestor_email: string
          requestor_id: string
          requestor_name: string
          requestor_role: string
          status: string
          thread_id: string
          transaction_ref: string
        }[]
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
      log_case_event: {
        Args: {
          p_case_id: string
          p_event_type: string
          p_is_internal?: boolean
          p_payload?: Json
        }
        Returns: undefined
      }
      log_document_access: {
        Args: { _action?: string; _document_id: string }
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
      mark_case_messages_read: {
        Args: { p_case_id: string }
        Returns: undefined
      }
      mark_direct_thread_read: {
        Args: { p_thread_id: string }
        Returns: undefined
      }
      mark_invoice_email: {
        Args: { p_error?: string; p_invoice_id: string; p_status: string }
        Returns: undefined
      }
      master_announce_to_network: { Args: { p_body: string }; Returns: number }
      master_send_rate_offer: {
        Args: {
          p_note?: string
          p_partner_amount: number
          p_partner_id: string
        }
        Returns: string
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      notification_category_for_source: {
        Args: { _source: string }
        Returns: string
      }
      partner_base_pool: { Args: { p_partner_id: string }; Returns: number }
      partner_respond_rate_offer: {
        Args: { p_accept: boolean; p_offer_id: string }
        Returns: undefined
      }
      profile_privileged_unchanged: {
        Args: {
          _commission_amount: number
          _deleted_at: string
          _iban_confirmed_at: string
          _id: string
          _is_manager: boolean
          _is_master_partner: boolean
          _master_partner_id: string
          _referral_code: string
          _referral_code_enabled: boolean
        }
        Returns: boolean
      }
      purge_expired_documents: {
        Args: { p_retention?: string }
        Returns: number
      }
      push_queue_dispatch: { Args: never; Returns: undefined }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      reassign_case: {
        Args: { p_case_id: string; p_new_assignee: string }
        Returns: undefined
      }
      record_case_commission: {
        Args: { p_case_id: string; p_total_payment_ils?: number }
        Returns: undefined
      }
      record_partner_click: {
        Args: { p_code: string; p_session_id: string; p_user_agent: string }
        Returns: undefined
      }
      reject_case_payment: {
        Args: { p_payment_id: string; p_reason?: string }
        Returns: undefined
      }
      reject_recruit_application: { Args: { p_id: string }; Returns: undefined }
      request_case_changes: {
        Args: { p_case_id: string; p_note: string }
        Returns: undefined
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
      request_payout_via_chat: { Args: { p_notes?: string }; Returns: Json }
      resolve_partner_link: {
        Args: { p_code: string }
        Returns: {
          is_master_partner: boolean
          link_id: string
          partner_id: string
          partner_name: string
          purpose: string
          target_path: string
        }[]
      }
      resolve_recruit_code: {
        Args: { p_code: string }
        Returns: {
          recruiter_name: string
          valid: boolean
        }[]
      }
      resolve_referral_code: { Args: { p_code: string }; Returns: string }
      resubmit_case_for_review: {
        Args: { p_case_id: string }
        Returns: undefined
      }
      review_case_payment_proof:
        | {
            Args: { p_action: string; p_proof_id: string; p_reason?: string }
            Returns: undefined
          }
        | {
            Args: {
              p_approved: boolean
              p_proof_id: string
              p_rejection_reason?: string
            }
            Returns: Json
          }
      search_cases_for_mention: {
        Args: { p_query: string }
        Returns: {
          case_reference: string
          full_name: string
          id: string
          status: string
        }[]
      }
      send_case_message: {
        Args: {
          p_attachments?: Json
          p_body: string
          p_case_id: string
          p_kind?: string
          p_mentions?: string[]
          p_visibility?: string
        }
        Returns: string
      }
      send_direct_message: {
        Args: {
          p_attachments?: Json
          p_body: string
          p_mentions?: string[]
          p_thread_id: string
        }
        Returns: string
      }
      set_case_services: {
        Args: { p_case_id: string; p_items: Json }
        Returns: Json
      }
      start_direct_thread: { Args: { p_other_user: string }; Returns: string }
      submit_case_for_review: { Args: { p_case_id: string }; Returns: Json }
      submit_case_payment: {
        Args: {
          p_amount: number
          p_case_id: string
          p_idem_key?: string
          p_note?: string
          p_payment_type?: string
        }
        Returns: string
      }
      submit_case_payment_proof:
        | {
            Args: {
              p_case_id: string
              p_file_path: string
              p_note?: string
              p_payment_type: string
            }
            Returns: Json
          }
        | {
            Args: { p_file_path: string; p_note?: string; p_payment_id: string }
            Returns: string
          }
      submit_recruit_application: {
        Args: {
          p_city?: string
          p_code: string
          p_email: string
          p_full_name: string
          p_note?: string
          p_phone: string
          p_social_link?: string
        }
        Returns: string
      }
      sync_case_school_payments: {
        Args: { p_case_id: string }
        Returns: undefined
      }
      team_can_view_student_role: {
        Args: { _student_user_id: string }
        Returns: boolean
      }
      validate_chat_attachments: { Args: { _att: Json }; Returns: Json }
    }
    Enums: {
      app_role:
        | "admin"
        | "team_member"
        | "social_media_partner"
        | "student"
        | "ambassador"
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
      app_role: [
        "admin",
        "team_member",
        "social_media_partner",
        "student",
        "ambassador",
      ],
    },
  },
} as const
