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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      attorney_permissions: {
        Row: {
          can_create: boolean | null
          can_delete: boolean | null
          can_view: boolean | null
          created_at: string | null
          id: string
          practice_area_ids: string[] | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          can_create?: boolean | null
          can_delete?: boolean | null
          can_view?: boolean | null
          created_at?: string | null
          id?: string
          practice_area_ids?: string[] | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          can_create?: boolean | null
          can_delete?: boolean | null
          can_view?: boolean | null
          created_at?: string | null
          id?: string
          practice_area_ids?: string[] | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      blog_images: {
        Row: {
          caption: string | null
          created_at: string | null
          id: string
          image_url: string
          post_id: string
          sort_order: number | null
        }
        Insert: {
          caption?: string | null
          created_at?: string | null
          id?: string
          image_url: string
          post_id: string
          sort_order?: number | null
        }
        Update: {
          caption?: string | null
          created_at?: string | null
          id?: string
          image_url?: string
          post_id?: string
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "blog_images_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "blog_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_posts: {
        Row: {
          author_id: string | null
          category: string | null
          content: string | null
          created_at: string | null
          excerpt: string | null
          featured_image_url: string | null
          id: string
          meta_description: string | null
          published: boolean | null
          slug: string
          title: string
          updated_at: string | null
        }
        Insert: {
          author_id?: string | null
          category?: string | null
          content?: string | null
          created_at?: string | null
          excerpt?: string | null
          featured_image_url?: string | null
          id?: string
          meta_description?: string | null
          published?: boolean | null
          slug: string
          title: string
          updated_at?: string | null
        }
        Update: {
          author_id?: string | null
          category?: string | null
          content?: string | null
          created_at?: string | null
          excerpt?: string | null
          featured_image_url?: string | null
          id?: string
          meta_description?: string | null
          published?: boolean | null
          slug?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      client_portal_access: {
        Row: {
          active: boolean
          birthday_day: number | null
          birthday_month: number | null
          client_id: string
          created_at: string
          id: string
          nickname: string | null
          updated_at: string
          user_id: string
          username: string | null
        }
        Insert: {
          active?: boolean
          birthday_day?: number | null
          birthday_month?: number | null
          client_id: string
          created_at?: string
          id?: string
          nickname?: string | null
          updated_at?: string
          user_id: string
          username?: string | null
        }
        Update: {
          active?: boolean
          birthday_day?: number | null
          birthday_month?: number | null
          client_id?: string
          created_at?: string
          id?: string
          nickname?: string | null
          updated_at?: string
          user_id?: string
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_portal_access_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          address: string | null
          birth_date: string | null
          cep: string | null
          city: string | null
          cnpj: string | null
          contact_name: string | null
          contact_phone: string | null
          cpf: string | null
          created_at: string
          created_by: string | null
          education: string | null
          emails: Json
          father_name: string | null
          full_name: string
          group_name: string | null
          id: string
          lead_id: string | null
          marital_status: string | null
          mother_name: string | null
          nationality: string | null
          neighborhood: string | null
          notes: string | null
          person_type: string
          phones: Json
          pis: string | null
          profession: string | null
          profile_type: string | null
          rg: string | null
          social_name: string | null
          state: string | null
          state_registration: string | null
          trade_name: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          birth_date?: string | null
          cep?: string | null
          city?: string | null
          cnpj?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          cpf?: string | null
          created_at?: string
          created_by?: string | null
          education?: string | null
          emails?: Json
          father_name?: string | null
          full_name: string
          group_name?: string | null
          id?: string
          lead_id?: string | null
          marital_status?: string | null
          mother_name?: string | null
          nationality?: string | null
          neighborhood?: string | null
          notes?: string | null
          person_type?: string
          phones?: Json
          pis?: string | null
          profession?: string | null
          profile_type?: string | null
          rg?: string | null
          social_name?: string | null
          state?: string | null
          state_registration?: string | null
          trade_name?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          birth_date?: string | null
          cep?: string | null
          city?: string | null
          cnpj?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          cpf?: string | null
          created_at?: string
          created_by?: string | null
          education?: string | null
          emails?: Json
          father_name?: string | null
          full_name?: string
          group_name?: string | null
          id?: string
          lead_id?: string | null
          marital_status?: string | null
          mother_name?: string | null
          nationality?: string | null
          neighborhood?: string | null
          notes?: string | null
          person_type?: string
          phones?: Json
          pis?: string | null
          profession?: string | null
          profile_type?: string | null
          rg?: string | null
          social_name?: string | null
          state?: string | null
          state_registration?: string | null
          trade_name?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      contract_documents: {
        Row: {
          contract_id: string
          copies: number
          created_at: string
          document_type: string
          file_name: string | null
          file_url: string | null
          generated_by: string | null
          generated_html: string | null
          id: string
          template_name: string | null
        }
        Insert: {
          contract_id: string
          copies?: number
          created_at?: string
          document_type: string
          file_name?: string | null
          file_url?: string | null
          generated_by?: string | null
          generated_html?: string | null
          id?: string
          template_name?: string | null
        }
        Update: {
          contract_id?: string
          copies?: number
          created_at?: string
          document_type?: string
          file_name?: string | null
          file_url?: string | null
          generated_by?: string | null
          generated_html?: string | null
          id?: string
          template_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contract_documents_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_history: {
        Row: {
          action: string
          contract_id: string
          created_at: string
          description: string | null
          id: string
          metadata: Json | null
          performed_by: string | null
        }
        Insert: {
          action: string
          contract_id: string
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json | null
          performed_by?: string | null
        }
        Update: {
          action?: string
          contract_id?: string
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json | null
          performed_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contract_history_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      contracts: {
        Row: {
          additional_data: Json
          adverse_party: Json
          attorney_id: string | null
          client_id: string
          contract_number: string | null
          created_at: string
          created_by: string | null
          fees: Json
          id: string
          notes: string | null
          practice_area_id: string | null
          process_data: Json
          process_type: string | null
          status: string
          updated_at: string
        }
        Insert: {
          additional_data?: Json
          adverse_party?: Json
          attorney_id?: string | null
          client_id: string
          contract_number?: string | null
          created_at?: string
          created_by?: string | null
          fees?: Json
          id?: string
          notes?: string | null
          practice_area_id?: string | null
          process_data?: Json
          process_type?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          additional_data?: Json
          adverse_party?: Json
          attorney_id?: string | null
          client_id?: string
          contract_number?: string | null
          created_at?: string
          created_by?: string | null
          fees?: Json
          id?: string
          notes?: string | null
          practice_area_id?: string | null
          process_data?: Json
          process_type?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contracts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      featured_attorneys: {
        Row: {
          active: boolean
          created_at: string
          full_name: string
          id: string
          oab_number: string | null
          photo_url: string | null
          sort_order: number
          specialty: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          full_name: string
          id?: string
          oab_number?: string | null
          photo_url?: string | null
          sort_order?: number
          specialty?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          full_name?: string
          id?: string
          oab_number?: string | null
          photo_url?: string | null
          sort_order?: number
          specialty?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      kanban_stage_permissions: {
        Row: {
          can_act: boolean
          created_at: string
          id: string
          stage: string
          team_member_id: string
        }
        Insert: {
          can_act?: boolean
          created_at?: string
          id?: string
          stage: string
          team_member_id: string
        }
        Update: {
          can_act?: boolean
          created_at?: string
          id?: string
          stage?: string
          team_member_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kanban_stage_permissions_team_member_id_fkey"
            columns: ["team_member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_history: {
        Row: {
          action: string
          created_at: string | null
          description: string | null
          id: string
          lead_id: string
          performed_by: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          description?: string | null
          id?: string
          lead_id: string
          performed_by?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          description?: string | null
          id?: string
          lead_id?: string
          performed_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_history_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          assigned_attorney_id: string | null
          created_at: string | null
          email: string | null
          id: string
          kanban_status: string | null
          message: string | null
          name: string
          phone: string | null
          practice_area_id: string | null
          responsible_ids: string[]
          status: string
          updated_at: string | null
        }
        Insert: {
          assigned_attorney_id?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          kanban_status?: string | null
          message?: string | null
          name: string
          phone?: string | null
          practice_area_id?: string | null
          responsible_ids?: string[]
          status?: string
          updated_at?: string | null
        }
        Update: {
          assigned_attorney_id?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          kanban_status?: string | null
          message?: string | null
          name?: string
          phone?: string | null
          practice_area_id?: string | null
          responsible_ids?: string[]
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_practice_area_id_fkey"
            columns: ["practice_area_id"]
            isOneToOne: false
            referencedRelation: "practice_areas"
            referencedColumns: ["id"]
          },
        ]
      }
      practice_areas: {
        Row: {
          active: boolean | null
          content: string | null
          cover_image_url: string | null
          created_at: string | null
          cta_button_text: string | null
          description: string | null
          featured: boolean
          gallery: Json
          icon_color: string | null
          icon_name: string | null
          icon_svg: string | null
          id: string
          slug: string | null
          sort_order: number | null
          subtitle: string | null
          title: string
          updated_at: string | null
          whatsapp_message: string | null
          youtube_url: string | null
        }
        Insert: {
          active?: boolean | null
          content?: string | null
          cover_image_url?: string | null
          created_at?: string | null
          cta_button_text?: string | null
          description?: string | null
          featured?: boolean
          gallery?: Json
          icon_color?: string | null
          icon_name?: string | null
          icon_svg?: string | null
          id?: string
          slug?: string | null
          sort_order?: number | null
          subtitle?: string | null
          title: string
          updated_at?: string | null
          whatsapp_message?: string | null
          youtube_url?: string | null
        }
        Update: {
          active?: boolean | null
          content?: string | null
          cover_image_url?: string | null
          created_at?: string | null
          cta_button_text?: string | null
          description?: string | null
          featured?: boolean
          gallery?: Json
          icon_color?: string | null
          icon_name?: string | null
          icon_svg?: string | null
          id?: string
          slug?: string | null
          sort_order?: number | null
          subtitle?: string | null
          title?: string
          updated_at?: string | null
          whatsapp_message?: string | null
          youtube_url?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          full_name: string | null
          id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      site_settings: {
        Row: {
          id: string
          key: string
          updated_at: string | null
          value: string | null
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string | null
          value?: string | null
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string | null
          value?: string | null
        }
        Relationships: []
      }
      team_members: {
        Row: {
          active: boolean
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          phone: string | null
          role_title: string | null
          specialty: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          phone?: string | null
          role_title?: string | null
          specialty?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          phone?: string | null
          role_title?: string | null
          specialty?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
      can_act_on_stage: {
        Args: { _stage: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_lead_responsible: {
        Args: { _lead_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "super_admin" | "admin" | "attorney" | "team_member" | "client"
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
      app_role: ["super_admin", "admin", "attorney", "team_member", "client"],
    },
  },
} as const
