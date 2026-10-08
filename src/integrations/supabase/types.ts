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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      clips: {
        Row: {
          created_at: string
          end_seconds: number
          id: string
          project_id: string
          score: number
          start_seconds: number
          title: string
          user_id: string
          video_path: string | null
        }
        Insert: {
          created_at?: string
          end_seconds: number
          id?: string
          project_id: string
          score?: number
          start_seconds: number
          title: string
          user_id: string
          video_path?: string | null
        }
        Update: {
          created_at?: string
          end_seconds?: number
          id?: string
          project_id?: string
          score?: number
          start_seconds?: number
          title?: string
          user_id?: string
          video_path?: string | null
        }
        Relationships: []
      }
      exports: {
        Row: {
          id: string
          project_id: string
          clip_id: string
          user_id: string
          provider: string
          render_id: string | null
          output_path: string | null
          status: string
          output_url: string | null
          error_message: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          clip_id: string
          user_id: string
          provider?: string
          render_id?: string | null
          output_path?: string | null
          status?: string
          output_url?: string | null
          error_message?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          clip_id?: string
          user_id?: string
          provider?: string
          render_id?: string | null
          output_path?: string | null
          status?: string
          output_url?: string | null
          error_message?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      credit_ledger: {
        Row: {
          actor_id: string | null
          amount: number
          created_at: string
          id: string
          kind: string
          user_id: string
        }
        Insert: {
          actor_id?: string | null
          amount: number
          created_at?: string
          id?: string
          kind: string
          user_id: string
        }
        Update: {
          actor_id?: string | null
          amount?: number
          created_at?: string
          id?: string
          kind?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_ledger_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      transcripts: {
        Row: {
          created_at: string
          id: string
          language: string | null
          project_id: string
          text: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          language?: string | null
          project_id: string
          text?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          language?: string | null
          project_id?: string
          text?: string
          user_id?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          credits: number
          id: string
          status: string
          user_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          credits?: number
          id?: string
          status?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          credits?: number
          id?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          credit_balance: number | null
          display_name: string
          email: string
          id: string
          plan: string
          suspended: boolean
          unlimited_credits: boolean
        }
        Insert: {
          created_at?: string
          credit_balance?: number | null
          display_name?: string
          email?: string
          id: string
          plan?: string
          suspended?: boolean
          unlimited_credits?: boolean
        }
        Update: {
          created_at?: string
          credit_balance?: number | null
          display_name?: string
          email?: string
          id?: string
          plan?: string
          suspended?: boolean
          unlimited_credits?: boolean
        }
        Relationships: []
      }
      projects: {
        Row: {
          created_at: string
          cuts: number
          error_message: string | null
          id: string
          minutes: number
          progress: number
          status: string
          source_type: string
          source_url: string | null
          title: string
          user_id: string
          video_name: string | null
          video_path: string | null
          video_size: number | null
        }
        Insert: {
          created_at?: string
          cuts?: number
          error_message?: string | null
          id?: string
          minutes?: number
          progress?: number
          status?: string
          source_type?: string
          source_url?: string | null
          title: string
          user_id: string
          video_name?: string | null
          video_path?: string | null
          video_size?: number | null
        }
        Update: {
          created_at?: string
          cuts?: number
          error_message?: string | null
          id?: string
          minutes?: number
          progress?: number
          status?: string
          source_type?: string
          source_url?: string | null
          title?: string
          user_id?: string
          video_name?: string | null
          video_path?: string | null
          video_size?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_events: {
        Row: {
          api_calls: number
          created_at: string
          credits_used: number
          cuts: number
          error: string | null
          estimated_cost: number
          id: string
          minutes: number
          processing_seconds: number
          project_id: string | null
          user_id: string
          videos: number
        }
        Insert: {
          api_calls?: number
          created_at?: string
          credits_used?: number
          cuts?: number
          error?: string | null
          estimated_cost?: number
          id?: string
          minutes?: number
          processing_seconds?: number
          project_id?: string | null
          user_id: string
          videos?: number
        }
        Update: {
          api_calls?: number
          created_at?: string
          credits_used?: number
          cuts?: number
          error?: string | null
          estimated_cost?: number
          id?: string
          minutes?: number
          processing_seconds?: number
          project_id?: string | null
          user_id?: string
          videos?: number
        }
        Relationships: [
          {
            foreignKeyName: "usage_events_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usage_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
          role?: Database["public"]["Enums"]["app_role"]
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
      admin_update_user: {
        Args: {
          credit_delta?: number
          new_plan?: string
          new_suspended?: boolean
          target: string
        }
        Returns: undefined
      }
      assign_initial_owner: { Args: { target: string }; Returns: undefined }
      is_owner: { Args: never; Returns: boolean }
      reserve_processing_credits: {
        Args: { amount: number; target: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "owner_admin" | "user"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["owner_admin", "user"],
    },
  },
} as const
