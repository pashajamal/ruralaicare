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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          actor_name: string | null
          actor_role: string | null
          created_at: string
          detail: string | null
          health_centre: string | null
          id: string
          patient_id: string | null
          visit_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_name?: string | null
          actor_role?: string | null
          created_at?: string
          detail?: string | null
          health_centre?: string | null
          id?: string
          patient_id?: string | null
          visit_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_name?: string | null
          actor_role?: string | null
          created_at?: string
          detail?: string | null
          health_centre?: string | null
          id?: string
          patient_id?: string | null
          visit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "visits"
            referencedColumns: ["id"]
          },
        ]
      }
      ayurvedic_protocols: {
        Row: {
          condition_name: string
          created_at: string
          id: string
          keywords: string[]
          remedy_text: string
          source_reference: string | null
        }
        Insert: {
          condition_name: string
          created_at?: string
          id?: string
          keywords?: string[]
          remedy_text: string
          source_reference?: string | null
        }
        Update: {
          condition_name?: string
          created_at?: string
          id?: string
          keywords?: string[]
          remedy_text?: string
          source_reference?: string | null
        }
        Relationships: []
      }
      care_plans: {
        Row: {
          created_at: string
          doctor_id: string | null
          follow_up_date: string | null
          health_centre: string
          id: string
          medication_instructions: string | null
          monitoring_days: number
          monitoring_instructions: string | null
          patient_id: string
          status: string
          updated_at: string
          visit_id: string
          watch_symptoms: Json
        }
        Insert: {
          created_at?: string
          doctor_id?: string | null
          follow_up_date?: string | null
          health_centre?: string
          id?: string
          medication_instructions?: string | null
          monitoring_days?: number
          monitoring_instructions?: string | null
          patient_id: string
          status?: string
          updated_at?: string
          visit_id: string
          watch_symptoms?: Json
        }
        Update: {
          created_at?: string
          doctor_id?: string | null
          follow_up_date?: string | null
          health_centre?: string
          id?: string
          medication_instructions?: string | null
          monitoring_days?: number
          monitoring_instructions?: string | null
          patient_id?: string
          status?: string
          updated_at?: string
          visit_id?: string
          watch_symptoms?: Json
        }
        Relationships: [
          {
            foreignKeyName: "care_plans_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "care_plans_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "visits"
            referencedColumns: ["id"]
          },
        ]
      }
      consultations: {
        Row: {
          assigned_doctor: string | null
          completed_at: string | null
          created_at: string
          ended_at: string | null
          health_centre: string
          health_worker_id: string | null
          id: string
          initiated_by: string | null
          notes: string | null
          patient_id: string
          priority: string
          started_at: string | null
          status: string
          type: string
          updated_at: string
          urgent_flag: boolean
          visit_id: string
        }
        Insert: {
          assigned_doctor?: string | null
          completed_at?: string | null
          created_at?: string
          ended_at?: string | null
          health_centre?: string
          health_worker_id?: string | null
          id?: string
          initiated_by?: string | null
          notes?: string | null
          patient_id: string
          priority?: string
          started_at?: string | null
          status?: string
          type?: string
          updated_at?: string
          urgent_flag?: boolean
          visit_id: string
        }
        Update: {
          assigned_doctor?: string | null
          completed_at?: string | null
          created_at?: string
          ended_at?: string | null
          health_centre?: string
          health_worker_id?: string | null
          id?: string
          initiated_by?: string | null
          notes?: string | null
          patient_id?: string
          priority?: string
          started_at?: string | null
          status?: string
          type?: string
          updated_at?: string
          urgent_flag?: boolean
          visit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "consultations_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultations_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "visits"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_tracker_entries: {
        Row: {
          care_plan_id: string | null
          created_at: string
          entry_date: string
          escalation_flag: boolean
          health_centre: string
          id: string
          logged_by: string | null
          note: string | null
          patient_id: string
          pulse: number | null
          severity_score: number
          spo2: number | null
          temperature: number | null
        }
        Insert: {
          care_plan_id?: string | null
          created_at?: string
          entry_date?: string
          escalation_flag?: boolean
          health_centre?: string
          id?: string
          logged_by?: string | null
          note?: string | null
          patient_id: string
          pulse?: number | null
          severity_score?: number
          spo2?: number | null
          temperature?: number | null
        }
        Update: {
          care_plan_id?: string | null
          created_at?: string
          entry_date?: string
          escalation_flag?: boolean
          health_centre?: string
          id?: string
          logged_by?: string | null
          note?: string | null
          patient_id?: string
          pulse?: number | null
          severity_score?: number
          spo2?: number | null
          temperature?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_tracker_entries_care_plan_id_fkey"
            columns: ["care_plan_id"]
            isOneToOne: false
            referencedRelation: "care_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_tracker_entries_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      escalations: {
        Row: {
          care_plan_id: string | null
          created_at: string
          daily_tracker_entry_id: string | null
          health_centre: string
          id: string
          patient_id: string
          reason: string
          status: string
          tier: string
          updated_at: string
          visit_id: string | null
        }
        Insert: {
          care_plan_id?: string | null
          created_at?: string
          daily_tracker_entry_id?: string | null
          health_centre?: string
          id?: string
          patient_id: string
          reason: string
          status?: string
          tier?: string
          updated_at?: string
          visit_id?: string | null
        }
        Update: {
          care_plan_id?: string | null
          created_at?: string
          daily_tracker_entry_id?: string | null
          health_centre?: string
          id?: string
          patient_id?: string
          reason?: string
          status?: string
          tier?: string
          updated_at?: string
          visit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "escalations_care_plan_id_fkey"
            columns: ["care_plan_id"]
            isOneToOne: false
            referencedRelation: "care_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escalations_daily_tracker_entry_id_fkey"
            columns: ["daily_tracker_entry_id"]
            isOneToOne: false
            referencedRelation: "daily_tracker_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escalations_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escalations_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "visits"
            referencedColumns: ["id"]
          },
        ]
      }
      first_aid_protocols: {
        Row: {
          condition_name: string
          created_at: string
          id: string
          keywords: string[]
          otc_medicine: string | null
          protocol_text: string
        }
        Insert: {
          condition_name: string
          created_at?: string
          id?: string
          keywords?: string[]
          otc_medicine?: string | null
          protocol_text: string
        }
        Update: {
          condition_name?: string
          created_at?: string
          id?: string
          keywords?: string[]
          otc_medicine?: string | null
          protocol_text?: string
        }
        Relationships: []
      }
      follow_ups: {
        Row: {
          created_at: string
          created_by: string | null
          due_date: string
          health_centre: string
          id: string
          instructions: string | null
          patient_id: string
          priority: string
          reason: string | null
          status: string
          updated_at: string
          visit_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          due_date: string
          health_centre?: string
          id?: string
          instructions?: string | null
          patient_id: string
          priority?: string
          reason?: string | null
          status?: string
          updated_at?: string
          visit_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          due_date?: string
          health_centre?: string
          id?: string
          instructions?: string | null
          patient_id?: string
          priority?: string
          reason?: string | null
          status?: string
          updated_at?: string
          visit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "follow_ups_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follow_ups_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "visits"
            referencedColumns: ["id"]
          },
        ]
      }
      hospitals: {
        Row: {
          address: string | null
          created_at: string
          id: string
          latitude: number
          longitude: number
          name: string
          phone: string | null
          specialty_tags: Json
        }
        Insert: {
          address?: string | null
          created_at?: string
          id?: string
          latitude: number
          longitude: number
          name: string
          phone?: string | null
          specialty_tags?: Json
        }
        Update: {
          address?: string | null
          created_at?: string
          id?: string
          latitude?: number
          longitude?: number
          name?: string
          phone?: string | null
          specialty_tags?: Json
        }
        Relationships: []
      }
      knowledge_base: {
        Row: {
          content: string
          created_at: string
          embedding: string
          id: string
          metadata: Json
          source_type: string
        }
        Insert: {
          content: string
          created_at?: string
          embedding: string
          id?: string
          metadata?: Json
          source_type: string
        }
        Update: {
          content?: string
          created_at?: string
          embedding?: string
          id?: string
          metadata?: Json
          source_type?: string
        }
        Relationships: []
      }
      medicine_inventory: {
        Row: {
          created_at: string
          expiry_date: string | null
          health_centre: string
          id: string
          medicine_name: string
          quantity: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          expiry_date?: string | null
          health_centre?: string
          id?: string
          medicine_name: string
          quantity?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          expiry_date?: string | null
          health_centre?: string
          id?: string
          medicine_name?: string
          quantity?: number
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          audience: string
          body: string | null
          created_at: string
          health_centre: string | null
          id: string
          kind: string
          read_at: string | null
          title: string
          user_id: string | null
          visit_id: string | null
        }
        Insert: {
          audience?: string
          body?: string | null
          created_at?: string
          health_centre?: string | null
          id?: string
          kind?: string
          read_at?: string | null
          title: string
          user_id?: string | null
          visit_id?: string | null
        }
        Update: {
          audience?: string
          body?: string | null
          created_at?: string
          health_centre?: string | null
          id?: string
          kind?: string
          read_at?: string | null
          title?: string
          user_id?: string | null
          visit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "visits"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_conditions: {
        Row: {
          condition_name: string
          created_at: string
          diagnosed_note: string | null
          health_centre: string
          id: string
          medication_name: string | null
          on_medication: boolean
          patient_id: string
          updated_at: string
        }
        Insert: {
          condition_name: string
          created_at?: string
          diagnosed_note?: string | null
          health_centre?: string
          id?: string
          medication_name?: string | null
          on_medication?: boolean
          patient_id: string
          updated_at?: string
        }
        Update: {
          condition_name?: string
          created_at?: string
          diagnosed_note?: string | null
          health_centre?: string
          id?: string
          medication_name?: string | null
          on_medication?: boolean
          patient_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_conditions_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      patients: {
        Row: {
          age: number
          contact: string | null
          created_at: string
          created_by: string | null
          health_centre: string
          id: string
          location: string | null
          mobile_number: string
          name: string
          preferred_language: string
          sex: string | null
        }
        Insert: {
          age: number
          contact?: string | null
          created_at?: string
          created_by?: string | null
          health_centre?: string
          id?: string
          location?: string | null
          mobile_number: string
          name: string
          preferred_language?: string
          sex?: string | null
        }
        Update: {
          age?: number
          contact?: string | null
          created_at?: string
          created_by?: string | null
          health_centre?: string
          id?: string
          location?: string | null
          mobile_number?: string
          name?: string
          preferred_language?: string
          sex?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string
          health_centre: string
          id: string
          notify_consultation: boolean
          notify_followup: boolean
          notify_red: boolean
          preferred_patient_language: string
          ui_language: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          full_name?: string
          health_centre?: string
          id: string
          notify_consultation?: boolean
          notify_followup?: boolean
          notify_red?: boolean
          preferred_patient_language?: string
          ui_language?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_name?: string
          health_centre?: string
          id?: string
          notify_consultation?: boolean
          notify_followup?: boolean
          notify_red?: boolean
          preferred_patient_language?: string
          ui_language?: string
          updated_at?: string
        }
        Relationships: []
      }
      referrals: {
        Row: {
          created_at: string
          doctor_id: string | null
          facility: string | null
          health_centre: string
          id: string
          notes: string | null
          patient_id: string
          reason: string
          risk_tier: string | null
          status: string
          updated_at: string
          visit_id: string
        }
        Insert: {
          created_at?: string
          doctor_id?: string | null
          facility?: string | null
          health_centre?: string
          id?: string
          notes?: string | null
          patient_id: string
          reason: string
          risk_tier?: string | null
          status?: string
          updated_at?: string
          visit_id: string
        }
        Update: {
          created_at?: string
          doctor_id?: string | null
          facility?: string | null
          health_centre?: string
          id?: string
          notes?: string | null
          patient_id?: string
          reason?: string
          risk_tier?: string | null
          status?: string
          updated_at?: string
          visit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "referrals_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "visits"
            referencedColumns: ["id"]
          },
        ]
      }
      reminders: {
        Row: {
          care_plan_id: string | null
          created_at: string
          due_date: string
          health_centre: string
          id: string
          patient_id: string
          status: string
          type: string
        }
        Insert: {
          care_plan_id?: string | null
          created_at?: string
          due_date: string
          health_centre?: string
          id?: string
          patient_id: string
          status?: string
          type?: string
        }
        Update: {
          care_plan_id?: string | null
          created_at?: string
          due_date?: string
          health_centre?: string
          id?: string
          patient_id?: string
          status?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "reminders_care_plan_id_fkey"
            columns: ["care_plan_id"]
            isOneToOne: false
            referencedRelation: "care_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminders_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
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
      visit_messages: {
        Row: {
          body: string
          consultation_id: string | null
          created_at: string
          health_centre: string
          id: string
          sender_id: string | null
          sender_name: string
          sender_role: string
          visit_id: string
        }
        Insert: {
          body: string
          consultation_id?: string | null
          created_at?: string
          health_centre: string
          id?: string
          sender_id?: string | null
          sender_name: string
          sender_role: string
          visit_id: string
        }
        Update: {
          body?: string
          consultation_id?: string | null
          created_at?: string
          health_centre?: string
          id?: string
          sender_id?: string | null
          sender_name?: string
          sender_role?: string
          visit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "visit_messages_consultation_id_fkey"
            columns: ["consultation_id"]
            isOneToOne: false
            referencedRelation: "consultations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visit_messages_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "visits"
            referencedColumns: ["id"]
          },
        ]
      }
      visits: {
        Row: {
          ai_status: string
          assigned_doctor: string | null
          ayurvedic_condition: string | null
          ayurvedic_remedy: string | null
          ayurvedic_source: string | null
          chronic_conditions: Json | null
          confirmation_message: string | null
          created_at: string
          created_by: string | null
          doctor_decision: string | null
          doctor_notes: string | null
          drug_safety_info: Json | null
          duration: string | null
          emergency_acknowledged: boolean
          finalized_at: string | null
          health_centre: string
          history_text: string | null
          hospital_specialty_tag: string | null
          id: string
          image_analysis: string | null
          image_url: string | null
          patient_id: string
          pregnancy_status: Json | null
          preliminary_assessment: string | null
          protocol_text: string | null
          referral_required: boolean
          risk_tier: string | null
          status: string
          structured_summary: Json | null
          symptoms_text: string
          triggering_rules: Json | null
          updated_at: string
          vitals: Json
        }
        Insert: {
          ai_status?: string
          assigned_doctor?: string | null
          ayurvedic_condition?: string | null
          ayurvedic_remedy?: string | null
          ayurvedic_source?: string | null
          chronic_conditions?: Json | null
          confirmation_message?: string | null
          created_at?: string
          created_by?: string | null
          doctor_decision?: string | null
          doctor_notes?: string | null
          drug_safety_info?: Json | null
          duration?: string | null
          emergency_acknowledged?: boolean
          finalized_at?: string | null
          health_centre?: string
          history_text?: string | null
          hospital_specialty_tag?: string | null
          id?: string
          image_analysis?: string | null
          image_url?: string | null
          patient_id: string
          pregnancy_status?: Json | null
          preliminary_assessment?: string | null
          protocol_text?: string | null
          referral_required?: boolean
          risk_tier?: string | null
          status?: string
          structured_summary?: Json | null
          symptoms_text: string
          triggering_rules?: Json | null
          updated_at?: string
          vitals?: Json
        }
        Update: {
          ai_status?: string
          assigned_doctor?: string | null
          ayurvedic_condition?: string | null
          ayurvedic_remedy?: string | null
          ayurvedic_source?: string | null
          chronic_conditions?: Json | null
          confirmation_message?: string | null
          created_at?: string
          created_by?: string | null
          doctor_decision?: string | null
          doctor_notes?: string | null
          drug_safety_info?: Json | null
          duration?: string | null
          emergency_acknowledged?: boolean
          finalized_at?: string | null
          health_centre?: string
          history_text?: string | null
          hospital_specialty_tag?: string | null
          id?: string
          image_analysis?: string | null
          image_url?: string | null
          patient_id?: string
          pregnancy_status?: Json | null
          preliminary_assessment?: string | null
          protocol_text?: string | null
          referral_required?: boolean
          risk_tier?: string | null
          status?: string
          structured_summary?: Json | null
          symptoms_text?: string
          triggering_rules?: Json | null
          updated_at?: string
          vitals?: Json
        }
        Relationships: [
          {
            foreignKeyName: "visits_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
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
      is_doctor: { Args: never; Returns: boolean }
      match_knowledge_base: {
        Args: {
          filter_source_type?: string
          match_count: number
          query_embedding: string
        }
        Returns: {
          content: string
          created_at: string
          embedding: string
          id: string
          metadata: Json
          similarity: number
          source_type: string
        }[]
      }
      my_centre: { Args: never; Returns: string }
    }
    Enums: {
      app_role: "health_worker" | "doctor" | "admin"
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
      app_role: ["health_worker", "doctor", "admin"],
    },
  },
} as const
